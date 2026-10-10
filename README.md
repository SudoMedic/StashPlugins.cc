# StashPlugins

A searchable directory of every community plugin and theme for [Stash](https://github.com/stashapp/stash), built from the
[community list of plugin sources](https://discourse.stashapp.cc/t/list-of-plugin-sources/122).

In Stash, a plugin source has to be added before its plugins can be browsed, and each source is listed separately.
This site indexes all ~90 community sources in one place. Plugins can be searched, filtered by type or source, sorted
by date or name, and installed with a generated snippet.

## How it works

1. **Collect.** Once a day, the crawler reads every source on the community list, plus sources added through the
   ledger. It downloads each source's `index.yml` (the same file Stash reads), then reads each plugin's manifest,
   README and git history from its repository.
2. **Check.** Each package's SHA-256 hash from the index is compared with the community review ledger,
   `registry/ledger.jsonl`. A plugin is shown as community verified when reviewers have approved that exact hash,
   changed since review when only an earlier version was approved, not reviewed yet, or revoked.
3. **Review.** Changes to the ledger are made by pull request. Each pull request needs approvals from registered
   reviewers other than its author, and the number required depends on the type of change. A GitHub Actions workflow
   counts the approvals and reports the result as a required status check. Each ledger entry records the hash of the
   previous entry, so earlier decisions cannot be altered without invalidating the ledger.
4. **Publish.** The site is built as static pages and deployed to GitHub Pages. Revoked plugins are left out of
   search and their install instructions are disabled. Removed sources are dropped from the site.
5. **Install.** Each plugin page generates install instructions for the Stash UI, GraphQL, cURL and `config.yml`.
   Stash checks the downloaded package against the same SHA-256 hash before installing it.

See [GOVERNANCE.md](GOVERNANCE.md) for the full review process.

## What each plugin shows

| Field | Where it comes from |
| --- | --- |
| Name, description, version, requirements | The source's `index.yml`, the same file Stash reads |
| Type (UI, theme, tasks & hooks), runtime, settings | The plugin manifest (`<id>.yml`) in the repo, or inside the package zip |
| Last updated, first created, author, contributors | `git log` of the plugin's folder (`--follow` on the manifest catches moves) |
| Repo / source links, README | The git repo behind the source URL |

When a source's code lives outside its repo, dates come from when the package id first and last changed in the index file.

## Community review

Plugin approvals are decided by community vote. Approving or revoking a plugin, adding or removing a source, and
adding or removing a reviewer are each a pull request that appends one entry to
[`registry/ledger.jsonl`](registry/ledger.jsonl). A pull request is mergeable only after enough registered reviewers
approve it on GitHub. Approvals from the pull request author and from the owner of the plugin's repository are not
counted. Each ledger entry records the hash of the previous entry, so earlier entries cannot be changed without
invalidating the ledger.

An approval pins the package's SHA-256, the same hash Stash verifies on install. Plugins show as
**Community verified**, **Changed since review** (new code since the approval), **Not reviewed yet**, or
**Revoked** (hidden, with no install snippets). Rules, vote counts and repo settings are in [GOVERNANCE.md](GOVERNANCE.md).

```sh
npm run ledger -- inspect <plugin-slug>              # unpack the exact zip Stash would install
npm run ledger -- approve <plugin-slug> --by <you>   # append an approval, then open a pull request
npm run ledger -- verify                             # check the whole hash chain
```

## Install snippets

Every plugin has four options:

1. **Add source**: name, URL and local path to paste into *Settings → Plugins → Available Plugins → Add Source*.
2. **GraphQL**: Stash's `installPackages` mutation for `/playground`. Installs directly; no source needed.
3. **cURL**: the same mutation from a terminal. Users can set their Stash address and API key (kept in their browser only).
4. **config.yml**: a `plugins.package_sources` entry.

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
scripts/lib/ledger.mjs   ledger hash chain, review status and vote counting (unit tested)
scripts/ledger.mjs       ledger CLI: verify, inspect, approve, revoke, sources, reviewers, check-prs
registry/ledger.jsonl    the community review ledger (append-only)
registry/governance.json how many approvals each kind of change needs
data/sources.json        last good copy of the forum list (fallback if the forum is down)
data/overrides.json      per-source fixes: { "<index url>": { "name": "...", "repo": { "host", "owner", "name", "branch" } } }
src/data/catalog.json    crawled data, committed so PR builds are offline and reproducible
src/lib/                 shared by server pages and browser: catalog, cards, snippets, install panel
src/pages/               browse page, /plugins/<slug>/, /sources/, /guide/, /plugins.json
```

## Deploy

Deployment runs on GitHub Actions:

- **CI** (`.github/workflows/ci.yml`): tests and builds every PR from the committed catalog.
- **Crawl and deploy** (`.github/workflows/deploy.yml`): on push to `main`, daily at 05:17 UTC, or by hand:
  re-crawls all sources, builds, and publishes to GitHub Pages. If the crawl fails it ships the committed snapshot.
- **Community quorum** (`.github/workflows/quorum.yml`): counts reviewer votes on open PRs and posts the
  `community-quorum` status. Make it a required check on `main` (see [GOVERNANCE.md](GOVERNANCE.md#repository-settings)).

One-time setup: *Settings → Pages → Source: GitHub Actions*. For the custom domain, add `stashplugins.cc` under
*Settings → Pages → Custom domain* and point DNS at GitHub Pages. The build picks up the domain or project path automatically.

## Adding a source

Add it to the [forum list](https://discourse.stashapp.cc/t/list-of-plugin-sources/122). It appears here after the next daily crawl.
A source can also be proposed directly with `npm run ledger -- add-source <index-url> --by <you>`.

## License

Released under the [MIT License](LICENSE). Plugins listed on the site are distributed under their authors' own licenses.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and pull request guidelines, and
[SECURITY.md](SECURITY.md) for reporting a malicious plugin or a vulnerability in this site.
