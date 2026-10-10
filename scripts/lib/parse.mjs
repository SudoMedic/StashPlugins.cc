// Pure helpers used by the crawler. Kept free of I/O so they can be unit tested.
import YAML from 'yaml';

const BOT_RE = /(\[bot\]|dependabot|renovate|github-actions|actions-user)/i;

export const isBot = (c) => BOT_RE.test(c.name ?? '') || BOT_RE.test(c.email ?? '');

/** Extract the index URLs from the Discourse "List of plugin sources" post HTML. */
export function parseSourceList(html) {
  const urls = [];
  const seen = new Set();
  for (const m of html.matchAll(/<li>\s*<a[^>]+href="([^"]+)"/g)) {
    const url = decodeEntities(m[1]).trim();
    if (!/^https?:\/\//.test(url) || !/\.ya?ml(\?.*)?$/i.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url);
  }
  return urls;
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/**
 * Guess candidate git repositories that host the source for a package index URL.
 * Returns an ordered list; the crawler keeps the first one that exists.
 */
export function repoCandidates(indexUrl) {
  const u = new URL(indexUrl);
  const host = u.hostname.toLowerCase();
  const segs = u.pathname.split('/').filter(Boolean);
  segs.pop(); // index file name

  if (host === 'raw.githubusercontent.com') {
    const [owner, repo, ...rest] = segs;
    let branch = rest[0];
    if (branch === 'refs' && rest[1] === 'heads') branch = rest[2];
    return [{ host: 'github.com', owner, name: repo, branch }];
  }
  const gh = host.match(/^([^.]+)\.github\.io$/);
  if (gh) {
    const owner = gh[1];
    const out = [];
    if (segs.length) out.push({ host: 'github.com', owner, name: segs[0] });
    out.push({ host: 'github.com', owner, name: `${owner}.github.io` });
    return out;
  }
  const cb = host.match(/^([^.]+)\.codeberg\.page$/);
  if (cb) {
    const owner = cb[1];
    const out = [];
    if (segs.length) out.push({ host: 'codeberg.org', owner, name: segs[0] });
    out.push({ host: 'codeberg.org', owner, name: 'pages' });
    return out;
  }
  return [];
}

/** Parse a Stash package index (a YAML list of packages). Throws on bad input. */
export function parseIndex(text) {
  const doc = YAML.parse(text);
  if (!Array.isArray(doc)) throw new Error('index is not a list of packages');
  const pkgs = doc
    .filter((p) => p && typeof p === 'object' && p.id && p.path)
    .map((p) => ({
      id: String(p.id),
      name: String(p.name ?? p.id),
      description: str(p.metadata?.description) ?? str(p.description),
      version: str(p.version),
      date: normalizeDate(p.date),
      path: String(p.path),
      requires: Array.isArray(p.requires) ? p.requires.map(String) : [],
    }));
  if (!pkgs.length) throw new Error('index contains no packages');
  return pkgs;
}

function str(v) {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

/** Index dates look like "2025-12-20 01:59:59" (UTC, no zone). */
export function normalizeDate(v) {
  if (!v) return undefined;
  if (v instanceof Date) return isNaN(v) ? undefined : v.toISOString();
  const s = String(v).trim().replace(' ', 'T');
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return isNaN(d) ? undefined : d.toISOString();
}

/** Pick the best manifest path for a package id out of every .yml path in a repo. */
export function pickManifest(paths, id) {
  const want = id.toLowerCase();
  const candidates = paths.filter((p) => {
    const base = p.split('/').pop().toLowerCase();
    return base === `${want}.yml` || base === `${want}.yaml`;
  });
  const score = (p) => {
    const parts = p.toLowerCase().split('/');
    let s = parts.length;
    if (parts.some((x) => ['_site', 'dist', 'build', 'stable', 'node_modules', '.github', 'archive', 'old', 'deprecated'].includes(x))) s += 50;
    if (parts.some((x) => ['plugins', 'themes', 'plugin'].includes(x))) s -= 1;
    if (parts.length >= 2 && parts.at(-2) === want) s -= 2; // plugins/<id>/<id>.yml
    return s;
  };
  return candidates.sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

/** Summarise a Stash plugin manifest (pkg/plugin/config.go) into display tags. */
export function describeManifest(m) {
  if (!m || typeof m !== 'object') return null;
  const ui = m.ui && typeof m.ui === 'object' ? m.ui : {};
  const js = list(ui.javascript);
  const css = list(ui.css);
  const tasks = Array.isArray(m.tasks) ? m.tasks.filter(Boolean) : [];
  const hooks = Array.isArray(m.hooks) ? m.hooks.filter(Boolean) : [];
  const exec = list(m.exec);
  const settings = m.settings && typeof m.settings === 'object' ? Object.keys(m.settings) : [];

  const tags = [];
  if (js.length) tags.push('ui');
  if (css.length) tags.push('css');
  if (tasks.length) tags.push('tasks');
  if (hooks.length) tags.push('hooks');
  if (settings.length) tags.push('settings');

  let runtime;
  const iface = String(m.interface ?? '').toLowerCase();
  const bin = String(exec[0] ?? '').toLowerCase().split(/[\\/]/).pop();
  if (iface === 'js') runtime = 'JavaScript';
  else if (/^python/.test(bin) || exec.some((e) => /\.py$/i.test(e))) runtime = 'Python';
  else if (/^(node|bun|deno)/.test(bin)) runtime = 'Node';
  else if (exec.length) runtime = 'Binary';

  return {
    name: str(m.name),
    description: str(m.description),
    version: str(m.version),
    url: str(m.url),
    tags,
    runtime,
    tasks: tasks.map((t) => ({ name: str(t.name) ?? '', description: str(t.description) })),
    hooks: hooks.map((h) => ({ name: str(h.name) ?? '', description: str(h.description), triggeredBy: list(h.triggeredBy) })),
    settings: settings.map((k) => ({
      key: k,
      name: str(m.settings[k]?.displayName) ?? k,
      description: str(m.settings[k]?.description),
      type: str(m.settings[k]?.type),
    })),
    requires: list(m.ui?.requires ?? m.requires),
  };
}

function list(v) {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).filter((x) => x != null && x !== '').map(String);
}

/** Classify a package. Themes are CSS-only UI plugins. */
export function classify(pkg, info) {
  const text = `${pkg.id} ${pkg.name}`.toLowerCase();
  const tags = info?.tags ?? [];
  const backend = tags.includes('tasks') || tags.includes('hooks');
  if (/\btheme\b|theme$/.test(text) || (tags.includes('css') && !tags.includes('ui') && !backend)) return 'theme';
  if (tags.includes('ui') && !backend) return 'ui';
  if (backend && !tags.includes('ui')) return 'backend';
  if (backend && tags.includes('ui')) return 'hybrid';
  return 'other';
}

/** Parse `git log --format=%H%x1f%aI%x1f%an%x1f%ae` output. */
export function parseLog(text) {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, date, name, email] = line.split('\x1f');
      return { sha, date, name, email };
    });
}

/** GitHub login from a noreply address like 12345+login@users.noreply.github.com. */
export function loginFromEmail(email) {
  const m = String(email ?? '').match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i);
  return m ? m[1] : undefined;
}

/**
 * Credit the person who wrote most of the commits (bots ignored); ties go to
 * whoever committed first.
 */
export function pickAuthor(commits) {
  const people = new Map();
  commits.forEach((c, i) => {
    if (isBot(c)) return;
    const login = loginFromEmail(c.email);
    const key = (login ?? c.name).toLowerCase();
    const p = people.get(key) ?? { name: login ?? c.name, login, count: 0, last: i };
    p.count++;
    p.last = i; // log is newest first, so a larger index is older
    if (login && !p.login) p.login = login;
    people.set(key, p);
  });
  const best = [...people.values()].sort((a, b) => b.count - a.count || b.last - a.last)[0];
  return best ? { name: best.name, login: best.login } : undefined;
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
