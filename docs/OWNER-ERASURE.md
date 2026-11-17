# Installation-owner personal-data erasure

The native HTTP workflow targets the authenticated owner's own operator row.
It cannot name another operator. It uses Base `preview`, `start`, `run` and
`receipt`, and its durable multi-step deletion pipeline. Project erasure remains
a separate operation.

1. Complete ordinary email sign-in (or native email step-up). Send
   `POST /api/owner/erasure/successor` with `email` and `displayName` for the real
   successor. This privately calls Base's member invitation primitive; general
   invitations, role changes and second-owner creation remain closed. Inviting a
   different successor retires the earlier one in the same transaction: this
   owner's invitations to them are removed, and the invited operator is deleted
   (or deactivated if they had accepted), so a mistyped address never holds erasure.
2. The successor follows that ordinary one-use email invitation. They are an
   active member and have no owner management yet. The current owner remains
   the sole owner.
3. `GET /api/owner/erasure` returns table counts, exceptions, a plan hash and any
   hold. It contains no email, operator ID, stored text or successor identifier.
4. With a fresh native proof, send `POST /api/owner/erasure` containing only
   `{"confirm":"ERASE MY PERSONAL DATA","planHash":"<preview hash>"}`.
   The first atomic Base step rechecks the predecessor's session/version and
   the exact verified successor session/version, promotes that member, and
   deactivates the predecessor. There is exactly one active owner after commit.
   Both parties' earlier owner/invitation sessions are invalidated. The successor
   uses ordinary email sign-in again and retains normal owner management.

All writes require the configured origin. Anonymous sessions, project grants,
cross-origin requests, extra subject fields, wrong confirmation and stale plans
are refused. The final owner's native database protection remains in place;
without a verified successor the operation plainly refuses without deletion.
Responses can be `202` while deletion continues; the scheduler resumes the Base
operation. The successor reads counts and times at
`GET /api/owner/erasure/receipts`. The predecessor receives no continuing owner
access. Receipts clear the subject and contain no stored identity value.

If the first deletion batch refuses a changed plan or authority, the untouched
operation is canceled and ordinary surviving sessions, sign-in and writes can
continue. Cancellation is conditional on no committed step or retained work;
an operation that has deleted anything remains resumable. The write freeze
continues through the finalization phase until the receipt is complete.

## Scope and preservation

Relational deletion covers the predecessor's `oa_operators`, own tokens and
sessions, external bindings, provider session data/pins, step-up challenges,
agent and deploy keys, invitation-cancellation state, development credential marks,
setup links, pending dependency approvals and their correlated auth outbox
messages. Successor invitation provenance is retired and their pre-handoff
session is invalidated; other people's invitation provenance causes a hold.
The predecessor's agent and deploy keys, and legacy unattributed ones, are
deleted. Project ingest keys are project rows: they stay listed and keep
ingesting, and only their minter attribution is cleared. The additive
credential attribution migration is required. Migration 0030's durable
credential trigger rejects a delayed predecessor mint after erasure has
completed; afterwards an existing key may only be revoked, which works
regardless of who minted it or any later identity fence. Competing writes are frozen during the resumable
operation, and each Base batch owns its guard only within that transaction.

The Business roster is retired in the same transaction. The agent-door erasure step
(`agent_door_state` declares `retire: { refs }`, fed by `operatorPolicyRefs`) removes the
person's `bs_team` row and their entry in the stored `bs_settings.document`, marks their
editor attribution in `bs_audit`, and records only SHA-256 digests of their roster address and
Business member id in `bs_retired` (migration 0104). Spool's own steps still delete their local
Business overrides and stop the Business with its stored document cleared. A signed revision that
lists a retired person applies without them until it sends a larger invite number; a person whose
native account an earlier release erased is retired the same way at the next revision.

Run Edit Run fleet, 15 November 2026: repair create/check/fact transactions
and the main API's browser-origin, assignment, triage, retention and restore
writes recheck the admitting session and operator version at transaction time.
Every guarded batch verifies that authority before and after its statements;
a handoff makes the batch roll back with `409 authority_changed`. Restore and
retention keep the same admitting authority across their batches. Already
committed retention work is not undone, but no later predecessor write can
commit or reintroduce an erased identifier. The portability engine's abort and
cleanup still run after a refusal.

