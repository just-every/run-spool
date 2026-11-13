# main-spool-readable-codes-1

Repository: just-every/run-spool
Branch: cloud/main-spool-readable-codes-1

## Plan

1. Refresh the fleet launcher, configure fleet identity, credential helper, commit hooks and guarded product transport; clone current main into an isolated checkout.
2. Reproduce held alert identifiers, environment usage codes and restore refusals through the emitted application's authenticated public HTTP and browser doors.
3. Resolve held-row issue and rule references within their project. Share readable capture counter labels with organization usage. Translate browser restore failures into plain explanations and safe next actions, preserving all server refusal logic.
4. Extend existing alert, organization and archive journeys rather than registering new tests. Assert behavior at 1440; capture changed screens at 1440 and 390.
5. Run touched journeys and typecheck. Fetch main and integrate it before the candidate commit. Regenerate the source lock last and check it. Inspect every candidate identity and trailer, then publish only the named product branch with the cloud push guard.
6. Discover and poll exact-SHA Verify using REST within the API budget. Publish this report and actual receipts separately to the evidence ref, then return custody and claim lines for the fleet.

## Reproduction

Current main reproduced all three findings. Actual browser receipts are reproduction.json and damaged-reproduction.json, with before screenshots. Held history displayed an issue hash and a rule UUID. Organization Usage displayed filtered:environments after a matching real capture. An archive from before public project erasure was refused with erasure_epoch and Sign in again; a checksum-damaged archive in an independent empty installation was refused with part_checksum and Sign in again.

## Scope

No contract judgments or generated acceptance views are edited. No server restore or hold decision changes. No CLI import changes, provider qualification or DONE claim. UI uses existing components, typography and layout.

## Results and validation

Final product head: d43de99817db620fac950ddc7e8bfbcf3c38eccb. Three guarded product pushes succeeded on their first attempts; history was preserved. The first head was 0c3d70f9a190c536ea417e53a68e1d58e91211d2. No PR was created: the fleet lands the named branch. The product checkout is clean.

Before/after: 3 reported trips reproduced, 3 fixed, 0 remaining in this scope. Both archive refusal subcases were verified. Contract Status/Gap/Evidence changes: 0. New top-level test registrations: 0; existing alert, organization and archive journeys were extended, with no test removed or weakened. No cap raise or test-budget change.

- Build passed using the public rer build command.
- Typecheck passed with pnpm 10.12.4.
- tests/alerts-ui.mjs passed: held new issue and actual regression history has issue short ID/title and current rule name; hashes and UUIDs are absent before expiry, after expiry and after explicit release. Existing destination/delivery/baseline/Slack behavior remains asserted.
- tests/triage-journey.mjs passed (22 groups, 101 existing JPG captures): the actual browser-downloaded archive restores with whole-product equality into an independent empty destination. A checksum-damaged file stays refused with HTTP 400 part_checksum, and the pre-erasure file stays refused with HTTP 400 erasure_epoch after erasing all projects. Both create no projects and show readable explanations and recovery advice with no sign-in link.
- tests/team-browser.mjs#usageLabels passed through the emitted Worker and browser using the retained usage-proof.mjs runner. Real accepted, duplicate and environment-filtered captures reconcile with usage rows, whose labels hide internal reason codes. The filter policy is restored afterward.
- Browser proof shows held, expired and released history, usage, damaged restore and pre-erasure restore at 1440 and 390. Assertions added by this round run at 1440.
- The source lock was generated after adding new source files and restoring generated screenshot artifacts; its check passed. Contract documents check passed without editing contract judgments or generated views.

Local limitation: an additional attempt to run the complete unrelated teamFlow parent stalled in unchanged admissionRuntime startup before migrations or assertions, under both Node 24 and pinned Node 22. A final sequential pinned-Node retry also reached only fixture startup and was stopped by its 180-second timeout (shell exit 247); team-startup-limit.log retains that actual output. Only its own PIDs were stopped. The touched usageLabels flow passed separately; no full teamFlow pass is claimed. A concurrent targeted usage attempt collided with the alerts fixture's fixed port; the final sequential retry passed. An extra typecheck invocation accidentally used the VM pnpm 11 default and refused module installation; the final invocation used the required toolchain and passed. No dependency or product changes resulted from either attempt.

