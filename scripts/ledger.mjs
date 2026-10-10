#!/usr/bin/env node
// Community review ledger CLI. See GOVERNANCE.md.
//
//   npm run ledger -- verify [ledger.jsonl]
//   npm run ledger -- inspect <plugin-slug>
//   npm run ledger -- approve <plugin-or-source-slug>... --by <login> [--note "..."]
//   npm run ledger -- revoke <plugin-slug>... --by <login> --reason "..." [--all-versions]
//   npm run ledger -- add-source <index-url> --by <login> [--note "..."]
//   npm run ledger -- remove-source <index-url | source-slug> --by <login> --reason "..."
//   npm run ledger -- add-reviewer <login> --by <login> [--note "..."]
//   npm run ledger -- remove-reviewer <login> --by <login> --reason "..."
//   npm run ledger -- check-prs [--pr <n>] [--dry-run] [--base <ref>]
//                     (CI: count votes, post a commit status; --base overrides the base branch for local testing)
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { extractZipEntry, readZipEntries } from './lib/zip.mjs';
import { parseIndex } from './lib/parse.mjs';
import {
  classifyChange,
  LEDGER_PATH,
  parseLedger,
  sealEntry,
  serializeEntry,
  sourceOwners,
  tally,
  verifyLedger,
} from './lib/ledger.mjs';

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LEDGER_FILE = path.join(ROOT, LEDGER_PATH);
const GOVERNANCE_FILE = path.join(ROOT, 'registry/governance.json');
const CATALOG_FILE = path.join(ROOT, 'src/data/catalog.json');
const STATUS_CONTEXT = 'community-quorum';
const ZIP_LIMIT = 50_000_000;

const log = (...a) => console.error(...a);
const die = (msg) => {
  log(`✗ ${msg}`);
  process.exit(1);
};

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    by: { type: 'string', ...(process.env.LEDGER_BY ? { default: process.env.LEDGER_BY } : {}) },
    note: { type: 'string' },
    reason: { type: 'string' },
    'all-versions': { type: 'boolean' },
    pr: { type: 'string' },
    'dry-run': { type: 'boolean' },
    base: { type: 'string' },
  },
});
const [command, ...args] = positionals;

async function loadLedger() {
  return parseLedger(await readFile(LEDGER_FILE, 'utf8'));
}

async function loadCatalog() {
  return JSON.parse(await readFile(CATALOG_FILE, 'utf8'));
}

async function fetchIndex(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'stashplugins-ledger' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return parseIndex(await res.text());
}

/** Verify, seal and append one entry. Refuses to write anything the verifier would reject. */
async function append(fields) {
  if (!opts.by) die('pass --by <your GitHub login> (or set LEDGER_BY)');
  const entries = await loadLedger();
  const before = verifyLedger(entries);
  if (!before.ok) die(`the ledger is already invalid:\n  ${before.errors.join('\n  ')}`);
  const entry = sealEntry(entries, { at: new Date().toISOString(), by: opts.by, ...fields });
  const after = verifyLedger([...entries, entry]);
  if (!after.ok) die(after.errors.join('\n'));
  await appendFile(LEDGER_FILE, serializeEntry(entry));
  log(`✓ appended entry ${entry.seq} (${entry.type}) ${entry.hash.slice(0, 12)}`);
  log('  Commit registry/ledger.jsonl and open a pull request; reviewers vote by approving it.');
}

/** Resolve slugs to { source, packages[] } groups, one per source. */
function resolveSlugs(catalog, slugs) {
  const groups = new Map();
  for (const slug of slugs) {
    const plugin = catalog.plugins.find((p) => p.slug === slug);
    const source = catalog.sources.find((s) => s.slug === slug);
    const picked = plugin ? [plugin] : source ? catalog.plugins.filter((p) => p.source === source.slug) : die(`no plugin or source with slug "${slug}"`);
    for (const p of picked) {
      const g = groups.get(p.sourceUrl) ?? { source: p.sourceUrl, ids: [] };
      if (!g.ids.includes(p.id)) g.ids.push(p.id);
      groups.set(p.sourceUrl, g);
    }
  }
  return [...groups.values()];
}

