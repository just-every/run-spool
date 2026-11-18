# sd-spool-design-keys-4

Product repository: just-every/run-spool. Product branch: cloud/sd-spool-design-keys-4. Builder: sd / Run Edit Run fleet. Task started UTC: 2026-11-17.

The round replays keys-3 onto main and reserves 0110 for the queued Sentry roster work. Key metadata now uses 0111_key_names_and_use.sql throughout the migration inventory, generated deployment specification, archive compatibility and fixtures. The prior round's owner-facing key names, last-use facts, revocation confirmation, one-time key dialog, invitation context, email test/enable flow, collapsed advanced controls, dated private backup and project-erasure preview remain intact.

The full working plan is [PLAN.md](PLAN.md). Local checks, integration comparisons, migration-order proof, browser proof and exact-SHA CI custody are saved in the explicitly selected receipt files in this packet. Product and evidence publication are separate; neither substitutes for the Mac publication scan or landing gates.

## Source custody and integration

Confirmed keys-3 head ba97984c5372e00bd6c28bb05eb37fb8c7f89928 and Sentry-4 head 8d44b36e050201ea0923e4d767ba346f9466328e through Git. Starting main is f44efc8c76f8f11753b89465cc3fcb7b64760570 and ends at 0109_feedback_review.sql. The source round contains 606b86f4448570834917908289e37de38fd8fa24 and its empty verification trigger ba97984c5372e00bd6c28bb05eb37fb8c7f89928. Their product diff was reapplied without source history merges.

Main has 103 migration files. This candidate has 104; its final migration is 0111_key_names_and_use.sql. The Sentry migration is deliberately not copied into the product branch. The independent D1 order probe reads its exact bytes from the named Sentry commit, applies main's 103 migrations, populates three credential kinds, applies Sentry 0110, populates a pending roster proposal, then applies keys 0111. All three credential rows preserve every pre-existing field and revocation, metadata begins blank/unknown, the proposal survives, and the ledger grows from 103 to 105 rows. Sentry SQL SHA-256 is d88d992bf20a0697cd58991c4a78148dd0730acdcf9ae3837a8e3184ab16c8eb. Keys SQL SHA-256 remains b1cae0eee0f949294c39ff602c56d7dc8abbabef544dfa782376a016cb73865c.

The setup descriptor/digest and producer workflow are unchanged from both main and Sentry-4. The generated deployment spec contains only this candidate's keys addition, avoiding unrelated Sentry implementation changes. At landing, integration outputs and sources.lock.json must reflect the merged source; migration numbers are already distinct.

## Contract and release boundaries

CONTRACT.md is unchanged. Contract generation wrote zero files and its check reported zero errors and warnings. ACCEPTANCE.md and docs/CLAIMS.md are kept whole from main and are not committed by this round. No clause status, meaning, evidence judgment or gap is promoted. Core counts remain 23 done / 45 partial / 19 missing = 87; agent surface remains 0 / 9 / 9 = 18; full target remains 23 / 54 / 28 = 105.

The requested historical command `pnpm run validate:release` is absent from this checkout's package scripts and from its pinned rer implementation; invoking it returned ERR_PNPM_NO_SCRIPT. Current build instructions declare pnpm build:app through rer build, with first-party, source, retained-Base, integration and type checks. Those commands are exercised rather than introducing a replacement script. No clause meaning changed, so RELEASE.json receives no invented contractChanges entry, version change or unrelated release edit. No tag or release was produced.

## Validation notes

The initial direct archive test used the VM's Node 24.19.0 and failed inside Miniflare SynchronousFetcher on message?.id === id, after the populated published-release and 0068 preservation assertions had passed. The test passed when rerun using the declared Node 22.20.0 (307.10 seconds). It preserved 176 released-schema tables and 120 populated rows; a separate 0068 upgrade preserved 201 tables, and legacy/current archive restore and refusal checks passed. This is recorded separately from product assertions; no implementation was weakened to accommodate the VM runtime.

Local and browser fixtures use synthetic data. Invitation links and newly minted project keys are masked in selected screenshots. Logs or environment files holding setup links, credentials or private held-out material are excluded from this packet. Local suppressed mail proves suppression, not external provider delivery. No account, device or hosted qualification is claimed.

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).

