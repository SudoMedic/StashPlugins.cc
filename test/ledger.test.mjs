import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canonicalJson,
  classifyChange,
  entryHash,
  parseLedger,
  reviewStatus,
  sealEntry,
  serializeEntry,
  sourceOwners,
  tally,
  verifyLedger,
} from '../scripts/lib/ledger.mjs';

const SRC = 'https://feederbox826.github.io/plugins/main/index.yml';
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const AT = '2026-10-10T00:00:00.000Z';

function chain(...fields) {
  const entries = [];
  for (const f of fields) entries.push(sealEntry(entries, { at: AT, ...f }));
  return entries;
}

const genesis = { type: 'genesis', reviewers: ['alice', 'bob', 'carol'] };
const approveA = { type: 'approve', by: 'dave', source: SRC, packages: [{ id: 'skip-intro', version: '1', sha256: SHA_A }] };

test('canonicalJson ignores key order and hashes are stable', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [1, { f: 2, e: 3 }], c: null } }), '{"a":{"c":null,"d":[1,{"e":3,"f":2}]},"b":1}');
  assert.equal(entryHash({ x: 1, y: 2 }), entryHash({ y: 2, x: 1, hash: 'ignored' }));
});

test('a sealed chain verifies and round-trips through the file format', () => {
  const entries = chain(genesis, approveA);
  const text = entries.map(serializeEntry).join('');
  const r = verifyLedger(parseLedger(text));
  assert.equal(r.ok, true, r.errors.join('\n'));
  assert.equal(r.head, entries[1].hash);
  assert.equal(r.state.reviewers.size, 3);
});

test('editing, dropping or reordering a past entry breaks the chain', () => {
  const entries = chain(genesis, approveA, { type: 'add-reviewer', by: 'alice', login: 'erin' });

  const edited = structuredClone(entries);
  edited[1].packages[0].sha256 = SHA_B;
  assert.match(verifyLedger(edited).errors.join('\n'), /entry 1: hash mismatch/);

  const resealed = structuredClone(entries);
  resealed[1].packages[0].sha256 = SHA_B;
  resealed[1].hash = entryHash(resealed[1]);
  assert.match(verifyLedger(resealed).errors.join('\n'), /entry 2: prev does not match/);

  const dropped = [entries[0], entries[2]];
  assert.equal(verifyLedger(dropped).ok, false);
});

test('entries are validated against the state before them', () => {
  const bad = chain(genesis, { type: 'add-reviewer', by: 'alice', login: 'Bob' }, { type: 'revoke', by: 'x', source: 'http://insecure/index.yml', packages: [{ id: 'p' }] });
  const errs = verifyLedger(bad).errors.join('\n');
  assert.match(errs, /bob is already a reviewer|Bob is already a reviewer/);
  assert.match(errs, /https URL/);
  assert.match(errs, /needs a "reason"/);
  assert.match(verifyLedger(chain({ type: 'genesis', reviewers: ['a'] }, { type: 'remove-reviewer', by: 'a', login: 'a', reason: 'x' })).errors.join(), /last reviewer/);
});

test('reviewStatus pins approvals to an exact sha256', () => {
  const { state } = verifyLedger(chain(genesis, approveA));
  assert.equal(reviewStatus(state, SRC, 'skip-intro', SHA_A).status, 'verified');
  assert.equal(reviewStatus(state, SRC, 'SKIP-INTRO', SHA_A.toUpperCase()).status, 'verified');
  assert.equal(reviewStatus(state, SRC, 'skip-intro', SHA_B).status, 'changed');
  assert.equal(reviewStatus(state, SRC, 'skip-intro', undefined).status, 'changed');
  assert.equal(reviewStatus(state, SRC, 'other', SHA_A).status, 'unreviewed');
  assert.equal(reviewStatus(state, 'https://x.github.io/index.yml', 'skip-intro', SHA_A).status, 'unreviewed');
});

