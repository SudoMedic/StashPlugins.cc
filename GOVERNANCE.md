# Governance

StashPlugins has no owner who decides what is safe. Every decision is a vote by several independent people, recorded
in a public, hash-chained ledger that anyone can copy, verify or fork.

## The ledger

[`registry/ledger.jsonl`](registry/ledger.jsonl) has one JSON entry per line. Each entry has a `seq`, the `hash` of
the entry before it (`prev`), and its own `hash`: the SHA-256 of the entry's canonical JSON (keys sorted, `hash`
left out). Changing or deleting any past entry changes its hash and breaks every later entry.
`npm run ledger -- verify` checks the whole chain, and CI, the crawler and the site build all refuse an invalid one.

| Entry | Effect |
| --- | --- |
| `genesis` | First entry; lists the bootstrap reviewers. |
| `approve` | Pins `source` + package `id` + `sha256`. That exact zip shows as **Community verified**. |
| `revoke` | With a `sha256`: blocks that version. Without one: blocks every version, including future ones, until a later `approve`. |
| `add-source` | Crawls an index even if it isn't on the forum list. |
| `remove-source` | Drops a source and all its plugins from the site (spam, abuse). |
| `add-reviewer` / `remove-reviewer` | Changes who can vote. |

The `sha256` is the one in the source's `index.yml`, and Stash checks the downloaded zip against it before
installing. If an author ships new code, the hash changes and the plugin shows **Changed since review** until it is
approved again. Nobody can slip new code in under an old approval.

## Voting

1. **Propose.** Run a ledger command and open a pull request with the appended line:

   ```sh
   npm run ledger -- inspect <plugin-slug>                     # download, check sha256, unpack to .cache/review/
   npm run ledger -- approve <plugin-or-source-slug> --by <you> --note "read all files; no network calls"
   npm run ledger -- revoke <plugin-slug> --by <you> --reason "sends API key to example.com" [--all-versions]
   npm run ledger -- add-source <index-url> --by <you>
   npm run ledger -- remove-source <index-url-or-slug> --by <you> --reason "spam"
   npm run ledger -- add-reviewer <login> --by <you>
   ```

   Slugs are the last part of a plugin's URL on the site (`/plugins/<slug>/`). `--by` must be your GitHub login,
   because the vote counter rejects entries signed by anyone other than the pull request's author.

2. **Vote.** Reviewers read the code and leave a GitHub review: **Approve** to vote yes, **Request changes** to veto.

3. **Count.** The *Community quorum* workflow posts a `community-quorum` status: pending until enough votes are in,
   success at quorum, failure on a veto or an invalid change. A vote counts only when:
   - the voter is in the ledger's reviewer set on the base branch (you can't add yourself and vote in one PR),
   - their GitHub account is at least `reviewer.minAccountAgeDays` old,
   - they did not open the pull request,
   - they don't own the repo behind the source being voted on,
   - the approval is on the pull request's latest commit (pushing anything new resets the votes).

4. **Merge.** When the status is green, any maintainer merges. The site picks it up on the next deploy.

### How many votes

Set in [`registry/governance.json`](registry/governance.json). A pull request needs the highest quorum of anything
it touches.

| Key | Applies to | Default |
| --- | --- | --- |
| `approve` | approving plugin versions | 2 |
| `revoke` | takedowns, kept low so malware comes down fast | 1 |
| `add-source` / `remove-source` | sources | 2 |
| `add-reviewer` / `remove-reviewer` | reviewer set | 2 |
| `code` | any other file in the repo | 2 |
| `governance` | `governance.json`, the vote counter, `parse.mjs`, `.github/`, `LICENSE` | 3 |

Other settings:
- `vetoes`: requests for changes from eligible reviewers that block a pull request.
- `reviewer.minAccountAgeDays`: minimum GitHub account age for a vote to count.
- `proposer.minAccountAgeDays`: minimum account age to open a proposal at all; this is the anti-spam check.
- `proposer.maxEntriesPerPullRequest`: maximum ledger entries in one pull request.
- `listing`: `"all"` lists every plugin with its status. `"verified"` lists and offers install snippets only for
  community-verified versions.

Every change involves at least two people: the one proposing it and someone else approving it. While the reviewer
set is smaller than a quorum, the requirement drops to "every eligible reviewer". The one exception is a reviewer's
own pull request when no other reviewer exists yet. That only happens at bootstrap, and it's visible in the ledger.

## Repository settings (one-time, by the owner)

The vote counter only binds if GitHub enforces it. On *Settings → Branches → Branch protection rules* for `main`:

- **Require status checks to pass:** add `community-quorum` (and `test-and-build`).
- **Require a pull request before merging**, and **Do not allow bypassing the above settings**, so admins follow
  the same rules.
- Disable force pushes and deletions.

Then:

- Keep write access to as few people as possible. Contributors and reviewers work from forks, and reviewers don't
  need write access to vote. A fork's workflows get a read-only token and can't fake the `community-quorum` status.
- *Settings → Actions → General → Fork pull request workflows*: require approval for first-time contributors.
- Add more people to the genesis reviewer set, or add them with `add-reviewer` pull requests, until the reviewer
  set is larger than the biggest quorum.

## Why this works (and its limits)

- **Tamper-evident.** History lives in git and in the hash chain. Every clone and fork is a full copy that can be
  checked with `npm run ledger -- verify`, and the published site serves `/ledger.jsonl`.
- **No tokens or mining.** A vote is a signed-in GitHub review, so it's one account, one vote. Account-age limits,
  the reviewer set and per-source conflict checks make sock puppets expensive.
- **Forkable.** Everything is MIT licensed. If the community disagrees with the maintainers, it can fork the repo,
  ledger included, and carry on with the same history.
- **Limits.** Reviewers are people and can miss things; "verified" means reviewed, not guaranteed. GitHub is
  trusted to report who reviewed what. Plugins themselves stay under their authors' licenses; MIT covers this
  site's code and the ledger.