Admission passed (421.92 seconds), including native owner claim, session-bound transfer proof, scoped memberships, second-browser invitation acceptance, managed no-JavaScript sign-in and hosted mail-off truthfulness. Dev-credential tests passed (86.47 seconds), including scoped ingest/deploy, gated agent/owner access, hosted refusal of dev grants and identity fencing.

The first pinned-Node triage run passed the added key assertions and stopped on a Playwright 15-second page-screenshot timeout at settings-data (fonts had loaded). One unchanged retry was started; no assertion, timeout or product control was weakened. The failed attempt remains recorded in LOCAL-CHECKS.json and its actual diagnostic is retained in TRIAGE-SCREENSHOT-ATTEMPT1.txt.

The unchanged triage retry passed on Node 22.20.0 in 520.79 seconds: 22 assertion groups and 104 desktop/phone captures. It proved key naming and last use, cancellation/confirmation before revoke, one-time issuance, backup busy state and dated filename, full retained-data/private-map equality in the downloaded archive, independent restore, damaged/erased restore refusal, offline recovery, keyboard behavior and no owner-page errors. Only the explicitly selected changed-screen pairs are published in this packet.

The required agent-door suite initially used its separate Playwright variable and could not find a bundled browser. Its native policy assertions had passed until browser launch. The retry sets both RER_CHROMIUM_EXECUTABLE_PATH and PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to /usr/bin/chromium, with the suite’s existing --no-sandbox launch argument; no repository test was changed. The initial exit receipt is CHECK-agent-door-attempt1.json.

The agent-door suite passed with system Chromium in 377.96 seconds. It covers native policy, external classification, protocol/size refusals, sponsor-role narrowing and attribution, pause, audit and replay custody. These checks preserve existing contract judgments and do not promote an agent-surface clause.

A fresh ref probe found main advanced to 53b460837d5a58266c39d03a9f923e09e9c29fb7. Its only change from the original base is the locked transitive qs update from 6.16.0 to 6.17.1 and its generated source-lock hash. The linear product replay retains that newer main update and regenerate the source lock rather than resolving it by hand. Sentry 0110 is still unlanded.

Agent handoff passed in 1183.36 seconds on Node 22.20.0, including actual second-origin capture and maps, HTTP/CLI/MCP refusal equivalence, foreign-project and next-request revocation fences, native proposal equivalence, retention, 10,000 retained-event capacity and the concurrent final-slot race. Cleanup reported every browser, edge, MCP client and isolated checkout stopped/removed.

The five core alerts suites passed in 391.83 seconds, including native scheduling, recurrence, private-network and redirect refusal, signed egress, Slack rotation/revoke/uncertainty/rate handling, archive exclusion and erasure. The browser alerts suite passed in 147.06 seconds: short email test/review/enable, persisted rules, isolation, delivery states, keyboard navigation and paired 1440/390 layout proof. These use recorded edge doubles, not live mail/provider qualification.

The environment reconnected after the project-erasure fixture reported all seven assertion groups and eight captures passed, during final cleanup. The runner registry was lost and surviving process records showed SIGKILL, so no clean process exit was inferred. The complete emitted result is PROJECT-ERASURE-INTERRUPTED.json; a fresh project-erasure run and the remaining owner-erasure run obtain clean terminal receipts. No live servers survived the reconnect.

A clean project-erasure rerun hit a genuine stale-preview refusal on the phone: 409 plan_changed instead of accepting an out-of-date confirmation. The UI now fetches a new preview, clears confirmation and asks for deliberate review and typing again. The test sends an obsolete preview hash to the real server at 1440, proves refusal and no project deletion, checks the cleared/disabled confirmation, captures the updated-review state at both widths, then explicitly reconfirms. The server fence remains intact; no automatic destructive retry is added.

The owner-erasure CLI fence test initially reported legacy_schema_object_inventory because its command harness clones committed HEAD, while the migration was still uncommitted. Its native deletion and unrelated-person preservation checks passed. It will be repeated on the preserved committed candidate; the old failure receipt is retained as CHECK-owner-erasure-uncommitted-head.json.

The candidate was replayed linearly onto main 53b460837d5a58266c39d03a9f923e09e9c29fb7, installed with the frozen lockfile, and passed current first-party, retained-Base, build, integration, catalogue, type and source-lock checks. The first real source save is 739be0258a90e46502e11f53221870745553cdd5 and was pushed successfully through cloud-push.py on attempt 1 with [skip ci], so CLI fixtures can clone the committed migration. A separate CI trigger uses the identical committed tree; the clean local erasure receipts are now complete. This preserves the published save without rebasing or force-pushing it.

