#!/usr/bin/env node
// Builds src/data/catalog.json from every package source on the Stash forum list.
//
//   1. Read the source list from discourse.stashapp.cc (falls back to the last
//      saved list when the forum is unreachable), plus sources the community
//      ledger added, minus the ones it removed.
//   2. Download each source's index.yml — the same file Stash reads.
//   3. Clone the repo behind each source (blobs > 256k skipped) and, for every
//      package, find its manifest, README and git history.
//
// Env: CACHE_DIR (default .cache), GITHUB_TOKEN (optional, adds stars/topics),
//      CONCURRENCY (default 6), ONLY (substring filter on source URLs, for debugging).
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import YAML from 'yaml';
import { parseLedger, verifyLedger } from './lib/ledger.mjs';
import { extractZipEntry, readZipEntries } from './lib/zip.mjs';
import {
  classify,
  describeManifest,
  isBot,
  loginFromEmail,
  parseIndex,
  parseLog,
  parseSourceList,
  pickAuthor,
  pickManifest,
  repoCandidates,
  slugify,
} from './lib/parse.mjs';

const exec = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.resolve(ROOT, process.env.CACHE_DIR ?? '.cache');
const OUT = path.join(ROOT, 'src/data/catalog.json');
const SOURCES_FILE = path.join(ROOT, 'data/sources.json');
const OVERRIDES_FILE = path.join(ROOT, 'data/overrides.json');
const LEDGER_FILE = path.join(ROOT, 'registry/ledger.jsonl');
const FORUM_URL = 'https://discourse.stashapp.cc/t/list-of-plugin-sources/122';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6);
const README_LIMIT = 40_000;
const ZIP_LIMIT = 8_000_000;

const log = (...a) => console.error(...a);

