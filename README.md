# StashPlugins

A searchable directory of every community plugin and theme for [Stash](https://github.com/stashapp/stash), built from the
[community list of plugin sources](https://discourse.stashapp.cc/t/list-of-plugin-sources/122).

Stash makes you add a source, then scroll an unsorted list. This site puts all ~90 sources in one place:
search, filter by type or source, sort by updated/created/name, and copy a snippet that installs the plugin.

## What each plugin shows

| Field | Where it comes from |
| --- | --- |
| Name, description, version, requirements | The source's `index.yml` — the same file Stash reads |
| Type (UI, theme, tasks & hooks), runtime, settings | The plugin manifest (`<id>.yml`) in the repo, or inside the package zip |
| Last updated, first created, author, contributors | `git log` of the plugin's folder (`--follow` on the manifest catches moves) |
| Repo / source links, README | The git repo behind the source URL |

When a source's code lives outside its repo, dates come from when the package id first and last changed in the index file.

## Install snippets

Every plugin has four options:

1. **Add source** — name, URL and local path to paste into *Settings → Plugins → Available Plugins → Add Source*.
2. **GraphQL** — Stash's `installPackages` mutation for `/playground`. Installs directly; no source needed.
3. **cURL** — the same mutation from a terminal. Users can set their Stash address and API key (kept in their browser only).
4. **config.yml** — a `plugins.package_sources` entry.

Required plugins are resolved (same source first, then any source) and added automatically.
Tick several cards to install them all with one snippet.

## Develop

```sh
npm install
npm run crawl   # rebuilds src/data/catalog.json (~1 min; clones repos into .cache/)
npm run dev     # http://localhost:4321
npm test
npm run build   # static site in dist/
```

Crawler env vars: `GITHUB_TOKEN` (adds repo stars, license, archived flag), `CONCURRENCY` (default 6),
`ONLY=<substring>` (crawl matching sources only), `CACHE_DIR`.

Behind a proxy on Node 22, run the crawler with `NODE_USE_ENV_PROXY=1`.

### Layout

```
scripts/crawl.mjs        crawler: forum list → index.yml → git repos → catalog.json
scripts/lib/parse.mjs    pure parsing helpers (unit tested)
scripts/lib/zip.mjs      reads manifests out of package zips
data/sources.json        last good copy of the forum list (fallback if the forum is down)
data/overrides.json      per-source fixes: { "<index url>": { "name": "...", "repo": { "host", "owner", "name", "branch" } } }
src/data/catalog.json    crawled data, committed so PR builds are offline and reproducible
src/lib/                 shared by server pages and browser: catalog, cards, snippets, install panel
src/pages/               browse page, /plugins/<slug>/, /sources/, /guide/, /plugins.json
```

## Deploy

GitHub Actions does everything:

- **CI** (`.github/workflows/ci.yml`) — tests and builds every PR from the committed catalog.
- **Crawl and deploy** (`.github/workflows/deploy.yml`) — on push to `main`, daily at 05:17 UTC, or by hand:
  re-crawls all sources, builds, and publishes to GitHub Pages. If the crawl fails it ships the committed snapshot.

One-time setup: *Settings → Pages → Source: GitHub Actions*. For the custom domain, add `stashplugins.cc` under
*Settings → Pages → Custom domain* and point DNS at GitHub Pages. The public domain is pinned as `SITE_URL` in
`deploy.yml`, so canonical and share links never use the github.io address.

## Adding a source

Add it to the [forum list](https://discourse.stashapp.cc/t/list-of-plugin-sources/122). It appears here after the next daily crawl.