async function cmdApprove() {
  if (!args.length) die('usage: approve <plugin-or-source-slug>... --by <login>');
  const catalog = await loadCatalog();
  for (const g of resolveSlugs(catalog, args)) {
    // Pin what Stash would install right now, not what the last crawl saw.
    const live = await fetchIndex(g.source);
    const packages = g.ids.map((id) => {
      const p = live.find((x) => x.id.toLowerCase() === id.toLowerCase());
      if (!p) die(`${id} is no longer in ${g.source}`);
      if (!p.sha256) die(`${id} has no sha256 in its index, so a version cannot be pinned`);
      log(`  ${p.id} ${p.version ?? ''} sha256:${p.sha256}`);
      return { id: p.id, version: p.version, sha256: p.sha256.toLowerCase() };
    });
    await append({ type: 'approve', source: g.source, packages, note: opts.note });
  }
}

async function cmdRevoke() {
  if (!args.length || !opts.reason) die('usage: revoke <plugin-slug>... --by <login> --reason "..." [--all-versions]');
  const catalog = await loadCatalog();
  for (const g of resolveSlugs(catalog, args)) {
    let packages = g.ids.map((id) => ({ id }));
    if (!opts['all-versions']) {
      const live = await fetchIndex(g.source);
      packages = g.ids.map((id) => {
        const p = live.find((x) => x.id.toLowerCase() === id.toLowerCase());
        if (!p?.sha256) die(`${id}: no current sha256 to revoke; use --all-versions`);
        return { id: p.id, version: p.version, sha256: p.sha256.toLowerCase() };
      });
    }
    await append({ type: 'revoke', source: g.source, packages, reason: opts.reason });
  }
}

async function cmdSource(type) {
  let [url] = args;
  if (!url) die(`usage: ${type} <index-url> --by <login>`);
  if (!/^https:/.test(url)) {
    const s = (await loadCatalog()).sources.find((x) => x.slug === url);
    if (!s) die(`no source with slug "${url}"`);
    url = s.url;
  }
  if (type === 'add-source') {
    const pkgs = await fetchIndex(url);
    log(`  ${url} lists ${pkgs.length} package${pkgs.length === 1 ? '' : 's'}`);
    await append({ type, source: url, note: opts.note });
  } else {
    if (!opts.reason) die('remove-source needs --reason');
    await append({ type, source: url, reason: opts.reason });
  }
}

async function cmdReviewer(type) {
  const [login] = args;
  if (!login) die(`usage: ${type} <login> --by <login>`);
  if (type === 'remove-reviewer' && !opts.reason) die('remove-reviewer needs --reason');
  await append({ type, login, note: opts.note, reason: opts.reason });
}

async function cmdVerify() {
  const entries = args[0] ? parseLedger(await readFile(path.resolve(args[0]), 'utf8')) : await loadLedger();
  const { ok, errors, state, head } = verifyLedger(entries);
  if (!ok) die(`ledger is invalid:\n  ${errors.join('\n  ')}`);
  const approved = [...state.approvals.values()].length;
  log(`✓ ledger ok, head ${head}`);
  log(`  ${state.reviewers.size} reviewers, ${approved} approved packages, ${state.revocations.size} revoked, ${state.removedSources.size} removed sources`);
}

/** Download a package zip, check it against the index sha256 and unpack it for review. */
async function cmdInspect() {
  const [slug] = args;
  const catalog = await loadCatalog();
  const p = catalog.plugins.find((x) => x.slug === slug) ?? die(`no plugin with slug "${slug}"`);
  const live = (await fetchIndex(p.sourceUrl)).find((x) => x.id === p.id) ?? die(`${p.id} is no longer in ${p.sourceUrl}`);
  const url = new URL(live.path, p.sourceUrl).href;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) die(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > ZIP_LIMIT) die('zip is larger than 50 MB');
  const sha = createHash('sha256').update(buf).digest('hex');
  const match = live.sha256 && sha === live.sha256.toLowerCase();
  const dir = path.join(ROOT, '.cache/review', slug, sha.slice(0, 12));
  for (const e of readZipEntries(buf)) {
    if (e.name.endsWith('/')) continue;
    const out = path.resolve(dir, e.name);
    if (!out.startsWith(dir + path.sep)) die(`zip entry escapes the folder: ${e.name}`);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, extractZipEntry(buf, e));
    log(`  ${e.name}`);
  }
  log(`\n${p.name} ${live.version ?? ''}`);
  log(`  zip      ${url}`);
  log(`  sha256   ${sha}`);
  log(`  index    ${live.sha256 ?? '(none)'} ${match ? '✓ matches' : '✗ DOES NOT MATCH: Stash will refuse this zip'}`);
  log(`  unpacked ${path.relative(process.cwd(), dir)}`);
  log(`\nRead every file. If it is safe: npm run ledger -- approve ${slug} --by <you>`);
}

