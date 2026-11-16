# sd-spool-sdk027-1 builder report

Run Edit Run fleet (sd), 2026-11-16T14:38:29.313178+00:00

Repository: just-every/run-spool
Branch: cloud/sd-spool-sdk027-1
Candidate: 2011d4884e82800cccefbf4d0a7cdfa91384e47b
Fresh main read/merge base: e1bbf84516f3e8729b623f040ff5b68cd95f3a91
Product save: 7632c3ff6d81c4f5fd41efc22dc39ba18ca22857 ([skip ci])
PR: none; seed uses the fleet cloud-branch landing contract.

## Plan and implementation

1. Read launcher and Spool AGENTS, contract acceptance, preview/identity
   intake/read/archive code, ERASE-001 receipts, portability journal/fence,
   owner-authority transaction guards and existing public journeys.
2. Preserve the email preview API and add exact id/username/literal-IP
   selections where the policy retains a matchable form. Keep/hash matching
   uses the existing per-project identity HMAC; no key is minted by preview.
   Responses contain counts and scope explanations, never supplied values or
   match hashes. Preserve maintainer/admin preview; require installation owner
   for destructive confirmation.
3. Add typed ERASE USER DATA confirmation bound to field, value, chosen action,
   policy revision, native counts, archive inventory and erasure epoch. Recheck
   current owner/session, policy/key and counts inside the atomic D1 write.
   Reject stale plans, grants, foreign origins and uncorrelatable fields.
4. In that one transaction clear every retained identity field/derived user key
   on matching events, or delete the matching events and exact FK children.
   De-identify session DIDs literally equal to the supplied value. Update only
   issues whose events were selected. Other projects and unrelated event
   identities remain intact. No external/outbound action is performed.
5. Reuse rer_erasure_operations, the standard counts/times receipt projection,
   erasure.complete safe audit, transfer invalidation and the existing
   portability redaction checkpoint. Never persist the input/HMAC as an
   operation subject. No new journal/table/store or migration is needed.
   Generic /api/erasures/<id> reads the same receipt. Older archives are
   refused by the same-installation or trusted-later-journal fence; a current
   archive restores successfully. A fresh store given only an old archive
   cannot infer a later erasure.
6. Extend tests/end-user-erasure-preview.mjs through real Sentry HTTP capture,
   owner route and emitted Settings page, preserving existing authority and
   read-only preview assertions. Add attached feedback, literal-DID handling,
   generic receipt, value-free audit/receipt and current/old archive proofs.
   Check keyboard confirmation, Axe serious/critical violations, text size and
   overflow at 1440; record changed screens at 1440 and 390.
7. Commit one focused tests/end-user-erasure-volume.mjs journey outside push
   Verify. Run it with the exact 1200-second alarm. Main's public archive/intake
   policy caps one project at 10,000 events: prove refusal above that cap and
   time removal of 10,000 identities without direct D1 fixture planting. Do not
   disable capacity guards or pretend this is a 150,000-event proof.
8. Typecheck, build, run touched public journeys, check contract documents,
   merge fresh main after the published save, regenerate sources.lock.json
   last and check it. Push only the named cloud branch with the fleet guard.
   Observe exact-SHA Verify through bounded REST calls, then publish this
   non-secret packet separately to evidence/sd-spool-sdk027-1. The Mac owns
   publication scanning, independent gate and landing; this builder never
   submits, tags, releases or changes main.

## Results and acceptance boundaries

Acceptance 1: public email count preview and keyboard confirmation passed;
keep/hash, project isolation and unavailable/drop cases are covered.
Acceptance 2: event identity and issue visibility removal plus current archive
omission/round-trip are covered for the implemented stores. Complete point 2
is NOT claimed: identity search/facets are absent on this main. Feedback contact
is discarded at intake, retained scrubbed messages have no identity index;
attachments/replays have no retained matching store. Attached feedback is
removed when its matching event is deleted. Different session aliases and
anonymous aggregates cannot be attributed. These limitations are shown in the
preview AND retained-scope receipt, never represented as successful erasure.
Acceptance 3: all four user fields, private HMACs and project keys are absent
from completed receipts and public/native audits; safe completion fact exists.
Acceptance 4: same-installation and fresh-post-archive destinations refuse the
older archive with erasure_epoch; the post-erasure archive itself restores.
Acceptance 5: NOT proven at 150,000 events. Public volume refuses a 10,001-event
restore and the actual admitted-volume journey times 10,000. See volume.json
for actual timing. The declared target remains 150,000; no threshold is changed.

## Before/after counts and judgments

