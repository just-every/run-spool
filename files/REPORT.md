# Spool v0.7.12 release metadata preparation

Author: Run Edit Run fleet. Recorded: 2026-11-15T09:46:01Z.
Tag: sd-spool-release-0-7-12. Repository: just-every/run-spool.

## Product custody

Product branch: cloud/sd-spool-release-0-7-12
Product head: cc086904fd942175d18c60082b10c459c343dc78
Base main: 9ef8c42fe095ccf349b9d013894f99df4e63ce78
Previous immutable tag commit: b9e7e575097e0dd0fc0662ce1ed507fa0d41f0d8
Product push: succeeded on the first guarded attempt; one real commit, one product push.
No PR was created: this brief uses the fleet's guarded branch landing path; repository AGENTS.md requires no PR for this candidate.
The checkout is clean. Product metadata preparation is separate from release publication.

## Plan and execution

1. Refreshed the fleet launcher and installed decrypted-bundle Git helper, cloud push guard and commit-message cleanup hooks. Cloned only the declared repository with depth 1 and blob filtering; acquired the intervening main history and v0.7.11 tag for the actual comparison. Configured fleet identity globally and in the clone.
2. Read the supplied RULES.md and release rules, launcher AGENTS.md and repository AGENTS.md and contract documents. Used only the named metadata lease. No lane INBOX.md or STATE.md was read or written.
3. Freshly verified main still equaled the brief's SHA, with exact-SHA Verify 43693624323 and Run site 43693624304 completed/success. Release readback confirms v0.7.11 is the latest non-draft published Release; all listed releases contain no v0.7.12, including drafts. Remote refs contained no v0.7.12 or competing 0.7.12 release branch, and open PRs contain no competing release metadata owner.
4. Reviewed the real v0.7.11..main comparison: 28 commits, 65 changed paths and three newly added migrations. Notes cover project metric alerts, retained Sentry transaction timing, project recipients and explicit fallback, issue severity/tag comparisons, native archive compatibility and dependency refreshes. Notes retain existing documented limitations and add the new bounded transaction/issue-ownership limits.
5. Updated package.json and seed.json version fields, RELEASE.json, and only the new CHANGELOG.md section. Kept package.json's exact @runeditrun/rer pin at 0.2.113. Preserved prior changelog sections and latest-published-tag references in README.md/docs/getting-started.md: v0.7.12 is not yet published. There is no package-lock.json; this repository uses pnpm-lock.yaml, which stayed unchanged.
6. Installed dependencies with frozen pnpm lock, ran the existing first-party check and typecheck, fetched fresh main and rebased the unpublished work without changing the base. Regenerated sources.lock.json last with the documented edition-authoring command and passed its check. Verified metadata consistency, exact changelog/release notes agreement, additive migration inventory, scope and all candidate commit identities/messages.
7. Committed as Run Edit Run fleet <fleet@runeditrun.com> for both author and committer, with repository hooks active and no trailers. Pushed only the named product branch through cloud-push.py. REST discovered exact-SHA Verify 43700561623. One watcher observes the 300-second poll minimum and ten-call budget; its final result is recorded below and in RECEIPT.json.
8. Saved this actual non-secret packet outside the product clone. Evidence is published separately through cloud_evidence.py to refs/heads/evidence/sd-spool-release-0-7-12. After evidence publication and custody readback, the pushed clone/dependencies are removed.

## Exact changed paths and counts

- package.json: 0.7.11 -> 0.7.12; @runeditrun/rer 0.2.113 -> 0.2.113.
- seed.json: 0.7.11 -> 0.7.12.
- RELEASE.json: version 0.7.11 -> 0.7.12; previousVersion 0.7.10 -> 0.7.11; migration entries 0 -> 3; breaking stays false; honest notes/update instructions.
- CHANGELOG.md: one new release section, dated using date -u, with notes exactly equal to publicReleaseNotes.
- sources.lock.json: four metadata file hashes updated; component, parent, manifest, toolchain and edition identities unchanged.

Candidate diff: five files; 45 insertions, 11 deletions.
Product source, tests, homepages, dependencies, contract source and generated views changed: zero.
Clause status changes: none. Contract status counts are unchanged: {'done': 23, 'partial': 54, 'missing': 28}.
No clause acceptance claim or promotion is made for this metadata-only round.

