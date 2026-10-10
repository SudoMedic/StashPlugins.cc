// The community review ledger: an append-only, hash-chained log of decisions
// (approve/revoke plugin versions, add/remove sources and reviewers).
//
// Every entry carries the hash of the one before it, so changing or deleting
// any past entry breaks every later hash. Votes are GitHub pull-request reviews;
// `tally` decides whether a pull request has enough of them.
//
// Pure functions only (no network, no fs) so the rules can be unit tested.
import { createHash } from 'node:crypto';
import { repoCandidates } from './parse.mjs';

export const ENTRY_TYPES = ['genesis', 'approve', 'revoke', 'add-source', 'remove-source', 'add-reviewer', 'remove-reviewer'];

const SHA256_RE = /^[a-f0-9]{64}$/;
const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** JSON with object keys sorted at every level, so a hash never depends on key order. */
export function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

export function entryHash(entry) {
  const { hash, ...rest } = entry;
  return createHash('sha256').update(canonicalJson(rest)).digest('hex');
}

export function parseLedger(text) {
  return String(text)
    .split('\n')
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch {
        throw new Error(`ledger line ${i + 1} is not valid JSON`);
      }
    });
}

export function serializeEntry(entry) {
  return canonicalJson(entry) + '\n';
}

/** Seal a new entry onto the end of the chain. */
export function sealEntry(entries, fields) {
  const prev = entries.at(-1);
  const entry = { ...fields, seq: entries.length, prev: prev ? prev.hash : null };
  return { ...entry, hash: entryHash(entry) };
}

export const packageKey = (source, id) => `${source}\n${String(id).toLowerCase()}`;
const lc = (s) => String(s).toLowerCase();

export function emptyState() {
  return {
    reviewers: new Map(), // lowercase login -> { login, seq }
    approvals: new Map(), // packageKey -> [{ sha256, version, seq, at, by, note }]
    revocations: new Map(), // packageKey -> [{ sha256 | null, seq, at, by, reason }]
    addedSources: new Map(), // url -> { seq, by, note }
    removedSources: new Map(), // url -> { seq, by, reason }
  };
}