Publication: the full publication scan remains with the Mac fleet lander, as required by the cloud brief. This run checked its own staged diff for credential-shaped additions and verified every candidate author/committer and trailer before the guarded push. No evidence, screenshots, credentials or environment values are in the product commit.

## Claims and boundaries

CLAIM ALERT-003 PARTIAL points=none tests=tests/alerts-ui.mjs#readableHeld
CLAIM SDK-006 PARTIAL points=none tests=tests/team-browser.mjs#usageLabels
CLAIM ERR-009 PARTIAL points=2 tests=tests/triage-journey.mjs#journey; tests/restore-refusal-ui.mjs#damagedRestoreUI
CLAIM ERASE-001 PARTIAL points=none tests=tests/restore-refusal-ui.mjs#erasedRestoreUI

The none claims name readability or representative refusal slices; they do not qualify the complete maintenance/quiet-hour, every-filter, or same-and-fresh erasure acceptance points. No DONE claim or clause status change is requested. ERR-009 point 2 retains the existing public independent restore and equality proof. Wider account, provider, scale and commercial obligations remain outside this round.

## CI and evidence custody

Exact-SHA Verify is being observed through one REST watcher, at least 300 seconds between observations. Its actual run receipt and terminal result will accompany this packet. Evidence publication is separate from product READY and never implies landing or acceptance.


## Exact-SHA CI correction

First Verify: 43385097574 on 0c3d70f9a190c536ea417e53a68e1d58e91211d2 completed/failure. Every test shard passed except owner-ui. Its failed job 131752174469, Run suites step, failed the new usage count assertion (2 rendered rows versus 5 refreshed API rows). The complete failed assertion log was read once and is retained as ci-first-owner-ui-failure.log. The derived shards and verify aggregate jobs also failed because of that shard.

The first follow-up commit fc9504463ad9158b9275ff52d042b1002ca40da7 replaces the immediate count read with Playwright's waiting assertion for the same expected count. No assertion is deleted, skipped or weakened. The targeted usageLabels journey passed again, then main was fetched and merged (already current), the lock regenerated and checked, both commits' identity/trailers inspected and the same branch pushed normally. No empty commit, skip marker, rebase or force push was used. Product behavior is unchanged from the first tested head.

Seven GitHub calls were used to discover/poll the first run, inspect jobs and read its one assertion failure log. The remaining three calls are reserved for the terminal candidate's status at the original watch deadline and any necessary failure inspection.


## Root-cause reproduction and terminal test correction

A same-page control reproduced the exact stale-state cause: preloading Settings with two usage reasons, then capturing new outcomes and navigating only to its organization hash leaves the existing Members state in place. The waiting assertion still correctly refused (expected 4 rows, received 2 after 20 seconds). The terminal correction explicitly reloads that existing Settings page, as a person would to refresh counters, before asserting every current row and its label. The same control then passed through the real emitted Worker at 1440, with screenshots at 1440 and 390. See usage-same-page-before.log, usage-same-page-after.log and usage-same-page-runner.mjs. This is a test setup correction; the product implementation remains unchanged from the first head. The wait-only intermediate head is not a READY candidate.

The terminal commit was pushed normally after main integration (already current), lock regeneration/check and inspection of all three candidate commit identities and trailers. No assertion was weakened. The original 45-minute CI watch deadline is retained: a still-running terminal Verify will be handed back as PUSHED, never READY. The existing fleet will watch and land or repair that exact head.


## Terminal custody

PUSHED branch=cloud/main-spool-readable-codes-1 head=d43de99817db620fac950ddc7e8bfbcf3c38eccb

At the original 45-minute watch deadline (2026-11-13 08:06:26 UTC), exact-SHA Verify 43389953919 was in_progress, conclusion null: https://github.com/just-every/run-spool/actions/runs/43389953919. Eight GitHub calls were used. No green claim or product READY is made. The fleet should continue watching this run and land or repair the exact pushed head. The earlier failed run 43385097574 and its owner-ui job/Run suites failure are fully retained; the terminal same-page reload correction passed locally. The intermediate head was superseded before any CI result was consumed. No PR was created. Clause statuses remain unchanged; reported trips are 3 before and 0 after in the touched local public-door checks. The complete plan, limitations, claims, before/after browser proof and actual receipts are this packet.