async function fetchText(url, { tries = 3, timeout = 20_000, headers = {} } = {}) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'stashplugins-crawler (+https://stashplugins.cc)', ...headers },
        signal: AbortSignal.timeout(timeout),
      });
      if (res.status === 404) throw Object.assign(new Error('HTTP 404'), { fatal: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      err = e;
      if (e.fatal) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw err;
}

async function git(args, opts = {}) {
  const { stdout } = await exec('git', args, {
    maxBuffer: 64 * 1024 * 1024,
    timeout: opts.timeout ?? 180_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    ...opts,
  });
  return stdout;
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

async function loadSourceUrls() {
  try {
    const json = JSON.parse(await fetchText(`${FORUM_URL}.json`));
    const urls = parseSourceList(json.post_stream.posts[0].cooked);
    if (urls.length < 10) throw new Error(`only ${urls.length} sources parsed`);
    await mkdir(path.dirname(SOURCES_FILE), { recursive: true });
    await writeFile(SOURCES_FILE, JSON.stringify({ fetchedFrom: FORUM_URL, urls }, null, 2) + '\n');
    return urls;
  } catch (e) {
    log(`! forum unavailable (${e.message}); using ${path.relative(ROOT, SOURCES_FILE)}`);
    return JSON.parse(await readFile(SOURCES_FILE, 'utf8')).urls;
  }
}

function repoUrl(r) {
  return `https://${r.host}/${r.owner}/${r.name}`;
}

/** Bare, blob-filtered clone kept in the cache and refreshed on later runs. */
async function syncRepo(r) {
  const dir = path.join(CACHE, 'repos', r.host, r.owner.toLowerCase(), r.name.toLowerCase());
  if (existsSync(path.join(dir, 'HEAD'))) {
    await git(['-C', dir, 'fetch', '--quiet', '--prune', 'origin']);
  } else {
    await mkdir(path.dirname(dir), { recursive: true });
    await git(['clone', '--quiet', '--bare', '--filter=blob:limit=256k', repoUrl(r) + '.git', dir], { timeout: 600_000 });
    await git(['-C', dir, 'config', 'remote.origin.fetch', '+refs/heads/*:refs/heads/*']);
  }
  return dir;
}

async function resolveRepo(indexUrl, override) {
  const candidates = override?.repo ? [override.repo] : repoCandidates(indexUrl);
  for (const c of candidates) {
    try {
      const out = await git(['ls-remote', '--symref', repoUrl(c) + '.git', 'HEAD'], { timeout: 30_000 });
      const head = out.match(/^ref: refs\/heads\/(\S+)\s+HEAD/m)?.[1];
      return { ...c, branch: c.branch ?? override?.repo?.branch ?? head ?? 'main' };
    } catch {
      /* try next */
    }
  }
  return null;
}

async function githubMeta(r) {
  if (!process.env.GITHUB_TOKEN || r.host !== 'github.com') return {};
  try {
    const j = JSON.parse(
      await fetchText(`https://api.github.com/repos/${r.owner}/${r.name}`, {
        tries: 2,
        headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' },
      }),
    );
    return {
      owner: j.owner?.login ?? r.owner,
      name: j.name ?? r.name,
      stars: j.stargazers_count,
      repoDescription: j.description ?? undefined,
      topics: j.topics?.length ? j.topics : undefined,
      archived: j.archived || undefined,
      license: j.license?.spdx_id && j.license.spdx_id !== 'NOASSERTION' ? j.license.spdx_id : undefined,
    };
  } catch (e) {
    log(`  ! github api ${r.owner}/${r.name}: ${e.message}`);
    return {};
  }
}

async function historyFor(dir, ref, folder, manifestPath) {
  const fmt = '--format=%H%x1f%aI%x1f%an%x1f%ae';
  // folder === null: the manifest shares the repo root with other packages, so only its own file counts.
  const folderLog = folder === null ? [] : parseLog(await git(['-C', dir, 'log', fmt, ref, '--', folder || '.']));
  // --follow on the manifest catches history from before a folder was moved.
  let fileLog = [];
  if (manifestPath) {
    try {
      fileLog = parseLog(await git(['-C', dir, 'log', '--follow', fmt, ref, '--', manifestPath], { timeout: 60_000 }));
    } catch {
      /* ignore */
    }
  }
  const bySha = new Map();
  for (const c of [...folderLog, ...fileLog]) bySha.set(c.sha, c);
  const commits = [...bySha.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return commits;
}

async function readBlob(dir, ref, p) {
  return git(['-C', dir, 'show', `${ref}:${p}`], { timeout: 60_000 });
}

function absolutizeReadme(md, r, branch, folder) {
  const base = (raw) =>
    r.host === 'github.com'
      ? `https://${raw ? 'raw.githubusercontent.com' : 'github.com'}/${r.owner}/${r.name}/${raw ? '' : 'blob/'}${branch}/`
      : `https://codeberg.org/${r.owner}/${r.name}/${raw ? 'raw' : 'src'}/branch/${branch}/`;
  const resolve = (link, raw) => {
    if (/^([a-z]+:|#|\/\/)/i.test(link)) return link;
    const rel = link.startsWith('/') ? link.slice(1) : path.posix.normalize(path.posix.join(folder || '', link));
    return base(raw) + rel;
  };
  return md
    .replace(/(!\[[^\]]*\]\()\s*<?([^)\s>]+)>?/g, (_, pre, link) => pre + resolve(link, true))
    .replace(/((?<!!)\[[^\]]*\]\()\s*<?([^)\s>]+)>?/g, (_, pre, link) => pre + resolve(link, false))
    .replace(/(\)\]\()\s*<?([^)\s>]+)>?/g, (_, pre, link) => pre + resolve(link, false)) // [![badge](img)](link)
    .replace(/^(\s*\[[^\]]+\]:\s*)<?(\S+?)>?(?=\s|$)/gm, (_, pre, link) => pre + resolve(link, false)) // [ref]: link
    .replace(/(<img[^>]+src=")([^"]+)/gi, (_, pre, link) => pre + resolve(link, true))
    .replace(/(<a[^>]+href=")([^"]+)/gi, (_, pre, link) => pre + resolve(link, false))
    .replace(/(<source[^>]+srcset=")([^"\s,]+)/gi, (_, pre, link) => pre + resolve(link, true));
}

const looksLikeManifest = (m) =>
  !!m && typeof m === 'object' && !Array.isArray(m) && !!m.name && !!(m.ui || m.exec || m.tasks || m.hooks || m.interface || m.description);