// ---- CI: count votes on open pull requests ---------------------------------

const gh = {
  repo: process.env.GITHUB_REPOSITORY,
  token: process.env.GITHUB_TOKEN,
  async req(pathname, init = {}) {
    const res = await fetch(`https://api.github.com${pathname}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${this.token}`,
        'x-github-api-version': '2022-11-28',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`GitHub ${init.method ?? 'GET'} ${pathname}: HTTP ${res.status} ${await res.text()}`);
    return res;
  },
  async json(pathname) {
    return (await this.req(pathname)).json();
  },
  async all(pathname) {
    const out = [];
    for (let page = 1; page <= 20; page++) {
      const batch = await this.json(`${pathname}${pathname.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      out.push(...batch);
      if (batch.length < 100) break;
    }
    return out;
  },
};

async function git(...a) {
  return (await exec('git', a, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })).stdout;
}

/** File contents at a ref, or '' when it doesn't exist there. Never checks out or runs PR code. */
async function showFile(ref, p) {
  try {
    return await git('show', `${ref}:${p}`);
  } catch {
    return '';
  }
}

const accountCache = new Map();
async function accounts(logins) {
  for (const l of logins) {
    const k = l.toLowerCase();
    if (accountCache.has(k)) continue;
    // A failed lookup must not quietly shrink the reviewer pool (and with it the
    // quorum), so only a deleted account (404) is treated as unable to vote.
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(l)}`, {
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${gh.token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 404) accountCache.set(k, {});
    else if (!res.ok) throw new Error(`GitHub user lookup for ${l} failed: HTTP ${res.status}`);
    else accountCache.set(k, { createdAt: (await res.json()).created_at });
  }
  return accountCache;
}

async function evaluate(pr) {
  const author = pr.user.login;
  const errors = [];
  const warnings = [];

  await git('fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/${pr.base.ref}:refs/quorum/base`, `+refs/pull/${pr.number}/head:refs/quorum/head`);
  const head = 'refs/quorum/head';
  const headSha = (await git('rev-parse', head)).trim();
  if (headSha !== pr.head.sha) warnings.push('the pull request moved while it was being checked');

  // Rules come from the base branch, never from the pull request.
  const baseRef = opts.base ?? 'refs/quorum/base';
  const governanceText = await showFile(baseRef, 'registry/governance.json');
  if (!governanceText) throw new Error(`${pr.base.ref} has no registry/governance.json yet`);
  const governance = JSON.parse(governanceText);
  const baseText = await showFile(baseRef, LEDGER_PATH);
  const base = verifyLedger(parseLedger(baseText));
  if (!base.ok) errors.push(`the base ledger is invalid: ${base.errors[0]}`);

  const files = (await gh.all(`/repos/${gh.repo}/pulls/${pr.number}/files`)).flatMap((f) => [f.filename, f.previous_filename].filter(Boolean));
  const headText = files.includes(LEDGER_PATH) ? await showFile(head, LEDGER_PATH) : baseText;
  const change = classifyChange({ files, baseText, headText });
  errors.push(...change.errors);

  const conflicted = new Set();
  if (change.newEntries.length) {
    const full = verifyLedger(parseLedger(headText));
    errors.push(...full.errors);
    const max = governance.proposer?.maxEntriesPerPullRequest ?? 10;
    if (change.newEntries.length > max) errors.push(`at most ${max} ledger entries per pull request`);
    for (const e of change.newEntries) {
      if (String(e.by).toLowerCase() !== author.toLowerCase()) errors.push(`entry ${e.seq} is signed "by": "${e.by}" but the pull request is from ${author}`);
      if (e.type === 'approve' || e.type === 'revoke' || e.type === 'add-source') {
        for (const o of sourceOwners(e.source)) conflicted.add(o);
      }
      if (e.type === 'approve' || e.type === 'add-source') {
        try {
          const live = await fetchIndex(e.source);
          for (const p of e.packages ?? []) {
            const cur = live.find((x) => x.id.toLowerCase() === p.id.toLowerCase());
            if (!cur) errors.push(`${p.id} is not in ${e.source}`);
            else if (cur.sha256?.toLowerCase() !== p.sha256) warnings.push(`${p.id} changed since it was pinned; the approval will show as "changed since review"`);
          }
        } catch (err) {
          warnings.push(`could not read ${e.source}: ${err.message}`);
        }
      }
    }
  }

  const reviews = await gh.all(`/repos/${gh.repo}/pulls/${pr.number}/reviews`);
  const logins = new Set([author, ...[...base.state.reviewers.values()].map((r) => r.login), ...reviews.map((r) => r.user?.login).filter(Boolean)]);
  const acct = await accounts(logins);

  const proposerAge = governance.proposer?.minAccountAgeDays ?? 0;
  const authorCreated = acct.get(author.toLowerCase())?.createdAt;
  if (!base.state.reviewers.has(author.toLowerCase()) && (!authorCreated || Date.now() - Date.parse(authorCreated) < proposerAge * 86_400_000)) {
    errors.push(`accounts younger than ${proposerAge} days cannot open proposals (anti-spam)`);
  }

  const t = tally({
    governance,
    reviewerState: base.state,
    author,
    headSha,
    reviews,
    accounts: acct,
    kinds: change.kinds,
    conflicted: [...conflicted],
  });

  let state = errors.length ? 'failure' : t.state;
  if (pr.draft && state === 'success') state = 'pending';
  const description = errors.length
    ? errors[0]
    : t.vetoes.length && t.state === 'failure'
      ? `Changes requested by ${t.vetoes.join(', ')}`
      : t.required === 0
        ? `No approvals required: no other eligible reviewers yet${pr.draft ? ' (draft)' : ''}`
        : `${t.approvers.length}/${t.required} approvals from verified reviewers${pr.draft ? ' (draft)' : ''}`;
  return { pr, headSha, state, description: description.slice(0, 139), errors, warnings, tally: t, kinds: change.kinds, entries: change.newEntries };
}

function report(r) {
  const lines = [
    `### #${r.pr.number} ${r.pr.title}`,
    `**${r.state}**: ${r.description}`,
    `- Changes: ${r.kinds.join(', ') || 'none'}`,
    `- Approvals needed: ${r.tally.required}${r.tally.required !== r.tally.configured ? ` (configured ${r.tally.configured})` : ''}`,
    `- Counted: ${r.tally.approvers.join(', ') || 'none'}`,
  ];
  if (r.tally.vetoes.length) lines.push(`- Changes requested: ${r.tally.vetoes.join(', ')}`);
  for (const i of r.tally.ignored) lines.push(`- Not counted: ${i.login} (${i.why})`);
  for (const n of r.tally.notes) lines.push(`- Note: ${n}`);
  for (const e of r.errors) lines.push(`- ✗ ${e}`);
  for (const w of r.warnings) lines.push(`- ⚠ ${w}`);
  for (const e of r.entries) lines.push(`- Entry ${e.seq}: \`${e.type}\` ${e.source ?? e.login ?? ''} ${(e.packages ?? []).map((p) => p.id).join(', ')}`);
  return lines.join('\n');
}

async function cmdCheckPrs() {
  if (!gh.repo || !gh.token) die('check-prs needs GITHUB_REPOSITORY and GITHUB_TOKEN');
  const prs = opts.pr ? [await gh.json(`/repos/${gh.repo}/pulls/${opts.pr}`)] : await gh.all(`/repos/${gh.repo}/pulls?state=open`);
  const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${gh.repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;
  const summary = [];
  let failed = 0;
  for (const pr of prs) {
    if (pr.state !== 'open' && !opts.pr) continue;
    let r;
    try {
      r = await evaluate(pr);
    } catch (e) {
      failed++;
      log(`✗ #${pr.number}: ${e.message}`);
      continue;
    }
    const text = report(r);
    log(text + '\n');
    summary.push(text);
    if (!opts['dry-run']) {
      await gh.req(`/repos/${gh.repo}/statuses/${r.headSha}`, {
        method: 'POST',
        body: JSON.stringify({ state: r.state, context: STATUS_CONTEXT, description: r.description, target_url: runUrl }),
      });
    }
  }
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Community quorum\n\n${summary.join('\n\n') || 'No open pull requests.'}\n`);
  if (failed) process.exit(1);
}

const commands = {
  verify: cmdVerify,
  inspect: cmdInspect,
  approve: cmdApprove,
  revoke: cmdRevoke,
  'add-source': () => cmdSource('add-source'),
  'remove-source': () => cmdSource('remove-source'),
  'add-reviewer': () => cmdReviewer('add-reviewer'),
  'remove-reviewer': () => cmdReviewer('remove-reviewer'),
  'check-prs': cmdCheckPrs,
};

const run = commands[command];
if (!run) die(`unknown command "${command ?? ''}". Commands: ${Object.keys(commands).join(', ')}`);
run().catch((e) => die(e.stack ?? e.message));
