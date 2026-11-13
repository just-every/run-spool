# Spool readable codes continuation

Repository: just-every/run-spool
Branch: cloud/main-spool-readable-codes-1-pc1
Saved product head: d43de99817db620fac950ddc7e8bfbcf3c38eccb
Candidate: 84132b9e5331a368a43b1a75eab7faa52cbfd8a0
Merged main: ba41c296c3aa6bc6aa5a7623e5d2dadfe99279bf
Product push: succeeded on the first attempt. No PR created; the fleet owns landing.

## Plan and outcome

The full plan is in PLAN.md. This continuation preserved all three published product commits, read the launcher and repository rules, inspected the completed execution failure once, reproduced the existing journey locally, merged updated main without rewriting history, replaced a fragile background-tab gesture with ordinary link navigation, regenerated the source lock last, ran touched checks, and pushed the named product branch. Exact-SHA Verify completed successfully; separate report publication completes the handoff.

Previous Verify 43389953919 failed in verify (execution), job 131767690678, Run suites: disconnectedGitHubSetup waited 30 seconds for a page after a ControlOrMeta click. The two downstream summary jobs failed because of that job. The unmodified journey passed locally, so this was not a consistently reproducible product failure. The fix exercises normal click navigation to the actual GitHub setup guide and Back navigation. The same-origin, anonymous HTTP success, docs-index reachability, disconnected status, connection limits, accessibility, workflow, restore, and erasure assertions remain. No assertion was removed, skipped, or weakened.

Current main's capture-setup, integration-egress and dashboard-window changes were retained. The only merge conflict was sources.lock.json; the documented generator resolved it. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md were not edited. No proof files were committed. Generated alert screenshots were copied to this packet and restored in the product checkout before the final lock generation.

## User-visible results

| Finding | Before, as supplied in the brief | Candidate local public-door result |
| --- | --- | --- |
| 12: held/released alerts | issue hash and rule UUID | issue short ID/title and rule name before expiry, after expiry and after release; no stored hash or UUID in rows |
| 15: usage | filtered:environments | Filtered by environment, alongside readable accepted/duplicate/filtered totals |
| 16: restore refusals | erasure_epoch or part_checksum; unrelated sign-in action | erased-data safety explanation and safe choices; damaged-file explanation and replacement guidance; no sign-in action for either file refusal |

The browser still receives HTTP 400 and the exact server refusal codes part_checksum and erasure_epoch. Both refused restores leave the destination empty. Refusal, holding, release and capture semantics are unchanged by this round.

Counts: the brief names 3 readability findings; local candidate probes observe 0 remaining failures in those three findings. The previous Verify had 3 failed jobs (one substantive execution failure and two summary failures). Candidate Verify now has 0 failed jobs, versus 3 in the previous run. This continuation adds 0 test registrations, changes 0 clause statuses, and adds 1 merge/fix-forward commit. No test-budget raise was requested. The original saved candidate extended existing journeys; this continuation only changes an interaction in an existing journey.

## Local validation

All intended final checks passed: application build, pinned pnpm 10.12.4 / Node 22.20.0 typecheck, source check after final regeneration, contract document check, execution journey with ordinary navigation, alerts UI journey, and the focused public HTTP/UI usage-and-restore proof. checks.json and the individual logs are actual receipts. The focused proof invokes the committed usageLabels, damagedRestoreUI and erasedRestoreUI helpers without introducing a new product test registration.

The saved execution journey also passed locally before the navigation repair. One auxiliary check shell initially used the VM's default pnpm 11 and failed before running typecheck; the final check used the required pinned toolchain and passed. A source check during merge correctly detected the not-yet-regenerated lock; the final regeneration/check passed. The initial diagnostic logs are retained; final results are checks.json, typecheck.log and source-check.log.

Browser evidence: screens/held-{1440,390}.png, released-{1440,390}.png, usage-{1440,390}.png, restore-damaged-{1440,390}.png and restore-erased-{1440,390}.png. All use synthetic data. The agent visually inspected usage and both restore states at both widths, and all held/released captures; public-door assertions run at 1440 for the changed readability behavior. Browser contexts and all started runtimes were closed. The application was rebuilt from committed candidate 84132b9e5331a368a43b1a75eab7faa52cbfd8a0 and both the focused public proof and complete alerts UI journey passed again, refreshing all ten captures from that exact candidate build. See candidate-build.log, candidate-readable-proof.log and candidate-alerts-ui.log.

## Claims and limits

CLAIM ALERT-003 PARTIAL points=6 tests=tests/alerts-ui.mjs#readableHeld
CLAIM SDK-006 PARTIAL points=3 tests=tests/team-browser.mjs#usageLabels
CLAIM ERR-009 PARTIAL points=4,5 tests=tests/restore-refusal-ui.mjs#damagedRestoreUI; tests/restore-refusal-ui.mjs#erasedRestoreUI

GAP ALERT-003: This round proves readable retained backlog labels; it does not claim new live-provider or full digest qualification.
GAP SDK-006: This focused label proof uses native ingest and does not claim a new complete unmodified-SDK filter matrix.
GAP ERR-009: This round proves two browser refusal messages and nonmutation; it does not claim complete portability qualification.

No DONE claim or clause status promotion. Publication scan and main landing remain fleet responsibilities. No main/default-branch push and no history rewrite occurred. Product identity and trailers were checked across every candidate commit, including side parents; all are fleet identity and no co-author trailers remain. No account/permission blocker was encountered.

## CI and custody

Previous run: https://github.com/just-every/run-spool/actions/runs/43389953919
Candidate Verify: https://github.com/just-every/run-spool/actions/runs/43398044990
Exact head: 84132b9e5331a368a43b1a75eab7faa52cbfd8a0
Final exact-SHA result: completed/success, observed by REST. See ci-final.json and ci-history.json. The candidate satisfies the READY contract; no generator exception or rerun was needed.
API budget: 7 of 10 calls used. Initial failed jobs lookup and one failed execution log archive invocation, then exact-SHA discovery and subsequent run polls at least 300 seconds apart. No direct job-log blob download and no redundant workflow dispatch/rerun.

Evidence publication is report transport only. It does not signal product READY, acceptance or landing. All selected files are actual regular files, explicitly selected, and checked for injected secret values before publication.

Terminal product custody: READY branch=cloud/main-spool-readable-codes-1-pc1 head=84132b9e5331a368a43b1a75eab7faa52cbfd8a0