Supported email action: preview only -> owner-confirmed identity removal or
matching-event deletion with durable receipt and existing restore protection.
Public mixed fixture: 6 retained events, 4 matching identities -> 6 events and
0 matches after identity removal; alternative deletion then leaves 5 retained
events, 0 matching second-user events, 0 attached feedback and 1 session DID
identity removed. Independent project retains its two matches.
Volume fixture: 10,000/10,000 retained/matching -> 10,000/0; above-cap restore
refused without leaving a project. Requested 150,000 case is not admitted.
Contract counts unchanged: published 9 done/3 partial/0 missing (12), target
14 done/51 partial/28 missing (93), total 23 done/54 partial/28 missing (105).
SDK-027 source judgment unchanged: missing -> missing, as builders do not edit
Status/Gap/Evidence. Builder claim: PARTIAL, supported points 1,3,4. Independent
Codex Sol high data-erasure gate is required before a DONE promotion.
Root test script files: 130 -> 131 (file count, not a registration census).
Existing CI journey extended; one focused volume script added outside push CI.
No user-flow assertion was removed or weakened. Replaced the old self-copy pin
on operation and unavailable store-list ordering with count/behavior checks.

DEFAULT SDK-027: Installation-owner-only destructive authority, typed confirmation,
no automatic outbound action, safe audit; maintainer/admin count preview remains.
GAP SDK-027: Search/facets, independently uncorrelatable stores/session aliases and
150,000-event public-door timing remain unproven. No DONE claim is made.

## Validation and custody

See validation.json, public-journey.log, journey-receipt.json, volume.log,
volume.json, typecheck.log, build-summary.txt, source-check-summary.txt,
contract-check.log, identity-check.txt and ci.json for actual receipts.
Screenshots are real emitted-page captures at 1440 and 390, selected explicitly.
The earlier matching screens show 3 of 5 events; the stale-plan probe then adds
one matching event, and the completed owner receipt removes 4 of 6 identities.
Setup output and local gates/credentials are not part of this packet.
No fleet evidence is committed to the product branch. Only product code,
requested docs/tests and regenerated source lock are in its product commits.
The launcher refresh and fleet credential helper were used. No other credential
was sought. Read-only attempts to retrieve the two platform playbooks returned
404; the shipped RULES essentials and actual seed instructions were followed.
No unsupported Mac helpers or publication scan were represented as having run.

CI custody update — Run Edit Run fleet, 16 November 2026 UTC: Verify run 43887905458 remains in_progress on the exact candidate at 2026-11-16T14:59:55.679089+00:00. The product branch is pushed; no green or landing claim is inferred from the report transfer.

## Terminal CI blocker

Run Edit Run fleet (sd), 16 November 2026 UTC: exact-SHA Verify 43887905458
completed/failure on 2011d4884e82800cccefbf4d0a7cdfa91384e47b. Build,
contract-docs, owner-ui (including the extended public erasure journey), project
erasure, project-erasure-cap and owner-erasure jobs all succeeded.

The genuine failed job is runtime (ruby), 133371916493. Its unchanged
`tests/sdk-runtimes.mjs:41` reconciliation asserts that Spool's observed outcomes
equal those sent to the reference collector. The CI run additionally observed:
`client_discarded:error:network_error=1`,
`client_discarded:log_byte:network_error=521`,
`client_discarded:log_item:network_error=1`, and
`client_discarded:monitor:network_error=1`.
The normal accepted count is still 3; the extra discard reports cause the strict
assertion to fail. Aggregate shards (spool) and verify jobs fail with it. No
runtime/SDK/intake implementation or Ruby fixture was changed by this branch.
This report does not claim that an independent main run reproduced the failure.

The required archive log command was run once and succeeded:
`gh run view 43887905458 --repo just-every/run-spool --job 133371916493 --log-failed`.
Its assertion trace is in ci-ruby-failure.log; the workflow environment preamble
is omitted from the public packet. ci-jobs.json records the complete job results.
Ten GitHub calls were used, including the two unavailable read-only playbook
requests, exact-SHA observations, job listing and one genuine failed-job log.
No workflow was dispatched or rerun, and no assertion was weakened or skipped.
Ruby is not installed in this cloud VM; no unrelated runtime dependency or
out-of-lease SDK/test change was introduced to obtain a different CI result.

Terminal product custody is BLOCKED on successful exact-SHA Verify. The branch
and both product commits are pushed. The erasure work and PARTIAL claim are
complete for this slice, but this failed workflow is not a READY candidate.
Independent Codex Sol high data-erasure gate and the Mac publication/landing
checks remain required. The separate evidence ref is report transport only.
