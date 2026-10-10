# StashPlugins features

StashPlugins is a free, open source directory of community plugins and themes for Stash. It reads the same plugin
source indexes that Stash uses and makes them searchable in one place. Plugins are reviewed by registered community
reviewers, and every review decision is recorded in a public ledger.

## Browsing

- Indexes every source on the community list of plugin sources, refreshed daily
- Search by name, package id, author, description, runtime or feature
- Filter by type (UI plugin, theme, tasks and hooks, UI with tasks), by source, or to community verified plugins only
- Sort by last updated, newest, oldest, name or author
- Copies of the same plugin from forks and mirrors are grouped, with an option to show all of them
- Search terms and filters are kept in the URL, so results can be linked

## Plugin pages

- Description, version, package id and requirements from the source index
- Type, runtime (Python, JavaScript, Node or binary) and settings from the plugin manifest
- Author, contributors, first created and last updated dates from the plugin's git history
- Tasks, hooks and settings with their descriptions
- The plugin's README, sanitized before display
- Links to the source code, repository and homepage
- Other sources that offer the same plugin, and other plugins from the same source
- Review status and the SHA-256 hash of the current package

## Installing

Each plugin page provides four installation methods:

1. Add source: the name, URL and local path to enter under Settings, Plugins, Available Plugins, Add Source
2. GraphQL: an `installPackages` mutation to run in Stash's `/playground`, which installs without adding a source
3. cURL: the same mutation for a terminal, using a Stash address and API key stored only in the browser
4. config.yml: a `plugins.package_sources` entry for headless and Docker installations

Required plugins are resolved and included automatically. Several plugins can be selected and installed with a single
snippet, including plugins from different sources. The Sources page lists every source with its current status and
provides a configuration snippet for all of them.

## Community review

- Approving or revoking a plugin, adding or removing a source, and adding or removing a reviewer each require a pull
  request approved by registered reviewers
- Every change involves at least two people; the author of a pull request cannot approve it
- Reviewers cannot vote on plugins from repositories they own
- Votes are counted only from registered reviewers whose GitHub accounts are at least 180 days old
- Approvals must be given on the latest commit; any new commit requires new approvals
- A request for changes from any reviewer blocks the pull request
- Proposals require a GitHub account at least 30 days old and are limited to 10 entries each
- Revocations need fewer approvals than other changes, so malicious plugins can be removed quickly

Default approvals required:

| Change | Approvals |
| --- | --- |
| Approve a plugin version | 2 |
| Revoke a plugin | 1 |
| Add or remove a source | 2 |
| Add or remove a reviewer | 2 |
| Change the site's code | 2 |
| Change the review rules | 3 |

The values are configurable in `registry/governance.json`, and changing them requires the highest number of approvals.

## Version pinning

- An approval records the SHA-256 hash of the exact package, the same hash Stash verifies during installation
- When an author publishes a new version, the plugin is shown as changed since review until the new version is
  approved
- Revoked plugins are removed from search and their install instructions are disabled
- Revoking all versions of a plugin also blocks future versions until one is approved
- Each plugin is shown as community verified, changed since review, not reviewed yet or revoked
- The site can optionally be configured to list community verified plugins only

## Public ledger

- Every decision is an entry in an append-only ledger, `registry/ledger.jsonl`
- Each entry records the hash of the previous entry, similar in principle to a blockchain, so earlier entries cannot be
  altered without invalidating the ledger
- Every clone and fork of the repository contains the complete history
- The site publishes the ledger at `/ledger.jsonl`, and `npm run ledger -- verify` checks it
- Site builds, the daily refresh and pull request checks fail if the ledger does not verify
- The Review page shows the rules, the current reviewers, plugins awaiting review and the full ledger

## Reviewer tools

- `npm run ledger -- inspect <plugin>` downloads the package Stash would install, verifies its hash and extracts it
  for review
- `npm run ledger -- approve <plugin> --by <login>` records an approval for a pull request
- All plugins in a source can be approved in a single entry
- The Review page lists approved plugins that have changed since their last review
- New reviewers are added through the same voting process

## Open source

- Released under the MIT License, free to use, modify and build on
- Static site hosted on GitHub Pages, with no accounts, tracking or advertising
- The repository, including the ledger, can be forked with its full history
- Listed plugins remain under their authors' licenses
- Security policy, contribution guide and issue templates for reporting plugins and bugs
