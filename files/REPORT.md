# sd-spool-sdk027-3 builder report

Run Edit Run fleet (sd), 2026-11-16 UTC.

Repository: just-every/run-spool. Branch: cloud/sd-spool-sdk027-3.
Fresh main: a037966cccf2f232e8c098d62607ba36cca7f777.
Product candidate: e29a9f44ad44315d65b4e12d7f2e69b739f67233.
Terminal CI observations are bound by provenance.json and ci.json.
No PR is required by this seed's fleet branch landing contract; none was opened.

## Plan and implementation

The full working plan is PLAN.md. This round read the pinned previous report
first and continued from its landed main, rather than reimplementing identity
confirmation, journal or restore fencing. It left feedback code and UI alone.

1. Profile the public 10,000-event erasure before batching changes. A temporary
   diagnostic captured D1 metadata from the real owner confirmation batch; it
   was removed from source before product commits. A disposable D1 diagnostic
   also recorded SQLite query plans without accessing credentials or product
   internals as acceptance proof.
2. Fix the measured bottleneck: each JSON chunk guard previously chose the
   entire project's events as its outer loop, reparsing JSON for every event.
   Force JSON rows first with CROSS JOIN, then use the exact indexed project,
   event and occurrence lookup. Payload updates were already set-based and
   indexed. Keep bounded 256 KiB JSON chunks, one atomic owner transaction,
   previous occurrence/digest guards, current owner/policy/epoch/custody fences,
   transfer invalidation, one existing journal checkpoint, safe audit and receipt.
   There is no per-event database transport or journal entry. No trigger,
   capacity limit or archive validator was disabled, and no new store/migration
   was needed. Read event payloads in pages of 500 and retain only actual changes.
3. Add an owner-only identity query/facet API inside the leased identity domain:
   GET /api/projects/<project>/identity-search. It reads event_identities itself,
   accepts raw input against kept or hashed fields and stored hashes directly,
   and supports user.id, user.email, user.username and user.ip/ip_address.
   Responses bound occurrence references to 25 and facet values to 1,000, naming
   truncation. Facets obey keep/hash/drop and never return private keep-field
   match hashes or the project key. There is no duplicated persistent index.
   Agents, members, administrators and requests carrying grants are refused.
4. Remove attributable whole-token copies from messages, tags and breadcrumbs,
   including occurrences without a retained identity in the selected project.
   Retained identity HMACs also recognize raw copied aliases after keep-to-hash
   conversion. Candidate token hashes are cached privately per plan; unknown
   aliases are never reconstructed or persisted. Preserve neighboring text and
   other users/projects. Recompute changed payload digests. Remove captured issue
   title and attention-alert title copies that otherwise appear in exports.
   Guard their previous title/revision or payload inside the same transaction.
5. Keep partial-token and immutable-grouping-sensitive copies rather than
   breaking grouping provenance or making the next archive unrestorable. Preview
   and receipt explicitly name these retained records and the unsupported stores.
   The existing Settings flow shows text/title counts and these retained-copy
   counts. No grouping IDs or event membership are silently rewritten.
6. Extend the existing public browser journey and outside-Verify scale journey.
   Preserve all unsafe-path and no-mutation checks. Use synthetic Sentry intake,
   ordinary policy/erasure/query/export/archive/restore doors, and the built UI.
   Assert UI behavior at 1440 and capture the changed screens at 1440 and 390.
   The scale script checks its actual checked-out candidate and records a run ID,
   exact requested admission result, admitted volume and measured confirmation.
7. Run touched checks and typecheck; check contract docs without editing source
   judgments; regenerate sources.lock.json last and check it. Push first and
   substantial saves with skip markers, then a real non-skipped final candidate.
   Merge fresh main after saves and never rewrite published history. Inspect all
   candidate identities/trailers before every guarded push. Observe only the
   exact candidate's Verify using bounded REST calls.
8. Publish this complete nonsecret report/receipt packet separately to the
   evidence ref. Product commits contain only requested product code, docs,
   existing journeys and the regenerated source lock. No fleet reports,
   credentials, setup outputs, private gates or environment dumps are included.

## Measured performance

