# sd-spool-design-keys-3

Repository: just-every/run-spool. Branch: cloud/sd-spool-design-keys-3.
Final head: ba97984c5372e00bd6c28bb05eb37fb8c7f89928.
Exact-SHA Verify: [44182275861](https://github.com/just-every/run-spool/actions/runs/44182275861), completed/success on ba97984c5372e00bd6c28bb05eb37fb8c7f89928, observed 2026-11-17T22:01:42Z.

## Result

Replayed the complete keys-2 product delta onto fresh main, then repaired the runtime prerequisite journey in `tests/setup-prerequisites.mjs::settingsPrerequisiteGuides`, imported by `tests/runtime.mjs`. The journey now clicks Settings / Alerts & integrations / Details before following the Slack guide. That guide is deliberately inside the new collapsed disclosure; the unchanged journey had waited 30 seconds for a hidden region. The local reproduction matched the old runtime job's non-assertion error and absence of D1/SQLite/network errors.

The repair preserves all existing visible-link, same-origin, anonymous-document, source-pin, receipt-recipe and recipe-output assertions. It additionally checks the intended collapsed initial state. Temporary private diagnostic instrumentation was removed before candidate verification. No timeout increase, request retry, assertion removal or authorization relaxation was used. DIAGNOSIS.md records the original completed failed run, 44156366231, runtime job 134299004802, read once with the required log-archive command. No old-run rerun was spent.

The product replay retains key names and last-use metadata, explicit revoke confirmation, the one-time new-key dialog, invitation context and local links, email-alert test/review/Turn on, advanced controls behind Details, dated backup download and the project-erasure preview. It retains keys-2's populated-upgrade and agent-selector repairs. The only new journey repair in this round is the Slack prerequisite interaction, plus its owner-journey documentation.

## Plan and completed local validation

PLAN.md contains the full plan. Execution followed fleet setup and scope inspection; old failure log and local reproduction; linear replay and narrow journey repair; generators and the documented build prefix in order; affected owner-flow suites and browser proof; source-lock and publication hygiene checks; guarded branch preservation and exact-SHA Verify; separate evidence transport.

The ordered build prefix passed: native-export candidate-path checks; first-party `rer check`; `pnpm source:check`; offline `verify-base`; `pnpm build:app`; `pnpm integration:check`; agent-surface check; and `pnpm typecheck`. This seed has no `validate:release` or `verify:release` package script. Its documented prefix is retained, and no clause meaning or RELEASE.json entry changed.

Affected suites passed: runtime, product, origins runtime, accessibility/triage, alerts, alerts UI, admission, dev credentials, agent handoff, privacy, project erasure, project-erasure capacity and owner erasure. Additional checks passed: old-archive populated upgrade, real Sentry SDK/loader qualification and the repository-required agent-door suite. The incoming main change was only the egress TLS dependency/provenance update; the full ordered prefix, runtime journey and egress test were repeated successfully after replay onto it.

Selected measured results:

- Historical upgrade: 176 historical tables, 120 rows before and 120 after, preserved with explicit additive metadata defaults and inherited schema constraints.
- Owner UI: 22 groups, 104 captures at 1440 and 390. New behavioural assertions run at 1440; changed states also have phone captures.
- Agent handoff: 9 groups, 10 masked captures; whole packet 231653/262144 UTF-8 bytes; all three malicious selector classes refused by HTTP, CLI and MCP without changed product rows or credential authority.
- Privacy: 14 actual result rows report zero tested secrets and no lost ordinary data.
- Project erasure: 7 groups, 8 captures, cascade/audit/receipt and HTTP/CLI restore fences passed.
- Capacity erasure: 10000 events; acceptance 1507 ms; completion 40005 ms; receipt 38.428 seconds.
- Committed-source owner erasure: 3 groups; explicit-journal CLI refusals return erasure_epoch; independent sessions and unrelated data survive; bounded resumption and late-credential rejection pass.

The packet contains actual result JSON/text and 20 selected, masked synthetic browser captures covering keys, invitations, email alerts, backup, erasure and the repaired Slack guide at 1440 and 390. `triage-results.json` is preserved unchanged: the local UI run preceded the first product commit, so its recorded HEAD is the initial main, 3b7a3ebe545f3bd9c6a979ca04d5687c6a375b09. The verification receipt identifies the tested source tree; remote Verify is the exact-final-SHA gate. Raw private diagnostics, keys, sessions, archives, environment dumps and held-out material are excluded.

## Provenance and recovery

Keys-2 was confirmed at 5379ddf99bbf5c930790b3fae60b47d8af84474e. Main advanced during local verification to f44efc8c76f8f11753b89465cc3fcb7b64760570, the egress TLS rustls 0.23.46 update. Its changed product paths did not overlap the 46 replay paths; sources.lock.json was regenerated separately. A recoverable source patch was verified before replay (SHA-256 088d32d51fd7b8102d09ec053f847df85e56356b12095e6b6b676db4c25f8b3f). Main's TLS artifacts, source provenance, contract and generated views were preserved whole. Migration 0110 remained free.

The VM restarted during the first handoff capacity setup. Completed results and product files survived. Two immediate setup attempts were refused because the interrupted test server still reserved port 15543. After normal stop failed to clear it, only that verified test-owned server was terminated and its abandoned synthetic checkout removed. The complete handoff rerun passed. No guard was bypassed.

The initial owner-erasure CLI archive assertion compared a new staged-schema archive with a CLI checkout cloned from old committed HEAD. It returned legacy_schema_object_inventory before reaching the expected erasure fence. No assertion was changed. Under the mandatory first-real-commit preservation rule, content save 606b86f4448570834917908289e37de38fd8fa24 was pushed with [skip ci]; the unchanged owner-erasure suite then passed against committed source. Final Verify trigger ba97984c5372e00bd6c28bb05eb37fb8c7f89928 has exactly the same source tree as that tested save. This accounts for two guarded product pushes; each succeeded on its first attempt.

Both candidate commits have Run Edit Run fleet as author and committer, fleet@runeditrun.com for both addresses, and no trailers. All messages and side parents were checked before each push. There are no merge commits in origin/main..HEAD. Commit hooks remained active. The final product diff has 47 files, 434 insertions and 168 deletions; no fleet reports, screenshots, generated contract views or credential material are in the product commits.

## Scope and counts

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).

Before and after: Core 23 done / 45 partial / 19 missing = 87; Agent surface 0 done / 9 partial / 9 missing = 18; Full target 23 done / 54 partial / 28 missing = 105. Clause status changes: none. CONTRACT.md, ACCEPTANCE.md, docs/CLAIMS.md and RELEASE.json are unchanged. The contract generator writes zero changed documents; check reports zero errors and warnings. The source lock was regenerated last and its check passes. Core migrations increase from 103 to 104 with 0110_key_names_and_use.sql.

No PR, tag, release, deployment, Base refresh, default-branch write or landing was performed. Evidence publication is separate from product readiness. Local and synthetic provider-edge results qualify only their tested boundaries. The fleet's independent publication scan and landing remain on its own machine. Actual product, check and CI provenance is in the accompanying receipts; GitHub call accounting is in github-budget.json.

## Terminal custody

Product READY: cloud/sd-spool-design-keys-3 at ba97984c5372e00bd6c28bb05eb37fb8c7f89928. Exact-SHA Verify completed successfully; no workflow rerun was used. Six of the ten permitted GitHub calls were used, including the two original-run diagnostic calls. No blocker remains. The complete packet is republished separately to evidence/sd-spool-design-keys-3; its exact terminal ref/head is returned in the final message. Publication does not land the product or claim a contract clause.
