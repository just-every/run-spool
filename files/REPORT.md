# Spool silent saves: main-spool-silent-saves-1

Repository: just-every/run-spool
Product branch: cloud/main-spool-silent-saves-1
Product head: 65a8288d14a12711fc777f9c07646fedb12c6bf0
Base main: 5886617d17da50761fb442f66b03ce623d5e9559
Pull request: none; no repository instruction requires a PR for this lane.

## Delivered behavior

Assignment validation retains the exact original privacy predicate: the revision must be an integer, and a non-null label must be a nonempty string no longer than 80 characters with scrub(label) === label. No scrubber code changed. The public PATCH assignment route now distinguishes invalid label shape from scrubbed private data. It returns HTTP 400 with a plain explanation that email addresses and other private data are not stored as operator labels and asks for a plain name. The issue form displays that response beside the input, associates it through aria-describedby/aria-invalid, and retains the draft. It confirms a successful save or clear beside the field. A plain name such as Priya Nair persists and returns after reload.

Rules retain the required preview gate from ALERT-001. A single readiness message attached to the save button identifies the first missing form value, destination configuration, reviewed test, or preview. A valid draft with a reviewed passing test now explicitly says “Preview rule to review its matches before enabling.” After a successful preview Create rule enables and saves the rule. The test-review instruction no longer persists as a second form callout once review is complete. Disabled drafts remain saveable without a preview, as before.

The rule form aligns fields to the top of their grid row. In the actual 1440px proof the space between the Create rule heading and Rule name field fell from 175.40625px to 20px. At 390px it remained 20px. No alert channels, membership semantics or delivery authority changed.

## Plan and execution

The complete plan is PLAN.md. Completed: fleet identity/launcher/helper/hook setup; shallow filtered clone of the one declared repository; repository instructions and contract review; reproduction through actual emitted-application routes and browser controls at 1440/390; focused implementation; extension of existing tests; touched browser journeys/typecheck/build/source checks; source lock regeneration; incorporation check against current main; identity/trailer inspection; guarded named-branch push on its first attempt; exact-head browser proof. Exact-SHA CI status and final evidence custody are recorded separately in the CI receipt and final report appendix below.

The main fetch and env-scoped rebase immediately before the first product push reported the branch current. No history was rewritten after publication. The product commit has no skip marker and no co-author trailer. The product tree contains only four source files, two extended test files and sources.lock.json. Test-generated retained screenshots were restored; proof and fleet reports are kept solely in this packet/evidence ref. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are unchanged.

## Reproduction and proof

before-browser-receipt.json records the original public route responses and desktop/mobile measurements. The rejected example address returned the generic “scrubbed operator label” error and neither rejection nor success had local form feedback. A reviewed destination with a valid rule draft left Create rule disabled without naming preview.

after-browser-receipt.json records the focused proof on full product SHA 65a8288d14a12711fc777f9c07646fedb12c6bf0. At both 1440 and 390, it asserts the refused route response is shown, the typed address remains, a plain name returns HTTP 200 with in-place confirmation and survives reload, the single readiness line names preview, and a passing preview enables Create rule and persists the rule. Relevant before/after PNGs and browser-proof.mjs are included. These use synthetic local data and development-suppressed mail, not a live-provider receipt. One proof preparation attempt checked a generic reviewed label before the newly added destination's refresh completed; the harness was corrected to wait for that destination's own reviewed result before assertions. The completed exact-head proof passed. A native workerd cleanup emitted a broken-pipe diagnostic after disposal; the proof exited zero and all owned browser/runtime processes ended.

## Tests and counts

- pnpm typecheck: exit 0.
- cloud_run npx -y @runeditrun/rer build: exit 0.
- node tests/alerts-ui.mjs through cloud_run with /usr/bin/chromium: exit 0. Existing journey extended at 1440 to assert a passing but unreviewed test cannot enable a rule; after review, the one save description names the missing Preview rule action; fields start alongside the event checklist. Existing create/edit/reload, refusal, disabled draft, delivery, digest, baseline and Slack checks remain.
- node tests/triage-journey.mjs through cloud_run with /usr/bin/chromium: exit 0; 21 check groups and 92 captures at 1440/390. tests/operator-ui.mjs#operatorUi extends the existing assignment flow with a real route rejection, unchanged stored assignments, retained text, displayed route reason, valid-save confirmation and reload persistence. New behavioral assertions are restricted to 1440; existing mobile smoke coverage remains.
- node scripts/edition-authoring/cli.mjs lock, then pnpm source:check: exit 0. Six source hashes changed, exactly the touched source/test files.
- node src/base/contract-docs.mjs check: exit 0, 0 errors and 0 warnings; generated documents current.
- git diff --check and added-line credential-shape inspection: pass.