test('a revoke of every version also blocks versions published later, until re-approved', () => {
  const revokeAll = { type: 'revoke', by: 'alice', source: SRC, packages: [{ id: 'skip-intro' }], reason: 'steals API keys' };
  const { state } = verifyLedger(chain(genesis, approveA, revokeAll));
  assert.equal(reviewStatus(state, SRC, 'skip-intro', SHA_A).status, 'revoked');
  assert.equal(reviewStatus(state, SRC, 'skip-intro', SHA_B).status, 'revoked');
  assert.equal(reviewStatus(state, SRC, 'skip-intro', SHA_B).reason, 'steals API keys');

  const approveB = { type: 'approve', by: 'bob', source: SRC, packages: [{ id: 'skip-intro', sha256: SHA_B }] };
  const later = verifyLedger(chain(genesis, approveA, revokeAll, approveB)).state;
  assert.equal(reviewStatus(later, SRC, 'skip-intro', SHA_B).status, 'verified');
  assert.equal(reviewStatus(later, SRC, 'skip-intro', SHA_A).status, 'revoked');
});

test('a revoke of one version leaves other approved versions alone', () => {
  const approveB = { type: 'approve', by: 'bob', source: SRC, packages: [{ id: 'skip-intro', sha256: SHA_B }] };
  const revokeA = { type: 'revoke', by: 'alice', source: SRC, packages: [{ id: 'skip-intro', sha256: SHA_A }], reason: 'bad build' };
  const { state } = verifyLedger(chain(genesis, approveA, approveB, revokeA));
  assert.equal(reviewStatus(state, SRC, 'skip-intro', SHA_A).status, 'revoked');
  assert.equal(reviewStatus(state, SRC, 'skip-intro', SHA_B).status, 'verified');
});

test('removing a source revokes everything in it; adding it back restores it', () => {
  const remove = { type: 'remove-source', by: 'alice', source: SRC, reason: 'spam' };
  const s1 = verifyLedger(chain(genesis, approveA, remove)).state;
  assert.equal(reviewStatus(s1, SRC, 'skip-intro', SHA_A).status, 'revoked');
  const s2 = verifyLedger(chain(genesis, approveA, remove, { type: 'add-source', by: 'bob', source: SRC })).state;
  assert.equal(reviewStatus(s2, SRC, 'skip-intro', SHA_A).status, 'verified');
  assert.equal(s2.addedSources.has(SRC), true);
});

test('classifyChange enforces append-only and sorts files into quorum kinds', () => {
  const base = chain(genesis);
  const head = chain(genesis, approveA);
  const baseText = base.map(serializeEntry).join('');
  const headText = head.map(serializeEntry).join('');

  const ok = classifyChange({ files: ['registry/ledger.jsonl'], baseText, headText });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.kinds, ['approve']);
  assert.equal(ok.newEntries[0].seq, 1);

  const rewrite = classifyChange({ files: ['registry/ledger.jsonl'], baseText: headText, headText: baseText + serializeEntry(head[1]).replace('dave', 'eve') });
  assert.match(rewrite.errors.join(), /append-only/);

  const mixed = classifyChange({ files: ['src/pages/index.astro', 'registry/governance.json', '.github/workflows/x.yml'], baseText, headText: baseText });
  assert.deepEqual(mixed.kinds.sort(), ['code', 'governance']);
  assert.deepEqual(classifyChange({ files: ['scripts/lib/ledger.mjs'], baseText, headText: baseText }).kinds, ['governance']);
});

test('sourceOwners finds the repo owner behind an index URL', () => {
  assert.deepEqual(sourceOwners(SRC), ['feederbox826']);
  assert.deepEqual(sourceOwners('https://raw.githubusercontent.com/Owner/repo/main/index.yml'), ['owner']);
});

// ---- voting ----------------------------------------------------------------

const governance = { quorum: { approve: 2, revoke: 1, code: 2, governance: 3, 'add-reviewer': 2 }, vetoes: 1, reviewer: { minAccountAgeDays: 180 } };
const NOW = Date.parse('2026-10-10T00:00:00Z');
const old = { createdAt: '2020-01-01T00:00:00Z' };
const young = { createdAt: '2026-09-01T00:00:00Z' };
const reviewerState = verifyLedger(chain({ type: 'genesis', reviewers: ['alice', 'bob', 'carol', 'feederbox826', 'newbie'] })).state;
const accounts = new Map([
  ['alice', old],
  ['bob', old],
  ['carol', old],
  ['feederbox826', old],
  ['newbie', young],
  ['mallory', old],
]);
const review = (login, state, commit_id = 'head') => ({ user: { login }, state, commit_id });
const vote = (reviews, extra = {}) =>
  tally({ governance, reviewerState, author: 'dave', headSha: 'head', reviews, accounts, kinds: ['approve'], now: NOW, ...extra });

