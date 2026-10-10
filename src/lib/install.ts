// The install panel: four ways to get a plugin into Stash.
import { esc } from './render';
import {
  configSnippet,
  curlSnippet,
  graphqlSnippet,
  normalizeStashUrl,
  type PackageSpec,
  type SourceRef,
  type StashTarget,
} from './snippets';

export type InstallTab = 'source' | 'graphql' | 'curl' | 'config';

export const TABS: { id: InstallTab; label: string }[] = [
  { id: 'source', label: 'Add source' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'curl', label: 'cURL' },
  { id: 'config', label: 'config.yml' },
];

export interface InstallArgs {
  /** Display names of the packages being installed. */
  names: string[];
  specs: PackageSpec[];
  sources: SourceRef[];
  target: StashTarget;
  tab: InstallTab;
  /** Unique id prefix so several panels can live on one page. */
  uid: string;
}

const copyIcon =
  '<svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path fill="currentColor" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>';

export function codeBlock(code: string, label: string) {
  return `<div class="code"><button type="button" class="copy" data-copy aria-label="Copy ${esc(label)}">${copyIcon}<span>Copy</span></button><pre><code>${esc(code)}</code></pre></div>`;
}

function field(label: string, value: string) {
  return `<div class="field"><span class="field-label">${esc(label)}</span><code class="field-value">${esc(value)}</code><button type="button" class="copy copy-sm" data-copy aria-label="Copy ${esc(label)}">${copyIcon}<span>Copy</span></button></div>`;
}

function list(names: string[]) {
  const shown = names.slice(0, 3).map((n) => `<strong>${esc(n)}</strong>`);
  if (names.length > 3) shown.push(`${names.length - 3} more`);
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}` : shown[0] ?? '';
}

export function installPanelHtml(a: InstallArgs): string {
  const stash = normalizeStashUrl(a.target.url);
  const tabs = TABS.map(
    (t) =>
      `<button type="button" role="tab" id="${a.uid}-tab-${t.id}" aria-controls="${a.uid}-panel-${t.id}" aria-selected="${t.id === a.tab}" tabindex="${t.id === a.tab ? 0 : -1}" data-tab="${t.id}">${t.label}</button>`,
  ).join('');

  const panel = (id: InstallTab, body: string) =>
    `<div class="tabpanel" role="tabpanel" id="${a.uid}-panel-${id}" aria-labelledby="${a.uid}-tab-${id}"${id === a.tab ? '' : ' hidden'}>${body}</div>`;

  const deps = a.specs.slice(a.names.length);
  const sourceSteps = a.sources
    .map(
      (s) => `<div class="source-fields">${field('Name', s.name)}${field('Source URL', s.url)}${field('Local path', s.slug)}</div>`,
    )
    .join('');

  const source = panel(
    'source',
    `<ol class="steps">
      <li>In Stash open <a href="${esc(stash)}/settings?tab=plugins" target="_blank" rel="noopener">Settings → Plugins</a>, scroll to <em>Available Plugins</em> and click <em>Add Source</em>.</li>
      <li>Paste ${a.sources.length > 1 ? 'each source' : 'these values'}:${sourceSteps}</li>
      <li>Expand the new source, tick ${list(a.names)}, then click <em>Install</em>.${
        deps.length ? ` Also install its requirements: ${deps.map((d) => `<strong>${esc(d.id)}</strong>`).join(', ')}.` : ''
      }</li>
    </ol>
    <p class="hint">Adding the source lets Stash show updates for it later.</p>`,
  );

  const graphql = panel(
    'graphql',
    `<p>Open <a href="${esc(stash)}/playground" target="_blank" rel="noopener">${esc(stash)}/playground</a>, paste this and press ▶. Stash downloads and installs in the background — no source needed.</p>
    ${codeBlock(graphqlSnippet(a.specs), 'GraphQL mutation')}
    ${a.specs.length > a.names.length ? `<p class="hint">Includes ${a.specs.length - a.names.length} required ${a.specs.length - a.names.length === 1 ? 'dependency' : 'dependencies'}.</p>` : ''}`,
  );

  const curl = panel(
    'curl',
    `<p>Run in a terminal that can reach your Stash. ${a.target.apiKey ? 'Uses your API key.' : 'Add your API key in <em>Your Stash</em> below if Stash has a login.'}</p>
    ${codeBlock(curlSnippet(a.specs, a.target), 'cURL command')}`,
  );

  const config = panel(
    'config',
    `<p>Merge into <code>plugins:</code> in Stash's <code>config.yml</code> and restart. Keep any sources you already have.</p>
    ${codeBlock(configSnippet(a.sources), 'config.yml snippet')}`,
  );

  return `<div class="install" data-install-panel>
    <div class="tabs" role="tablist" aria-label="Install method">${tabs}</div>
    ${source}${graphql}${curl}${config}
    <details class="target">
      <summary>Your Stash: <code>${esc(stash)}</code>${a.target.apiKey ? ' · API key set' : ''}</summary>
      <div class="target-form">
        <label>Stash address<input type="url" name="stash-url" value="${esc(a.target.url)}" placeholder="http://localhost:9999" autocomplete="off" spellcheck="false"></label>
        <label>API key <span class="muted">(optional, stays in this browser)</span><input type="password" name="stash-key" value="${esc(a.target.apiKey ?? '')}" autocomplete="off" spellcheck="false"></label>
      </div>
    </details>
  </div>`;
}