Two test files were extended; no registration or executable test entrypoint was added, deleted, skipped or weakened. Registration delta is 0. The inherited 200-test cap is unchanged; no test-budget increase was requested. Existing clause table counts before and after are identical: 23 done, 53 partial, 29 missing (105 clauses). No clause Status, Gap or Evidence changed. The two reported silent-save journeys now have actionable feedback; zero of those two remain silent in the focused proof.

Local Node is 24.19.0 and pnpm 10.12.4, following the supplied toolchain script. CI uses the repository-pinned Node 22.20.0. local-checks-receipt.json and the actual touched-check logs record the local results. Full local Verify was not run, per the brief.

## Claims, defaults and remaining boundaries

CLAIM UX-001 PARTIAL points=none tests=tests/operator-ui.mjs#operatorUi
CLAIM ALERT-001 PARTIAL points=none tests=tests/alerts-ui.mjs#ALERT-003 destination tests, delivery states, timezone digests and snoozing
CLAIM ALERT-003 PARTIAL points=2 tests=tests/alerts-ui.mjs#ALERT-003 destination tests, delivery states, timezone digests and snoozing
DEFAULT ALERT-001: Preserve mandatory preview; explicitly name it as the missing step after passing-test review.
DEFAULT UX-001: Assignment remains a privacy-scrubbed operator label; it grants no access or notification.
GAP UX-001: This focused assignment/alert-feedback round does not qualify the full target team workflow, native devices, human screen-reader operation or VPAT.
GAP ALERT-003: Local suppressed-mail and network-edge fixture proof does not qualify missing live-provider outcomes or new channels.
GAP TEAM-002: Real member/team assignment and ownership routing are unchanged and not claimed.

Full fleet publication scanning cannot run in this cloud task and remains on the fleet machine under the explicit cloud adaptation. The local added-line inspection passed; evidence transfer does not waive any independent publication, contract or landing gate. No provider deployment, main update or landing was attempted.

## CI and custody appendix

Product push: first attempt succeeded for cloud/main-spool-silent-saves-1 at 65a8288d14a12711fc777f9c07646fedb12c6bf0. Exact-head Verify run 42983001168 was observed in_progress at 2026-11-11T08:00:10Z: https://github.com/just-every/run-spool/actions/runs/42983001168 . One watcher has made two REST calls; the next run poll will be no earlier than 08:05:10Z. Final CI disposition will be appended after completion. This packet publication is report-only custody, not acceptance or landing authority.

Initial report-only evidence publication succeeded: refs/heads/evidence/main-spool-silent-saves-1 at f7f4cd7a9d587925d2c32d7d9f5af26646ac8d65. All 31 returned manifest entries matched the selected local files by byte count and SHA-256. The product checkout/head/index remained unchanged. A final evidence publication will include the completed CI receipt.

### Final CI disposition

Verify run 42983001168 completed successfully on exact product head 65a8288d14a12711fc777f9c07646fedb12c6bf0, confirmed through REST at 2026-11-11T08:15:12Z. The single watcher made five calls, each run observation at least 300 seconds apart after discovery. No failed-job log reads, workflow reruns or dispatches were needed. Exact-SHA Verify is green; no contract-generator exception is being used.

The requested fixes, touched checks, exact-head desktop/mobile browser proof and named-branch publication are complete. There are no product blockers. Full fleet publication scanning and landing remain with the fleet machine; this run made no main/default-branch push or deployment and no DONE claim. The final report-only evidence publication includes all 32 explicitly selected packet files. After that publication is confirmed, the successfully pushed product clone is deleted; the packet and publication receipts remain outside it.
