# Contributing

Contributions are welcome, whether they are plugin reviews, source changes, bug reports or code.

## Reviews and ledger proposals

Approving or revoking plugins, adding or removing sources and adding reviewers all go through the ledger. See
[GOVERNANCE.md](GOVERNANCE.md) for the process and the number of approvals each change needs. A ledger pull request
should contain only the new lines in `registry/ledger.jsonl`, created with `npm run ledger`. Do not edit existing lines.

## Development

Requirements: Node.js 22.18 or later (the CI uses Node 24) and git.

```sh
npm install
npm run dev                   # http://localhost:4321
npm test                      # unit tests
npm run ledger -- verify      # check the ledger
npm run build                 # static site in dist/
```

`npm run crawl` rebuilds `src/data/catalog.json` from every source. It takes about a minute and clones each plugin
repository into `.cache/`. Set `ONLY=<substring>` to crawl matching sources only. The committed catalog is used for
pull request builds, so a crawl is only needed when changing the crawler.

## Pull requests

- Work from a fork and open the pull request against `main`.
- Keep each pull request to one change, and keep ledger proposals separate from code changes.
- Add or update tests in `test/` for changes to the crawler, parsing, snippets or ledger rules.
- Make sure `npm test`, `npm run ledger -- verify` and `npm run build` pass.
- Code changes need approvals from reviewers like any other change (see [GOVERNANCE.md](GOVERNANCE.md#quorum)).

## Reporting problems

Use the issue templates for bugs and for reporting plugins. Report vulnerabilities in the site privately as described
in [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
