# gr-mt-spool-ci-19 — Nightly command journey investigation
Author: Run Edit Run fleet, 2026-11-17.

## Scope and plan
Only just-every/run-spool is a write target. The local product branch is cloud/gr-mt-spool-ci-19. PLAN.md records the full plan. No product changes, UI changes, clause edits, test removals or PRs have been made.

## Historical failure and existing fix
Nightly journeys run 43803437294 failed at adc3de69b9ae0ff60e41897f8ff7662fd656d560. Job 133088740043 failed in `pnpm test:commands` at the `slow-readiness` assertion. Its safe diagnostic reports setup still running, lifecycle `starting`, and an AssertionError. Dependent jobs failed or skipped; they were not separate causes.

The old journey treated the periodic `Still starting` diagnostic as proof the application was already health-ready. That message can arrive during the production build; the immediate health assertion raced application startup. The current main fix in commit 7fee744e133924477a3d95e69b8a96d61d69f75d waits on the actual `/health` door with bounded requests while requiring setup to remain pending, then retains SIGINT/cancellation, runtime shutdown and byte-preserved private-settings assertions. No wanted behavior was removed.

`gh run view 43803437294 --repo just-every/run-spool --job 133088740043 --log-failed` exited 0 but printed nothing with this gh version. It successfully downloaded its archive. The failed job's log was read once from that local archive without another API request. nightly-failure.log preserves the failing step with environment lines excluded. main-fix.diff shows the existing source difference from the reported head.

## Validation — PASS
Pinned Node 22.20.0, pnpm 10.12.4, system Chromium `/usr/bin/chromium` with `--no-sandbox`, and cloud_run subreaper. Frozen dependency install succeeded. Typecheck passed. The command journey was started on 7ece18059c1c7924a5b6f9cc816a7af3900136d5; it passed completely with exit 0. The successful final summary is retained in local-commands.log.

Main advanced to 337a4cacd736ad172f397f318bb766fa5402ed9a during investigation. Its only differences from the locally tested revision are Ruby runtime dependency files and the source lock. The command journey, command runner, installer and package/lockfile pins are unchanged; the causal readiness fix is an ancestor of both revisions.

## CI observations
API-RECEIPT.json lists all seven GitHub invocations used. Each completed failed job log was requested only once. No workflow was dispatched, retried or cancelled.

- Reported Nightly: 43803437294, failure, adc3de69b9ae0ff60e41897f8ff7662fd656d560.
- Inspected main 7ece18059c1c7924a5b6f9cc816a7af3900136d5: push Verify 44041292455 and PR Verify 44041298939 succeeded; later main Verify 44045714537 failed in runtime job 133911463949 at tests/deployment-history.mjs:71 (`fetch failed`, socket other side closed). This is a separate runtime failure, not the reported command journey failure. main-runtime-failure.log contains the relevant actual failure lines. No speculative runtime fix was added.
- Latest main 337a4cacd736ad172f397f318bb766fa5402ed9a: earlier push Verify 44056761412 succeeded, latest push Verify 44064973763 was still in progress at its one subsequent status poll (more than 300 seconds after discovery), and Run site 44064973942 succeeded. No whole-head green claim is made from the earlier run while the latest run remains pending.

## Counts, clauses and custody
Product changed files: 0. Added/removed tests: 0/0. Acceptance counts remain 23 done, 54 partial, 28 missing, 105 total. Clause status changes: none. Generated views and source lock were not edited. The complete command journey passed. Final disposition is no-change: the reported failure was real at the old revision and is already fixed on current main. No product commit, product push or PR was made. No public product publication scan is claimed; no new product tree is being published. Evidence is separate report-only custody, never a product landing signal.

## Final result and remaining work
`result.json` records status `no-change` and returned branch head 337a4cacd736ad172f397f318bb766fa5402ed9a. The clone was fast-forwarded on cloud/gr-mt-spool-ci-19 to the observed current main after local tests finished. SOURCE-RECEIPT.txt proves the relevant sources are identical to the tested revision. The result is also saved at /home/agent/rer-consolidation/work/maint/gr-mt-spool-ci-19/result.json. The requested output clone is retained at /home/agent/rer-consolidation/work/maint/gr-mt-spool-ci-19/repo; no new unpublished product work exists.

Before/after for this task: historical reported command job failed; current complete local command journey passed. Product files changed 0→0; new/deleted tests 0→0; acceptance counts 23/54/28 remain unchanged; clause changes none. The existing fix is a test synchronization repair, not a behavior waiver.

No blocker remains for resolving this historical maintenance item as already fixed. Follow-up: the lane should track the separate deployment-history runtime/socket failure observed in main Verify 44045714537. The later current-main Verify 44064973763 is pending in the last observed receipt; this report does not claim it green. No READY/PUSHED product claim is made because this task created no product candidate.

All local browser/server processes were owned by the command journey; its successful completion and cloud_run subreaper completion confirm cleanup. No held credentials, browser sessions or private gate material were exported. Packet files were selected explicitly and checked for symlinks and obvious credential patterns. This limited packet review is not represented as Base's full product publication scan. No new product tree was pushed, so there was no product publication gate to waive.
