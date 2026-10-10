import governanceJson from '../../registry/governance.json';
import ledgerText from '../../registry/ledger.jsonl?raw';
import { parseLedger, reviewStatus, verifyLedger } from '../../scripts/lib/ledger.mjs';
import raw from '../data/catalog.json';
import type { PackageSpec } from './snippets';

export type PluginType = 'ui' | 'theme' | 'backend' | 'hybrid' | 'other';

export type ReviewStatus = 'verified' | 'changed' | 'unreviewed' | 'revoked';

export interface Review {
  status: ReviewStatus;
  /** Approved version (verified/changed). */
  version?: string;
  at?: string;
  by?: string;
  /** Ledger entry that decided the status. */
  seq?: number;
  reason?: string;
}

export interface Person {
  name: string;
  login?: string;
}

export interface Plugin {
  slug: string;
  id: string;
  name: string;
  description?: string;
  version?: string;
  sha256?: string;
  review: Review;
  type: PluginType;
  tags: string[];
  runtime?: string;
  requires: string[];
  source: string;
  sourceUrl: string;
  sourceName: string;
  repoUrl?: string;
  folderUrl?: string;
  homepage?: string;
  updated?: string;
  indexDate?: string;
  created?: string;
  commits?: number;
  author: Person;
  contributors?: Person[];
  stars?: number;
  tasks?: { name: string; description?: string }[];
  hooks?: { name: string; description?: string; triggeredBy: string[] }[];
  settings?: { key: string; name: string; description?: string; type?: string }[];
  readme?: string;
  alsoIn?: string[];
}

export interface Source {
  slug: string;
  name: string;
  url: string;
  owner: string;
  repoUrl?: string;
  branch?: string;
  stars?: number;
  description?: string;
  archived?: boolean;
  license?: string;
  status: 'ok' | 'error';
  error?: string;
  count: number;
}

export interface Catalog {
  generatedAt: string;
  forumUrl: string;
  sources: Source[];
  plugins: Plugin[];
}

export interface Governance {
  quorum: Record<string, number>;
  vetoes: number;
  reviewer: { minAccountAgeDays: number };
  proposer: { minAccountAgeDays: number; maxEntriesPerPullRequest: number };
  /** "all": list everything with its review status. "verified": list approved versions only. */
  listing: 'all' | 'verified';
}

export const governance = governanceJson as Governance;

// A broken chain fails the build rather than publishing unverifiable statuses.
const ledgerEntries = parseLedger(ledgerText);
const ledgerResult = verifyLedger(ledgerEntries);
if (!ledgerResult.ok) throw new Error(`registry/ledger.jsonl is invalid:\n  ${ledgerResult.errors.join('\n  ')}`);

export const ledger = {
  entries: ledgerEntries as LedgerEntry[],
  head: ledgerResult.head as string,
  reviewers: [...ledgerResult.state.reviewers.values()] as { login: string; seq: number }[],
};

export interface LedgerEntry {
  seq: number;
  type: string;
  at: string;
  by?: string;
  hash: string;
  prev: string | null;
  source?: string;
  login?: string;
  note?: string;
  reason?: string;
  reviewers?: string[];
  packages?: { id: string; version?: string; sha256?: string }[];
}

const crawled = raw as unknown as Omit<Catalog, 'plugins'> & { plugins: Omit<Plugin, 'review'>[] };
const removed = ledgerResult.state.removedSources;

export const catalog: Catalog = {
  ...crawled,
  sources: crawled.sources.filter((s) => !removed.has(s.url)),
  plugins: crawled.plugins
    .filter((p) => !removed.has(p.sourceUrl))
    .map((p) => ({ ...p, review: reviewStatus(ledgerResult.state, p.sourceUrl, p.id, p.sha256) as Review })),
};

/** Whether the site offers install snippets for a plugin. */
export function installable(p: Plugin) {
  if (p.review.status === 'revoked') return false;
  return governance.listing !== 'verified' || p.review.status === 'verified';
}