/** Lazily parse every manifest-looking yml in a repo, keyed by lowercase `name`. */
async function manifestsByName(ctx) {
  ctx.byName ??= (async () => {
    const map = new Map();
    if (!ctx.dir) return map;
    for (const p of ctx.ymlPaths.slice(0, 400)) {
      if (/(^|\/)\.github\//.test(p)) continue;
      try {
        const m = YAML.parse(await readBlob(ctx.dir, ctx.repo.branch, p));
        if (looksLikeManifest(m)) {
          const k = String(m.name).toLowerCase();
          if (!map.has(k)) map.set(k, { path: p, manifest: m });
        }
      } catch {
        /* not yaml */
      }
    }
    return map;
  })();
  return ctx.byName;
}

async function findManifest(pkg, ctx) {
  for (const p of pickManifest(ctx.ymlPaths, pkg.id).slice(0, 4)) {
    try {
      const m = YAML.parse(await readBlob(ctx.dir, ctx.repo.branch, p));
      if (m && typeof m === 'object' && m.name) return { path: p, manifest: m };
    } catch {
      /* not a manifest */
    }
  }
  return (await manifestsByName(ctx)).get(pkg.name.toLowerCase());
}

/** Read the manifest out of the package zip itself — exactly what Stash installs. */
async function manifestFromZip(pkg, indexUrl) {
  const url = new URL(pkg.path, indexUrl).href;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > ZIP_LIMIT) {
      await res.body.cancel().catch(() => {});
      throw new Error('zip too large');
    }
    chunks.push(chunk);
  }
  const buf = Buffer.concat(chunks);
  const ymls = readZipEntries(buf)
    .filter((e) => /\.ya?ml$/i.test(e.name) && !e.name.endsWith('/'))
    .sort((a, b) => a.name.split('/').length - b.name.split('/').length);
  const stem = (e) => e.name.split('/').pop().toLowerCase().replace(/\.ya?ml$/, '');
  // Exact id match first, then any yml that looks like a plugin manifest.
  for (const e of [...ymls.filter((e) => stem(e) === pkg.id.toLowerCase()), ...ymls.filter((e) => stem(e) !== pkg.id.toLowerCase())]) {
    try {
      const m = YAML.parse(extractZipEntry(buf, e).toString('utf8'));
      if (looksLikeManifest(m)) return m;
    } catch {
      /* not yaml */
    }
  }
  throw new Error('no manifest in zip');
}

/** Where in the repo is the index file the source URL points at? */
async function indexLocations(ctx) {
  ctx.indexLocs ??= (async () => {
    const segs = new URL(ctx.indexUrl).pathname.split('/').filter(Boolean);
    const out = [];
    const refs = (await git(['-C', ctx.dir, 'for-each-ref', '--format=%(refname:short)', 'refs/heads'])).split('\n').filter(Boolean);
    for (const ref of [ctx.repo.branch, ...refs.filter((r) => r !== ctx.repo.branch)]) {
      const files = ref === ctx.repo.branch ? ctx.paths : (await git(['-C', ctx.dir, 'ls-tree', '-r', '--name-only', ref])).split('\n');
      // Longest suffix of the URL path that exists in this branch.
      for (let i = 0; i < segs.length; i++) {
        const p = segs.slice(i).join('/');
        if (files.includes(p)) {
          out.push({ ref, path: p });
          break;
        }
      }
    }
    return out;
  })();
  return ctx.indexLocs;
}

/** When the source isn't in the repo, date the package by when its id entered the index file. */
async function publishHistory(pkg, ctx) {
  // -G takes a POSIX basic regex: only .[]*^$\\ are special.
  const re = `id:[[:space:]]*['"]*${pkg.id.replace(/[.[\]*^$\\]/g, '\\$&')}['"]*[[:space:]]*$`;
  for (const loc of await indexLocations(ctx)) {
    const commits = parseLog(
      await git(['-C', ctx.dir, 'log', '--format=%H%x1f%aI%x1f%an%x1f%ae', `-G${re}`, loc.ref, '--', loc.path], { timeout: 60_000 }),
    );
    if (commits.length) return commits;
  }
  return [];
}

function applyHistory(out, commits) {
  out.created = new Date(commits.at(-1).date).toISOString();
  out.updated = new Date(commits[0].date).toISOString();
  out.commits = commits.length;
  out.author = pickAuthor(commits);
  const contributors = new Map();
  for (const c of commits) {
    if (isBot(c)) continue;
    const login = loginFromEmail(c.email);
    const key = (login ?? c.name).toLowerCase();
    if (!contributors.has(key)) contributors.set(key, { name: login ?? c.name, login });
  }
  out.contributors = [...contributors.values()].slice(0, 12);
}

