# Spool plain release and delivery labels

Repository: just-every/run-spool
Branch: cloud/main-spool-plain-delivery-labels-1-r1
Product head: 32e75542b7d75b44cb55508056a7bd63a655c824
Base: 26d13d4f574298851f25778818c1af0b9b2a2386
Product push: successful, first attempt through cloud-push.py. No PR required by repository instructions; none created.

The three reported newcomer findings reproduce through the emitted application's public HTTP and browser doors. BEFORE.json records an unmodified Node SDK capture without release/dist and an automatic release: the release filter offered ` (1)`, observed first-seen release was blank, release history printed `[sentry:no-dist]`, the local delivery row rendered `suppressed locally0`, and both digest and resumption records said accepted. AFTER.json records the same flow with meaningful labels, no marker, no stray zero, and suppressed local mail history.

Changes
- Shared display-only release/build labels render No release and No build supplied for missing identities. Applied to the release filter, issue list/events, Recent occurrence, observed deployment text, release facts/history, deployment history and source-map build displays. Stored values, capture grouping, release identity, APIs and registration behavior are unchanged.
- Delivery's numeric Slack flag is explicitly boolean before React conditional rendering, removing the unlabelled 0. The existing saved mail_development result code supplies the delivery and digest/resumption status. Digest/resumption rows say suppressed locally and No email sent. Actual mail/provider behavior remains unchanged.
- Extended the two existing public journeys with missing-release filtering, unmodified Node capture, no-dist release/deployment rendering, clean delivery row text and truthful local digest/resumption outcomes. Existing acceptance assertions remain. New assertions run at 1440; both widths retain screen proof.

Validation
- Candidate application build, the complete releaseIdentityFlow (including archive restore, release recurrence, resolution and existing browser paths), the full alerts-ui script, typecheck, source-lock check and contract-document check passed.
- The final deployment fixture refers to the SDK's real absent-dist identity and is read back through Deployment history at 1440 and 390.
- The alerts script also completed its existing baseline and Slack journeys. Its retained log includes two workerd Broken pipe teardown diagnostics; the process exit was 0 and the final journey success message is present.
- Local toolchain followed the supplied shim: Node 24.19.0 (the script preserves a newer runtime), pnpm 10.12.4, headless /usr/bin/chromium with --no-sandbox. CI uses the repository's own pin.
- Test registrations added: 0; removed: 0. Existing journeys extended: 2 before / 2 after. Reported user-visible findings: 3 before / 0 after. No cap raise or test-budget change.
- CONTRACT.md, ACCEPTANCE.md, docs/CLAIMS.md and clause Status/Gap/Evidence are unchanged. SDK-009 remains partial; ALERT-003 remains partial. No DONE claim.
- The source lock was regenerated last after staging the new helper and passed its check. Main was fetched and the unpushed candidate rebased before commit; main had no newer commit at that point. No published history was rewritten.
- Product tree is clean. Only the named product branch was pushed. No screenshots, proof or fleet reports were committed to it.

CLAIM SDK-009 PARTIAL points=3 tests=tests/release-identity-flow.mjs#releaseIdentityFlow
CLAIM ALERT-003 PARTIAL points=none tests=tests/alerts-ui.mjs#destination tests, delivery states, timezone digests and snoozing

SDK-009 point 3 is supported by the release-less public journey. ALERT-003's assertions improve the local display portions of points 1, 4 and 5; no full acceptance point or provider-send qualification is claimed for that clause. No actual digest/resumption provider send, whole-clause acceptance, live-account qualification or landing is claimed. Existing broader clause gaps remain in CONTRACT.md.

Defaults: the shipped polish essentials govern this label correction; no unprovided ruling was needed. No layout or icon controls were added. The readable-ids round's resumption identifier text was left intact.

CI: Verify 43180512757, https://github.com/just-every/run-spool/actions/runs/43180512757, exact head 32e75542b7d75b44cb55508056a7bd63a655c824. Completed successfully on the exact product SHA. CI-FINAL.json and RECEIPT.json record terminal custody: READY.

Publication scan: delegated to the fleet Mac per cloud instructions; not run or claimed here. Scoped diff credential-pattern check and every candidate author/committer/trailer check passed. No blockers discovered locally.

RELEASE-HARNESS.mjs and PROOF-HARNESS.mjs retain the actual runners (run from .artifacts/ in a prepared checkout; their imports resolve to that checkout). PLAN.md contains the complete execution plan. Actual checks and browser proof are selected explicitly in the evidence packet. Evidence publication is separate from product readiness and landing.

Evidence transfer: the initial report-only ref was fetched independently; its manifest, complete regular-file tree, hashes and exact product provenance verified successfully (EVIDENCE-TRANSFER-CHECK.json). The final publication adds this terminal CI receipt without changing product history.
