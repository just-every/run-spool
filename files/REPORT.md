# Dashboard window refusal result

Repository: just-every/run-spool
Branch: cloud/main-spool-dashboard-window-1
Base: 0f9809608a4ba84b23f4f8ece165605fcdd1acba
Product head: 02e798f0a22349398ec82f4ec6ea6ff86385e8bd
PR: none; this seed uses the fleet branch landing path.

## Reproduction and result

Reproduced item 13 through the emitted native product, public owner sign-in and Settings reporting editor. Two widgets with a two-hour window extending into the future produced “Use an explicit reporting window of at most 90 days”. The unsaved dashboard created zero reporting items. Actual before screenshots at 1440 and 390 and the baseline receipt are included.

The shared window validator now distinguishes an invalid start, invalid end, start before the supported epoch, end before/equal to start, a window exceeding 90 days, and an end beyond the existing clock-skew allowance. Every response names the cause and a corrective action. Native item writes prefix configuration errors with the widget number. The settings form displays all invalid widget windows beside their own start/end input, announces the messages, and connects each message with aria-describedby and aria-invalid. Correcting one widget clears its error without clearing another widget's error.

Future windows remain refused. The existing five-minute clock-skew allowance, 90-day duration rule, time-zone handling and admission boundary remain unchanged. FIND-003 does not authorize a new clamping behavior. No other stranger finding was changed.

The exact product head's browser proof shows both widgets' future-end refusals once at 1440 and 390, with no horizontal overflow or persisted item. Images contain only synthetic local data. Existing product fonts, Settings placement, one border per field and minimum text size remain in use; no icon-only controls were introduced.

## Validation

- Setup and build passed through cloud_run.
- pnpm typecheck passed.
- tests/reports-flow.mjs passed, including reportWorkbench: both invalid end fields have a future-end explanation rather than a duration explanation, associated accessible descriptions, no saved dashboard, independent error clearing, followed by the existing successful dashboard/query reconciliation journey.
- tests/investigation-flow.mjs dashboardFlow passed through an isolated native HTTP harness: each invalid window names widget 2 and its actual cause; refused updates preserve the prior widgets and revision. Existing metric, sharing, query, export, authority and capacity assertions also passed.
- Source lock was regenerated using the documented command after the final test edit. Initial CI revealed that the new validator was not yet tracked when the generator enumerated files. A second, append-only commit regenerated the lock after tracking the validator; source:check then passed on the committed head. Generated contract documents check passed. No contract or generated view was committed.
- git diff --check and the all-candidate author/committer/trailer audit passed. Both product pushes succeeded on their first transport attempt through cloud-push.py. No publication scan ran in cloud; the fleet lander retains that gate.

The first browser test attempt exposed the label's accessible-name inclusion of its inline error; stable input labels fixed that. A later test fixture used a historical start with a current future end and correctly met the duration refusal; the regression now uses a short current window before restoring its historical reconciliation window. The final touched journeys passed without deleting or weakening existing assertions.

## Counts and clause custody

Contract summary before and after: 23 done, 54 partial, 28 missing, 105 total. No clause status, Gap or Evidence changes. FIND-003 remains at main's existing judgment; this builder makes no DONE claim. Existing reportWorkbench and dashboardFlow were extended; zero test registrations were added or removed. No test-budget.json exists in this seed.

CLAIM FIND-003 PARTIAL points=3 tests=tests/reports-flow.mjs#reportWorkbench; tests/investigation-flow.mjs#dashboardFlow
DEFAULT FIND-003: Preserve future-end refusal and the existing five-minute clock-skew allowance; no clamping or policy expansion.
GAP FIND-003: This round qualifies the window-refusal correction and reruns existing point 3 journeys; it makes no new qualification of unrelated clause points.

## Plan and custody

PLAN.md contains the full executed plan. The pre-candidate fetch and rebase kept current main; main had not advanced. The source lock was generated last. The first real commit was pushed immediately. Both commits contain no skip-CI marker, use fleet author and committer, have no coauthor trailers, and include only product/tests/source-lock changes. After the initial CI failure, main was fetched and merged (already current), and the lock-only correction was pushed without rewriting published history. Evidence is published only to evidence/main-spool-dashboard-window-1, independently of product READY custody. Local setup/deployment links, credentials and setup logs are excluded.

CI: initial Verify run 43383739912 failed in build job 131747338251, step Check source and portable contract, on the source lock. Its failure archive was read once; ci-initial-failure.json records the actual error and correction. Final-head Verify run 43384549662 is recorded in ci-receipt.json and the terminal report. Browser/check receipts and selected logs are actual files. No account or product blockers were encountered.
