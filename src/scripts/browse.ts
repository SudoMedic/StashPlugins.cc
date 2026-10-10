// Browse page: search, filter, sort, install dialog and multi-select.
import type { ListItem } from '../lib/catalog';
import { cardHtml } from '../lib/render';
import type { PackageSpec, SourceRef } from '../lib/snippets';
import { renderPanels, store } from './common';

const PAGE = 48;
const base = document.body.dataset.base ?? '/';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const q = $<HTMLInputElement>('q');
const sourceSel = $<HTMLSelectElement>('source');
const sortSel = $<HTMLSelectElement>('sort');
const allBox = $<HTMLInputElement>('all');
const verifiedBox = $<HTMLInputElement>('verified');
const grid = $('grid');
const countEl = $('count');
const emptyEl = $('empty');
const moreBtn = $<HTMLButtonElement>('more');
const dialog = $<HTMLDialogElement>('install-dialog');
const cartEl = $('cart');

let items: ListItem[] = [];
let bySlug = new Map<string, ListItem>();
let type = '';
let shown = PAGE;
let sortTouched = false;
const picked = new Set<string>(store.get<string[]>('picked', []));

// ---- state <-> URL -------------------------------------------------------
function readUrl() {
  const p = new URLSearchParams(location.search);
  q.value = p.get('q') ?? '';
  type = p.get('type') ?? '';
  sourceSel.value = p.get('source') ?? '';
  allBox.checked = p.get('all') === '1' || !!sourceSel.value;
  verifiedBox.checked = p.get('verified') === '1';
  const sort = p.get('sort');
  sortTouched = !!sort;
  sortSel.value = sort ?? (q.value ? 'relevance' : 'updated');
}

function writeUrl() {
  const p = new URLSearchParams();
  if (q.value.trim()) p.set('q', q.value.trim());
  if (type) p.set('type', type);
  if (sourceSel.value) p.set('source', sourceSel.value);
  if (allBox.checked && !sourceSel.value) p.set('all', '1');
  if (verifiedBox.checked) p.set('verified', '1');
  if (sortTouched) p.set('sort', sortSel.value);
  const s = p.toString();
  history.replaceState(null, '', s ? `?${s}` : location.pathname);
}

// ---- search --------------------------------------------------------------
const norm = (s: string | undefined) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

interface Indexed {
  item: ListItem;
  name: string;
  id: string;
  desc: string;
  author: string;
  rest: string;
}
let indexed: Indexed[] = [];

function score(x: Indexed, tokens: string[]): number {
  let total = 0;
  for (const t of tokens) {
    let s = 0;
    if (x.name === t || x.id === t) s = 12;
    else if (x.name.startsWith(t) || x.id.startsWith(t)) s = 8;
    else if (x.name.includes(t) || x.id.includes(t)) s = 6;
    else if (x.author.includes(t)) s = 4;
    else if (x.desc.includes(t)) s = 3;
    else if (x.rest.includes(t)) s = 1;
    if (!s) return 0;
    total += s;
  }
  return total;
}

const cmpStr = (a = '', b = '') => a.localeCompare(b, 'en', { sensitivity: 'base' });
const SORTS: Record<string, (a: ListItem, b: ListItem) => number> = {
  updated: (a, b) => cmpStr(b.u, a.u),
  created: (a, b) => cmpStr(b.c, a.c),
  oldest: (a, b) => (a.c ? 0 : 1) - (b.c ? 0 : 1) || cmpStr(a.c, b.c),
  name: (a, b) => cmpStr(a.n, b.n),
  author: (a, b) => cmpStr(a.a.name, b.a.name) || cmpStr(a.n, b.n),
};

function compute() {
  const tokens = norm(q.value).split(/\s+/).filter(Boolean);
  const src = sourceSel.value;
  const showAll = allBox.checked || !!src;

  const matches: { item: ListItem; s: number }[] = [];
  for (const x of indexed) {
    if (!showAll && !x.item.can) continue;
    if (src && x.item.src !== src) continue;
    if (verifiedBox.checked && x.item.rv !== 'verified') continue;
    const s = tokens.length ? score(x, tokens) : 1;
    if (s) matches.push({ item: x.item, s });
  }

  // Type counts reflect the other active filters.
  const counts: Record<string, number> = { '': matches.length };
  for (const { item } of matches) counts[item.t] = (counts[item.t] ?? 0) + 1;
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    el.textContent = String(counts[el.dataset.count!] ?? 0);
  });

  const filtered = type ? matches.filter((x) => x.item.t === type) : matches;
  const sort = sortSel.value;
  if (sort === 'relevance' && tokens.length) filtered.sort((a, b) => b.s - a.s || SORTS.updated(a.item, b.item));
  else filtered.sort((a, b) => (SORTS[sort] ?? SORTS.updated)(a.item, b.item));
  return filtered.map((x) => x.item);
}

