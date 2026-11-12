# Spool capture-truth carry

Repository: just-every/run-spool
Branch: cloud/main-spool-capture-truth-1-c1
Initial base: 26d13d4f574298851f25778818c1af0b9b2a2386 (origin/main at clone).
Final integrated base: ddeed7780feda8bb85c9b3d9dc740387c63b18db (Settings sections landed during the pre-commit fetch).
Previous round: 28bd1e7857c63015aaef5f23f9dd8f7ff2e43cb3.
Final product candidate: 3af8a3ca856777e2445d33c6d1e5227e624b8278.
Final exact-SHA Verify: Verify 43199529558 (exact candidate SHA), completed/success observed at 10:41:00 UTC after five watcher API calls; actual REST responses and timestamps are in ci-receipt.json.

## Cause established before the fixture change

The full unmodified main agent-handoff journey passed, including caps, both capacity restores and the eight-request race for one remaining retained slot. It reported 9 groups, 10 masked captures, 9,999 events available on the old open issue, a 231,566/262,144-byte packet, 10,000 retained events, one accepted contender and seven counted refusals. Actual output and cleanup are in agent-main.log and agent-main-results.json.

The previous round was squashed onto main without committing. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md were restored whole from main. The unchanged squashed caps fixture was then restored through the public archive door and its existing capProof called without edits. It failed at tests/agent-handoff/caps.mjs:69: “older open issue lies outside the bounded unfiltered list.” The public unfiltered query returned two rows and included that older open issue; the open filter still correctly returned it. caps-squash-reproduction.log and its receipt retain the actual failure and the exact staged-input digest.

The fixture created 101 newer resolved native comparison issues with count=0, plus regression alert rows. Main previously let those empty aggregates fill the 100-row ordinary list. The capture-truth predicate correctly removes empty native aggregates from that list; the older actual open issue therefore appeared without needing a filter. This is a fixture dependency on empty native rows, not an incorrect ordering/filtering of retained issues. DIAGNOSIS.md records the source trace and intended correction before editing; PRIOR-PLAN.md and PRIOR-REPORT.md are the actual prior round's published documents.

## Fixture correction and scope

Each of the 101 resolved comparison issues now owns one existing early occurrence, reassigned within the same validated archive. Its normalized event frame, grouping fingerprint, payload digest and admission diagnostic agree. No occurrence is added or discarded. The ordinary unfiltered list again fills with newer real issues, while the older open issue lies beyond its bound. Owner HTTP and CLI retain their original filter-before-bound assertions, and official MCP now explicitly checks both list_issues and spool.issues.read with state=open and limit=1 against the same older issue.

The project remains at exactly 10,000 occurrences; its near-capacity archive remains at 9,999. The older open issue owns 9,898 occurrences after redistribution, so the exact packet available and omitted counts change from 9,999 to 9,898. This changes the fixture's expected cardinality, not the strength of its assertions. The newest packet event, descending order, complete UTF-8 byte bound, byte-driven omission, oversized zero-included case, full-capacity refusal, final-slot contention, exact accepted/refused counts, unchanged pre-existing rows, release/alert integrity and outcome accounting are all still asserted. No assertion is removed, skipped or relaxed; no sleep, retry or deadline change is introduced. No test registration is added.

The additional carry fix changes only tests/agent-handoff/caps.mjs and its regenerated sources.lock.json entry. The updated main also contributes its already landed Settings sections; those product and test changes are retained whole. Relative to current main, the single product commit carries the net capture-truth round plus this fixture correction. There is no merge commit, no edit to the earlier branch and no skip-CI marker. The three contract/view files remain byte-identical to main. Clause status counts remain 23 done / 54 partial / 28 missing (105 total); ERR-008 and GROUP-001 retain main's done judgments and SDK-007 remains partial. This builder makes scoped partial claims only.

## Concurrent main update

At the final pre-commit fetch, main advanced from 26d13d4 to ddeed7780feda8bb85c9b3d9dc740387c63b18db with the Settings split into seven addressable sections. The guarded shell stopped before creating a product commit. Unpublished work was saved, moved onto main and restored; only sources.lock.json conflicted. Main's contract/view files and source lock were retained whole, then the lock was regenerated from the combined source. Newer Settings fragment navigation and its assertions remain intact. No published history was rewritten and no intermediate product commit was made.

The caps fixture on these two main revisions is byte-identical, so the original clean-main pass and squash reproduction establish the same cause. The carry is rebuilt and all four required journeys rerun against the integrated Settings tree, with separate main-update receipts. main-update-receipt.json records the integration and final tested tree; the earlier receipts are preserved as earlier-base observations, not represented as final-base runs.

## Runtime interruption

At approximately 10:04 UTC the cloud environment restarted its execution context. The active SDK and agent runs lost their reapers/collectors and ended without receipts; their logs are retained separately as interrupted observations, not passes. The staged tree and completed earlier receipts survived. The remaining owned dev PIDs were stopped explicitly, the interrupted scratch directories removed, and both checks restarted against the same integrated tree. runtime-interruption-receipt.json records the observed process state and cleanup. No assertion, delay, retry policy or timeout was changed.

## Original capture-truth results

The actual before probe used the unmodified Sentry Node SDK with session tracking and captureFeedback at the public envelope door. Both successful items were stored and each incorrectly generated one overdue loss row. Rendered grouping split/apply/undo restored all three occurrences and preserved the short-ID alias and correction history, but ordinary total/open/unowned counts increased from 1/1/1 to 2/2/2. before-receipt.json retains the actual API/correction facts.