/** Plugins shown in search and used to resolve requirements. */
export const listed = catalog.plugins.filter(installable);

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  verified: 'Community verified',
  changed: 'Changed since review',
  unreviewed: 'Not reviewed yet',
  revoked: 'Revoked',
};

export const TYPE_LABELS: Record<PluginType, string> = {
  ui: 'UI plugin',
  theme: 'Theme',
  backend: 'Tasks & hooks',
  hybrid: 'UI + tasks',
  other: 'Plugin',
};

const bySlug = new Map(catalog.plugins.map((p) => [p.slug, p]));
export const sourcesBySlug = new Map(catalog.sources.map((s) => [s.slug, s]));

export function getPlugin(slug: string) {
  return bySlug.get(slug);
}

/** Resolve `requires` ids: same source first, then any other source. */
export function dependencies(p: Plugin): { spec: PackageSpec; plugin?: Plugin }[] {
  return p.requires.map((id) => {
    const lc = id.toLowerCase();
    const same = listed.find((q) => q.source === p.source && q.id.toLowerCase() === lc);
    const any = same ?? canonicalById.get(lc);
    return { spec: { id: any?.id ?? id, sourceURL: any?.sourceUrl ?? p.sourceUrl }, plugin: any };
  });
}

export function installSpecs(p: Plugin): PackageSpec[] {
  return [{ id: p.id, sourceURL: p.sourceUrl }, ...dependencies(p).map((d) => d.spec)];
}

/**
 * Forks repackage the same plugin. The canonical copy is the oldest one;
 * ties go to the official stashapp source, then the most recently updated.
 */
const canonicalById = new Map<string, Plugin>();
{
  const rank = (p: Plugin) => [
    p.created ? Date.parse(p.created) : Infinity,
    p.source.startsWith('stashapp-') ? 0 : 1,
    -(p.updated ? Date.parse(p.updated) : 0),
  ];
  const cmp = (a: Plugin, b: Plugin) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return a.slug.localeCompare(b.slug);
  };
  for (const p of listed) {
    const k = p.id.toLowerCase();
    const cur = canonicalById.get(k);
    if (!cur || cmp(p, cur) < 0) canonicalById.set(k, p);
  }
}

export function isCanonical(p: Plugin) {
  return canonicalById.get(p.id.toLowerCase())?.slug === p.slug;
}

/** Slim record shipped to the browser for search, filter and sort. */
export interface ListItem {
  s: string; // slug
  i: string; // id
  n: string; // name
  d?: string; // description
  t: PluginType;
  g: string[]; // tags
  r?: string; // runtime
  src: string; // source slug
  sn: string; // source name
  su: string; // source url
  ru?: string; // repo url
  fu?: string; // folder url
  u?: string; // updated
  c?: string; // created
  a: Person;
  v?: string;
  st?: number;
  rv: ReviewStatus;
  dup: number; // copies in other sources
  can: boolean; // canonical copy
  deps: PackageSpec[];
}

export function toListItem(p: Plugin): ListItem {
  return {
    s: p.slug,
    i: p.id,
    n: p.name,
    d: p.description,
    t: p.type,
    g: p.tags,
    r: p.runtime,
    src: p.source,
    sn: p.sourceName,
    su: p.sourceUrl,
    ru: p.repoUrl,
    fu: p.folderUrl,
    u: p.updated,
    c: p.created,
    a: p.author,
    v: p.version,
    st: p.stars,
    rv: p.review.status,
    dup: p.alsoIn?.length ?? 0,
    can: isCanonical(p),
    deps: dependencies(p).map((d) => d.spec),
  };
}

export const listItems = listed.map(toListItem);

export const stats = {
  plugins: listed.length,
  unique: new Set(listed.map((p) => p.id.toLowerCase())).size,
  sources: catalog.sources.filter((s) => s.status === 'ok').length,
  authors: new Set(listed.map((p) => (p.author.login ?? p.author.name).toLowerCase())).size,
  themes: listed.filter((p) => p.type === 'theme' && isCanonical(p)).length,
  verified: listed.filter((p) => p.review.status === 'verified').length,
};
