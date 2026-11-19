# gr-mt-spool-ci-21 — Spool Verify maintenance

Prepared by Codex, 2026-11-19.

## Result

Current `main` at `bb2efcd34837cd6067d02ce176609d3fc636dad2` passed Verify and the project-erasure journey. The comparison from the failing head to this head contains release metadata, package version and the source lock. The erasure code, workflow and journey are identical. The original failure's assertion and cause remain unconfirmed. This maintenance run requires no product change.

The local checkout is `cloud/gr-mt-spool-ci-21` at that same, already published main SHA. Product commits and PRs from this run: zero. The task evidence uses the dedicated evidence ref.

## Plan and findings

1. Identify the failing workflow step and try to retrieve the failed assertion. Verify run 44473682990 at `7db1a39f91289cf56850176e25b55e69629eaa0d` failed in job 135389438776, `verify (project-erasure)`, at `Run suites` (`pnpm test:project-erasure`). The suite step ran from 06:40:33 to 06:44:12 UTC. The `shards (spool)` and `verify` aggregate jobs then failed.
2. Compare that revision with the current advertised main head, run the same suite using the declared Node and pnpm versions, and check current exact-SHA CI. The full local journey passed seven groups and produced ten browser captures. Current-main Verify 44486041326 and same-SHA release branch Verify 44475847586 completed successfully. Run site 44486041117 also completed successfully.
3. Check repository consistency and record the disposition. `pnpm typecheck`, `node src/base/contract-docs.mjs check` and `pnpm source:check` all passed. The tracked checkout diff against main was empty.

## Original run access

`gh run view 44473682990 --repo just-every/run-spool --job 135389438776 --log-failed` exited 0 with empty stdout. A full-log request for the same job also exited 0 with empty stdout. The server-output artifact download via `gh run download 44473682990 --repo just-every/run-spool --name server-output-project-erasure --dir /tmp/gr-mt-spool-ci-21-artifact` returned Forbidden from blob storage. The original assertion could not be inspected. The current-main verification and local reproduction command establish the current result.

## Clause counts

| Tier | Done before → after | Partial before → after | Missing before → after |
| --- | ---: | ---: | ---: |
| Core | 23 → 23 | 45 → 45 | 19 → 19 |
| Agent surface | 0 → 0 | 9 → 9 | 9 → 9 |
| Later | 0 → 0 | 0 → 0 | 0 → 0 |
| Full target | 23 → 23 | 54 → 54 | 28 → 28 |

ERASE-001 remains done. There were zero clause judgments, acceptance changes or test registrations added or removed.

## References

- [Original failed Verify](https://github.com/just-every/run-spool/actions/runs/44473682990)
- [Current main Verify](https://github.com/just-every/run-spool/actions/runs/44486041326)
- [Same-SHA release branch Verify](https://github.com/just-every/run-spool/actions/runs/44475847586)
- [Current main Run site](https://github.com/just-every/run-spool/actions/runs/44486041117)
