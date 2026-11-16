# sd-spool-sdk004-1 results

Signed: Run Edit Run fleet, 2026-11-16 UTC.

Repository: just-every/run-spool
Branch: cloud/sd-spool-sdk004-1
Product head: cde6912af309f5fcf24bd8239d7e6684cb0dc6e5
CI: Verify 43892572351 on cde6912af309f5fcf24bd8239d7e6684cb0dc6e5: completed / failure. Product custody: BLOCKED.
PR: none. The fleet owns publication scan, admission and landing; this cloud never pushes main or self-submits.

## Delivered

The feedback inbox now opens consented private review. Contact, screenshot review and replies stay outside issue feedback and agent evidence. Private contact is text, not a public link. Screenshot bytes come from the session-authorized no-store PNG route with nosniff, same-origin resource policy and sandbox CSP. The reviewer explicitly opens the screenshot and can mark the report reviewed.

Private data uses an opt-in `spool` extension to feedback intake, requiring explicit consent. Existing unmodified Sentry feedback and legacy reports retain their description-only behavior; ordinary contact/name/URL/attachment fields remain discarded. PNG intake rejects HTML, SVG, remote URLs, malformed CRCs and excessive bytes/dimensions; it strips text/EXIF and other non-rendering chunks. Visible pixels still need the reporter's review.

An assigned project member or maintainer can review and explicitly reply. The existing owner and organization-admin project authority remains supported. Read-only and unrelated members, anonymous requests and project credentials cannot read private details or send replies. Cross-origin writes are refused. Review reads and changes have value-free audit facts.

Each reply has durable queued, sent, failed or never-sent state and a bounded, scrubbed body. The existing approved mail sender validates the installation's provider and records its attempt. Sent means provider accepted, not confirmed mailbox delivery. Uncertain transport is failed/delivery-unconfirmed, with no automatic replay. A repeated request ID reads the existing ledger without another provider request. No intake or review action automatically sends email.

MAIL_PROVIDER=none disables the reply control with an explicit email-off message. An explicit API attempt records never_sent/mail_off and sends nothing. Local suppression and missing configuration also have honest never-sent reasons. Provider tests used the existing Resend network fake and an in-process response hold in front of that fake to observe queued state. No real provider was called.

Additive migration 0109 adds nullable private_data to the existing feedback row. Contact, sanitized screenshot, review and bounded reply ledger therefore share the report's existing withdrawal, occurrence cascade, retention, archive-transfer invalidation and full-project erasure custody. Withdrawal removes the whole row, refuses replay and fences older archives. Private installation archives retain the ledger without sending anything on restore. The exact prior-column shape translates to null; both a populated archive exported before this migration and the existing older archive journeys restore successfully.

## Plan and scope

PLAN.md contains the full execution plan. The work followed it: launcher and identity setup; shallow blobless clone; private custody and routes; existing-panel UI; public-door journey; compatibility and touched checks; fresh-main merge after the published save; source lock regenerated last; guarded candidate push; exact-SHA CI; separate evidence publication.

The main implementation stays in the leased feedback domain, panel/CSS, migration, test and documentation paths. The following small integration edits were necessary outside the listed lease: members/resolver.ts admits the new assigned-member review/reply actions; SettingsView.tsx exposes the existing processing-section inbox to assigned project members; portability.ts recognizes the exact additive archive column and supplies null on translation. The generated management/integration/deployment-spec.json also registers the additive migration. The existing tests/old-archive.mjs upgrade check now permits only that additive column while still requiring all inherited DDL/values and the new null consent default; no existing user-flow assertion was removed. No erasure or identities path was edited. CONTRACT.md Status, Gap and Evidence and both generated views are unchanged.

## Validation

- Integration sync/check, typecheck, production build, contract-document check, source-lock regeneration/check and diff check passed.
- The complete tests/feedback-flow.mjs public-door journey passed, preserving its existing Sentry text intake, association, pagination, origin/grant fences, withdrawal, archive and retention assertions.
- The extended journey proves consent refusals; private PNG decoding and metadata stripping; direct anonymous/ingest/agent refusals; read-only and unrelated member refusals; actual native invitations and assigned-member review; explicit email-off state; retained never-sent history on restore; screenshot/contact/reply withdrawal and retry refusal; anonymous intake reaching its public rate refusal.
- An assigned teammate sends through the existing provider fake. A held fake response exposes queued state through the private HTTP read; accepted, rejected, uncertain and missing-configuration outcomes then expose sent, failed, failed and never-sent respectively. The same request ID does not dispatch twice. Reply text is scrubbed before storage and dispatch.
- Built inbox assertions ran at 1440, including contact, decoded screenshot, disabled mail-off form, reply history, overflow and no serious/critical Axe findings. The changed screen was captured once at viewport widths 1440 and 390. Both actual images are in this packet.
- The populated prior-0109 native feedback archive restored with its description intact and private details null. The existing old-archive journey passed published-release upgrade, pre-metric archive, current round-trip, occupied-target refusal and corrupted/mismatched schema refusal.
- Retained local tests exited zero. The feedback run emitted a workerd Broken pipe diagnostic during fixture teardown; the journey and cleanup completed successfully. No product assertion was weakened or removed to accommodate it.
- Local tools used the supplied shim's Node 24.19.0 and pnpm 10.12.4; its engine warning notes the repository's Node 22.20.0 pin. CI supplies the pinned Node version. Chromium used /usr/bin/chromium with --no-sandbox. Local-only fixtures required inherited HTTP proxies unset and file-based Node entrypoints; early diagnostic attempts with --input-type=module hung Miniflare and were stopped by their own recorded PIDs. Final retained checks use the file-based commands.

