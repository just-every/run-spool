# gr-mt-spool-ci-12 result

Author: Run Edit Run fleet. Date: 2026-11-17.

No change is required. Current main is `1853e3b3b59d49853b5ee7678f851d6de8343fbf`. Its push Verify run [44018323170](https://github.com/just-every/run-spool/actions/runs/44018323170) completed successfully, including the owner UI suite that failed in the maintenance report. This is a verified already-fixed result, not an unreproduced report classified as a false positive.

## Plan and disposition

1. Configure fleet identity, refresh the authorized launcher bundle, install the fleet Git helper and push guard, and read launcher and product instructions. Completed.
2. Clone only just-every/run-spool with full commit history, create `cloud/gr-mt-spool-ci-12` from main, and retain repository hooks through the fleet hook forwarding setup. Completed.
3. Inspect the reported run and fetch its one failed product-job log once. The job metadata names `verify (owner-ui)`, job 128322166812, step `Run suites`. The requested archive command exited 0 with zero output bytes. No assertion text was available and no log download was retried.
4. Compare the report with current main and establish whether work remains. Completed: exact-SHA discovery and the run detail confirm completed/success on current main. The job inventory shows a successful build, every runtime and product suite, `shards (spool)` and final `verify`. `light` is skipped, so this is executed full coverage, not a light-only result.
5. Use the brief's explicit no-change disposition when current main already passes. Completed: zero product changes, zero new product commits, no product branch push, no PR, and no clause judgments changed. No empty commit or workflow rerun was requested.
6. Record actual receipts and publish only the non-secret evidence packet to `refs/heads/evidence/gr-mt-spool-ci-12`. The terminal EVIDENCE receipt records the transport result. Evidence publication carries no product landing claim.

## Verification

- Remote main probe: `git ls-remote origin refs/heads/main` returned the full SHA above.
- Exact-SHA discovery: `gh api 'repos/just-every/run-spool/actions/runs?head_sha=1853e3b3b59d49853b5ee7678f851d6de8343fbf&per_page=100'` found completed successful Verify runs 44018323170, 44022478247 and 44008607802. The selected push run 44018323170 also has explicit run and complete job receipts.
- Push run 44018323170: completed/success at that exact SHA; owner UI job 133821883166 completed/success. Its suite command is `pnpm test:accessibility && pnpm test:admission`.
- Run site 44018323004: completed/success at the same SHA, from exact-SHA discovery.
- Local non-interactive setup completed successfully. Its private runtime output is excluded from this packet.
- Typecheck results and runtime versions are recorded in `verification-receipt.json` and `typecheck.log`. No product tests were touched or rerun locally; the successful full main workflow is the evidence for the no-change disposition.
- Seven GitHub budget units were used: six `gh api` invocations and one failed-job archive invocation. The first historical job inventory used the API's default page size; a later `per_page=100` read completed that inventory.

## Before and after

The historical run 42345409504 had one failed product suite (`owner-ui`) and two downstream failed aggregation jobs: 24 jobs succeeded, 3 failed and 4 were skipped, 31 total. Current selected Verify has 28 successful jobs, 0 failed and 4 skipped, 32 total. These are workflow job counts, not test registration counts. Owner UI failures changed from 1 in the report to 0 on current main through changes already landed before this task. This task changed no test registrations, product files, contract text or clause status cells. Test counts and clause status counts are unchanged by this task.

## Limits and custody

The historical failing assertion and its exact correcting commit are not claimed: the archive command returned no content. The current exact-SHA full run conclusively establishes the reported workflow is passing again on main. No owner ruling is needed and no blocker remains.

There is no new committed product tree requiring publication scanning. A product publication scan was not run and no product ref is published. The evidence packet contains only explicitly selected public metadata, this signed report and actual non-secret receipts. The result's `security: true` describes the reviewed no-change/report-only disposition; it is not a product scanner receipt.

The local cloud branch remains at the existing main SHA. It is not a new READY or PUSHED product candidate. The clone and local result.json remain available as maintenance outputs; no pending unpushed product work exists.
