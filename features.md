# StashPlugins features

StashPlugins is a free, open source directory of every community plugin and theme for Stash. It reads the same
plugin sources Stash does and puts them all in one searchable place. Nobody owns the list: decisions about what is
safe are made by community votes and recorded in a public ledger anyone can check.

## Find plugins

- Every source from the community list of plugin sources in one place, refreshed daily
- Search by name, package id, author, description, runtime or feature
- Filter by type: UI plugins, themes, tasks and hooks, UI plus tasks
- Filter by source, or show only community verified plugins
- Sort by recently updated, newest, oldest, name or author
- Forks and mirrors of the same plugin are grouped, with a toggle to show every copy
- Shareable links: search terms and filters are kept in the address bar

## Plugin pages

- Description, version, package id and requirements from the source's `index.yml`
- Plugin type, runtime (Python, JavaScript, Node, binary) and settings from the plugin manifest
- Last updated and first created dates, author and contributors from the plugin's git history
- Tasks, hooks and settings listed with their descriptions
- README rendered on the page, with unsafe content stripped
- Links to the source code, repository and homepage
- Other sources that offer the same plugin, and more plugins from the same source
- Community review status and the exact SHA-256 of the package

## Install

Every plugin has four ready-to-copy install options:

1. **Add source:** the name, URL and local path to paste into Settings, Plugins, Available Plugins, Add Source
2. **GraphQL:** Stash's `installPackages` mutation for the `/playground` page. Installs directly with no source setup
3. **cURL:** the same mutation from a terminal, with your Stash address and API key (kept in your browser only)
4. **config.yml:** a `plugins.package_sources` entry for headless or Docker setups

- Required plugins are found and added automatically
- Tick several plugins and install them all with one snippet, even across sources
- The Sources page shows every source with its online status and a snippet to add all of them at once

## Community review

- **Votes, not gatekeepers.** Approving a plugin, taking one down, adding or removing a source, and adding or
  removing a reviewer are all pull requests that need approval from several registered reviewers
- **Two-person integrity.** Every change needs at least two people: the one proposing it and someone else
  approving it. Your own pull request never counts as a vote
- **No conflicts of interest.** Reviewers cannot vote on plugins from a repo they own
- **Verified accounts.** A vote only counts from a registered reviewer whose GitHub account is at least 180 days old
- **Fresh votes only.** Approvals must be on the latest change. Pushing anything new resets the votes
- **Veto.** A single request for changes from a reviewer blocks a proposal
- **Spam limits.** Proposals need a GitHub account at least 30 days old, and each proposal is capped at 10 entries
- **Fast takedowns.** Revoking a malicious plugin needs fewer votes than approving one, so bad code comes down fast

### Default vote counts

| Change | Approvals needed |
| --- | --- |
| Approve a plugin version | 2 |
| Revoke a plugin | 1 |
| Add or remove a source | 2 |
| Add or remove a reviewer | 2 |
| Change the site's code | 2 |
| Change the voting rules | 3 |

All numbers are set in `registry/governance.json`, and changing them takes the highest vote count.

## Pinned versions

- An approval pins the SHA-256 of the exact package zip, the same hash Stash checks when it installs
- If an author publishes new code, the plugin shows **Changed since review** until reviewers approve the new version
- A revoked plugin is removed from search and its install snippets are disabled
- A full revoke also blocks future versions until reviewers approve one again
- Every plugin shows one of four statuses: **Community verified**, **Changed since review**, **Not reviewed yet** or
  **Revoked**
- Optional strict mode lists only community verified plugins

## Public ledger

- Every decision is one entry in an append-only ledger, `registry/ledger.jsonl`
- Each entry includes the hash of the one before it, so editing or deleting any past decision breaks the chain,
  much like a blockchain but without tokens or mining
- Every copy and fork of the repo holds the full history
- The site publishes the ledger at `/ledger.jsonl`, and `npm run ledger -- verify` checks it
- The site build, the daily refresh and every pull request check refuse a broken ledger
- The Review page lists the rules, the reviewers, plugins waiting for review and the full ledger

## For reviewers

- `npm run ledger -- inspect <plugin>` downloads the exact zip Stash would install, checks its hash and unpacks it
  for reading
- `npm run ledger -- approve <plugin> --by <you>` records an approval, ready for a pull request
- One command can approve every plugin in a source at once
- The Review page lists approved plugins that have changed since review
- Anyone can apply to be a reviewer with an `add-reviewer` proposal

## Open source

- MIT licensed: free to use, copy, change and build on
- No accounts, tracking or ads. The site is static and hosted on GitHub Pages
- If the community disagrees with the maintainers, it can fork the repo, ledger included, and carry on with the
  same history
- Plugins listed on the site keep their own authors' licenses