The final CI trigger is b5b0d25111dcb56a07afc12605ee1e6a935c1b18, pushed successfully through the guard on attempt 1. Its tree df2cf2c2b35bb58007571f645ba1cd52d4748b26 is identical to the committed source save. Both candidate commits have fleet author/committer identities, no co-author trailers and no merge commits. Exact-SHA Verify run 44202529736 is being checked via the prescribed REST endpoint, within the ten-call budget and five-minute minimum interval. No PR, tag, release, deployment or main push was made.

Owner erasure passed cleanly on committed source in 684.76 seconds, including native deletion while preserving independent people, same-installation and independent restore fences through HTTP/CLI, authority races and interrupted multi-batch resumption. The earlier uncommitted-HEAD inventory refusal is resolved by the committed migration and is not counted as a passing run.

Project erasure passed cleanly on committed repaired source in 1004.73 seconds: seven assertion groups and ten captures, including the deliberate obsolete-preview refusal, cleared confirmation, explicit review and reconfirmation, exact project erasure, preservation of unrelated data and same/fresh/journal archive fences through real HTTP and CLI paths. All latest local check receipts are successful; LOCAL-SUMMARY.json identifies them while earlier failures/interruption remain separate. The final CI trigger has identical source bytes to the tested committed save.

Final local custody: 29 latest check receipts pass, tracked source is clean, and the terminal source fingerprint equals the committed save. Eighteen curated screenshots cover nine changed states at both 1440 and 390, with issuance keys and invitation inputs masked. The temporary two-job RER setting used for the independent reruns was removed after both suites stopped, restoring the VM’s prior queue configuration. No live test server or browser remains.

The first exact-SHA Verify attempt failed only at root job owner-ui (134460693011), with dependent shards/verify failures. Native stale assignment returned the expected HTTP 409. The unchanged test then synchronously read a not-yet-rendered aria-describedby and constructed #null, timing out in tests/operator-ui.mjs:74. The corresponding local journey had passed. The actual failed-job archive was read once with the prescribed gh run view command; sanitized diagnostic with the environment listing omitted is CI-OWNER-UI-FAILED.txt. One permitted rerun of that root job and its dependent jobs was requested, without changing or weakening assertions or touching unleased OperatorPanel/operator-ui source. The original failure remains part of the CI receipt.

Read-only lease verification: the original keys-1 core change 08265b6 (branch tip 739c7ff1575296fd329c69769364f030618a7b11) changed 39 files; neither tests/operator-ui.mjs nor src/ui/workbench/OperatorPanel.tsx is included. The candidate diff also leaves both untouched. The unrelated assignment-feedback observation race therefore stays outside this repair; only the expressly permitted flaky-job rerun was requested.

## Terminal result

READY on cloud/sd-spool-design-keys-4 at b5b0d25111dcb56a07afc12605ee1e6a935c1b18. Exact-SHA Verify 44202529736 completed successfully after the single permitted flaky owner-ui job rerun. The initial failure and its unleased-file diagnosis remain in CI.json, CI-FAILED-JOBS.json and CI-OWNER-UI-FAILED.txt. Ten of ten authorized REST calls were used; no further GitHub API reads are planned.

All 29 latest local check receipts pass. The source is clean and unchanged from the committed save tree df2cf2c2b35bb58007571f645ba1cd52d4748b26. The candidate has two linear fleet-authored commits, no co-author trailers and no merge commits. Product migration inventory is 103 → 104; the tested main + Sentry 0110 + keys 0111 inventory is 105. Core remains 23 done / 45 partial / 19 missing = 87, Agent surface 0 / 9 / 9 = 18, full target 23 / 54 / 28 = 105. Clause status changes: none. RELEASE.json and generated acceptance/claims views are unchanged.

No PR was created, and there is no remaining builder blocker. Publication scan, landing and regenerated merged views remain the Mac fleet’s gates. No main push, tag, release, deployment or Base refresh occurred. The explicit report-only evidence publication is separate from this product READY result.

Terminal verification recorded UTC: 2026-11-18T00:44:05.472633+00:00.
