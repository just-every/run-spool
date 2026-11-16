# sd-spool-sdk027-2 builder report

Run Edit Run fleet (sd), 2026-11-16 UTC.

Repository: just-every/run-spool
Branch: cloud/sd-spool-sdk027-2
Candidate: a037966cccf2f232e8c098d62607ba36cca7f777
Fresh main / merge base: 2011d4884e82800cccefbf4d0a7cdfa91384e47b
PR: none. The seed uses fleet cloud-branch landing.
Product commits: bce4ad6631654076e37892961f408edadc77b36a,
1b3f0b18f97947b8b36f28cff0898e4f6668d71e (published saves), and
25d5794843d0cc57feb0665ef8db2d0e9c2b2591 (superseded candidate), and
a037966cccf2f232e8c098d62607ba36cca7f777 (final non-skipped candidate).

## Plan and implementation

1. Read sd-spool-sdk027-1's complete report from its pinned evidence commit,
   launcher/seed AGENTS, shipped RULES and riders, contract and current code.
   Fresh main is the landed previous candidate. Preserve its owner-only typed
   confirmation, safe receipt/audit and restore-fence behavior.
2. Trace existing public search, facet, export, issue and archive doors.
   Identity-specific user.* queries are still explicitly unsupported.
   Ordinary FIND-001 tag search and facets read event payloads directly;
   raw IDs and hashes copied into those tags survived the previous erasure.
3. Add an erasure search plan in src/domain/identities/erasure-search.ts.
   On exact matching event occurrences, remove tag entries whose keys or
   values equal retained identity fields or their private hashes. Hash raw
   candidate tags against retained identity HMACs too, so keep-to-hash
   conversion does not strand a raw copied tag. Cache those candidate hashes.
   Never infer substrings, unknown aliases or another person's occurrences.
   Preserve all other tags, users, projects and event text.
4. Recompute changed payload digests. Include changed search payloads in
   the preview fingerprint and verify previous occurrence/digest tuples
   at commit. Chunk JSON update parameters at 256 KiB instead of creating
   one D1 write per retained event. Apply these updates, identity removal,
   exact session DID de-identification, transfer invalidation, restore
   checkpoint, safe audit and receipt in one existing owner transaction.
   Event deletion removes the same projections with its occurrences.
   No migration, parallel journal or retained sensitive subject is added.
5. Show actual matching search tag entry counts in the existing preview
   and receipt. Keep unavailable identity-specific search, attachments,
   replays and independently matching feedback explicit with reasons.
   Sessions still use only literal DID equality with the supplied value.
   No relationship between other aliases or anonymous aggregates is invented.
   No feedback implementation or feedback UI file is changed.
6. Extend tests/end-user-erasure-preview.mjs's existing public journey.
   Seed via Sentry HTTP, convert identity policy through owner routes, then
   inspect populated tag search/facets before and after confirmed erasure.
   Read JSON/CSV exports, built Settings/search pages, issue identities,
   archives and restore refusal. Preserve all authority and no-mutation
   refusal checks. Exercise actual id, username and literal-IP confirmations
   with matching session DIDs. Assert UI behavior at 1440; capture the changed
   preview, unavailable, completion and search screens at 1440 and 390.
7. Extend the existing outside-Verify volume journey to attempt the actual
   150,000-event public restore under an 1800-second alarm. Do not disable
   admission guards, plant rows directly in D1, or lower the five-minute bar.
   At the admitted 10,000 events, exercise the changed tag/digest batching
   alongside identity erasure. Record the exact candidate and run identifier.
8. Build, typecheck and run touched journeys. Merge fresh main after saves,
   check contract documents, regenerate sources.lock.json last and check it.
   Inspect every candidate commit identity/trailer before every guarded
   product push. Publish only cloud/sd-spool-sdk027-2; no main/PR/tag/release,
   self-submission or history rewrite. Observe exact-SHA Verify with one
   bounded REST poller and publish this nonsecret packet separately.
   The fleet Mac owns publication scanning, independent gate and landing.

PLAN.md also records the working plan. All written claims here are signed by
Run Edit Run fleet (sd), 16 November 2026 UTC.

## Public-door results and before/after counts