The public HTTP journeys in `tests/owner-erasure-inflight.mjs` withhold request
bodies after admission, complete the separate erasure handoff, then release
the old writes. Browser-origin add/remove, assignment, triage and retention,
alongside the other main API writes, return `409 authority_changed` and leave
the post-erasure snapshot unchanged. The held restore does the same. These
transaction guards already exist on the main revision tested for this round;
this note corrects the stale boundary description, without claiming the
remaining owner-erasure gaps are complete.

The bootstrap singleton remains, with a retired claim marker. The managed
claim retains installation/time/completion facts but loses email, operator,
session and claim-token identifier. Matching IdP claim grants retain their
issuer/client uniqueness while subject, sector and claim-token values are
retired. Claim replay or bootstrap cannot reopen the installation. Auth audit
actors become random unjoinable labels and their value is cleared. Email rate
buckets derived from the current session secret are removed; uncorrelated IP
and confirmation-token rate aggregates remain.

The supported captured values are exact known operator ID, email, display name
and bound IdP subjects in project names, issue titles, event messages and
breadcrumbs, map JSON values, diagnostic text, repair notes/links/checks,
stored alert titles and development outbox JSON values. JSON is decoded before
matching, so escaped strings are covered. Identifiers match only as whole
tokens: the characters around them must not continue a word, address or
identifier, so "Sam" is replaced in "Sam: failed" but never inside "Sample".
An identifier found only inside a longer token causes the
`identifier_inside_longer_token` hold, because it cannot be told apart from
other people's text. Only matching values are replaced; other values in the
same row, map or message stay intact. Map/event digests are
recomputed. A shared operator display name found in capture causes a hold.
This is exact-identifier removal, not a claim that the schema can infer a person
from prose, unknown aliases or an identical name belonging to an unregistered
person. Encodings within text (for example a base64 string), unknown aliases,
and future incoming captures are outside this declared operation.

Structural row keys, event grouping inputs, domain-rule creator attribution,
unsupported captured surfaces and unreadable content are refused rather than
altering structural identities or deleting neighboring records. The displayed
hold must be resolved through an appropriate supported workflow first.

## Shared import custody is a current boundary

Any retained import job, stream, staging object or original causes
`shared_import_custody`, before destructive mutation. Import-kit stores exact
original bytes, possibly in chunks, plus normalized/rejected source records
and `principal_id`/`parent_principal_id` pointers in durable custody ledgers.
Its current retirement selector does not select custody by those principal
pointers. Related source/original erasure requires a native target, and its
original-erasure policy withdraws whole affected artifacts, including unrelated
people's bytes. That cannot satisfy selective self erasure while keeping
co-located other-person data identical. Spool therefore does not claim complete
owner erasure for installations with that custody. Base needs selective
principal retirement and a supported privacy transformation of shared originals
before this hold can be lifted safely.

## Archives and external copies

Each deleted row receives the existing portability tombstone. Native content
redaction also advances Base's maintained redaction checkpoint, so older
archives—including captured child rows—are rejected by the existing restore
fence. A fresh destination needs a trusted later journal (or the later archive)
to know about the erasure. Post-erasure archives remain restorable. An empty
store given only an old archive cannot infer later erasure; raw database imports
bypass the application fence.

This does not remove downloaded archives, delivered email, identity-provider
records, `OWNER_EMAIL`/alert destination deployment configuration, D1 Time Travel
or provider/external backups. The owner must separately retire those copies.

AI-005 owner erasure deletes `grouping_proposals` and its private server-computed review snapshots. Safe AUDIT-001 chronology retains only unlinkable actor/subject aliases, action, time and outcome.

## Moved from CONTRACT.md

The contract cleanup of 28 October 2026 moved this mechanism here from CONTRACT.md; the clause keeps the requirement.

Deleted: the owner's operator row, tokens, sessions, external identities, provider session data, step-up challenges, agent and deploy keys they minted, development marks, setup links, pending dependency approvals and their auth outbox mail. Retired: the bootstrap and managed claim ledgers keep only installation, time and completion facts, so the installation stays claimed and cannot be reopened; auth audit actors become random unjoinable labels. Inert grouping proposals and their private review snapshots are deleted. Captured data: exact known identifiers (operator ID, email, display name, bound IdP subjects) are replaced inside project names, issue titles, event messages, breadcrumbs and context, map JSON, diagnostics, repair notes, links and checks, alert titles and development outbox JSON, leaving every other value in the row intact; they match only as whole tokens, and an identifier found only inside a longer word or address is a hold. Project ingest keys keep ingesting and stay listed with their minter attribution cleared, and any key stays revocable afterwards. Inviting a different successor retires the earlier invitation and invitee. Other people's operators, sessions, grants and captured values are unchanged. Retained import custody, an identifier inside a structural key, and a display name shared with another person are explicit holds that refuse without mutation; prose that names the owner without an exact identifier, unknown aliases and encoded text are outside the declared scope. Receipts carry counts and times only.

