// HTML for plugin cards. Used for the server-rendered first page and by the
// browser when filtering, so both always match.
import type { ListItem, PluginType } from './catalog';

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const TYPE_SHORT: Record<PluginType, string> = {
  ui: 'UI',
  theme: 'Theme',
  backend: 'Tasks',
  hybrid: 'UI + Tasks',
  other: 'Plugin',
};

export function timeAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  const steps: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30.44, 'day'],
    [12, 'month'],
    [Infinity, 'year'],
  ];
  let v = s;
  for (const [n, unit] of steps) {
    if (v < n) {
      const r = Math.floor(v);
      if (unit === 'second') return 'just now';
      return `${r} ${unit}${r === 1 ? '' : 's'} ago`;
    }
    v /= n;
  }
  return '';
}

export function shortDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function avatar(login: string | undefined, size = 40) {
  return login ? `https://github.com/${encodeURIComponent(login)}.png?size=${size}` : '';
}

export function cardHtml(p: ListItem, base: string, opts: { selected?: boolean; now?: number } = {}): string {
  const href = `${base}plugins/${p.s}/`;
  const av = avatar(p.a.login, 40);
  const tags = [
    p.rv === 'verified' ? `<span class="tag tag-verified" title="This exact version was approved by community reviewers">✓ Verified</span>` : '',
    p.rv === 'changed' ? `<span class="tag tag-changed" title="An earlier version was approved; this one has not been reviewed yet">Changed since review</span>` : '',
    `<span class="tag tag-${p.t}">${TYPE_SHORT[p.t]}</span>`,
    p.r ? `<span class="tag">${esc(p.r)}</span>` : '',
    p.g.includes('settings') ? `<span class="tag">Settings</span>` : '',
    p.dup ? `<span class="tag tag-dup" title="Also offered by ${p.dup} other source${p.dup === 1 ? '' : 's'}">+${p.dup} source${p.dup === 1 ? '' : 's'}</span>` : '',
  ].join('');
  return `<article class="card" data-slug="${esc(p.s)}">
  <div class="card-top">
    <h3 class="card-title"><a href="${href}">${esc(p.n)}</a></h3>
    <label class="pick" title="Add to install list"><input type="checkbox" data-pick="${esc(p.s)}"${opts.selected ? ' checked' : ''}><span class="sr-only">Select ${esc(p.n)}</span></label>
  </div>
  <p class="card-desc">${p.d ? esc(p.d) : '<span class="muted">No description provided.</span>'}</p>
  <div class="tags">${tags}</div>
  <dl class="card-meta">
    <div><dt>Updated</dt><dd><time datetime="${esc(p.u)}" title="${esc(shortDate(p.u))}">${timeAgo(p.u, opts.now)}</time></dd></div>
    <div><dt>Created</dt><dd><time datetime="${esc(p.c)}">${shortDate(p.c)}</time></dd></div>
  </dl>
  <div class="card-foot">
    <span class="author">${av ? `<img src="${av}" alt="" width="20" height="20" loading="lazy">` : '<span class="av-fallback" aria-hidden="true"></span>'}<span>${esc(p.a.name)}</span></span>
    <span class="card-actions">
      ${p.ru ? `<a class="icon-btn" href="${esc(p.fu ?? p.ru)}" target="_blank" rel="noopener" title="View source on ${p.ru.includes('codeberg') ? 'Codeberg' : 'GitHub'}"><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg><span class="sr-only">Source</span></a>` : ''}
      <button class="btn btn-sm btn-primary" type="button" data-install="${esc(p.s)}">Install</button>
    </span>
  </div>
  <div class="card-src" title="${esc(p.su)}">${esc(p.sn)}</div>
</article>`;
}