The public journey passed on the exact candidate. Six retained events include
four matching user identities. Four matching raw-ID tag occurrences and two
matching private-hash tag occurrences are visible through ordinary search
before confirmation. The count-only preview reports six search tag entries.
After confirmation:

- Four event identities and six search tag entries are removed; all six events
  remain. Both populated tag queries have zero matches. Their JSON exports
  have no rows; CSV downloads contain their header alone.
- The unfiltered JSON export remains populated with its issue and six
  occurrences, and contains neither erased ID nor private hash. The facets
  omit both tokens but retain a nonidentity tag and the other user's ID.
- The other project's complete query/facet response stays identical.
  Issue identity views and the next archive omit the erased identities and
  search tags. The post-erasure archive restores successfully.
- The same installation and a fresh destination given the later archive
  reject the older archive with erasure_epoch.
- The alternative event-deletion action removes one event, one attached
  feedback record, one exact session DID identity and its one identity tag.
  Five events remain in the original project.
- Actual confirmations using id, username and IP each remove the matching
  identities and one literally equal session DID. The remaining event and
  session matches are zero. Unsupported stores remain explained in receipts.
- Anonymous, member, read-only, foreign, removed, admin/maintainer destructive
  attempts, valid/revoked grants, wrong confirmation, stale preview and foreign
  origin refuse without product mutation. Owner confirmation succeeds.
  Repeated previews remain count-only and read-only.
- Receipts and safe/native audit rows contain no supplied identity values,
  selected private HMACs or project identity keys.

Actual receipt examples: journey-receipt.json. The owner browser confirmation
receipt reports 0.007 seconds of atomic operation time for its four identities
and six tags; this is not the requested scale proof. The deletion receipt
reports 0.008 seconds. public-journey.log records the successful journey.

Eight real emitted-page screenshots cover matching preview, unavailable policy,
completed erasure and erased search at 1440 and 390. Axe serious/critical,
13px text, keyboard controls and no horizontal overflow pass in the existing
1440 assertions. The browser is /usr/bin/chromium with --no-sandbox, driven
with the real HOME. All browser contexts and test runtimes close normally.

## Acceptance and remaining gaps

Point 1 remains proven: a count-only email preview names matching events,
sessions, attached-feedback scope and search tag entries, and explains the
unavailable stores. Point 3 remains proven: receipts and audit omit values.
Point 4 remains proven: known older archives are refused.

Point 2 is improved but not claimed complete. The actual implemented search/tag
facet, issue, export and next-archive projections are exercised with nonempty
fixtures. Identity-specific user.id/user.email/user.username/user.ip query and
facet doors remain absent on main. Attachment/replay matching stores do not
exist; independent feedback matching waits for the feedback round. Different
session aliases, anonymous aggregates and identities discarded without a
retained matching hash remain uncorrelatable. Generic text or tags on unrelated
occurrences cannot be attributed to this user solely by a similar token.
Arbitrary captured messages, stacks, titles and other derived snapshots are
not redacted by this tag projection. A value copied into such text is outside
the proof, even when an identity-bearing occurrence is selected; complete
search/export/archive omission for those copies is not established.
External/downloaded copies and future captures remain outside the installation.

Point 5 requires a 150,000-event project. Main still has the 10,000-event
admission trigger and archive row/event limits in addition to its intake gate.
This brief leases erasure/identities, not admission, archive validation or the
GOV-003 capacity implementation. Those existing limits are not relaxed.
A 10,000-event timing never qualifies point 5. See the actual scale receipt
and terminal update below.

SDK-027's source Status/Gap/Evidence judgment stays missing, unchanged by this
builder. The builder claim remains PARTIAL points 1,3,4. No full-clause DONE
claim or independent DONE gate is requested or implied. Contract and generated
view files are untouched.

DEFAULT SDK-027: Preserve installation-owner-only destructive authority, typed
ERASE USER DATA confirmation, no outbound action and value-free safe audit.
GAP SDK-027: Identity-specific search/facet doors, independent feedback and
uncorrelatable/absent stores, and the admitted 150,000-event timing remain
unproven; only existing exact-occurrence tag projections are qualified here.

## Counts, checks and custody

