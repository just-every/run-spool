# gr-mt-spool-ci-16

Run Edit Run fleet, 2026-11-17.

Repository: just-every/run-spool. Product branch: cloud/gr-mt-spool-ci-16.
Candidate: f9db9344ae83b7f2e8916488185f65e0a76c4cd4.

## Plan and outcome

1. Refresh fleet credentials, install the specified Git authentication and commit hooks, clone the declared repository with full history, and read its agent and contract instructions. Completed; no other product repository was cloned or changed.
2. Inspect the reported main Verify run before editing. Run 43463918357, head 3d3a7db595e571f8466bcee683634c83d93656b8, failed in job 132018638090, `runtime (java)`, step `Run java SDK journey`. The shard aggregator and final verify also failed because that runtime failed; the other runtime and product jobs succeeded.
3. Reproduce the failed dependency-resolution step and remove its mutable prefix-discovery dependency. Completed. Maven reported `No plugin found for prefix 'dependency'`. The unchanged Java fixture still invoked `dependency:copy-dependencies` on current main. The command now uses `org.apache.maven.plugins:maven-dependency-plugin:3.9.0:copy-dependencies`. It fetches the same Sentry runtime dependencies while avoiding group-prefix and plugin-version discovery. No assertions or SDK options were removed or weakened.
4. Regenerate the source lock last, commit the two-file change, check touched behavior and types, scan the exact committed tree, and publish only the named product branch when the scan permits it. Local checks, publication and exact-SHA Verify completed successfully; their actual receipts are recorded separately in this packet.
5. Return complete non-secret reports and receipts on the separate evidence branch; leave main landing to the fleet.

## Files

- `tests/runtimes/java.mjs`: one Maven goal changed to pinned full coordinates, with a two-line explanation.
- `sources.lock.json`: regenerated digest for that fixture.

No UI, workflow, product logic, contract judgments, generated acceptance views, or package identities changed. No PR is required or created for this branch-custody maintenance task.

## Reproduction and local checks

The requested `gh run view 43463918357 --repo just-every/run-spool --job 132018638090 --log-failed` completed successfully but printed no text with gh 2.46.0. Its already downloaded run-log ZIP contained the combined Java job log; `original-java-journey.log` is the relevant failed-step extract from that archive. No extra job-log download was needed. `original-jobs.json`, `original-run.json` and `original-java-annotations.json` preserve the observed completed failure and its job/step identity.

The before/after experiment uses the same isolated Maven artifact cache with group-prefix metadata absent. Offline shorthand resolution fails with the same NoPluginFoundForPrefixException; the fully qualified goal succeeds offline. The exact artifacts had first been resolved through the VM's required network proxy. This proves the correction avoids discovery metadata; it does not claim Maven works without downloading its artifacts initially.

The unchanged `node tests/sdk-runtimes.mjs java` passes on Node 22.20.0, pnpm 10.12.4, JDK 21.0.13 and Maven 3.9.11. It compiles the real Sentry Java 8.61.0 fixture, compares reference-collector and Spool runs, and checks error persistence, grouping after restart, unhandled crashes, release/dist, refusal with no new events, discarded outcomes, feedback association, suppressed exceptions and cause chains through the real Worker/API/UI. It also captures its existing issue and cause-chain screens at 1440 and 390 pixels with system Chromium and --no-sandbox. Initial VM-only obstacles (missing Maven/javac and Maven not honoring the HTTP proxy environment) were resolved outside the product checkout.

`pnpm typecheck` and `pnpm source:check` pass. The source-lock command completed successfully. The required noninteractive rer setup also completed successfully and built the application. No full local Verify or full suite was run; branch Verify remains the full wall.

## Counts and clause judgments

Before: the reported Verify has one root failing job (Java) plus two dependent failures. After locally: the Java journey passes, including 3 accepted error events, 2 accepted/persisted/associated feedback items and all 3 retained cause-chain exceptions.

