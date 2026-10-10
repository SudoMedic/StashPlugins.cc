import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configSnippet, curlSnippet, graphqlSnippet, normalizeStashUrl } from '../src/lib/snippets.ts';

const spec = { id: 'skip-intro', sourceURL: 'https://feederbox826.github.io/plugins/main/index.yml' };

test('graphql snippet calls installPackages with every spec once', () => {
  const s = graphqlSnippet([spec, spec, { id: 'CommunityScriptsUILibrary', sourceURL: 'https://x/index.yml' }]);
  assert.match(s, /installPackages\(\n    type: Plugin/);
  assert.equal(s.match(/skip-intro/g).length, 1);
  assert.match(s, /CommunityScriptsUILibrary/);
});

test('curl snippet sends valid JSON and survives shell quoting', () => {
  const s = curlSnippet([{ id: "it's", sourceURL: 'https://x/index.yml' }], { url: 'stash.lan:9999/', apiKey: 'k' });
  assert.match(s, /'http:\/\/stash\.lan:9999\/graphql'/);
  assert.match(s, /-H 'ApiKey: k'/);
  // Undo the shell quoting and check the body parses.
  const data = s.split("--data '")[1].slice(0, -1).replace(/'\\''/g, "'");
  const body = JSON.parse(data);
  assert.deepEqual(body.variables.p, [{ id: "it's", sourceURL: 'https://x/index.yml' }]);
  assert.match(body.query, /installPackages\(type:Plugin,packages:\$p\)/);
  assert.doesNotMatch(curlSnippet([spec], { url: '' }), /ApiKey/);
});

test('config snippet matches Stash plugins.package_sources', () => {
  const s = configSnippet([
    { name: 'a/b', url: 'https://a/index.yml', slug: 'a-b' },
    { name: 'a/b', url: 'https://a/index.yml', slug: 'a-b' },
  ]);
  assert.equal(s, 'plugins:\n  package_sources:\n    - name: a/b\n      url: https://a/index.yml\n      local_path: a-b');
});

test('normalizeStashUrl defaults to localhost', () => {
  assert.equal(normalizeStashUrl(''), 'http://localhost:9999');
  assert.equal(normalizeStashUrl('https://stash.example.com/'), 'https://stash.example.com');
});

test('config snippet quotes YAML-ambiguous values', () => {
  const s = configSnippet([{ name: 'My Source', url: 'https://x/a #b/index.yml', slug: 'my-source' }]);
  assert.match(s, /name: "My Source"/);
  assert.match(s, /url: "https:\/\/x\/a #b\/index.yml"/);
});
