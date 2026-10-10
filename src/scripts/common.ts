// Behaviour shared by every page: theme, copy buttons and install panels.
import { installPanelHtml, type InstallArgs, type InstallTab } from '../lib/install';
import type { StashTarget } from '../lib/snippets';

const store = {
  get<T>(k: string, fallback: T): T {
    try {
      const v = localStorage.getItem(k);
      return v == null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
};
export { store };

export function getTarget(): StashTarget {
  const t = store.get<StashTarget>('stash-target', { url: '' });
  return { url: t.url ?? '', apiKey: t.apiKey || undefined };
}

export function getTab(): InstallTab {
  return store.get<InstallTab>('install-tab', 'source');
}

let toastTimer: number | undefined;
export function toast(msg: string) {
  const el = document.querySelector<HTMLElement>('.toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1600);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

type PanelArgs = Omit<InstallArgs, 'target' | 'tab'>;

/** Render (or re-render) every install panel root on the page. */
export function renderPanels(scope: ParentNode = document) {
  const target = getTarget();
  const tab = getTab();
  scope.querySelectorAll<HTMLElement>('[data-install-root]').forEach((root) => {
    const args = JSON.parse(root.dataset.installRoot!) as PanelArgs;
    const open = root.querySelector('details.target')?.hasAttribute('open');
    root.innerHTML = installPanelHtml({ ...args, target, tab });
    if (open) root.querySelector('details.target')?.setAttribute('open', '');
  });
}

function selectTab(panel: HTMLElement, id: string, focus = false) {
  panel.querySelectorAll<HTMLButtonElement>('[role=tab]').forEach((b) => {
    const on = b.dataset.tab === id;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  panel.querySelectorAll<HTMLElement>('[role=tabpanel]').forEach((p) => {
    p.hidden = !p.id.endsWith(`-panel-${id}`);
  });
}

document.addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;

  const copy = t.closest<HTMLButtonElement>('[data-copy]');
  if (copy) {
    const host = copy.closest('.code, .field');
    const text = host?.querySelector('code')?.textContent ?? '';
    await copyText(text);
    copy.classList.add('copied');
    const label = copy.querySelector('span');
    if (label) label.textContent = 'Copied';
    toast('Copied to clipboard');
    setTimeout(() => {
      copy.classList.remove('copied');
      if (label) label.textContent = 'Copy';
    }, 1500);
    return;
  }

  const tab = t.closest<HTMLButtonElement>('[role=tab][data-tab]');
  if (tab) {
    const id = tab.dataset.tab as InstallTab;
    store.set('install-tab', id);
    document.querySelectorAll<HTMLElement>('[data-install-panel]').forEach((p) => selectTab(p, id));
    return;
  }

  if (t.closest('[data-theme-toggle]')) {
    const root = document.documentElement;
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
  }
});

// Arrow-key navigation between install tabs.
document.addEventListener('keydown', (e) => {
  const tab = (e.target as HTMLElement).closest<HTMLButtonElement>('[role=tab][data-tab]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const tabs = [...tab.parentElement!.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const i = tabs.indexOf(tab);
  const j = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  e.preventDefault();
  tabs[j].click();
  tabs[j].focus();
});

// Stash address / API key edits re-render every snippet.
document.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.name !== 'stash-url' && input.name !== 'stash-key') return;
  const form = input.closest('.target-form')!;
  const url = form.querySelector<HTMLInputElement>('[name=stash-url]')!.value.trim();
  const apiKey = form.querySelector<HTMLInputElement>('[name=stash-key]')!.value.trim();
  store.set('stash-target', { url, apiKey: apiKey || undefined });
  // Re-rendering replaces the form; put focus back where the user was going.
  const active = document.activeElement as HTMLInputElement | null;
  const roots = [...document.querySelectorAll('[data-install-root]')];
  const rootIdx = active ? roots.findIndex((r) => r.contains(active)) : -1;
  const focusName = rootIdx >= 0 ? active!.name : undefined;
  renderPanels();
  if (focusName) document.querySelectorAll('[data-install-root]')[rootIdx]?.querySelector<HTMLInputElement>(`[name="${focusName}"]`)?.focus();
  toast('Snippets updated');
});

renderPanels();