function isHttpsYml(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /\.ya?ml$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/** Check an entry's shape and that it makes sense against the state before it. Returns error strings. */
export function validateEntry(e, state) {
  const errs = [];
  if (!ENTRY_TYPES.includes(e.type)) return [`unknown entry type "${e.type}"`];
  if (e.type !== 'genesis' && (typeof e.by !== 'string' || !LOGIN_RE.test(e.by))) errs.push('"by" must be a GitHub login');
  if (typeof e.at !== 'string' || Number.isNaN(Date.parse(e.at))) errs.push('"at" must be an ISO date');

  const checkPackages = (requireSha) => {
    if (!isHttpsYml(e.source)) errs.push('"source" must be an https URL to a .yml/.yaml index');
    if (!Array.isArray(e.packages) || !e.packages.length) {
      errs.push('"packages" must be a non-empty list');
      return;
    }
    const seen = new Set();
    for (const p of e.packages) {
      if (!p || typeof p.id !== 'string' || !p.id) errs.push('every package needs an "id"');
      else if (seen.has(lc(p.id))) errs.push(`package "${p.id}" is listed twice`);
      else seen.add(lc(p.id));
      if (requireSha || p?.sha256 != null) {
        if (!SHA256_RE.test(p?.sha256 ?? '')) errs.push(`package "${p?.id}" needs a lowercase hex sha256`);
      }
    }
  };

  switch (e.type) {
    case 'genesis':
      if (e.seq !== 0) errs.push('genesis must be the first entry');
      if (!Array.isArray(e.reviewers) || !e.reviewers.length) errs.push('genesis needs at least one reviewer');
      else for (const r of e.reviewers) if (!LOGIN_RE.test(r)) errs.push(`"${r}" is not a GitHub login`);
      break;
    case 'approve':
      checkPackages(true);
      break;
    case 'revoke':
      checkPackages(false);
      if (!e.reason) errs.push('a revoke needs a "reason"');
      break;
    case 'add-source':
      if (!isHttpsYml(e.source)) errs.push('"source" must be an https URL to a .yml/.yaml index');
      break;
    case 'remove-source':
      if (!isHttpsYml(e.source)) errs.push('"source" must be an https URL to a .yml/.yaml index');
      if (!e.reason) errs.push('a remove-source needs a "reason"');
      break;
    case 'add-reviewer':
      if (!LOGIN_RE.test(e.login ?? '')) errs.push('"login" must be a GitHub login');
      else if (state.reviewers.has(lc(e.login))) errs.push(`${e.login} is already a reviewer`);
      break;
    case 'remove-reviewer':
      if (!state.reviewers.has(lc(e.login ?? ''))) errs.push(`${e.login} is not a reviewer`);
      else if (state.reviewers.size <= 1) errs.push('cannot remove the last reviewer');
      if (!e.reason) errs.push('a remove-reviewer needs a "reason"');
      break;
    default: {
      const never = e.type;
      throw new Error(`unhandled entry type ${never}`);
    }
  }
  return errs;
}

export function applyEntry(state, e) {
  switch (e.type) {
    case 'genesis':
      for (const r of e.reviewers) state.reviewers.set(lc(r), { login: r, seq: e.seq });
      break;
    case 'approve':
      for (const p of e.packages) {
        const k = packageKey(e.source, p.id);
        state.approvals.set(k, [...(state.approvals.get(k) ?? []), { sha256: p.sha256, version: p.version, seq: e.seq, at: e.at, by: e.by, note: e.note }]);
      }
      break;
    case 'revoke':
      for (const p of e.packages) {
        const k = packageKey(e.source, p.id);
        state.revocations.set(k, [...(state.revocations.get(k) ?? []), { sha256: p.sha256 ?? null, seq: e.seq, at: e.at, by: e.by, reason: e.reason }]);
      }
      break;
    case 'add-source':
      state.removedSources.delete(e.source);
      state.addedSources.set(e.source, { seq: e.seq, by: e.by, note: e.note });
      break;
    case 'remove-source':
      state.addedSources.delete(e.source);
      state.removedSources.set(e.source, { seq: e.seq, by: e.by, reason: e.reason });
      break;
    case 'add-reviewer':
      state.reviewers.set(lc(e.login), { login: e.login, seq: e.seq });
      break;
    case 'remove-reviewer':
      state.reviewers.delete(lc(e.login));
      break;
    default: {
      const never = e.type;
      throw new Error(`unhandled entry type ${never}`);
    }
  }
  return state;
}

/**
 * Verify the whole chain and fold it into the current state.
 * Returns { ok, errors, state, head } and never throws on bad data.
 */
export function verifyLedger(entries) {
  const errors = [];
  const state = emptyState();
  let prev = null;
  entries.forEach((e, i) => {
    const where = `entry ${i}`;
    if (e.seq !== i) errors.push(`${where}: seq is ${e.seq}, expected ${i}`);
    if (e.prev !== prev) errors.push(`${where}: prev does not match the hash of entry ${i - 1}`);
    if (e.hash !== entryHash(e)) errors.push(`${where}: hash mismatch (entry was edited after sealing)`);
    if (i > 0 && e.type === 'genesis') errors.push(`${where}: only the first entry may be genesis`);
    const errs = validateEntry(e, state);
    for (const m of errs) errors.push(`${where} (${e.type}): ${m}`);
    if (!errs.length) applyEntry(state, e);
    prev = e.hash;
  });
  if (!entries.length) errors.push('ledger is empty');
  else if (entries[0].type !== 'genesis') errors.push('entry 0 must be genesis');
  return { ok: errors.length === 0, errors, state, head: prev };
}

/**
 * Review status of one package version.
 *   verified   — this exact sha256 was approved and not revoked since
 *   changed    — an older version was approved; the current one was not
 *   revoked    — this version (or every version) was revoked after its last approval
 *   unreviewed — never approved
 */
export function reviewStatus(state, source, id, sha256) {
  const k = packageKey(source, id);
  const approvals = state.approvals.get(k) ?? [];
  const revocations = state.revocations.get(k) ?? [];
  const sha = sha256 ? lc(sha256) : undefined;
  const approval = sha ? approvals.filter((a) => a.sha256 === sha).at(-1) : undefined;
  const revocation = revocations.filter((r) => r.sha256 === null || (sha && r.sha256 === sha)).at(-1);
  if (state.removedSources.has(source)) return { status: 'revoked', reason: state.removedSources.get(source).reason, seq: state.removedSources.get(source).seq };
  if (revocation && revocation.seq > (approval?.seq ?? -1)) return { status: 'revoked', reason: revocation.reason, seq: revocation.seq, at: revocation.at };
  if (approval) return { status: 'verified', version: approval.version, seq: approval.seq, at: approval.at, by: approval.by };
  const last = approvals.at(-1);
  if (last) return { status: 'changed', version: last.version, seq: last.seq, at: last.at, by: last.by };
  return { status: 'unreviewed' };
}

// ---- pull-request rules ---------------------------------------------------

export const LEDGER_PATH = 'registry/ledger.jsonl';

/** Files whose change alters the rules themselves (or the code that enforces them). */
export function isGovernancePath(p) {
  return (
    p === 'registry/governance.json' ||
    p === 'scripts/ledger.mjs' ||
    p === 'scripts/lib/ledger.mjs' ||
    p === 'scripts/lib/parse.mjs' ||
    p === 'LICENSE' ||
    p.startsWith('.github/')
  );
}

/**
 * What a pull request changes, and which quorum each part needs.
 * `files` are changed paths; `baseText`/`headText` are the ledger file on each side.
 * Returns { errors, newEntries, kinds } where kinds is a list of governance.quorum keys.
 */
export function classifyChange({ files, baseText, headText }) {
  const errors = [];
  const kinds = new Set();
  let newEntries = [];
  for (const f of files) {
    if (f === LEDGER_PATH) continue;
    kinds.add(isGovernancePath(f) ? 'governance' : 'code');
  }
  if (files.includes(LEDGER_PATH)) {
    // Append-only: the head ledger must start with the base ledger byte-for-byte.
    const base = String(baseText ?? '');
    const head = String(headText ?? '');
    const baseNorm = base && !base.endsWith('\n') ? base + '\n' : base;
    if (!head.startsWith(baseNorm)) {
      errors.push('the ledger is append-only: existing lines were changed, removed or reordered');
    } else {
      try {
        newEntries = parseLedger(head.slice(baseNorm.length));
      } catch (e) {
        errors.push(e.message);
      }
      if (!newEntries.length) errors.push('the ledger file changed but no entries were appended');
      for (const e of newEntries) kinds.add(e.type);
    }
  }
  return { errors, newEntries, kinds: [...kinds] };
}

/** Owners of a source, who may not vote on their own plugins. */
export function sourceOwners(url) {
  try {
    return [...new Set(repoCandidates(url).map((c) => lc(c.owner)))];
  } catch {
    return [];
  }
}

/**
 * Count votes on a pull request.
 *
 * reviews:  GitHub reviews, oldest first: { user: { login }, state, commit_id }
 * accounts: Map lowercase login -> { createdAt } for every reviewer and voter
 * Returns { state: 'success' | 'pending' | 'failure', required, approvers, vetoes, ignored, notes }.
 */
export function tally({ governance, reviewerState, author, headSha, reviews, accounts, kinds, conflicted = [], now = Date.now() }) {
  const notes = [];
  const ignored = [];
  const day = 86_400_000;
  const minAge = (governance.reviewer?.minAccountAgeDays ?? 0) * day;
  const authorLc = lc(author);
  const conflictedLc = new Set(conflicted.map(lc));

  const required = Math.max(0, ...kinds.map((k) => governance.quorum?.[k] ?? governance.quorum?.code ?? 1));

  // Latest decisive review per person; plain comments don't change a vote.
  const latest = new Map();
  for (const r of reviews) {
    const who = lc(r.user?.login ?? '');
    if (!who) continue;
    if (r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED' || r.state === 'DISMISSED') latest.set(who, r);
  }

  const eligible = (login) => {
    if (!reviewerState.reviewers.has(login)) return 'not a registered reviewer';
    if (login === authorLc) return 'author of the pull request';
    if (conflictedLc.has(login)) return 'owns the source being voted on';
    const created = accounts.get(login)?.createdAt;
    if (!created || now - Date.parse(created) < minAge) return `GitHub account younger than ${governance.reviewer.minAccountAgeDays} days`;
    return null;
  };

  const approvers = [];
  const vetoes = [];
  for (const [login, r] of latest) {
    const why = eligible(login);
    const name = r.user.login;
    if (r.state === 'CHANGES_REQUESTED') {
      if (why) ignored.push({ login: name, why });
      else vetoes.push(name);
    } else if (r.state === 'APPROVED') {
      if (why) ignored.push({ login: name, why });
      else if (r.commit_id !== headSha) ignored.push({ login: name, why: 'approved an older commit; re-approve the latest one' });
      else approvers.push(name);
    }
  }

  // While the community is smaller than the quorum, the bar drops to everyone
  // who is able to vote. A zero-vote pass is only possible for a reviewer's own
  // pull request when no other reviewer exists yet.
  const available = [...reviewerState.reviewers.keys()].filter((l) => !eligible(l)).length;
  let need = Math.min(required, available);
  if (need === 0 && !reviewerState.reviewers.has(authorLc)) need = 1;
  if (need < required) notes.push(`bootstrap: only ${available} eligible reviewer${available === 1 ? '' : 's'}, so ${need} of ${required} approvals are required`);

  const maxVetoes = governance.vetoes ?? 1;
  let state;
  if (vetoes.length >= maxVetoes && maxVetoes > 0) state = 'failure';
  else if (approvers.length >= need) state = 'success';
  else state = 'pending';
  return { state, required: need, configured: required, approvers, vetoes, ignored, notes };
}
