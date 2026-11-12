# Spool v0.7.8 CI triage

Task: sd-spool-release-0-7-8-ci-triage-1. Repository: just-every/run-spool.

This is a read-only product investigation. No release candidate, source change,
product commit, PR, contract judgment, landing-record edit, tag or release was
created. The only Git publication planned is the report-only evidence ref.

## Exact provenance

- Investigated release head: d371ff60239cff49b2cb251f6e40309b883a631b.
- Investigated ref: cloud/sd-spool-release-0-7-8-rebase-d371ff60239cff49b2cb251f6e40309b883a631b.
- Verify: https://github.com/just-every/run-spool/actions/runs/43229401150.
- Disposable investigation branch: cloud/sd-spool-release-0-7-8-ci-triage-1.
- Its unchanged checkout is main snapshot aff1c97b9c3b3dbba92472102265f0171fdb3bf3.
  The evidence manifest's product_head names this checkout, not the investigated release head.
- PR: none created by this investigation. No admission or readmission performed.

## Original failure, from the complete failed-step log

Run 43229401150 attempt 1 was completed/failure. All 31 jobs and their attempts
were read: 24 success, 4 skipped, 3 failure. There was only one actual suite
failure: job 131221381091, verify (tunnel), Run suites (step 10), on runner
GitHub Actions 1000314465, ubuntu-24.04. Its command was:

    pnpm test:tunnel && pnpm test:sentry:sdk && pnpm test:sdk && pnpm test:languages

The earlier Next.js TRACE unsupported-method and aborted-upload errors were
nonfatal probe output. At 13:42:35Z, test:tunnel printed passed:true, including
proof that all hosts remained serving after TRACE/aborted uploads. The shell
then successfully advanced to test:sentry:sdk at 13:42:37Z.

The actual fatal error at 13:44:00Z was TypeError: fetch failed, caused by read
ECONNRESET (errno -104), in loaderFlow at tests/loader-flow.mjs:155, called by
tests/sentry-sdk.mjs:96. This was GET http://127.0.0.1:15521/api/archive after the
loader project's erasure had reached phase complete. It is a local emitted
Worker hosted by Miniflare, not an external CDN or provider request.

No AssertionError was emitted. The rejected fetch stopped the test before
line 156 could assert that the returned archive no longer contained the erased
keyHash (assertion message: "project erasure removes the key settings"). Thus
the log proves an interrupted post-erasure archive read, not an incorrect
archive response, failed privacy assertion, or release metadata product defect.
pnpm test:sdk and pnpm test:languages were never reached in attempt 1.

The downstream shards (spool) job 131230600828 and final verify job 131230648534
failed because their coverage dependencies reflected TESTS=failure. They were
not independent failing tests.

## Authorized one-time retry

Run metadata showed run_attempt=1, and filter=all returned only attempt-1 jobs;
no prior retry was present in the API evidence. At 2026-11-12T14:07:59Z one POST
was sent to actions/jobs/131221381091/rerun, with HTTP 201 Created. This targets
only the failed shard and GitHub's dependent summary/proof jobs. No new Verify
was dispatched, no whole-workflow rerun requested, and no fresh product push
was made to manufacture CI. At 2026-11-12T14:13:00Z the run was in_progress at
attempt 2 on the exact original SHA. Status reads are separated by 300 seconds.

## Main comparison and reproduction boundary

Read-only SHA-256 comparisons show tests/loader-flow.mjs, tests/sentry-sdk.mjs,
tests/tunnel-flow.mjs, tests/worker.mjs and .github/workflows/verify.yml are
byte-identical on the investigated head and the fetched main snapshot. This is
source evidence only; it does not prove a main runtime failure.

