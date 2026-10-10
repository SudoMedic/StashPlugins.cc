## Summary

<!-- What does this change, and why? -->

## Type of change

- [ ] Ledger proposal (approve, revoke, add or remove a source or reviewer)
- [ ] Bug fix
- [ ] Feature or improvement
- [ ] Documentation

## Checklist for ledger proposals

- [ ] Entries were created with `npm run ledger` and only `registry/ledger.jsonl` is changed
- [ ] For approvals: ran `npm run ledger -- inspect <slug>` and read every file in the package
- [ ] For approvals: found no unexpected network access, credential access or obfuscated code
- [ ] Disclosed above if I maintain the source repository

## Checklist for code changes

- [ ] `npm test`, `npm run ledger -- verify` and `npm run build` pass
- [ ] Tests added or updated where relevant

See [GOVERNANCE.md](../GOVERNANCE.md) for how votes are counted.