Contract counts before = after: published 9 done / 3 partial / 0 missing (12);
target including push-further 14 done / 51 partial / 28 missing (93);
total 23 done / 54 partial / 28 missing (105). No clause status changes.
Root test scripts 131 -> 131. No registration is added; two existing journeys
are extended. No existing user-flow assertion is removed, skipped or weakened.

Typecheck and build passed. Contract generator check passed with 0 errors and
0 warnings. Source lock was regenerated last and its check passed. checks.json,
typecheck.log and build-summary.txt record validation; provenance.json and
identity-check.txt bind the actual product commits. Main was fetched and the
published branch merged it without rewriting history; it was already current.
Every candidate author and committer is Run Edit Run fleet
<fleet@runeditrun.com>, with no co-author trailer. The product diff was checked
for injected secret values before publishing.

Only requested product code, docs, tests and regenerated sources.lock.json are
in product commits. All fleet reports/receipts/screens are outside the product
checkout and go only to evidence/sd-spool-sdk027-2. Launcher keys, environment
dumps, setup output, private gates and secret values are excluded. The full
Mac-only publication scan and landing gates are not represented as having run.
No main/default branch was pushed. No PR was created under the seed's existing
fleet branch contract. Evidence transfer is report transport, not product READY
or a full-clause acceptance/landing signal.

Superseded-candidate Verify: 43914369712, event push, last observed in progress;
no final-candidate conclusion is inferred from it. Final-candidate Verify is
recorded in ci.json.
Current status and final observation are in ci.json. GH calls are bounded to
one observation per 300 seconds for this run, including discovery; ten total
GitHub calls remain the budget. No workflow is dispatched or rerun.

## Final candidate scale result

Run Edit Run fleet (sd), 2026-11-16 UTC: the committed outside-Verify journey
passed on a037966cccf2f232e8c098d62607ba36cca7f777, run
sd-spool-sdk027-2-20261116T171243Z, using:

    cloud_run perl -e 'alarm 1800; exec @ARGV' -- node tests/end-user-erasure-volume.mjs

The exact requested 150,000-event corpus was submitted through public restore;
it returned HTTP 400 with "Archive event budget" and
left no project. The same public door admitted 10,000 events. Confirmed erasure
removed 10,000 event identities and 10,000 search tag entries according to the
completed receipt, preserving 10,000 events and leaving zero matching identities.
Wall time for confirmation: 143.504397 seconds;
operation receipt: 142.697 seconds.
This is a passing admitted-volume run, not acceptance point 5.

The earlier exact-candidate run on 25d5794843d0cc57feb0665ef8db2d0e9c2b2591
is preserved as scale-before-receipt.json and scale-before-journey.log.
It took 144.130289 client seconds (143.211 receipt seconds) for the same
10,000-event path. The final SQL update joins materialized change columns to
event IDs instead of rescanning JSON rows, but the measured end-to-end timing
is effectively unchanged. No performance speedup is claimed. The full
150,000-event target remains unadmitted and unproven; neither its volume nor
the 300-second requirement was lowered.

CLAIM SDK-027 PARTIAL points=1,3,4 tests=tests/end-user-erasure-preview.mjs#endUserErasurePreviewFlow
DEFAULT SDK-027: Installation-owner-only destructive confirmation, typed ERASE USER DATA, no outbound action and value-free safe audit.
GAP SDK-027: Identity-specific search/facet doors, arbitrary captured-text/derived copies, independent feedback and absent or uncorrelatable stores, and admitted 150,000-event timing remain unproven.

## Terminal CI and product custody

Run Edit Run fleet (sd), 2026-11-16T17:33:44 UTC: push Verify 43916019599
completed/success on the exact final candidate
a037966cccf2f232e8c098d62607ba36cca7f777.
Eight GitHub calls were used, with all run observations at least 300 seconds
apart. No failed-job log calls, reruns or dispatches were needed.

The product branch is pushed and READY for the fleet's landing review. This
is a PARTIAL SDK-027 builder claim, not a DONE promotion. Contract counts and
judgments are unchanged. Publication scan, independent acceptance judgment if
later claiming DONE, landing, exact-main Verify and Run site remain fleet
gates; this cloud did not push main or submit/land itself.

terminal-custody.json, ci.json and the complete selected packet carry the actual
receipts. The separate evidence ref is transport only, not acceptance or landing.