## End-user erasure under owner authority

Run Edit Run fleet, 16 November 2026: the separate end-user action in project
Settings erases a retained captured identity rather than the installation
owner's account. It uses the same `rer_erasure_operations` receipt table,
counts/times receipt projection, safe `erasure.complete` audit and portability
redaction checkpoint as ERASE-001. It has no parallel journal or subject store.
Its native mutations and completion receipt commit together under the current
owner-session fence. No raw user value or matching digest is saved in the
operation's subject or label. The ordinary owner receipt read at
`GET /api/erasures/<receipt id>` returns its counts and times.

`POST /api/projects/<project>/end-user-erasure/preview` accepts either the
existing `{ "email": "<email>" }` input or one `{ "field": "email", "value":
"<email>", "action": "remove_identity" }` selection. Supported fields are
`email`, `id`, `username` and `ip_address`; the alternative action is
`delete_events`. `POST /api/projects/<project>/end-user-erasure/confirm` accepts
the selection plus its `planHash` and `confirm: "ERASE USER DATA"`. It requires
the installation owner and same origin. Preview, confirmation, session/key,
policy, inventory and epoch checks protect the atomic write. Imported/staged
custody that cannot be selectively withdrawn holds this action without removal.
The receipt lists unavailable stores and literal-DID-only session attribution;
see [User identity policy](USER-IDENTITY.md#erase-one-retained-user).

Run Edit Run fleet (sd), 16 November 2026: end-user erasure removes supported
exact identity copies from project event tags, messages and breadcrumbs and
matching issue and alert titles. The count-only preview and receipt name changed event
text, titles and tag entries, plus partial-token and grouping-sensitive copies
that remain. Ordinary search/facets read payloads; the owner-only identity
search/facet API reads the identity projection itself. Payload/digest and title
updates use bounded set-based statements inside the existing atomic transaction.
Their JSON-first guard order performs indexed occurrence lookups rather than
rescanning the project per chunk. There is still one value-free journal
checkpoint and completion receipt. Uncorrelatable aliases, independent derived
snapshots and the independently matching feedback gap remain explicit in
[User identity policy](USER-IDENTITY.md#erase-one-retained-user).

Run Edit Run fleet (sd), 16 November 2026: the end-user scale journey now requires
an admitted 150,000-event project and a measured confirmation below 300 seconds;
it cannot substitute a smaller project after a restore refusal. Archive validation
admits GOV-003's 160,000-event acceptance corpus, with exact identity occurrence
membership indexed during validation. The archive capacity guard remains separate
from the maintained erasure epoch: an archive carrying erased values still refuses
with `erasure_epoch`, and the post-erasure archive remains restorable. This does
not remove the public intake limits or complete GOV-003 or the unsupported
SDK-027 stores. See the candidate-bound scale receipt for measured results.

### Measured end-user erasure and archive results

Run Edit Run fleet (sd), 17 November 2026: on candidate
`c5570fd9cdd52208ce39acbb41a46e19d666f043`, run
`sd-spool-sdk027-4-erasure-20261116T223452Z` erased the selected identity from
150,000 events in 24.681905 client seconds (7.185 receipt seconds), below the
300-second bar. Matching identities fell from 150,000 to zero; all 150,000
events remained. Run `sd-spool-sdk027-4-archive-final-20261116T224251Z` also
passed: 160,000 events restored, then 160,000 events and identities archived;
a 160,001-event restore returned `400 Archive event budget` without mutation.
The raised budget, from 10,000 to 160,000 events per project, is enforced by
`archiveEventsPerProject` and the early tally in `validateArchiveRows` in
`src/domain/archive.ts`; `validateArchive` uses it for legacy event rows too.
These are the prior candidate's measured results, recorded in its
[report and receipts](https://github.com/just-every/run-spool/tree/fb84a1bf05cbc9debdaf764ee1c11119f7f84b7a/files),
and leave the existing SDK-027 and GOV-003 gaps open. Run the committed journey
outside push Verify with:

```sh
perl -e 'alarm 2400; exec @ARGV' -- node tests/end-user-erasure-volume.mjs
perl -e 'alarm 2400; exec @ARGV' -- node tests/end-user-erasure-volume.mjs --archive-160000
```