The carried implementation excludes successful stored/duplicate/withdrawal/forwarding and accepted release-normalization outcomes from follow-up loss classification. The scheduled scan cancels existing mistaken attention with successful_capture_not_loss while preserving identity and history, cancels pending alternate notices with a reason, and remains idempotent. Genuine refusal/discard/delivery paths and their counters are preserved. Empty native issue aggregates remain available for correction provenance and aliases, but no longer inflate ordinary list/search/export, report or digest work counts. Supported issue-only imported history remains inspectable.

| Observation | Main before | Candidate after |
| --- | ---: | ---: |
| feedback_accepted stored receipts | 1 | 1 |
| session_stored receipts | 1 | 1 |
| False overdue capture-loss rows | 2 | 0 |
| Ordinary issue total after split undo | 2 | 1 |
| Open issue count after split undo | 2 | 1 |
| Unowned count after split undo | 2 | 1 |
| Preserved occurrences after undo | 3 | 3 |
| New test registrations | 0 | 0 |

## Validation and browser proof

PLAN.md is the full execution plan. Actual logs and JSON receipts record each command, exit status, source digest and tested tree. The isolated command harness overlays the current tracked inputs on its checkout; the final candidate's committed tree is cross-checked against these tested source bytes in final-provenance-receipt.json.

All seven final-tree checks passed on committed tree 9913ba0ed9caf04015a4af7d180c75618bd298b0: build, typecheck, source/contract-document check, full tests/agent-handoff.mjs, full tests/sentry-sdk.mjs, full tests/triage-journey.mjs (operatorUi), and full tests/product-runtime.mjs (operatorFlow). The full agent run passed 9 groups, 10 masked captures, the 231,566/262,144-byte packet, 9,898 retained open-issue occurrences and the one-accepted/seven-refused final-slot race. Triage passed 22 groups and 101 desktop/phone captures, including main's four new Settings captures. No registration is added by this carry.

The SDK journey asserts success-only storage with zero loss work, one genuine invalid-intake loss, three genuine before_send SDK discards, two canceled legacy success follow-ups, canceled pending notices with reasons, unchanged genuine loss custody and repeated-scan idempotency. All assertions passed. CHECKS.json and final-provenance-receipt.json cross-check the actual tested trees and file hashes against the single published commit. Earlier pre-main-update passes and interrupted runs remain separately labelled.

The independent final-head proof uses actual SDK intake and rendered split/apply/undo, then captures the changed Issues and Needs attention screens once each at 1440 and 390. Assertions run at the desktop width; the existing journey's phone smoke remains intact. Screens and receipts contain synthetic product data only. Proof drivers are report-only artifacts outside the product branch, not new registered tests.

## Scoped claims and retained gaps

CLAIM ERR-008 PARTIAL points=none tests=tests/sentry-sdk.mjs#successful Node feedback/session capture and genuine-loss follow-ups
CLAIM SDK-007 PARTIAL points=none tests=tests/sentry-sdk.mjs#successful Node feedback/session capture and genuine-loss follow-ups
CLAIM GROUP-001 PARTIAL points=3 tests=tests/operator-flow.mjs#operatorFlow; tests/operator-ui.mjs#operatorUi
DEFAULT ERR-008: Existing mistaken attention is reconciled by the next scheduled scan, retaining its source identity and a cancellation reason. No real capture counter or provider outcome is rewritten.
GAP SDK-007: This carry does not qualify every envelope category, runtime or provider outcome; broader clause gaps remain.
GAP GROUP-001: No grouping-policy expansion or additional acceptance point is claimed.

## Publication and custody

Only the declared repository and named product branch are product write targets. No PR is required by AGENTS.md or the branch workflow; Verify has a pre-main push entry point. The full-history clone uses fleet identity and preserved repository hooks. All candidate authors, committers and trailer messages are inspected before every product push, including side parents, through the supplied cloud push guard. The product branch contains source, tests and its generated source lock only; every report, receipt, proof driver and screen is kept outside the product checkout for explicit report-only publication to evidence/main-spool-capture-truth-1-c1.

The cloud adaptation reserves the full publication scan and landing checks for the fleet's own host; this VM cannot run that scan. Local source checks and credential inspection do not substitute for it. Product READY, evidence transfer, acceptance, landing and deployment are distinct. The fleet must apply its publication scan and exact-main gates before landing. No clause judgment or deployment is claimed here.

Product branch pushed on its first guarded attempt. Exact-SHA Verify 43199529558 completed/success for 3af8a3ca856777e2445d33c6d1e5227e624b8278, observed at 2026-11-12 10:41:00 UTC. Five watcher API calls were made, with every run call at least 300 seconds apart, including discovery. No CI rerun, failed-job archive request or second product commit was needed. The checkout is clean, the remote branch matches the final SHA, and the final commit has one parent (updated main), fleet author/committer identity and no co-author trailer. All seven final local receipts match its exact committed tree; the focused browser proof also ran on its exact SHA.

The complete public-safe packet is explicitly selected for report-only publication to refs/heads/evidence/main-spool-capture-truth-1-c1. The terminal EVIDENCE line names that separate transfer head. Evidence publication does not land or deploy the product. No blocker remains for builder READY; the fleet's independent publication and landing gates still apply. The pushed scratch clone is removed after successful evidence publication.

READY branch=cloud/main-spool-capture-truth-1-c1 head=3af8a3ca856777e2445d33c6d1e5227e624b8278
