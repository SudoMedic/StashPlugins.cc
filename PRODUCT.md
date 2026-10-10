# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: people who run their own Stash instance and want to find, judge and install community plugins and themes quickly. They often have the site open next to their Stash tab, search for a name or feature, check whether a plugin is community verified, then copy an install snippet.

Secondary: registered reviewers and plugin authors, who use the Review page and the ledger to see what needs review, follow vote counts and check the hash chain.

## Product Purpose

Stash only lets a user browse plugins after adding each plugin source separately, and the community maintains about 90 sources. StashPlugins indexes every source on the community list in one searchable directory, shows where each plugin comes from and how fresh it is, and generates install instructions for the Stash UI, GraphQL, cURL and `config.yml`.

Success: a Stash user finds the plugin they need, can tell whether reviewers approved the exact version on offer, and installs it without hunting for its source.

## Positioning

One index of every community source, combined with community review that pins the exact package SHA-256 Stash verifies on install. Approvals, revocations and reviewer changes are votes recorded in a public, append-only, hash-chained ledger (`registry/ledger.jsonl`), so the review status shown on the site can be checked independently.

## Operating Context

- Data is crawled once a day from the forum's list of plugin sources, each source's `index.yml`, and the plugins' git history. The catalog is committed so builds are reproducible.
- The site is static (Astro) and deployed to GitHub Pages at stashplugins.cc.
- Review happens through GitHub pull requests against the ledger; a GitHub Actions check counts reviewer approvals.
- Users paste snippets into Stash's Settings, the GraphQL playground, a terminal, or `config.yml`.

## Capabilities and Constraints

- Search, filter by type and source, sort, toggle verified-only and duplicates; state lives in the URL.
- Multi-select cards to install several plugins with one snippet; requirements are resolved automatically.
- The Stash address and API key a user enters stay in their browser only.
- Plugin statuses: Community verified, Changed since review, Not reviewed yet, Revoked. Revoked plugins are hidden from search and their install snippets are disabled.
- README content is third-party and sanitized before rendering.
- The site is not affiliated with the Stash project.

## Brand Commitments

- Name: StashPlugins, set as "Stash" plus "Plugins" with the second word in the accent color.
- Mark: the amber outlined cube in `public/favicon.svg`. It is a protected brand mark.
- Voice: plain, descriptive, factual. No em dashes in copy or docs.

## Evidence on Hand

- Live catalog counts (plugins, sources, authors, verified) come from `src/data/catalog.json` and are computed at build time.
- The review ledger and governance rules: `registry/ledger.jsonl`, `registry/governance.json`.
- No testimonials, user counts, press or screenshots of Stash exist in the repo. Do not invent them.

## Product Principles

1. Finding comes first: search and filters are the first thing on the page and never wait on decoration.
2. Trust is shown, not claimed: every review status links to the ledger entry that decided it.
3. Plugins are third-party code: the site always tells users to read the source and never overstates what review covers.
4. Copy-paste must be exact: snippets are generated from the same data Stash reads.

## Accessibility & Inclusion

WCAG 2.2 AA. Full keyboard use (the `/` shortcut focuses search, install tabs support arrow keys), visible focus, light and dark themes that follow the system setting, and reduced-motion support.
