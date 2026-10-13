# Project erasure

BASE-DATA-003 project erasure is implemented, first at `c279cd2d1fc02acfbc1160201782935e5324ddef` (GitHub Verify run 38215335300). The owner erases one project
from Settings → **Erase this project**, or through the same owner-only HTTP
route the panel uses. Manual retention remains a separate flow and never erases
a project.

## Using it

1. **Preview erasure** shows how many rows each kind of record holds, which
   rows stay without their project link (audit entries, the scheduler
   cursor), what is kept on purpose and why, and the limits outside this
   installation. It shows counts only, never a stored value.
2. Type the project identifier to confirm. A partial or different identifier
   keeps **Erase project** disabled; over HTTP it is refused with 400 and
   nothing changes.
3. The receipt lists the deleted counts and the requested, committed and
   completed times. **Continue** returns to the workbench.

Take a private archive first if you may need the data later. An archive made
before the erasure is refused by this installation afterwards.

| Route | Who | Result |
| --- | --- | --- |
| `GET /api/projects/:project/erasure` | owner session | `{deleted, redacted, retained, exceptions, planHash, hold}` |
| `POST /api/projects/:project/erasure` `{confirm, planHash}` | owner session, same origin | receipt; 200 when complete, 202 when the scheduled run continues it |
| `GET /api/erasures`, `GET /api/erasures/:id` | owner session | receipts (counts and times only) |

Anonymous requests get 401; any project grant (ingest, agent or deploy key)
gets 403; a cross-origin write 403; an unknown project 404; a changed plan
409 `plan_changed`; another erasure still running 409 `erasure_in_progress`.

## What it deletes

`src/domain/erasure/declaration.ts` declares the cascade: the project and its
events, issues, releases, source maps, admission counters, keys and their
dev-minted marks, browser origins and guards, Sentry DSN aliases, alerts,
alert rules, cursors, intents and history, mail jobs and attempts, the
development outbox messages of those mail jobs, integration rows in the
project's `spool.<project>` namespace, repairs, repair checks and Sentry-import
targets. Every deleted row gets its portability tombstone in the same atomic
batch, and each batch drops in-flight transfer snapshots.

A project created by Sentry organization import also has import-kit custody:
the source records that produced it and the original export bytes. Its
erasure runs as one import-kit batch (`eraseD1ImportTarget`) with the cascade:
the project's source records become zero-effect tombstones, and every original
export artifact that holds the project is withdrawn under
`withdraw-affected-artifacts`. Another project from the same export keeps its
native rows, but that export's original bytes become unavailable to it too.

Surviving project audit entries keep only their kind and time. Their project
reference becomes null and their detail `{"erasure": "<random label>"}`; the
label appears only in the receipt, so nobody holding the database can join an
entry back to the erased project. The alert scheduler cursor forgets the
project and its rules.

One erasure runs at a time. An erased project's identifier cannot be used for a
new project: its tombstone would refuse every later archive holding it.

## Kept on purpose, and limits

- The installation owner, the claim ledgers and authentication state stay.
- Other projects stay.
- Receipts keep counts and times only; portability tombstones are keyed hashes.
- Older archives are refused by this installation, and by a fresh installation
  that first restores the newer archive. A brand-new installation given only an
  older archive cannot recognise the erasure; give it the newer archive too
  (`rer import --input OLDER --journal NEWER`), which refuses the older one.
- Already downloaded archives, delivered mail, provider records, D1 Time Travel
  and backups, raw database imports and destination secrets
  (`ALERT_DESTINATIONS`) lie outside this installation and are not deleted.

## Measured

`tests/project-erasure.mjs` (`test:project-erasure`, part of verify) runs the
whole journey through public rer setup, dev, HTTP, export and import, and erases
a project holding the retained-event cap (10,000 occurrences) in about 60 to 70
seconds on a local Miniflare D1 and 147 seconds on the GitHub Verify runner,
inside the 300-second requirement. Hosted D1
statement, CPU and request limits are not measured here; an erasure that
outlives its request continues on the next scheduled run.

## Base helper adoption

`src/modules/erasure` is Base main's reviewed erasure module at
`9ec15a63a410d209cd5a179749336bb61751e0f6`, recorded file by file in
[base-copies.json](../base-copies.json) with migration
`0018_erasure.sql` (the module's own erasure schema). One file differs:
`src/modules/erasure/plan.mjs` qualifies the primary-key column when it
re-reads remembered rows. Unqualified, a key named like a `json_each` column
(`id`) resolves to the JSON row, so the re-read matched every row of an integer
`id` table; erasing one project then deleted every project's Sentry DSN alias.
The file is mapped as adapted source in edition.json until Base carries the
same fix, after which it returns to a byte-identical copy.

The adopted portability copy runs the restore fence, including an explicit
later journal, before any destination occupancy check, so an older archive is
refused by the erasure fence rather than by `target_not_empty`.