async function crawlPackage(pkg, ctx) {
  const out = { ...pkg };
  const { dir, repo, paths } = ctx;
  let found = dir ? await findManifest(pkg, ctx) : undefined;
  // A repo that publishes a single package *is* that package.
  if (!found && dir && ctx.single) {
    try {
      found = { path: '', manifest: await manifestFromZip(pkg, ctx.indexUrl) };
    } catch {
      found = { path: '', manifest: { name: pkg.name } };
    }
  }

  if (found) {
    const ref = repo.branch;
    const folder = path.posix.dirname(found.path || '.') === '.' ? '' : path.posix.dirname(found.path);
    if (found.path) out.manifestPath = found.path;
    out.folder = folder;
    out.info = describeManifest(found.manifest);

    const shared = !folder && !ctx.single;
    const readmePath = shared
      ? undefined
      : paths.find((p) => path.posix.dirname(p) === (folder || '.') && /^readme(\.md|\.markdown)?$/i.test(path.posix.basename(p)));
    if (readmePath) {
      try {
        const md = (await readBlob(dir, ref, readmePath)).slice(0, README_LIMIT);
        out.readme = absolutizeReadme(md, repo, ref, folder);
      } catch {
        /* ignore */
      }
    }
    try {
      const commits = await historyFor(dir, ref, shared ? null : folder, found.path || undefined);
      if (commits.length) applyHistory(out, commits);
    } catch (e) {
      log(`  ! history ${pkg.id}: ${e.message.split('\n')[0]}`);
    }
  } else {
    try {
      out.info = describeManifest(await manifestFromZip(pkg, ctx.indexUrl));
    } catch (e) {
      log(`  ! zip ${pkg.id}: ${e.message}`);
    }
    if (dir) {
      try {
        const commits = await publishHistory(pkg, ctx);
        if (commits.length) {
          applyHistory(out, commits);
          out.datedBy = 'index';
        }
      } catch (e) {
        log(`  ! publish history ${pkg.id}: ${e.message.split('\n')[0]}`);
      }
    }
  }
  return out;
}

async function crawlSource(indexUrl, overrides) {
  const ov = overrides[indexUrl] ?? {};
  const src = { url: indexUrl, status: 'ok', packages: [] };
  log(`→ ${indexUrl}`);

  let pkgs;
  try {
    pkgs = parseIndex(await fetchText(indexUrl));
  } catch (e) {
    src.status = 'error';
    src.error = e.message;
    log(`  ✗ index: ${e.message}`);
  }

  const repo = await resolveRepo(indexUrl, ov);
  if (repo) Object.assign(repo, await githubMeta(repo));
  src.repo = repo;
  const owner = repo?.owner ?? repoCandidates(indexUrl)[0]?.owner ?? new URL(indexUrl).hostname.split('.')[0];
  src.owner = owner;
  src.name = ov.name ?? (repo ? `${repo.owner}/${repo.name}` : new URL(indexUrl).hostname);
  if (!pkgs) return src;

  let dir;
  let paths = [];
  if (repo) {
    try {
      dir = await syncRepo(repo);
      paths = (await git(['-C', dir, 'ls-tree', '-r', '--name-only', repo.branch])).split('\n').filter(Boolean);
    } catch (e) {
      log(`  ! clone ${repoUrl(repo)}: ${e.message.split('\n')[0]}`);
      dir = undefined;
    }
  }
  const ymlPaths = paths.filter((p) => /\.ya?ml$/i.test(p));
  const ctx = { dir, repo, paths, ymlPaths, indexUrl, single: pkgs.length === 1 };

  src.packages = await pool(pkgs, 4, (pkg) => crawlPackage(pkg, ctx));
  const matched = src.packages.filter((p) => p.folder !== undefined).length;
  const dated = src.packages.filter((p) => p.created).length;
  log(`  ✓ ${src.packages.length} packages (${matched} in repo, ${dated} dated)`);
  return src;
}

const latest = (...ds) => ds.filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0];

