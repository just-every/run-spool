# gr-mt-spool-ci-11: Verify maintenance result

Written by Run Edit Run fleet, 16 November 2026 (UTC).

Disposition: **no-change**. The reported default-branch failure has already been superseded by a successful full Verify run on the current default-branch commit. No product repair or landing is needed from this task.

Repository: `just-every/run-spool`.
Local branch: `cloud/gr-mt-spool-ci-11`.
Exact HEAD / current main: `e29a9f44ad44315d65b4e12d7f2e69b739f67233`.
Clone: `/home/agent/rer-consolidation/work/maint/gr-mt-spool-ci-11/repo`.
Product commits created: zero. Product pushes: zero. PR: none.

## Plan and completed results

1. Set the fleet Git identity, refresh the launcher, read its AGENTS.md and the supplied RULES.md, install the fleet credential helper/push guard, and clone only the declared write repository with full history. Create the named cloud branch from origin/main and install the fleet hooks. Completed.
2. Read the repository's AGENTS.md, CLAUDE.md, package pins, contract and generated acceptance instructions. Discover the original run's failures and read each direct failed job's log once. Completed; the two log commands returned exit 0 and zero bytes, so the historical assertion text is unavailable. No assertion diagnosis is invented.
3. Check whether current main already resolves the failure before editing anything. Completed: current main has successful Verify runs 43966152100 and 43931474874. Inspect the newest run's jobs to distinguish real suite execution from reused or skipped coverage. Both previously failing suites ran and passed.
4. Make the smallest repair only if still needed. No repair is needed: the maintenance brief explicitly permits no-change when the current default branch is verified fixed. Preserve all source, tests, workflows, contract judgments and generated views.
5. Validate local installation, build and typecheck; retain actual evidence and report the no-change result. Completed. Publish the report packet only through `evidence/gr-mt-spool-ci-11`; this is separate from product custody.

## Original failure and superseding proof

Original Verify: https://github.com/just-every/run-spool/actions/runs/42130609799

Original SHA: `1045eb74227c9cba54a7e5d6acb120b3daab6d99`.
The jobs endpoint confirms two direct failures:

- `runtime (ruby)`, job 127606490207, step `Run ruby SDK journey`.
- `verify (owner-ui)`, job 127606490375, step `Run suites`.

`shards (spool)` and `verify` also failed as aggregators. The two requested `gh run view ... --job ... --log-failed` reads each exited successfully with empty stdout and stderr. Their empty actual logs and command/exit receipts are retained. No blocked blob download was retried, and no historical root cause is asserted.

Current-main Verify: https://github.com/just-every/run-spool/actions/runs/43966152100

REST returned `status=completed`, `conclusion=success`, `head_sha=e29a9f44ad44315d65b4e12d7f2e69b739f67233`. The Git remote's main ref independently matched this SHA.

- `runtime (ruby)`, job 133646724649: success; `Run ruby SDK journey` ran from 22:04:42 to 22:05:09 UTC on 16 November.
- `verify (owner-ui)`, job 133646724949: success; `Run suites` ran from 22:04:33 to 22:10:11 UTC; `Check hosted output and hydration` also passed.
- `shards (spool)`, job 133658758487: success.
- `verify`, job 133658857519: success.

This is actual full coverage, including both formerly red jobs, rather than a conclusion inferred from skipped suite jobs. The same exact SHA also has successful Run site 43966151796 and an earlier successful Verify 43931474874.

The current workflow still runs the Ruby SDK journey (`node tests/sdk-runtimes.mjs ruby`) and owner UI/admission suites (`pnpm test:accessibility && pnpm test:admission`). Relevant changes already on main include the Ruby fixture dependency update 1c649c2 and subsequent owner/triage work; without the historical assertion logs, these are context, not a claimed causal diagnosis.

## Local validation

- `cloud_run pnpm install --frozen-lockfile`: passed.
- `cloud_run npx -y @runeditrun/rer build`: passed initially with Node 24.19.0, which the supplied shim retained because it was newer than the pin. Its actual log is `build-node24.log`.
- Installed the exact Node 22.20.0 pin and reran `cloud_run npx -y @runeditrun/rer build` with Node 22.20.0 / pnpm 10.12.4: passed; `build.log`.
- `cloud_run pnpm typecheck` with Node 22.20.0 / pnpm 10.12.4: passed; `typecheck.log`.
- Full local Verify was not run, as instructed. No files were touched, so no new tests were needed. The original suites were not rerun locally; Ruby and Bundler are absent in this VM. Their successful exact-main CI execution is recorded above.
- No dev server or browser was started. Build commands ran under the prescribed child subreaper and completed.
- Git working tree and index remained clean; local HEAD equals origin/main. No source lock regeneration or contract regeneration was needed.

## Counts and clause status

The original run had 31 jobs: 23 successful, 4 failed, 4 skipped. The current full run has 32 jobs: 28 successful, 0 failed, 4 skipped. Direct target failures went from 2 to 0. These counts describe different actual runs and are not a claim that this task changed job registrations.

This task added 0 tests, removed 0 tests, changed 0 product files and created 0 product commits. Clause Status, Gap, Evidence, acceptance text and generated views are unchanged. The checked-in acceptance summary remains 23 done / 54 partial / 28 missing, 105 total; this task makes no new clause claim or promotion.

## Custody, limitations and defaults

`result.json` is written both at the maintenance work root and in this packet. Its `status` is `no-change`. Its `security` is false to record that no new product publication scan was run; this does not report a detected vulnerability. There is no new product tree or product push to scan. The branch is local only, and no READY/PUSHED product claim is made.

Default adopted: use the brief's explicit no-change path after verifying current main already passes. Do not create a no-op product commit, rerun a successful workflow, open a PR, or push the default branch.

No product blocker remains. Historical failure details are unavailable because both prescribed failed-job log reads returned empty output. This limits historical diagnosis, not the observed successful current-main outcome. Seven logical GitHub read invocations were used; no polling loop or retries were used.

The clone and complete actual non-secret packet are retained for fleet custody. Reports are published only to the required evidence ref, which carries no product acceptance or landing signal.
