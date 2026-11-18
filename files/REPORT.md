# Spool Sentry alert rule import repair

Run Edit Run fleet · 18 November 2026 · sd-spool-import-alerts-2

## Plan and implementation

1. Replay the three product commits from `746d6e15cc835fdcb3642c7f8168ac9794150d36` onto fresh Spool main as ordinary commits. Preserve the archive repair and migration `0114_sentry_alert_proposals.sql`. The keys and setup refs reserve 0111, 0112 and 0113.
2. Reproduce the blocked-save failure with the existing Alerts journey. On replay head `4ce0e819fc36bbfb056c83f31b57d003ff996e1c`, the normal browser run passed. Holding the first destination-list response after the second successful review for 1,200 ms reproduced the exact assertion from Verify 44246524029. The review was already in D1, but Alerts still displayed its old destination snapshot while fetching five datasets. The readiness hint therefore still asked the owner to review a test.
3. Return the stored review timestamp from the confirmed review write. Apply it to the matching project, destination and test in the Alerts view before the background read finishes. The existing readiness logic then names the preview action. The manual rule preview guards, the existing ALERT-001 assertions and the clause itself are preserved. The assignment journey on this base already uses an alert for conflict feedback. Its test waits for that alert to render after the response. In the Alerts journey the two existing button descriptions are read after their ARIA attributes appear.
4. Regenerate the contract views, check them and restore the published view files. Regenerate the source lock last. Build on the pinned Node and pnpm versions, then run the Alerts, Sentry, archive, erasure and operator journeys and compare the delayed browser probe with its replay-head result. Publish only the named product branch and follow its exact-SHA Verify. Return the test receipts and browser captures through the report-only evidence ref.

## Import behavior

Your Sentry alert rules were brought over as rules waiting for your approval. Those that need data wait for their first event or session, and any rule whose Slack, PagerDuty or other destination Spool cannot reach is listed as needing a destination.

The synthetic export covers legacy issue and metric rules, warning and critical thresholds with a resolve threshold, workflows with linked monitors, unique users, multiple session aggregates, a Slack destination, an unsupported aggregate and a malformed rule. An additional synthetic organization exercises a verified member, an explicitly assigned team and an unmapped member.

Approval creates native rules using the existing roster and project membership for destinations. Only approval can create a waiting rule. The check covers fresh matching data, a restarted Worker, native edit and undo conflict, project erasure and no delivery replay from the imported events. The alert proposal migration lives in the deployment ledger and the portability schema, and the archived fixture rewinds it with the roster table.

## Clause accounting

The full target count stays at 23 done, 54 partial and 28 missing across 105 clauses. MIG-001, ALERT-001 and AUDIT-001 remain partial. ERASE-001 remains done. The product branch carries no contract status, gap or evidence edits.

CLAIM MIG-001 PARTIAL points=2,7 tests=tests/sentry-import/field-accounting.mjs#fieldAccounting; tests/sentry-import/alert-rules.mjs#alertRulesImport

CLAIM ALERT-001 PARTIAL points=2,4 tests=tests/sentry-import/alert-rules.mjs#alertRulesImport; tests/alerts/conditions-journey.mjs#conditionsJourney

CLAIM AUDIT-001 PARTIAL points=none tests=tests/sentry-import/alert-rules.mjs#alertRulesImport

CLAIM ERASE-001 PARTIAL points=1 tests=tests/sentry-import/alert-rules.mjs#alertRulesImport

GAP MIG-001: A real authorized export and production-volume dual run remain unproved.

GAP AUDIT-001: The import approval audit passed locally. The new approval entry’s archive round trip was not independently asserted.

The cloud VM delegates the full publication scan and landing to the fleet. The two platform playbook paths returned HTTP 404. This round followed the shipped builder rules and Spool's repository instructions.

## Results

The synthetic export had 12 definitions. Import staged 10 proposals and refused 1 malformed rule. Owner approval created 10 native rules. 4 waited for matching data and later activated. The fixture recorded 5 native alert facts after fresh observations and 0 deliveries. A verified member and an assigned team bound to native destinations. The unmapped recipient and Slack rules stayed disabled. The focused journey passed exact re-import, guarded undo, HTTP 409 after a native edit, restart deduplication and project erasure.

The Alerts runtime and browser suites passed in split invocations. The browser suite passed again with the same 1,200 ms delay that reproduced the regression. The screenshots show the preview action and the import receipt at 1440 and 390 pixels. The phone receipt is scrolled to the rules so every outcome is visible.

The repository, offline Base, build, integration, typecheck, contract generation and source-lock checks passed. The old-archive suite passed. A public restore of a synthetic roster-era archive with a hashed ledger returned 200 after rewinding migration 0114 and the proposal table. The desktop triage passed the operator assignment flow, and the larger triage run reached its local timeout during the phone leg. The broad local project-erasure suite reached its time limit. The imported-alert erasure flow passed. The first Sentry HTTP run collided with the native alerts fixture on loopback port 15542. The independent Sentry HTTP retry status is timed_out. The signed Business import retry status is timed_out. The full repair-recovery retry reached its 90-second local dev readiness limit during setup. The focused archive restore returned HTTP 200.

The product branch was pushed at `9d389f449317e4c449e4b8624b992c59239186cc` from `e3093f41a692a33dd46ba997e9409e606e973c5c`. Exact-SHA Verify 44254228280 is in_progress with conclusion `pending`. The validation receipt records both product provenance and local outcomes. [44254228280](https://github.com/just-every/run-spool/actions/runs/44254228280)
