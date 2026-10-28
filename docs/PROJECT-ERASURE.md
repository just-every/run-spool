# Project erasure

ERASE-001 project erasure, Spool's delta on the Base BASE-DATA-003 duty, is implemented, first at `c279cd2d1fc02acfbc1160201782935e5324ddef` (GitHub Verify run 38215335300). The owner erases one project
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
3. Erasure is accepted as a durable job immediately after confirmation. The panel
   follows its bounded steps and shows progress. Leaving the page does not cancel
   it: the scheduled sweep continues the same job. Only **Project erased** marks
   completion. The receipt lists the deleted counts and the requested, committed and
   completed times. **Continue** returns to the workbench.

Take a private archive first if you may need the data later. An archive made
before the erasure is refused by this installation afterwards.

| Route | Who | Result |
| --- | --- | --- |
| `GET /api/projects/:project/erasure` | owner session | `{deleted, redacted, retained, exceptions, planHash, hold}` |
| `POST /api/projects/:project/erasure` `{confirm, planHash}` | owner session, same origin | 202 accepted receipt with `Location: /api/erasures/:id`; no destructive work in this request |
| `GET /api/erasures`, `GET /api/erasures/:id` | owner session | receipts (counts and times only); status reads never advance a job |
| `POST /api/erasures/:id/resume` | owner session, same origin | one bounded step; 202 while continuing, 200 only when complete |

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
the source records that produced it and the original export bytes. Its native
graph, and the door's private upload, plan and archive copies, are deleted by
the same bounded steps as any project (a 150-issue import is thousands of
statements with their restore tombstones, more than one D1 request carries).
Once that commits, one import-kit transaction (`eraseD1ImportTarget`, with the
project row already gone) turns the project's source records into zero-effect
tombstones and withdraws every original export artifact that holds the project
under `withdraw-affected-artifacts`. Only then may the blob phase mark the
receipt complete; a failed step leaves the operation where it was and the next
request retries it. Another project from the same export keeps its native rows,
but that export's original bytes become unavailable to it too.

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
  older archive cannot recognize the erasure; give it the newer archive too
  (`rer import --input OLDER --journal NEWER`), which refuses the older one.
- Already downloaded archives, delivered mail, provider records, D1 Time Travel
  and backups, raw database imports and destination secrets
  (`ALERT_DESTINATIONS`) lie outside this installation and are not deleted.

## Measured

`tests/project-erasure.mjs` runs the Settings journey, progress and completion
at 1440 and 390, including imported custody, anonymized audit, unrelated data
and old-archive fences. `tests/project-erasure-cap.mjs` separately restores
10,000 retained occurrences, requires a prompt 202 acceptance, follows the same
job to completion within the unchanged 300-second cap, and scans D1 and a fresh
archive for erased values. The local pre-change POST took 90.34 seconds (75.29
seconds from job creation to completion); the old request performed the whole
erasure before sending headers. With accepted jobs and bounded continuation,
the same local cap accepted in 0.729 seconds and completed in 29.766 seconds
(28.975 seconds from job creation). Hosted D1 limits remain separately
unmeasured.

## Base helper adoption

`src/modules/erasure` is Base main's reviewed erasure module at
`a81dd10c05b33c6f6372fc360ef29c40ea04332d`, with unchanged files recorded in
[base-copies.json](../base-copies.json) with migration
`0018_erasure.sql` (the module's own erasure schema). The adapted files are recorded in edition.json rather than claimed as
byte-identical copies. `index.mjs`/`index.d.mts` let an accepted imported job
publish its existing operation inside the original custody transaction.
`order.mjs` batches indexed parent/child lookups, and `verification.mjs` builds
SQLite key sets once while preserving all scope guards. `cascade.mjs` binds
queued composite keys in schema order rather than JSON property order. Also,
`src/modules/erasure/plan.mjs` qualifies the primary-key column when it
re-reads remembered rows. Unqualified, a key named like a `json_each` column
(`id`) resolves to the JSON row, so the re-read matched every row of an integer
`id` table; erasing one project then deleted every project's Sentry DSN alias.
The adopted Base version retains that qualified-key fix.

The adopted portability copy runs the restore fence, including an explicit
later journal, before any destination occupancy check, so an older archive is
refused by the erasure fence rather than by `target_not_empty`.

AI-005 grouping proposals and their server-computed review snapshots are project investigation data. The erasure inventory explicitly deletes `grouping_proposals`, including rejected, approved, applied, undone and stale advice. Restored advice remains inert.

## Moved from CONTRACT.md

The contract cleanup of 28 October 2026 moved this mechanism here from CONTRACT.md; the clause keeps the requirement.

It runs on Base main's erasure helper (`src/modules/erasure`), declared in `src/domain/erasure/declaration.ts`; one helper line carries a correctness fix not yet on Base (docs/PROJECT-ERASURE.md).

Erasure deletes the project and all project events, issues, releases, repairs, repair checks, reproducers and their runs and run tokens, fix workflows, their step leases and receipts, exposure reports, artifacts, admission counters, alerts, alert destinations, alert rules, cursors, intents and history, mail jobs and attempts, project keys and their dev-minted marks, browser origins and guards, inbound filter and grouping policies, grouping proposals and their server-computed review snapshots, feedback, release metadata/builds/policies and issue-resolution boundaries, Sentry DSN aliases, integration rows in the project's namespace, Sentry-import targets and project-related development outbox content. Every deleted row gets a Base portability tombstone and stored transfer snapshots are invalidated in each batch. A Sentry-imported project's import-kit custody (its source records and plan entries) and every original export artifact that holds the project are withdrawn in the same import-kit batch as the cascade; other projects in such an artifact keep their native rows, but that artifact's bytes become unavailable to them too. Completion is measured today within five minutes at the current 10,000-event admission cap; the target is GOV-003's published retained volume, within 15 minutes for 150,000 retained events and at no less than 10,000 events a minute above that. Manual retention's visible cutoff, occurrence identities, guarded tombstones and deduplication horizon are unchanged. One erasure runs at a time; an erased project's identifier cannot be reused, since its tombstone would refuse every later archive holding the new project.

Retained scope exceptions, each named in the preview and receipt: the installation owner, claim ledgers and authentication state remain because project erasure preserves installation authority; unrelated projects remain because they lie outside the selected project; project audit entries survive with only their kind and time, their project reference replaced by a random label shared only with the receipt, so a database holder cannot join them back; receipts keep counts and times only; portability tombstones are keyed hashes. Owner self-erasure uses the separate workflow below; project erasure alone does not erase its retained owner. Selective owner erasure remains blocked for shared import custody and unsupported or ambiguous attribution.