The actual baseline on the landed main completed a 10,000-event public erasure
in 151.942099 seconds client wall time; the receipt measured 151.240 seconds.
The atomic batch took 151.226 seconds across 83 D1 statements and read
100,532,935 rows. The sum of statement SQL durations was 150.781 seconds.
The slowest chunk guards individually read 3,210,000 rows and took about six
seconds. Journal, transfer invalidation, authority/custody checks and ordinary
indexed writes were not the dominant cost. See baseline-scale.json,
baseline-profile.json, baseline-scale.log and sql-plans.json.

A committed intermediate optimized run on
5b920aa75b1dae7884cabbde8afaefb69aacffb6 completed the admitted 10,000-event
journey in 2.002418 seconds (receipt 0.678 seconds), around 76 times faster
than that baseline. It also exercised captured messages/breadcrumbs and tags.
This is an intermediate diagnostic, not the final candidate's scale receipt.
The final exact-candidate run sd-spool-sdk027-3-20261116T184055Z on e29a9f44ad44315d65b4e12d7f2e69b739f67233
completed the admitted 10,000-event erasure in 2.390173 client
seconds (receipt 0.546 seconds), about 63.6 times faster than
the baseline despite also handling captured message/breadcrumb copies. The
receipt removed 10,000 event identities, 10,000 tag entries, captured text from
10,000 events and one issue/alert title each. It preserved all 10,000 events;
the next preview and identity query had zero matches. See scale-receipt.json
and scale-journey.log for the actual exact-SHA receipt.

The same committed run submitted the actual requested 150,000-event corpus
through public restore. After 297.827372 seconds it returned HTTP
400, Archive event budget, and left the destination empty. This is an admission
refusal, not erasure_epoch and not point 5. It then admitted the separate
10,000-event archive and performed the timed erasure. No admission guard was
relaxed, no direct database planting was used, and the 300-second bar was not
lowered. The whole journey ran under the documented 2400-second hard alarm.

The first full-volume restore attempt was stopped while staging so the required
10,000-event profiling could run first; it is preserved as
initial-restore-attempt.log and is not represented as a completed refusal.
The final committed scale journey separately attempted the actual 150,000-event
public restore under a 2400-second alarm, and fell back after the recorded
refusal with an unchanged empty destination. A 10,000-event timing never proves
SDK-027 acceptance point 5, and no linear extrapolation is offered as proof.

## Public-door results and scope

The passing expanded journey on the latest saved implementation shows:

- Six retained project events include four matching identities. Four raw-ID tag
  matches and two copied private-hash tag matches become zero ordinary search
  matches and header-only filtered CSV exports. Unfiltered JSON export remains
  populated with six occurrences and omits the erased ID and hash.
- Owner-only identity queries are populated before erasure under both keep and
  hash policies. Raw id/email/username/IP inputs and a stored email hash return
  four matching occurrences before and zero afterwards. Erased facets disappear;
  another user's facets and the other project's complete identity response stay.
- Five event records have attributable captured message/tag/breadcrumb text
  removed, including a record with no retained identity. One issue title and
  its one captured attention-alert title are redacted. Ordinary text search
  loses the erased identifier while the other user's text remains. The next
  archive's selected project payloads omit these tokens and restore successfully.
- One grouping-sensitive event and one partial-token event remain unchanged in
  a separate populated fixture. Preview and receipt explicitly name their
  retained-copy counts. Their post-erasure archive also restores successfully.
- Owner confirmation completes through the actual Settings screen. Anonymous,
  member, read-only, foreign/removed/admin/maintainer destructive attempts,
  valid/revoked grants, wrong confirmation, stale preview and foreign origin
  refuse without product mutation. Repeated previews remain read-only.
- Event deletion removes one exact event, its attached feedback and one matching
  session DID identity; five events remain in the original project. Exact id,
  username and IP confirmations exercise the same existing owner door.
- Receipt reads and safe/native audits contain no supplied identity values,
  selected private match hashes or project keys. Older archives are refused
  with erasure_epoch by the same installation and by a fresh destination that
  first accepts the later archive. The later archive remains restorable.

