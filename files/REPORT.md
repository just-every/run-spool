# gr-spool-qs-1: qs fix pushed; exact-SHA CI blocked

The qs-only product fix is complete and pushed on `cloud/gr-spool-qs-1` at `3ac41cb67cf1d559b1fc9baf838563c80ab195ac`. All required local checks passed. Exact-SHA Verify [44142299489](https://github.com/just-every/run-spool/actions/runs/44142299489) completed/failure because the wizard's external npm install could not resolve `@sentry/server-utils@11.14.0`. This is not the generated-view exception. No READY or landing is claimed.

Security scope: GHSA-6pq8-jhm2-2vcw / Dependabot alert 59. Unique qs versions: **2 → 1**. Vulnerable qs versions: **1 → 0**. Unrelated upgrades: **0**. Added/removed test registrations: **0/0**. Clause status changes: **none**. CLAIM: **none**. No PR.

## Product implementation and plan

PLAN.md is the full plan. The supplied predecessor report and behavior receipt were read first and are retained as PRIOR-REPORT.md and PRIOR-qs-behaviour.json. A fresh full-history clone and fresh fetch established main at `6263ba70f1d0fce4ea1df7e6bf7b4f0d827489e1`; a second fetch before commit confirmed it had not advanced.

Using Node 22.20.0 and pnpm 10.12.4, `pnpm --recursive update qs --lockfile-only` changed Express 5.3.0's qs resolution from 6.16.0 to the already locked 6.17.1 and removed the unused 6.16.0 records. The affected import is packages/agent → @modelcontextprotocol/sdk 1.32.1 → Express. The body-parser path already used 6.17.1. There is no manifest edit, new override, parent upgrade or unrelated dependency upgrade.

Only pnpm-lock.yaml and its generated hash in sources.lock.json changed: two files, two insertions and eleven deletions. The source-lock scope assertion confirms its only changed field is files/pnpm-lock.yaml/sha256 and that this digest matches the lockfile. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are untouched. No test code or fleet evidence was committed to the product branch.

The new commit's tree is `50a2660bbe4b586039fd20b8893c552dc5ddd6c9`, exactly the tree recorded for predecessor candidate 215d2fbf2b70cdbeb0ab6404b062c5ba09bfbeaf. This reproduces the prior product bytes. The tree match does not transfer publication or CI approval.

## Local validation

Frozen install, explicit setup (103 migrations), build, typecheck, source-lock regeneration/check, whitespace and the before/after behavior probe passed. checks.json records actual commands, exits and elapsed times. Setup was run through cloud_run with the requested fleet owner and non-interactive flags. Its access-link log stays private outside the packet; no environment or access link is published. This checkout has no TESTING.md; AGENTS.md, package scripts and Verify supply the available checks.

qs-probe.cjs follows the actual agent SDK's Express import. For an array item with its own toString equal to a string, null or 42, old 6.16.0 throws TypeError; patched 6.17.1 safely emits `a=%5Bobject%20Object%5D`. Ordinary comma strings and nested query parsing pass both versions. The actual results are in qs-before.json and qs-after.json. The optional local agent-handoff journey was left to the full CI wall. No UI changed, so no browser proof is required.

## CI blocker

Verify run **44142299489**, head **3ac41cb67cf1d559b1fc9baf838563c80ab195ac**, completed/failure. Job conclusions: **25 success, 3 failure, 4 skipped**. Contract documentation passed. The originating failure is `verify (wizard)`, job **134248971925**; `shards (spool)` (**134261432748**) and `verify` (**134261479223**) failed downstream. No green from another SHA is used.

The archive was fetched once with:

```sh
gh run view 44142299489 --repo just-every/run-spool --job 134248971925 --log-failed
```

The command exited **0**. The public sanitized failed-step log is ci-wizard-failed.log. It shows npm `ETARGET`: `No matching version found for @sentry/server-utils@11.14.0`, during the stage "configure Next.js and install its SDK". The fixture then asserts `1 !== 0` at tests/setup-flow.mjs:165. The timeout did not cause this failure: the wizard cleaned up after about 30 seconds.

packages/sdk/src/setup/plans.mjs:9 requests unpinned `@sentry/nextjs`. That setup plan and tests/setup-flow.mjs are byte-for-byte unchanged from origin/main. The failure occurs while installing this external SDK in the fresh Next.js fixture, outside the transitive qs update. Pinning/changing this SDK path would widen the explicitly qs-only assignment, so no additional product change was made. Registry availability may change later; no later successful install is inferred.

All **10** GitHub calls in the task budget were used: two predecessor reads, exact-SHA discovery, five spaced status polls, failed-job discovery and one originating failed-job archive read. api-budget.json is the ledger. Downstream aggregation logs were not fetched after budget exhaustion; the originating failure is fully recorded. No rerun was requested without budget. The default next step is to rerun Verify on this existing SHA after npm can supply the requested SDK dependency; a separate wizard pinning fix requires separate scope.

## Product custody and remaining landing gate

The sole product commit has fleet author and committer identities and no trailers. The required all-candidate identity audit passed before the single product push. The cloud push guard succeeded on its first attempt, and remote-product-ref.txt independently confirms the exact branch/head. The working tree is clean. No product push was rejected and no finished unpushed work remains.

The cloud adaptation reserves the fleet publication scan and landing for its Mac and says this cloud cannot run that scan. The Mac-only .tools/publish-check.sh helper is not shipped here. No scan command was run, no COMPLETE receipt is claimed, no prior INCOMPLETE scan is promoted and no gate is waived. Before landing, the fleet still must run the brief's once-only scan on a fresh full-history clone of this committed ref, requiring COMPLETE with zero NEW findings. The required scan arguments are recorded in receipt.json. Main was never pushed, no published history was rewritten and no PR was created.

The actual non-secret report packet is retained outside the product clone. Its separate evidence publication transfers reports only; it does not signal product READY, acceptance, publication-scan approval or landing.