Runtime entries: 10 before, 10 after. Added, removed, weakened or skipped test registrations: 0. Product files changed: 2. Clause status changes: 0. Reported generated counts remain Core 23 done / 45 partial / 19 missing (87); Agent surface 0 / 9 / 9 (18); full target 23 / 54 / 28 (105). These are existing generated judgments, not new qualification claims. SDK-012's existing Java journey is the touched proof; no clause promotion is requested.

Default: preserve every existing contract judgment and generated view. Main landing, exact-main CI and Run site remain fleet-owned.

## Publication scan timing

The released Base scanner is available through the checkout's pinned rer 0.2.118, with pinned Gitleaks 8.30.1. The 300-second default expired while inspecting this repository's 982-commit history. The complete scan was retried with its supported 1,800-second bound; the initial timeout is retained as a separate actual receipt. No product push is allowed without COMPLETE/PASS and zero findings.

A recovery bundle outside the product checkout records the complete candidate history and passes `git bundle verify`; `bundle-receipt.json` records its identity. It is recovery data, not proof of publication or READY.

The first full inspection completed in 426 seconds and refused only generated files in the build checkout's working tree: private local setup state, build output and test diagnostics. Every finding had `working-tree` scope; no committed-tree or candidate-message finding occurred. Those local files are ignored and are not pushed or included in this packet. The full report is retained as `publication-scan-build-checkout.json`. The final scan uses a clean detached worktree of the exact same candidate commit, sharing the complete repository history, so it inspects precisely the publishable source without local runtime state. This is not a history truncation or rule exception.

Final exact-source publication inspection: COMPLETE/PASS, zero active findings, commit f9db9344ae83b7f2e8916488185f65e0a76c4cd4, tree 2f6f34f69804aed2c4b0d6092d16a7189bd8f012. It inspected 982 commits, 972 trees, 8,208 distinct blobs and 23 tag messages. Eighteen separately classified pre-existing findings remain informational in the scanner's report; none is an active refusal. The complete passing receipt is `publication-scan.json` (rer 0.2.118 / Gitleaks 8.30.1; implementation digest c5f2d788f2f08764cd018e049b507c26f5ac01f651e2e8696398d89a5a886ffb).

## Product custody and exact-SHA CI

The guarded product push succeeded on its first attempt. Remote branch `cloud/gr-mt-spool-ci-16` now holds f9db9344ae83b7f2e8916488185f65e0a76c4cd4. The candidate was rebased against unchanged origin/main before publication; every candidate author and committer is Run Edit Run fleet at fleet@runeditrun.com, and there are no trailers. `push-receipt.log` is the actual guard receipt. No main/default branch or PR was changed.

Exact-SHA Verify run 44054041994 was discovered as a push run for this branch and SHA; it was in progress at discovery. Its terminal REST receipt is `ci-final.json`: completed/success on the exact candidate SHA, observed 2026-11-17T09:45:46Z. Original failure: run 43463918357, root job 132018638090.

## Final result

READY candidate: branch cloud/gr-mt-spool-ci-16, head f9db9344ae83b7f2e8916488185f65e0a76c4cd4. Exact-SHA Verify 44054041994 completed successfully: https://github.com/just-every/run-spool/actions/runs/44054041994 . The original reported failure is 43463918357; the repaired Java setup and unchanged Java qualification journey now pass locally, and the candidate's complete required Verify is green. The three status probes were spaced more than 300 seconds apart; no workflow was dispatched or rerun.

Before/after: Java fixture preparation fails / passes; required candidate Verify green; 10 / 10 runtime entries; 0 added, removed or skipped test registrations; 0 clause-status changes. Existing generated totals remain 23 done, 54 partial, 28 missing out of 105. No contract or generated acceptance-view edits were needed.

No remaining blocker or owner ruling. No PR was created. Product branch custody and READY are supported by the product push, publication and CI receipts; the separate evidence ref carries only this report packet. The fleet owns default-branch landing and subsequent main/Run site gates. The complete verified recovery bundle and local result.json remain outside the product checkout.
