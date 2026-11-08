# SDK-004 browser proof mechanical replay

Repository: just-every/run-spool
Task: sd-spool-c-f121-rb2
Product branch: cloud/sd-spool-c-f121-rb2
Original candidate: 7416c9367e8798c77ceb5de0e6912edcc20a1fc7

## Plan

1. Use a disposable full-history filtered clone, verify the original candidate head, and inspect its own diffs and tests.
2. Replay only its leased browser runtime proof and SDK-004 evidence onto fresh main, preserving all current statuses, other clauses, tests, judgments and ID-MAP.
3. Generate and check contract views; restore main's generated views. Regenerate and check the source lock last for each retained replay commit.
4. Run the candidate's changed browser proof and typecheck, retaining actual bounded output and receipts. Use a disposable file launcher for emitted Worker fixtures.
5. Inspect every candidate commit identity and trailer, push only the named cloud branch through the fleet guard, then observe exact-SHA Verify using REST within the ten-call budget.
6. Publish explicitly selected non-secret reports and receipts to the separate evidence ref. Record custody and clause/count results; remove the successful disposable clone and dependencies at task end. Do not land or change a judgment.

## Results

The original full-history candidate was verified at exactly 7416c9367e8798c77ceb5de0e6912edcc20a1fc7, then its four source commits were replayed and consolidated onto freshly fetched main d9ce1390bbf7b98783b9ff7bdad5a6fae973078b. The old lander merge was not reused. The resulting single commit is 45270b7ef7f2eb7e88c8685038a7615ef923b6eb.

Only tests/runtimes/browser.mjs, tests/runtimes/browser/app.js, CONTRACT.md's SDK-004 Status row and sources.lock.json differ from main. Both browser files are byte-identical to the original builder head. Every other CONTRACT.md line, main's newer tests/assertions, ID-MAP and judgments are retained. Rebase conflicts were resolved using index-stage contract lines: stage 2 whole contract plus the SDK-004 row from stage 3, with partial unchanged. Each replay step was regenerated and checked before continuation; intermediate commits were squashed and are absent from published history. The sole retained commit has a fresh checked lock.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; views=node src/base/contract-docs.mjs write exit=0

Both checks also exited 0: node scripts/edition-authoring/cli.mjs check and node src/base/contract-docs.mjs check.

Generated ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main before the final lock. Neither generated view is in the product commit. The Mac lander must regenerate the views from the merged contract.

Setup and build, typecheck, first-party source checks, integration check and offline Base integrity all passed. The entire existing tests/sentry-sdk.mjs suite passed through a disposable .mjs launcher with node --experimental-strip-types and Chromium /usr/bin/chromium with --no-sandbox. No --input-type=module was used. Local node was 24.19.0, pnpm 10.12.4; CI pins Node 22.20.0. The first setup attempt on the old candidate dependency tree failed on a package export; current-main pnpm frozen install resolved it, and replay setup/build then passed. Build-generated public/errors-capture.js changes were restored, not committed. The SDK suite emitted a transient workerd Broken pipe diagnostic during one fixture cleanup but completed all assertions and exited 0.

PROBE SDK-004 browser runtime proof: pinned unmodified Sentry 11.6.0 widget through reference collector and Spool public intake, identical actions with only DSN changed, handled/automatic target switches and reversed order after reload at 1440 and 390 -> four callback IDs per target and width exactly equal emitted feedback, complete inbox and archived report sets; exact retained occurrence/issue links; earlier links unchanged; feedback_accepted=4. Both issue screens are included at 1440 and 390. The replay strengthens main's two-report-per-width proof to four reports per width; it adds no product behavior and no assertion outside the original candidate.

SDK-004 remains partial. All 105 statuses are unchanged. Before -> after counts (done / partial / missing): Core 22 / 44 / 21 -> 22 / 44 / 21 (87 total); Agent surface 0 / 8 / 10 -> 0 / 8 / 10 (18 total); full target 22 / 52 / 31 -> 22 / 52 / 31 (105 total). No hold release or landing claim.

All candidate authors/committers are Run Edit Run fleet <fleet@runeditrun.com>; there are no co-author trailers and no [skip ci] in the product candidate. The fleet guard printed PUSH_OK on its first attempt. The tool's surrounding shell reported exit 1 after success; no rejection was printed, and independent git ls-remote read-back verified the exact branch/SHA. The product branch was pushed once without a retry. Product checkout and index remained clean. No PR was required or created under this repository's instructions.

Exact-SHA Verify observation and separate evidence custody follow below.

The required restored-view local check exited 1 solely with `ACCEPTANCE.md: generated content differs; run contract-docs write.` Contract prose reported 0 errors and 0 warnings. This is the expected stale generated-view boundary, not a source-lock or contract generation failure. The exact-SHA Verify run is 42475028293, completed/failure. Its archived build assertion confirms exactly the same generated ACCEPTANCE.md mismatch. Build source integrity completed before that assertion. The shards (spool) and verify aggregate failures are downstream of that build failure and the skipped dependent suites; their archived failure receipts and the public dependency source are included. All three failed-job archives were read exactly once, using five total GitHub calls with at least 300 seconds between calls. No dispatch, rerun or empty commit was used. This is READY under the brief’s explicit generated-view-only exception, not a claim that the GitHub run itself is green. The lander must regenerate the views and rerun Verify before landing.

## Terminal outcome and custody

READY under the explicit generated-view-only exception, product branch cloud/sd-spool-c-f121-rb2 at 45270b7ef7f2eb7e88c8685038a7615ef923b6eb. Verify: https://github.com/just-every/run-spool/actions/runs/42475028293. No blocker or missing semantic ruling. No PR created; no product landing performed. Product publication and evidence publication are separate.

The explicitly selected packet contains this full plan/results report; actual aggregate, mechanical, test, push, identity, source, replay and CI receipts; the original and replay source patches; and four synthetic browser screenshots. No credentials, environment dumps, private held-out material, symlinks or local setup state are selected. The evidence manifest supplies every selected file’s hash. The terminal EVIDENCE line supplies the report-only publication ref and head.

The local browsers and Worker fixtures finished; no broad process kill was used. node_modules has been removed. The disposable clone exists only for the required evidence publication and will be removed immediately after that publication succeeds, as requested. The packet remains outside it.
