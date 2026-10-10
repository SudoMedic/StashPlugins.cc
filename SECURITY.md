# Security policy

## Reporting a malicious or unsafe plugin

If a plugin listed on StashPlugins steals data, contacts unexpected servers, damages a Stash library or otherwise
behaves maliciously:

1. Open an issue with the **Report a plugin** template. Include the plugin page URL, the version and what you
   observed. Do not post credentials or personal data.
2. If you are a reviewer, open a revoke proposal so the plugin is hidden as soon as it is approved:

   ```sh
   npm run ledger -- revoke <plugin-slug> --by <login> --reason "<what it does>" --all-versions
   ```

Revocations need fewer approvals than other changes (see [GOVERNANCE.md](GOVERNANCE.md#quorum)) so they can be
merged quickly. Please also report the problem to the plugin's author and, where relevant, to the
[Stash community forum](https://discourse.stashapp.cc/).

## Reporting a vulnerability in this site

For vulnerabilities in the site, the crawler, the ledger tooling or the GitHub workflows, report privately through
[GitHub security advisories](https://github.com/SudoMedic/StashPlugins.cc/security/advisories/new) instead of a public
issue. Include steps to reproduce and the impact.

Examples of issues in scope:

- A way to merge a pull request without the required `community-quorum` approvals
- A way to change or remove ledger entries without failing verification
- Script injection through crawled data such as plugin names, descriptions or READMEs
- A workflow that runs untrusted pull request code with write permissions

## Supported versions

Only the current `main` branch and the deployed site are supported.