function render() {
  const list = compute();
  const now = Date.now();
  grid.innerHTML = list
    .slice(0, shown)
    .map((p) => cardHtml(p, base, { selected: picked.has(p.s), now }))
    .join('');
  countEl.textContent = list.length ? `Showing ${Math.min(shown, list.length)} of ${list.length}` : '';
  emptyEl.hidden = list.length > 0;
  moreBtn.hidden = list.length <= shown;
  document.querySelectorAll<HTMLButtonElement>('.chip[data-type]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.type === type)));
}

function update() {
  shown = PAGE;
  writeUrl();
  render();
}

// ---- install dialog ------------------------------------------------------
function sourceRefFor(url: string): SourceRef | undefined {
  const it = items.find((i) => i.su === url);
  return it ? { name: it.sn, url: it.su, slug: it.src } : undefined;
}

function openInstall(slugs: string[]) {
  const chosen = slugs.map((s) => bySlug.get(s)).filter((x): x is ListItem => !!x);
  if (!chosen.length) return;
  // Chosen packages first, then their requirements (install panel relies on this order).
  const specs: PackageSpec[] = chosen.map((p) => ({ id: p.i, sourceURL: p.su }));
  const key = (x: PackageSpec) => `${x.sourceURL}\n${x.id.toLowerCase()}`;
  const seen = new Set(specs.map(key));
  for (const d of chosen.flatMap((p) => p.deps)) {
    if (!seen.has(key(d))) {
      seen.add(key(d));
      specs.push(d);
    }
  }
  const sources: SourceRef[] = [];
  for (const s of specs) {
    const ref = sourceRefFor(s.sourceURL);
    if (ref && !sources.some((x) => x.url === ref.url)) sources.push(ref);
  }
  const names = chosen.map((p) => p.n);
  $('install-title').textContent = chosen.length === 1 ? `Install ${chosen[0].n}` : `Install ${chosen.length} plugins`;
  const depCount = specs.length - chosen.length;
  $('install-sub').textContent =
    chosen.length === 1
      ? `from ${chosen[0].sn}${depCount ? ` · needs ${chosen[0].deps.map((d) => d.id).join(', ')}` : ''}`
      : `from ${sources.length} source${sources.length === 1 ? '' : 's'}`;
  const body = $('install-body');
  body.innerHTML = '<div data-install-root></div>';
  body.firstElementChild!.setAttribute('data-install-root', JSON.stringify({ names, specs, sources, uid: 'dlg' }));
  renderPanels(body);
  dialog.showModal();
}

dialog.addEventListener('click', (e) => {
  if (e.target === dialog || (e.target as HTMLElement).closest('[data-close]')) dialog.close();
});

// ---- multi-select --------------------------------------------------------
function syncCart() {
  store.set('picked', [...picked]);
  cartEl.hidden = picked.size === 0;
  $('cart-count').textContent = `${picked.size} selected`;
}

$('cart-clear').addEventListener('click', () => {
  picked.clear();
  grid.querySelectorAll<HTMLInputElement>('[data-pick]').forEach((b) => (b.checked = false));
  syncCart();
});
$('cart-install').addEventListener('click', () => openInstall([...picked]));

grid.addEventListener('change', (e) => {
  const box = e.target as HTMLInputElement;
  const slug = box.dataset.pick;
  if (!slug) return;
  if (box.checked) picked.add(slug);
  else picked.delete(slug);
  syncCart();
});

grid.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-install]');
  if (btn) openInstall([btn.dataset.install!]);
});

// ---- controls ------------------------------------------------------------
let debounce: number | undefined;
q.addEventListener('input', () => {
  if (!sortTouched) sortSel.value = q.value.trim() ? 'relevance' : 'updated';
  clearTimeout(debounce);
  debounce = window.setTimeout(update, 80);
});
sourceSel.addEventListener('change', update);
allBox.addEventListener('change', update);
verifiedBox.addEventListener('change', update);
sortSel.addEventListener('change', () => {
  sortTouched = true;
  update();
});
document.querySelector('.chips')!.addEventListener('click', (e) => {
  const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip[data-type]');
  if (!chip) return;
  type = chip.dataset.type ?? '';
  update();
});
moreBtn.addEventListener('click', () => {
  const before = shown;
  shown += PAGE;
  render();
  // Pointer only: the added cards arrive in a short cascade.
  if (document.documentElement.dataset.input === 'key') return;
  grid.querySelectorAll<HTMLElement>('.card').forEach((card, i) => {
    if (i < before) return;
    card.style.setProperty('--i', String(i - before));
    card.classList.add('is-new');
  });
});
$('reset').addEventListener('click', () => {
  q.value = '';
  type = '';
  sourceSel.value = '';
  allBox.checked = false;
  verifiedBox.checked = false;
  sortTouched = false;
  sortSel.value = 'updated';
  update();
  q.focus();
});

document.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  const typing = el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
  if (e.key === '/' && !typing && !dialog.open) {
    e.preventDefault();
    q.focus();
    q.select();
  } else if (e.key === 'Escape' && el === q && q.value) {
    q.value = '';
    update();
  }
});

// ---- boot ----------------------------------------------------------------
readUrl();
syncCart();
fetch(`${base}plugins.json`)
  .then((r) => r.json() as Promise<ListItem[]>)
  .then((data) => {
    items = data;
    bySlug = new Map(items.map((i) => [i.s, i]));
    indexed = items.map((item) => ({
      item,
      name: norm(item.n),
      id: norm(item.i),
      desc: norm(item.d),
      author: norm(item.a.name + ' ' + (item.a.login ?? '')),
      rest: norm([item.sn, item.r, item.t, item.rv === 'verified' ? 'verified' : '', ...item.g].join(' ')),
    }));
    // Drop picks that no longer exist.
    for (const s of picked) if (!bySlug.has(s)) picked.delete(s);
    syncCart();
    render();
  })
  .catch(() => {
    countEl.textContent = 'Could not load the full catalog. Showing recent plugins only.';
  });