function buildCatalog(raw) {
  const sources = [];
  const plugins = [];
  const usedSourceSlugs = new Set();

  for (const s of raw) {
    let slug = slugify(s.repo ? `${s.repo.owner}-${s.repo.name.replace(/\.github\.io$/i, '')}` : s.name);
    // Several indexes can live in one repo (e.g. alpha/next channels).
    if (usedSourceSlugs.has(slug)) slug = slugify(`${slug}-${path.posix.basename(new URL(s.url).pathname).replace(/\.ya?ml$/, '')}`);
    let n = 2;
    while (usedSourceSlugs.has(slug)) slug = `${slug}-${n++}`;
    usedSourceSlugs.add(slug);

    const repoLink = s.repo ? repoUrl(s.repo) : undefined;
    sources.push({
      slug,
      name: s.name,
      url: s.url,
      owner: s.repo?.owner ?? s.owner,
      repoUrl: repoLink,
      branch: s.repo?.branch,
      stars: s.repo?.stars,
      description: s.repo?.repoDescription,
      archived: s.repo?.archived,
      license: s.repo?.license,
      status: s.status,
      error: s.error,
      count: s.packages.length,
    });

    for (const p of s.packages) {
      const ownerLogin = s.repo?.host === 'github.com' ? s.repo.owner : undefined;
      let author = p.author ?? { name: s.repo?.owner ?? s.owner, login: ownerLogin };
      if (!author.login && ownerLogin && author.name.toLowerCase() === ownerLogin.toLowerCase()) author = { ...author, login: ownerLogin };
      const folderUrl =
        s.repo && p.manifestPath
          ? s.repo.host === 'github.com'
            ? `${repoLink}/tree/${s.repo.branch}/${p.folder}`.replace(/\/$/, '')
            : `${repoLink}/src/branch/${s.repo.branch}/${p.folder}`.replace(/\/$/, '')
          : repoLink;
      const type = classify(p, p.info);
      plugins.push({
        slug: `${slug}--${slugify(p.id)}`,
        id: p.id,
        name: p.name,
        description: p.description ?? p.info?.description,
        version: p.version ?? p.info?.version,
        sha256: p.sha256,
        type,
        tags: p.info?.tags ?? [],
        runtime: p.info?.runtime,
        requires: p.requires,
        source: slug,
        sourceUrl: s.url,
        sourceName: s.name,
        repoUrl: repoLink,
        folderUrl,
        homepage: p.info?.url && p.info.url !== repoLink ? p.info.url : undefined,
        updated: latest(p.updated, p.date),
        indexDate: p.date,
        created: p.created,
        commits: p.commits,
        author,
        contributors: p.contributors,
        stars: s.repo?.stars,
        tasks: p.info?.tasks,
        hooks: p.info?.hooks,
        settings: p.info?.settings,
        readme: p.readme,
      });
    }
  }

  // Same plugin id offered by several sources (forks, mirrors).
  const byId = new Map();
  for (const p of plugins) {
    const k = p.id.toLowerCase();
    byId.set(k, [...(byId.get(k) ?? []), p.slug]);
  }
  for (const p of plugins) {
    const others = byId.get(p.id.toLowerCase()).filter((s) => s !== p.slug);
    if (others.length) p.alsoIn = others;
  }

  return { generatedAt: new Date().toISOString(), forumUrl: FORUM_URL, sources, plugins };
}

async function main() {
  const overrides = existsSync(OVERRIDES_FILE) ? JSON.parse(await readFile(OVERRIDES_FILE, 'utf8')) : {};
  const ledger = verifyLedger(parseLedger(await readFile(LEDGER_FILE, 'utf8')));
  if (!ledger.ok) throw new Error(`registry ledger is invalid:\n  ${ledger.errors.join('\n  ')}`);
  let urls = await loadSourceUrls();
  for (const extra of [...(overrides.$extraSources ?? []), ...ledger.state.addedSources.keys()]) if (!urls.includes(extra)) urls.push(extra);
  urls = urls.filter((u) => !ledger.state.removedSources.has(u));
  if (process.env.ONLY) urls = urls.filter((u) => u.includes(process.env.ONLY));
  log(`${urls.length} sources`);

  const raw = await pool(urls, CONCURRENCY, (u) =>
    crawlSource(u, overrides).catch((e) => ({ url: u, status: 'error', error: e.message, packages: [], name: u, owner: '' })),
  );
  const catalog = buildCatalog(raw);
  if (catalog.plugins.length < 50 && !process.env.ONLY) {
    log(`refusing to write a suspiciously small catalog (${catalog.plugins.length} plugins)`);
    process.exit(1);
  }
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(catalog) + '\n');
  const ok = catalog.sources.filter((s) => s.status === 'ok').length;
  log(`\nwrote ${path.relative(ROOT, OUT)}: ${catalog.plugins.length} plugins from ${ok}/${catalog.sources.length} sources`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