The exact final candidate's rerun passed and its browser receipt supersedes
saved-head results above. Artifact identities are recorded in browser-receipt.json.
Axe serious/critical checks, 13px text, keyboard controls and no horizontal
overflow are asserted at 1440. Matching, unavailable, complete and erased-search
screens are captured once at 1440 and 390. Chromium uses /usr/bin/chromium,
--no-sandbox and the real HOME; contexts and runtimes close normally.

## Contract reading, defaults and remaining gaps

GOV-003 explicitly requires a project holding at least 150,000 retained events
to archive, export and restore whole by streaming. SDK-027 point 4 separately
requires refusal of an older archive that still contains erased values. An
Archive event budget refusal does not satisfy that point and does not excuse
GOV-003. Existing admission/retention/archive capacity code is outside this
round's lease and is not relaxed or bypassed. The committed scale journey
records the actual large-corpus result separately from erasure_epoch.

Point 1 remains proven for a count-only email preview, point 3 for safe receipts
and audit, and point 4 for the known older archive refusal. Point 2 is improved
but not complete: the new identity API is owner-only; ordinary issue-search UI
syntax still has no user.* integration. Independent feedback awaits its own
round. Attachments/replays have no matching store, session aliases and anonymous
aggregates cannot be inferred, and dropped aliases cannot be recovered.
Partial-token copies, immutable-grouping-sensitive text, exception/stack/context
copies, encoded text and independent derived snapshots are not fully erased by
this focused matcher. Downloaded/provider copies and future captures remain
outside this installation. Point 5 needs an actually admitted 150,000-event
project and a measured sub-300-second erasure; an admitted 10,000-event result
leaves it unproven.

DEFAULT SDK-027: Preserve installation-owner-only destructive confirmation and
adopt owner-only access for the focused identity search/facet API; require typed
ERASE USER DATA, no outbound action and value-free safe audit.
GAP SDK-027: Ordinary user.* search UI integration, independently matching
feedback, absent/uncorrelatable stores and unsupported/partial/grouping-sensitive
captured copies remain; admitted 150,000-event timing is unproven.

SDK-027 source Status/Gap/Evidence stays missing and unchanged. The builder
claim is PARTIAL points 1,3,4, not a promotion to DONE. No independent DONE gate
is requested. Contract and generated view files are untouched. Contract counts
before = after: published 9 done / 3 partial / 0 missing (12); target and
push-further 14 done / 51 partial / 28 missing (93); all 23 done / 54 partial /
28 missing (105). Root test scripts remain 131; no registration is added. The
two existing journeys were extended and no existing flow assertion weakened.

## Checks and custody

Typecheck, build, touched public journey, contract-docs check and source-lock
check results are retained as actual files. The scale journey runs outside push
Verify. The browser journey remains invoked by tests/owner-claim.mjs inside the
existing test:admission Verify coverage. The final candidate has no skip marker.
CI IDs and exact head/status observations are in ci.json; no success is inferred
from another SHA. Ten total GitHub calls are the budget, with at least 300
seconds between observations for each run. The pinned prior report used one.

All candidate author and committer identities are the fleet identity, with no
OpenAI/Codex co-author trailers. The product diff and selected packet are checked
against injected secret values without printing them. No default branch, tag,
release or PR is pushed; no self-submission or deployment is attempted. The
Mac-only full-history publication scan and guarded landing are fleet gates and
are not represented as having run here. READY, if achieved, is custody of a
pushed exact-SHA green candidate with a PARTIAL clause claim, not acceptance or
landing. Separate evidence publication is report transport only.

CLAIM SDK-027 PARTIAL points=1,3,4 tests=tests/end-user-erasure-preview.mjs#endUserErasurePreviewFlow
DEFAULT SDK-027: Owner-only destructive confirmation and focused identity reads; typed ERASE USER DATA, no outbound action and value-free audit.
GAP SDK-027: Ordinary user.* search UI, independent feedback, absent/uncorrelatable stores, unsupported/partial/grouping-sensitive captured copies and admitted 150,000-event timing remain unproven.

## Terminal CI and product custody

Run Edit Run fleet (sd), 2026-11-16T18:53:37.324495+00:00: exact-candidate push Verify
43931474874 is in progress on e29a9f44ad44315d65b4e12d7f2e69b739f67233.
The branch is verified pushed; READY is not yet claimed. CI observations and
terminal-custody.json will be updated after the required bounded observation.
