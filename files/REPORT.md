# Readable references carry results

Repository: just-every/run-spool
Branch: cloud/main-spool-readable-ids-1-c1
Product head: c4492f61203d0e9af9184a2339252b78e0330978
Base/current main at preparation: ae07f7a47522ac43a5894fdfed3918ae49f763ea
Original readable-reference branch: cloud/main-spool-readable-ids-1 at 537706bc5836fbae9982cac5b587031e2858f18b
Product push: succeeded on the first attempt with the required fleet push guard.
Pull request: none; this repository's fleet branch landing path applies.

## Plan and implementation

The complete plan is in PLAN.md. Full history was cloned; the new branch started at current origin/main and received a squash of the original branch. The reports-flow conflict keeps main's settings#settings-projects navigation and all 84 behavioral assertion calls. The two assertions which formerly found event identities in visible code elements now compare the exact same expected sorted IDs with row data-event-id attributes. Four readable-reference assertions were added. No assertion was removed, skipped or loosened.

The carried net change describes grouping occurrences with workspace time zone, release and message; identifies issues with short IDs and titles; presents correction history as exact event moves with person and times; and keeps the raw correction only behind Copy details. Report event rows show their actual issue reference while the date opens the same exact event. Deployment run and outcome actors resolve to native owner, member or deploy-key names. Resumption references name the snoozed issue/rule/project and its period. Ordinary API/export/archive projections retain their existing schemas.

The product tree contains only the 13 source files, four extended test files and regenerated sources.lock.json from this round: 18 files, 202 insertions, 52 deletions. There is exactly one product commit and no merge commit. No skip marker or coauthor trailer is present. Both author and committer are Run Edit Run fleet <fleet@runeditrun.com>.

CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to origin/main. Their hashes and ancestry checks are in provenance.json. The source lock was regenerated last before committing and source:check passed after screenshot outputs were restored. No contract clause text, Status, Gap or Evidence changed.

## Local validation

All checks below passed on the committed product tree:

- cloud_run npx -y @runeditrun/rer build.
- pnpm typecheck.
- node src/base/contract-docs.mjs check.
- node scripts/edition-authoring/cli.mjs lock, then pnpm source:check.
- cloud_run node tests/reports-flow.mjs: reportsFlow and reportWorkbench passed, including exact retained totals, receipt dates, exact-event navigation, saved-query reconciliation, permissions/exports and readable rows.
- cloud_run node tests/triage-journey.mjs: the existing journey invoked operatorUi at 1440 and 390 and passed 22 check groups with 100 captures. Grouping split/merge preview, exact immutable memberships, apply/undo, short IDs, person attribution and Copy details equality passed.
- cloud_run node tests/deployment-history.mjs: the existing deployment history journey invoked releaseOrderFlow and passed owner/CI outcomes, idempotency/conflicts, timeout notice, rollback, ordering, restore/erasure and phone/desktop UI.
- cloud_run node tests/alerts-ui.mjs: destination tests, delivery states, timezone digests, snooze/resumption and baseline/rule journeys passed at 1440 and 390. Worker shutdown emitted broken-pipe diagnostics; the journey completed with exit 0.

Actual per-journey exit receipts, complete synthetic logs, static provenance and proof hashes are selected into this packet. Build used rer's project runtime selection; direct journeys used the supplied cloud toolchain and /usr/bin/chromium with --no-sandbox. No full local verification suite was run.

## Before and after counts

- Product commits ahead of current main: 0 -> 1; merge commits: 0 -> 0.
- Static assert.* calls in the five named files: 262 -> 286. Reports 84 -> 88; operator UI 42 -> 53; deployment history 44 -> 49; release order 70 -> 70; alerts UI 22 -> 26. These are source call counts, not dynamic assertions or test registrations.
- New test registrations: 0. No test entry point or registration was added; this work extends existing journeys only.
- Core: 23 done, 45 partial, 19 missing, total 87, unchanged.
- Agent surface: 0 done, 9 partial, 9 missing, total 18, unchanged.
- Full target: 23 done, 54 partial, 28 missing, total 105, unchanged.
- Target source statuses: GROUP-001 done -> done; FIND-003 done -> done; REL-001 done -> done; ALERT-003 partial -> partial. No DONE claim is made.

## Browser proof and scope

The packet includes the changed grouping picker/history/merge preview, report rows, deployment actors and resumption reference at 1440 and 390, with hashes in browser-proof.json. The readable-reference assertions run at 1440; existing phone smoke/journeys are retained. Screens were inspected at both widths.

The existing Held alerts ledger below the resumption section still shows its old raw identifiers; that ledger is outside the assigned resumption-reference change and the original round. No broader alert-delivery status wording was changed. The separate plain-delivery-labels round remains free to land. This carry makes no provider, team-wide, hosted, release or new full-clause acceptance claim.

## Claim lines

CLAIM GROUP-001 PARTIAL points=none tests=tests/operator-ui.mjs#operatorUi
CLAIM FIND-003 PARTIAL points=1,2,3 tests=tests/reports-flow.mjs#reportsFlow; tests/reports-flow.mjs#reportWorkbench
CLAIM REL-001 PARTIAL points=1,2,3,4,5,6 tests=tests/deployment-history.mjs#REL-001 deployment history journey; tests/release-order-flow.mjs#releaseOrderFlow
CLAIM ALERT-003 PARTIAL points=none tests=tests/alerts-ui.mjs#ALERT-003 destination tests, delivery states, timezone digests and snoozing never hide loss

## Custody and remaining fleet gates

Exact-SHA Verify is tracked in ci-receipt.json; final result is recorded below before evidence publication. Publication scanning, guarded landing, merged-main Verify and Run site remain the fleet machine's responsibility under the cloud adaptation. No cloud publication scan, main push, merge, deployment or landing was attempted.

Evidence publication uses only refs/heads/evidence/main-spool-readable-ids-1-c1 and a report-only tree; it does not signal product acceptance or change the product checkout. The clone is removed only after successful product/evidence publication and preservation of the selected packet.


## Exact-SHA CI result

Verify run 43215398526 completed/success on c4492f61203d0e9af9184a2339252b78e0330978.
https://github.com/just-every/run-spool/actions/runs/43215398526
A total of 9 GitHub REST calls were used, including bounded authentication recovery probes after HTTP 401. Run reads were at least 300 seconds apart. Access recovered using the refreshed launcher bundle. No workflow rerun was requested by this task.

No blocker remains. Product READY is independent of evidence transport and the fleet publication/landing gates.