## Migration inventory

The three entries reflect additions already on main, not new SQL in this candidate:

- migrations/core/0106_project_metric_alerts.sql
- migrations/core/0107_sentry_transactions.sql
- migrations/core/0108_alert_notify_targets.sql

No previously applied migration file changed between v0.7.11 and main.
Update instructions require a backup, retained database/private settings/project keys/deployment receipt, ordinary rer dev or rer deploy, and no reset. Archives import only into an empty destination.

## Validation and receipts

All local touched checks passed:

- pnpm install --frozen-lockfile: exit 0 (DEPENDENCIES.log).
- pnpm run check -- --profile first-party: exit 0 (METADATA-CHECK.log).
- pnpm typecheck: exit 0 (TYPECHECK.log).
- node scripts/edition-authoring/cli.mjs lock: exit 0 (SOURCE-LOCK.json).
- pnpm source:check: exit 0 (SOURCE-CHECK.log).
- git diff --check: exit 0.
- One-time metadata consistency/scope inspection: PASS (METADATA-RECEIPT.json).
- Every candidate commit author/committer/trailer and full message: PASS (IDENTITY-RECEIPT.json).
- Guarded product push: first attempt success (PRODUCT-PUSH.log).

Toolchain: pnpm 10.12.4, VM Node v24.19.0 under the prescribed toolchain setup. The repo declares Node 22.20.0; pnpm emitted its engine warning, while the existing checks passed. Branch Verify uses the workflow's pinned Node.
No new tests, full local suite, browser journey, app build or provider call was required or run for this version-only lease.
The full-history publication scan is delegated to the fleet Mac lander, as required by the cloud adaptation; it was not run in this VM.
Full plan, source comparison, actual command logs, checks, receipts and product diff are included in this packet.

## Known follow-up debts and boundaries

This task prepares a candidate only. The fleet still owns guarded landing, its publication scan and exact-main gates, immutable release production, signing, tag push, GitHub Release publication/readback and check-gh-release.sh. No tag, GitHub Release, signing, publishing, deployment, CI dispatch/rerun or self-submission occurred here.
The exact rer pin remains 0.2.113; rer 0.2.118 was not adopted.
A tag alone would be RELEASE-PENDING. This report makes no RELEASED or DONE claim.
Retained hosted archives still need separate Managed-to-native qualification; restore limitations in the prior release notes remain explicit. Issue-owner notification selection uses fallback, transaction intake remains bounded observations, local development suppresses mail, and real-account imports/live-provider delivery remain unqualified.
The successful push reported a pre-existing default-branch Dependabot inventory of 30 findings (4 high, 20 moderate, 6 low). This lease does not change dependencies; triage remains with maintenance.
No blocking ruling or account prerequisite is needed for the scoped metadata candidate.

## Exact-SHA candidate CI

Verify: https://github.com/just-every/run-spool/actions/runs/43700561623
Head: cc086904fd942175d18c60082b10c459c343dc78
Status at discovery 2026-11-15T09:44:14Z: in_progress; conclusion null.
Final observation follows.

Final REST observation: 2026-11-15T09:59:18Z, status in_progress, conclusion null, exact head unchanged.
Run ID: 43700561623. URL: https://github.com/just-every/run-spool/actions/runs/43700561623.
API usage: 8/10 calls, one watcher, discovery plus three polls separated by at least 300 seconds. Two calls were retained for potential failed-job diagnostics.
Terminal custody: PUSHED, not READY. No failing run has been observed, and no green result is claimed for this candidate. The fleet must continue exact-SHA CI observation before landing; pending CI alone is not a blocker.

## Evidence return

The complete actual non-secret report/receipt packet is selected explicitly for cloud_evidence.py and published only to refs/heads/evidence/sd-spool-release-0-7-12 in just-every/run-spool. The exact EVIDENCE ref/head is emitted in the terminal report. Evidence transport is independent of product custody and does not signal release or landing.
Final report author: Run Edit Run fleet. Finalized: 2026-11-15T09:59:58Z.
