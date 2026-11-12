# Spool 0.7.8 rebased-head CI triage

Status: Done. Exact-head Verify 43240964821 attempt 2 is completed/success after the one permitted failed-product-shard retry. No product change was made.

## Scope and provenance

Repository: just-every/run-spool. Task: sd-spool-release-0-7-8-rebased-ci-triage-1. Investigation target: 47ecaeeec8c442aa4648ad3b7f4fc1d7e1f115e2, Verify 43240964821. REST reports the tested branch as cloud/sd-spool-release-0-7-8-rebase-47ecaeeec8c442aa4648ad3b7f4fc1d7e1f115e2. The brief names cloud/sd-spool-release-0-7-8 as the original release branch. These are kept distinct from this task's local report-only branch, cloud/sd-spool-release-0-7-8-rebased-ci-triage-1, created from main 461eb0f58adf9456aef587866dd013d628c38b9f.

No product files were edited; no product commit, product push, PR, tag, release, production operation, source lock regeneration, contract generation, clause change, landing-record change or readmission was performed. The separate evidence ref carries reports only. The main snapshot and test-source comparison are investigation context, not passing CI evidence for the release head.

The original pre-integration candidate d371ff60 and Verify 43229401150 attempt 2 were green according to the supplied brief. That was a different SHA; its retry does not consume this head's retry and its green result cannot qualify this head. No API calls were spent re-reading that historical run.

## Actual failure

Verify 43240964821, attempt 1, observed completed/failure, last updated at 2026-11-12T15:06:02Z. The only failed product job was verify (execution), ID 131261613690, on GitHub-hosted ubuntu-24.04 runner ID 1000314867, name GitHub Actions 1000314867. Run suites executed `pnpm test:execution && node tests/business-import.mjs`. The first command invokes `node tests/execution-journey.mjs` and exited 1. The chained business-import test was not reached.

The failure was recorded at 2026-11-12T14:50:33.2130259Z, journey execution, stage disconnected-setup:

```text
browserContext.waitForEvent: Timeout 30000ms exceeded while waiting for event "page"
    at disconnectedGitHubSetup (tests/execution/ui.mjs:23:26)
    at tests/execution-journey.mjs:37:24
```

The actual failed expectation is a new browser page after ControlOrMeta-clicking the local "Set up the GitHub connection" guide at width 1440. It is a Playwright event-wait timeout, not an assert.equal mismatch. Earlier disconnected-connection checks and the same-install href assertion were reached first; the subsequent guide article/anonymous-200/docs-index assertions were not reached. No failing HTTP assertion, lost runner, provider 503, apt failure, health check or dev-server-start failure appears in this failed-step log. Do not label it an established infrastructure failure from the timeout alone.

The other red jobs were downstream aggregates: shards (spool), ID 131271954583, and verify, ID 131272010966. Their failures are consequences of the product job, not independent product assertions. They were not manually retried.

## Retry decision and evidence

The run endpoint reported run_attempt=1; the all-attempts jobs endpoint returned 31 jobs, all from attempt 1. Prior retries on this exact SHA: zero. At 2026-11-12T15:13:41Z, one request was accepted:

```text
gh api --method POST repos/just-every/run-spool/actions/jobs/131261613690/rerun
exit=0 response={}
```

Only that failed product job was requested. No full-workflow rerun, new Verify dispatch, successful-shard rerun, aggregate-job rerun or new commit was requested. Any downstream aggregate jobs automatically scheduled by GitHub are separately identified in the terminal receipt. No second retry is authorized or requested.

## Source inspection and baseline limits

The failing UI test, execution journey and Verify workflow have identical bytes at the candidate and cloned main snapshot 461eb0f58adf9456aef587866dd013d628c38b9f. The hashes and exact failure lines are recorded in source-inspection.json. This is source inspection only; it does not show that main passes or fails on the same runner.

No local full suite, typecheck, rer setup/build/verify, browser journey or main test has been run: this task has no source changes and the requested baseline, if needed, is the single failing test on the same runner. Existing repository workflows use ephemeral GitHub-hosted ubuntu-24.04 jobs, with no existing input to run only disconnectedGitHubSetup on main within the failed runner. A different cloud VM would not meet that condition. The retry passed, so the conditional same-runner main probe is not required. No main failure, product regression or infrastructure root cause is claimed.

## Counts, gates and custody

Before retry: 31 jobs, 24 success, 3 failure, 4 skipped. Of 23 product matrix jobs (13 verify shards, 10 runtime journeys), 22 passed and only execution failed. Before and after this investigation, contract summary counts remain Core 23 done / 45 partial / 19 missing (87); Agent surface 0 / 9 / 9 (18); Full target 23 / 54 / 28 (105). Clause status changes: none. Source and test count changes: zero.

Release refusal remains in force until exact-SHA Verify is completed/success and the fleet handles any subsequent landing decision. This investigator will not readmit or edit landing records. Product READY/PUSHED custody is not created by report publication. The full action plan is in PLAN.md; exact commands and timestamps are in api-calls.json; the accepted retry request is in retry-receipt.json; initial REST receipts and the failed-step error are separate files.

## Terminal result

Verify 43240964821 was observed completed/success at the second bounded retry status read. It reports run_attempt=2 and head_sha=47ecaeeec8c442aa4648ad3b7f4fc1d7e1f115e2; last updated 2026-11-12T15:19:14Z. The successful execution retry job is 131276971438, runner 1000314956, started 2026-11-12T15:13:51Z and completed 2026-11-12T15:19:03Z. Its Run suites step is success, so both the execution test and chained business-import command passed.

The job-rerun endpoint automatically ran downstream shards (spool) job 131280331915 and verify job 131280388151; both passed. No separate request targeted them. Attempt 2 includes carried-forward success records for earlier jobs with their original execution timestamps; these records do not mean successful product shards were manually rerun. The full-push-proof and nightly-proof records remain skipped; this investigation does not invent missing proof-job execution. The workflow itself and its final verify job are green on the exact SHA.

After retry: latest 31 job records contain 27 success, 0 failure and 4 skipped; product matrix coverage is 23 success, 0 failure out of 23. Historical attempt-1 failures remain in the all-attempts archive, which contains 62 records. Contract counts and test counts are unchanged. Seven of ten counted GitHub calls were used. Run status observations were more than 300 seconds apart; jobs metadata and the single failed-log archive fetch were not status polling.

Classification: retry-resolved browser page-event flake on this exact head. Root cause is undetermined. This is no evidence of an assertion mismatch, proven provider/runner infrastructure failure or main failure. No source fix, second retry, baseline suite or further dispatch is warranted by this result.

Blockers for this bounded triage: none. Next: sd reviews the exact-head green receipt and resumes the existing fleet-owned guarded release/landing process for the original candidate. No readmission, refusal-record mutation, publication scan, landing, release or production step was performed. Evidence publication is reports only and signals none of those actions. This task's local branch has no product commits and is not pushed; no product READY/PUSHED line is asserted for it.

The complete non-secret packet is selected explicitly for evidence-only publication. The disposable clone will be deleted after successful evidence transfer; the packet and transport receipt stay under the task work directory.
