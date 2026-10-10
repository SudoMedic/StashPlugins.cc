import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classify,
  describeManifest,
  loginFromEmail,
  normalizeDate,
  parseIndex,
  parseLog,
  parseSourceList,
  pickAuthor,
  pickManifest,
  repoCandidates,
} from '../scripts/lib/parse.mjs';

test('parseSourceList keeps yml links in order and drops duplicates', () => {
  const html = `<ol>
    <li><a href="https://a.github.io/x/main/index.yml">a</a></li>
    <li><a href="https://wordcounter.net/alphabetize">not an index</a></li>
    <li><a href="https://raw.githubusercontent.com/B/c/main/plugins.yaml">b</a></li>
    <li><a href="https://A.github.io/x/main/index.yml">dup</a></li>
  </ol>`;
  assert.deepEqual(parseSourceList(html), [
    'https://a.github.io/x/main/index.yml',
    'https://raw.githubusercontent.com/B/c/main/plugins.yaml',
  ]);
});

test('repoCandidates maps every hosting style to a repo', () => {
  assert.deepEqual(repoCandidates('https://stashapp.github.io/CommunityScripts/stable/index.yml')[0], {
    host: 'github.com',
    owner: 'stashapp',
    name: 'CommunityScripts',
  });
  assert.deepEqual(repoCandidates('https://atreemandork.github.io/index.yml'), [
    { host: 'github.com', owner: 'atreemandork', name: 'atreemandork.github.io' },
  ]);
  assert.deepEqual(repoCandidates('https://raw.githubusercontent.com/Servbot91/DiceR/refs/heads/main/plugins/manifest.yml'), [
    { host: 'github.com', owner: 'Servbot91', name: 'DiceR', branch: 'main' },
  ]);
  assert.deepEqual(repoCandidates('https://heman.codeberg.page/role-tagger/index.yml')[0], {
    host: 'codeberg.org',
    owner: 'heman',
    name: 'role-tagger',
  });
  assert.deepEqual(repoCandidates('https://surging9143.codeberg.page/index.yml'), [{ host: 'codeberg.org', owner: 'surging9143', name: 'pages' }]);
});

test('parseIndex reads the Stash package index format', () => {
  const pkgs = parseIndex(`
- id: skip-intro
  name: skip-intro
  metadata:
    description: Skips static duration intros
  version: 0.3.1-e4379e1
  date: 2026-03-30 08:19:47
  path: skip-intro.zip
  sha256: abc
  requires:
    - CommunityScriptsUILibrary
- not: a package
`);
  assert.equal(pkgs.length, 1);
  assert.equal(pkgs[0].description, 'Skips static duration intros');
  assert.equal(pkgs[0].date, '2026-03-30T08:19:47.000Z');
  assert.deepEqual(pkgs[0].requires, ['CommunityScriptsUILibrary']);
  assert.throws(() => parseIndex('foo: bar'));
  assert.throws(() => parseIndex('[]'));
});

test('normalizeDate treats zone-less dates as UTC', () => {
  assert.equal(normalizeDate('2025-01-02 03:04:05'), '2025-01-02T03:04:05.000Z');
  assert.equal(normalizeDate('2025-01-02T03:04:05-04:00'), '2025-01-02T07:04:05.000Z');
  assert.equal(normalizeDate('garbage'), undefined);
});

test('pickManifest prefers the source folder over build output', () => {
  const paths = ['_site/foo/foo.yml', 'plugins/foo/foo.yml', 'other/bar.yml', 'archive/foo.yml'];
  assert.equal(pickManifest(paths, 'foo')[0], 'plugins/foo/foo.yml');
  assert.equal(pickManifest(paths, 'FOO')[0], 'plugins/foo/foo.yml');
  assert.deepEqual(pickManifest(paths, 'baz'), []);
});

test('describeManifest and classify recognise plugin kinds', () => {
  const theme = describeManifest({ name: 'Dark', ui: { css: ['dark.css'] } });
  assert.equal(classify({ id: 'dark', name: 'Dark' }, theme), 'theme');
  const ui = describeManifest({ name: 'X', ui: { javascript: ['x.js'], css: ['x.css'] }, settings: { a: { displayName: 'A', type: 'BOOLEAN' } } });
  assert.deepEqual(ui.tags, ['ui', 'css', 'settings']);
  assert.equal(classify({ id: 'x', name: 'X' }, ui), 'ui');
  const py = describeManifest({ name: 'P', exec: ['python', '{pluginDir}/p.py'], interface: 'raw', tasks: [{ name: 'Run' }] });
  assert.equal(py.runtime, 'Python');
  assert.equal(classify({ id: 'p', name: 'P' }, py), 'backend');
  const both = describeManifest({ name: 'B', interface: 'js', ui: { javascript: ['b.js'] }, hooks: [{ name: 'h', triggeredBy: ['Scene.Update.Post'] }] });
  assert.equal(both.runtime, 'JavaScript');
  assert.equal(classify({ id: 'b', name: 'B' }, both), 'hybrid');
});

test('pickAuthor credits the main human committer', () => {
  const log = parseLog(
    [
      ['1', '2026-01-03T00:00:00Z', 'dependabot[bot]', 'x@github.com'],
      ['2', '2026-01-02T00:00:00Z', 'Jane', '123+janedev@users.noreply.github.com'],
      ['3', '2026-01-01T00:00:00Z', 'Bob', 'bob@example.com'],
      ['4', '2025-12-01T00:00:00Z', 'Jane D', '123+janedev@users.noreply.github.com'],
    ]
      .map((r) => r.join('\x1f'))
      .join('\n'),
  );
  assert.deepEqual(pickAuthor(log), { name: 'janedev', login: 'janedev' });
  assert.equal(loginFromEmail('someone@example.com'), undefined);
  assert.equal(pickAuthor([]), undefined);
});