RECEIPT.json binds the actual checks, product head, base, lock hash and screenshots. Complete relevant command logs are selected explicitly in this packet; credentials, environment dumps, private gate material, fixture archives and symlinks are excluded.

Before/after contract target counts: DONE 13 → 13, PARTIAL 47 → 47, MISSING 26 → 26 (86 clauses). SDK-004 stays PARTIAL. Existing SDK HTTP journey registration count is unchanged; feedbackFlow was extended without adding a CI registration.

## Defaults and gaps

DEFAULT SDK-004: explicit consent, deny by default, owner and assigned project team review, no automatic outbound action, audited review/replies. Organization administrators retain their existing project authority and private archive authority. Screenshot support is bounded raster PNG through the opt-in consent extension; unconsented ordinary SDK metadata stays discarded.

GAP SDK-004: acceptance 1 is not fully qualified through an end-user browser/mobile widget; ordinary unmodified Sentry attachment intake remains absent. The independent Spanish widget (acceptance 6) is absent. Selective identity erasure must match feedback.private_data contact and reply text and remove the entire feedback row with the existing transfer invalidation and portability tombstone fence. This is a hook for sd-spool-sdk027-1, whose src/domain/erasure and src/domain/identities lease was preserved. No claim of complete identity erasure, live-provider mailbox delivery, native-device qualification or full clause completion follows.

The two platform playbook content API paths returned HTTP 404. The shipped inline RULES and its polish essentials were followed; no unavailable policy ruling was invented. The required UI skill was read and its CLI installed; this round extended the existing Spool panel and retained its fonts and controls. No hosted design generation or new visual direction was needed. The cloud cannot run the fleet's final publication scan; the existing Mac gate retains that responsibility.

CLAIM SDK-004 PARTIAL points=2,3,4 tests=tests/feedback-flow.mjs#feedbackFlow; tests/feedback-flow.mjs#privateFeedbackFlow; tests/feedback-flow.mjs#feedbackMailFlow

Initial Verify 43890291747 failed before test shards because the generated managed deployment spec did not yet include migration 0109. Regenerating that spec with pnpm integration:sync fixed the local integration check; The subsequent old-archive check needed to recognize the newly registered additive column. That check now preserves every inherited field, constraint and value and asserts that historical feedback gains no private consent. Its complete final run passes. The failed build log is included, with the workflow environment listing excluded. Downstream shard/aggregate jobs failed because build failed; no product test assertion ran in that run.

Product save: 2518c0c (skip CI); first candidate: 717793521d928a9f7279b40c1ca3cbe0b5b69a43; integration candidate: f18a605cbed5cf19e68929ec41cd488d2db1e0df; final candidate: cde6912af309f5fcf24bd8239d7e6684cb0dc6e5 (no skip marker). All four commits have fleet author and committer, no trailers. All product pushes succeeded through cloud-push.py. No force push, default-branch push, tag, release or PR was made.

The superseded integration candidate had Verify 43891585587 in progress when replaced; its final CI conclusion was not queried. No green claim is made for either superseded head.

The ten-call GitHub budget has eight calls used before the terminal watcher: two unavailable platform document reads; four initial candidate CI discovery/status/jobs/failure-log reads; one superseded candidate discovery; one terminal candidate discovery. The sole terminal watcher makes at most two remaining REST status reads, ten minutes apart.

Terminal candidate observation 1: Verify 43892572351 was still in_progress on the exact terminal SHA; nine of ten GitHub calls used. One later status read remains. No READY claim has been made.

## Terminal observation

At 2026-11-16T15:28:18.085610+00:00, Verify 43892572351 was completed / failure on the exact terminal product SHA. GitHub calls used: 10 of 10. Product custody: BLOCKED.
Verify completed unsuccessfully. The remaining API budget is exhausted, so no unsupported cause or green claim is made for this terminal run. Successful exact-SHA Verify remains the blocking prerequisite.
Evidence publication is separate from product custody and never waives an independent gate.

After the terminal red Verify observation, the complete existing SDK HTTP registration was run locally on committed head cde6912af309f5fcf24bd8239d7e6684cb0dc6e5 with a 600-second timeout. It exited zero, including the changed feedback journey, native member/mail fake assertions, both feedback screen captures, all preceding SDK HTTP integration flows and final key-rate-limit checks. sdk-http-test.log is the complete actual receipt. The final feedback images and hashes now come from that committed-head run. No additional product change was made, and no cause is inferred for the uninspected CI failure.

BLOCKER: successful exact-SHA Verify is missing. Verify 43892572351 completed failure on the terminal SHA; the ten-call API budget prevents retrieving its failed job/log in this task. The next authorized step is to inspect that run once with a fresh budget, identify the failed job and repair any in-scope failure before landing. No READY or acceptance promotion is claimed.
