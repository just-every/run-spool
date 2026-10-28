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

Repair create/check/fact transactions also recheck the original session and
operator version, so a body withheld across the handoff cannot write later.
The main API still has an in-flight authority boundary: already-admitted
browser-origin, triage, retention and restore requests lack that transaction
check. A delayed browser-origin write can reintroduce a predecessor identifier
after completion. Full owner-erasure acceptance is blocked until those routes
receive transaction-time session guards; the current workflow does not claim
to fence all already-admitted requests.

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