The original runner is an ephemeral GitHub-hosted ubuntu-24.04 VM, not a fleet
self-hosted runner. No direct execution/reuse channel to that VM is exposed.
The existing Verify workflow has no single-test or single-shard dispatch input;
workflow_call accepts only the whole push/nightly tier. Nightly manual dispatch
runs all coverage. Command journey runs a different CLI suite. Managed release,
site/demo and SDK-release workflows are not a loader-flow execution facility.
A targeted main probe therefore cannot be obtained through those workflows
without either editing the read-only workflow or violating the ban on a fresh
Verify/full suite. This cloud VM is a different machine (Node v24.19.0 rather
than the CI job's v22.20.0), and was not used as false same-runner evidence.
If the same test remains red after the permitted retry, the lane needs an
existing fleet runner/controller able to execute the loader-flow slice on main
with the CI's ubuntu-24.04/Node 22.20.0/build/browser setup. No baseline or full
suite was run locally; no test was skipped, weakened or changed.

## Counts and contract custody

Product edits: 0 -> 0. Product commits: 0 -> 0. Clause status changes: 0 -> 0.
Existing clause, account, key and lease holds are untouched. Test registrations
and generated views are unchanged. No DONE/PARTIAL claim or promotion is made.
The final outcome, retry counts and next action are recorded below and in
triage-receipt.json. PLAN.md records the full bounded plan.

## Completed outcome (2026-11-12T14:24:10Z)

Done. Verify 43229401150 attempt 2 completed/success at 2026-11-12T14:19:01Z on
exact head d371ff60239cff49b2cb251f6e40309b883a631b. The one retried suite job was
131236537649 (verify (tunnel)), on GitHub Actions 1000314700, ubuntu-24.04,
14:08:04Z–14:18:49Z. Its Run suites step and job passed. Dependent shards (spool)
job 131242959384 and final verify job 131243010610 both passed.

Latest per-job counts changed from 24 success / 4 skipped / 3 failure to
27 success / 4 skipped / 0 failure across 31 named jobs. The filter=all response
contains 62 records because GitHub represents prior successful jobs again in
attempt 2 with their original timestamps. Those are reused results: this was
one specific-job rerun request, not a rerun of all successful suites. The four
skipped jobs remain skipped; the complete workflow nevertheless reports success
and its required final verify is success. No new full-push-proof or nightly
marker is inferred from this report.

Classification: retry-recovered CI flake in a local Worker archive read
(transport/runtime reset). The underlying ECONNRESET cause is unproven. The
failure does not reproduce in the authorized retry, and there is no evidence
here establishing a release metadata product defect. No FIX verdict is issued.
Because the sole failed shard recovered, the conditional same-test/main
reproduction was not required and was not run. No local facility remains a
blocker for this investigation. No source or contract change is needed to
complete this triage.

Narrow next action for sd: run the ordinary guarded readmit for the existing
sd-spool-release-0-7-8 landing record against exact head
 d371ff60239cff49b2cb251f6e40309b883a631b, using the run/attempt/job evidence above.
For the fleet this is `python3 -I .tools/cloud_lander.py readmit
sd-spool-release-0-7-8 --repo just-every/run-spool` (one command on the fleet's
own machine). This cloud did not execute it, edit a landing record, resubmit a
red head, bypass the publication scan, land, tag, release or deploy anything.
The ordinary guarded process must still independently enforce all other gates.

fv follow-up: retain the original local Miniflare post-erasure archive reset as
an intermittent CI/runtime observation with run 43229401150, original job
131221381091, passing retry job 131236537649 and attempts 1→2. A future recurrence
should retain server-output-tunnel artifacts and target that archive-read
boundary; no further retry or test weakening is authorized by this report.

Eight GitHub operations were used under the brief's counting convention (one
failed-job `gh run view --log-failed` invocation counts once). Status read completion stamps were 2026-11-12T14:07:18Z, 2026-11-12T14:13:00Z, 2026-11-12T14:18:01Z, 2026-11-12T14:23:02Z. The job rerun POST was at 14:07:59Z; later status reads were more than 300 seconds apart. There were no baseline or full
local suite runs, workflow dispatches, whole-workflow reruns, source edits,
product commits or product pushes. Existing account/key holds, clause judgments
and lease boundaries remain unchanged.

Publication custody: the explicitly selected non-secret packet is published
only to refs/heads/evidence/sd-spool-release-0-7-8-ci-triage-1. Its manifest records
the unchanged investigation checkout and each file's bytes, Git blob and SHA-256.
The exact EVIDENCE ref/head will be returned in the final response. This is report
transport only; it does not create a product candidate or assert landing READY.
