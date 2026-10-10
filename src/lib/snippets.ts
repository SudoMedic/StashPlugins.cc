// Install snippets. Shared by the server-rendered pages and the browser bundle.
//
// Stash installs packages with the `installPackages` GraphQL mutation
// (graphql/schema/schema.graphql). It takes a source URL + package id, so a
// plugin can be installed without first adding its source in the UI.

export interface PackageSpec {
  id: string;
  sourceURL: string;
}

export interface StashTarget {
  url: string; // e.g. http://localhost:9999
  apiKey?: string;
}

export const DEFAULT_STASH_URL = 'http://localhost:9999';

export function normalizeStashUrl(url: string | undefined): string {
  const u = (url || DEFAULT_STASH_URL).trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(u) ? u : `http://${u}`;
}

function dedupe(specs: PackageSpec[]): PackageSpec[] {
  const seen = new Set<string>();
  return specs.filter((s) => {
    const k = `${s.sourceURL}\n${s.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const gqlString = (s: string) => JSON.stringify(s);

export function graphqlSnippet(specs: PackageSpec[]): string {
  const lines = dedupe(specs).map((s) => `    { id: ${gqlString(s.id)}, sourceURL: ${gqlString(s.sourceURL)} }`);
  return `mutation InstallPlugins {\n  installPackages(\n    type: Plugin\n    packages: [\n${lines.join('\n')}\n    ]\n  )\n}`;
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function curlSnippet(specs: PackageSpec[], target: StashTarget): string {
  const body = JSON.stringify({
    query: 'mutation($p:[PackageSpecInput!]!){installPackages(type:Plugin,packages:$p)}',
    variables: { p: dedupe(specs) },
  });
  const lines = [
    `curl -X POST ${shellQuote(normalizeStashUrl(target.url) + '/graphql')}`,
    `  -H 'Content-Type: application/json'`,
  ];
  if (target.apiKey) lines.push(`  -H ${shellQuote('ApiKey: ' + target.apiKey)}`);
  lines.push(`  --data ${shellQuote(body)}`);
  return lines.join(' \\\n');
}

export interface SourceRef {
  name: string;
  url: string;
  slug: string;
}

export function configSnippet(sources: SourceRef[]): string {
  const seen = new Set<string>();
  const items = sources
    .filter((s) => !seen.has(s.url) && seen.add(s.url))
    .map((s) => `    - name: ${yamlScalar(s.name)}\n      url: ${yamlScalar(s.url)}\n      local_path: ${yamlScalar(s.slug)}`);
  return `plugins:\n  package_sources:\n${items.join('\n')}`;
}

/** Plain YAML scalar when unambiguous (no spaces, no leading indicator), else JSON-quoted. */
function yamlScalar(s: string) {
  return /^[A-Za-z0-9_.\/+-][\w.\/:~%?&=+@#-]*$/.test(s) && !/:$/.test(s) ? s : JSON.stringify(s);
}
