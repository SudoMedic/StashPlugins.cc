# Governance

This document describes how plugins, sources and reviewers are approved on StashPlugins, how votes are counted, and
the repository settings required to enforce the process.

## Ledger

All review decisions are recorded in [`registry/ledger.jsonl`](registry/ledger.jsonl), one JSON object per line.
Each entry has a sequence number (`seq`), the hash of the previous entry (`prev`) and its own `hash`, which is the
SHA-256 of the entry's canonical JSON with keys sorted and the `hash` field omitted. Because each hash depends on the
one before it, changing or removing an earlier entry invalidates every later entry.

`npm run ledger -- verify` checks the full ledger. CI, the crawler and the site build fail if the ledger is invalid.

| Entry type | Effect |
| --- | --- |
| `genesis` | First entry. Lists the initial reviewers. |
| `approve` | Records a reviewed package version by `source`, package `id` and `sha256`. That version is shown as community verified. |
| `revoke` | With a `sha256`, blocks that version. Without one, blocks every version of the package, including later ones, until a new `approve`. |
| `add-source` | Adds a package index to the crawl, whether or not it is on the forum list. |
| `remove-source` | Removes a source and all of its plugins from the site. |
| `add-reviewer` / `remove-reviewer` | Changes the set of reviewers whose votes are counted. |

The `sha256` recorded in an approval is the value from the source's `index.yml`. Stash verifies downloaded packages
against that value before installing them. When an author publishes a new version, its hash differs from the
approved one and the plugin is shown as changed since review until the new version is approved.

## Proposals

A proposal is a pull request that appends entries to the ledger. Entries are created with the ledger CLI:

```sh
npm run ledger -- inspect <plugin-slug>
npm run ledger -- approve <plugin-or-source-slug> --by <login> [--note "..."]
npm run ledger -- revoke <plugin-slug> --by <login> --reason "..." [--all-versions]
npm run ledger -- add-source <index-url> --by <login> [--note "..."]
npm run ledger -- remove-source <index-url-or-slug> --by <login> --reason "..."
npm run ledger -- add-reviewer <login> --by <login> [--note "..."]
npm run ledger -- remove-reviewer <login> --by <login> --reason "..."
```

`inspect` downloads the package zip, checks it against the index hash and extracts it to `.cache/review/` for reading.
A plugin slug is the last segment of the plugin's URL on the site (`/plugins/<slug>/`). The `--by` value must be the
GitHub login of the pull request author.

## Voting

Reviewers vote with GitHub pull request reviews. An approving review is a vote in favor; a review requesting changes
is a veto.

The *Community quorum* workflow evaluates every open pull request and sets the `community-quorum` commit status to
pending, success or failure. An approval is counted only if all of the following are true:

- The reviewer is in the reviewer set on the base branch. Reviewers added by the same pull request do not count.
- The reviewer's GitHub account is at least `reviewer.minAccountAgeDays` old.
- The reviewer is not the author of the pull request.
- The reviewer does not own the repository of a source the pull request approves, revokes or adds.
- The approval was given on the pull request's latest commit.

The status is set to failure if the pull request contains an invalid or out-of-order ledger entry, an entry whose
`by` does not match the author, more entries than allowed, or a veto. Proposals from accounts younger than
`proposer.minAccountAgeDays` are rejected.

The workflow runs from the default branch (`pull_request_target`, `workflow_run` and a scheduled run every 30
minutes). It reads files from the pull request with `git show` and does not check out or execute pull request code,
so a pull request cannot change the rules used to evaluate it.

## Quorum

Quorum settings are in [`registry/governance.json`](registry/governance.json). A pull request must meet the highest
quorum of any change it contains.

| Key | Applies to | Default |
| --- | --- | --- |
| `approve` | Approving package versions | 2 |
| `revoke` | Revoking package versions | 1 |
| `add-source`, `remove-source` | Sources | 2 |
| `add-reviewer`, `remove-reviewer` | The reviewer set | 2 |
| `code` | Any other file in the repository | 2 |
| `governance` | `governance.json`, the ledger code, `parse.mjs`, `.github/` and `LICENSE` | 3 |

Revocation has a lower quorum so that a malicious plugin can be removed quickly.

Other settings:

| Key | Meaning |
| --- | --- |
| `vetoes` | Number of change requests from eligible reviewers that block a pull request. |
| `reviewer.minAccountAgeDays` | Minimum GitHub account age for a vote to be counted. |
| `proposer.minAccountAgeDays` | Minimum GitHub account age to submit a proposal. |
| `proposer.maxEntriesPerPullRequest` | Maximum number of ledger entries in one pull request. |
| `listing` | `all` lists every plugin with its review status. `verified` lists and offers install instructions for community verified versions only. |

Every change requires at least two people: the author and one other reviewer. When fewer eligible reviewers exist
than the configured quorum, the requirement is reduced to the number of eligible reviewers. The only case in which
no approval is required is a pull request from a reviewer when no other eligible reviewer exists, which can occur only
while the project is being set up.

## Repository settings

The `community-quorum` status is only binding when GitHub enforces it. The repository owner should configure the
following under *Settings, Branches* for `main`:

- Require status checks to pass before merging: `community-quorum` and `test-and-build`.
- Require a pull request before merging.
- Do not allow bypassing the above settings, so that administrators follow the same rules.
- Block force pushes and branch deletion.

And additionally:

- Limit write access to maintainers. Contributors and reviewers work from forks; reviewers do not need write access
  to vote. Workflows triggered from forks receive a read-only token and cannot set the `community-quorum` status.
- Under *Settings, Actions, General*, require approval for workflow runs from first-time contributors.
- Add reviewers until the reviewer set is larger than the highest quorum.

## Security model

- The ledger is append-only and hash-chained. Any clone or fork can be verified independently, and the published
  site serves a copy at `/ledger.jsonl`.
- Votes are tied to GitHub accounts. Account age requirements, a curated reviewer set and the conflict-of-interest
  rule limit the effect of throwaway or duplicate accounts.
- Approvals are bound to exact package hashes, so a later change to a plugin requires a new review.
- The project and its ledger are MIT licensed and can be forked with their full history.

## Limitations

- A community verified status means that reviewers examined that version. It is not a guarantee that the code is
  free of defects or malicious behavior.
- The process relies on GitHub to report pull request reviews and account details accurately.
- Plugins are distributed by their authors under their own licenses. The MIT License covers this site's code and the
  ledger.