test('two approvals from eligible reviewers on the latest commit pass', () => {
  assert.equal(vote([review('alice', 'APPROVED')]).state, 'pending');
  const r = vote([review('alice', 'APPROVED'), review('bob', 'APPROVED')]);
  assert.equal(r.state, 'success');
  assert.deepEqual(r.approvers, ['alice', 'bob']);
});

test('votes that do not count are reported with a reason', () => {
  const r = vote(
    [review('mallory', 'APPROVED'), review('newbie', 'APPROVED'), review('alice', 'APPROVED', 'old'), review('feederbox826', 'APPROVED'), review('dave', 'APPROVED')],
    { conflicted: ['feederbox826'] },
  );
  assert.equal(r.state, 'pending');
  assert.deepEqual(r.approvers, []);
  const why = Object.fromEntries(r.ignored.map((i) => [i.login, i.why]));
  assert.match(why.mallory, /not a registered reviewer/);
  assert.match(why.newbie, /younger than 180 days/);
  assert.match(why.alice, /older commit/);
  assert.match(why.feederbox826, /owns the source/);
  assert.match(why.dave, /not a registered reviewer/);
});

test('the latest decisive review wins and a request for changes vetoes', () => {
  assert.equal(vote([review('alice', 'CHANGES_REQUESTED'), review('alice', 'APPROVED'), review('bob', 'APPROVED')]).state, 'success');
  const vetoed = vote([review('alice', 'APPROVED'), review('bob', 'APPROVED'), review('carol', 'CHANGES_REQUESTED')]);
  assert.equal(vetoed.state, 'failure');
  assert.deepEqual(vetoed.vetoes, ['carol']);
  assert.equal(vote([review('alice', 'APPROVED'), review('alice', 'COMMENTED'), review('bob', 'APPROVED')]).state, 'success');
  assert.equal(vote([review('alice', 'APPROVED'), review('alice', 'DISMISSED'), review('bob', 'APPROVED')]).state, 'pending');
});

test('the strictest change in a pull request sets the quorum', () => {
  const two = [review('alice', 'APPROVED'), review('bob', 'APPROVED')];
  assert.equal(vote(two, { kinds: ['revoke'] }).required, 1);
  assert.equal(vote(two, { kinds: ['revoke', 'governance'] }).state, 'pending');
  assert.equal(vote([...two, review('carol', 'APPROVED')], { kinds: ['governance'] }).state, 'success');
});

test('a reviewer cannot approve their own pull request', () => {
  const r = vote([review('alice', 'APPROVED'), review('bob', 'APPROVED')], { author: 'alice' });
  assert.deepEqual(r.approvers, ['bob']);
  assert.equal(r.state, 'pending');
});

test('a small community lowers the bar to everyone available, never below one other person', () => {
  const solo = verifyLedger(chain({ type: 'genesis', reviewers: ['owner'] })).state;
  const acc = new Map([['owner', old], ['dave', old]]);
  const fromOutsider = tally({ governance, reviewerState: solo, author: 'dave', headSha: 'head', reviews: [], accounts: acc, kinds: ['approve'], now: NOW });
  assert.equal(fromOutsider.required, 1);
  assert.equal(fromOutsider.state, 'pending');
  assert.equal(
    tally({ governance, reviewerState: solo, author: 'dave', headSha: 'head', reviews: [review('owner', 'APPROVED')], accounts: acc, kinds: ['approve'], now: NOW }).state,
    'success',
  );
  // The only reviewer proposing alone: nobody else exists yet to ask.
  const bootstrap = tally({ governance, reviewerState: solo, author: 'owner', headSha: 'head', reviews: [], accounts: acc, kinds: ['add-reviewer'], now: NOW });
  assert.equal(bootstrap.state, 'success');
  assert.match(bootstrap.notes.join(), /bootstrap/);
});
