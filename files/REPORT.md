# sd-spool-import-rules-2 results

No contract clause claimed; this is a move-in fault fix (main-pack-dedup-1, 17 Nov).

## Outcome and blocker

Only the independently requested truthful Sentry rule-loss receipt is implemented. The waiting-state/automatic-activation assignment is BLOCKED on identification or authorization of an import path that creates native alert rules.

Main 3b7a3ebe545f3bd9c6a979ca04d5687c6a375b09 has no such vendor-import path. Its shared target adapter in src/domain/sentry-import/targets.ts supports only project, release, issue and event. src/domain/sentry-import/mapping.ts retains other collections without native effects; Rollbar and Bugsnag use the same native target adapter. tests/rollbar-import.mjs explicitly asserts that imported source rules never become executable native rules.

Native backup/restore does carry alert rule configuration, but src/domain/alerts/archive.ts exports enabled:0, validates enabled===0, and excludes alert destinations, reviewed destination tests and credentials. tests/alerts-runtime.mjs explicitly asserts that safety boundary. Automatically enabling restored rules would need a separate destination/approval design; it is not an existing import-apply rule-creation path.

The assignment explicitly says not to implement Sentry native rule carry and not to alter ALERT-001/manual preview refusals. No dormant helper, forged import origin, direct database-created rule or changed manual preview is offered as a completed waiting-state implementation. No waiting/activation browser or HTTP proof is claimed. A clarification was requested; absent an identified in-scope door, the dependent waiting/arrival work is left unimplemented.

## Product changes

- Derive a distinct source-rule definition count from the immutable Sentry plan entries (rules, metric_alerts, detectors and workflows). Source duplicates do not increase it.
- Owner-facing review/status/reconciliation and history include the plain line: “Rules are not carried over yet: <n> rule(s) not imported”.
- Show that line in the existing Business imports history receipt.
- Add a short explanation to docs/SENTRY-SWITCHING.md.
- Extend the real public HTTP journey to assert the source count, its persistence across apply/reconcile/history, and zero native alert rules. Capture the built receipt at 1440 and 390; UI assertions run at 1440.
- Regenerate sources.lock.json last after staging the new test file.

Sentry rule carry remains absent: the two-source-definition fixture creates zero native alert rules before and after this change. It now says so explicitly. ALERT-001 manual refusal source and its original journey are byte-for-byte unchanged from main. No reuse of prior dfd4d220's changed preview/refusal behavior.

## Plan and disposition

See PLAN.md for the full initial sequence. Configure/inspect, truthful receipt, documentation, focused public-door checks, builds, preservation, and evidence return proceed. Import-only persistence and automatic activation await a real import-created rule path. No contract clause meaning or judgment changed; no release metadata, version, tag or rer pin changed. No rer refresh-base, self-submit, PR, main push or landing.

## Before/after counts

| Measure | Before | After |
| --- | ---: | ---: |
| Fixture source alert definitions | 2 | 2 |
| Imported native alert rules | 0 | 0 |
| Named rule-loss receipt in history | absent | 2 rule(s) not imported |
| Contract done / partial / missing / total | 23 / 54 / 28 / 105 | 23 / 54 / 28 / 105 |

ALERT-001: target partial → target partial. MIG-001: target partial → target partial. No clause claimed or promoted. All account, device, held-out and landing gates remain independent.

## Local validation

- Fleet setup and public rer setup completed; commit hooks preserve repository hooks.
- Contract docs check passed; no generated views committed.
- Base source copy verification (node scripts/edition-authoring/cli.mjs verify-base --offline) passed. An initial mistaken verify-copies spelling was corrected to the documented command.
- Source lock/check passed; typecheck and changed-test syntax passed.
- rer check --profile first-party (this seed's release/contract validation equivalent) passed.
- rer build passed, including build:app. rer build --site passed: 19 pages, 46 files.
- Integration check passed.
- Native alert suite: 3 tests passed, 0 failed. Original ALERT-001 conditions/refusals, baseline, restart deduplication, release-less regression and archive roundtrip passed.
- The first receipt screenshot helper attempt tried reopening an already open modal at the second width. The helper now opens once and resizes for the second proof; product behavior was unaffected.
- Final Sentry public-door suite passed, including baseline/scaled source accounting, real pause/resume, exact re-import, undo, inert native graph, access/origin refusals and the existing Bugsnag migration cases. Actual counts are in import-receipt.json and complete baseline/scaled ledgers are retained.

The cloud toolchain runs the checkout's pinned pnpm 10.12.4; rer selects project Node 22.20.0 for its commands. Direct checks/tests ran on available Node 24.19.0. Browser proof uses /usr/bin/chromium with --no-sandbox. Synthetic source and owner identities only. No hosted/provider/account acceptance is claimed.

## Product custody and CI

Branch: cloud/sd-spool-import-rules-2. Product head: 6d55202781d060e57defb4dc9e492b1a86a0bc2c. The first real commit was pushed immediately through the fleet guard; no intermediate skip-CI product commit. Fleet author/committer and absence of trailers verified over every candidate commit. Fresh main was fetched before the commit; rebase was already up to date. Product checkout is clean. No PR was created.

Exact-SHA Verify: https://github.com/just-every/run-spool/actions/runs/44161809971. Initial discovery was in progress; final status follows. Product CI is separate from the unresolved task-scope blocker and from evidence return.

Additional preservation: product.bundle outside the clone verifies successfully; SHA-256 18ee7b531727b1fff1c14534e26ceb0e915d6f28124bea5ef7fced1ebad4a136. The remote named branch was read back and matches the product head. The bundle is recovery data, not READY or CI evidence.

Final CI: Verify run 44161809971 completed SUCCESS on exact head 6d55202781d060e57defb4dc9e492b1a86a0bc2c, observed 2026-11-17T20:09:55.287096+00:00. Six repository GitHub API calls were used at intervals of at least 300 seconds. No rerun or failed-log request was needed. See ci-receipt.json and the complete original discovery/poll receipts.

Terminal assignment status: BLOCKED on the missing in-scope native rule-import path/ruling. The successful CI prerequisite applies to the receipt-only commit and does not complete the waiting/activation assignment. The optional clarification received no response during the run. No contract clause claimed; this is a move-in fault fix (main-pack-dedup-1, 17 Nov).

Report completed 2026-11-17T20:10:35Z. Product changes are on the named branch only; evidence uses only evidence/sd-spool-import-rules-2. No PR or release was created. The verified outside-clone bundle and packet remain after the requested clone cleanup.
