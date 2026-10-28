# Owner import reads

`GET /api/imports/business` needs an active installation owner session and no
project. `routeState.projectRequired` is false, including on an empty install.
Admin, maintainer, member and signed-out requests still receive 401 with an
error only. No new endpoint or screen is introduced.

All original fields remain. The owner reads add:

| Response | Additive facts |
| --- | --- |
| Business settings | `routeState`, `reasonLabels`; `keys[].name`, `nameReasonCode`, `createdAt`, `createdAtReasonCode` |
| Each history row | `organization`, `projectIds`, `counts`, `rejected`, `undo`, transition times and unavailable-reason codes |
| Operator plan | `rejected[].label`, `labelReasonCode`, `reasonCode`; `recordCounts`, `organization`, `projectIds`, `undo`, transition times and unavailable-reason codes |
| Operator status and reconcile | `recordCounts`, `organization`, `projectIds`, `undo`, transition times and unavailable-reason codes |
| Owner job responses (apply, status, undo) | `job.createdAt`, `job.appliedAt`, `job.undoneAt`, `job.timestampsReasonCode` |

`reasonLabels` maps stable reason codes to readable labels from
`src/domain/sentry-import/read-reasons.ts`. Original rejection sentences remain
for compatibility; screens can group and render `reasonCode` instead. Labels
come from project names, release versions, issue titles, and the title of an
event or its issue, after display scrubbing. No event bodies or stack frames
are returned. A missing safe label is null with `record_label_unavailable`.

`counts` / `recordCounts` are the reviewed source plan counts, including
`byKind` and `effects`. Existing reconcile `counts` still describes native
reconciliation. `projectIds` lists currently present imported projects
represented by the snapshot, including inherited projects on catch-up; it is
empty before apply or when those projects no longer exist. It is not a count
of projects newly created by this job. The organization comes from the retained
manifest, including for Business's `sentry` namespace.

`undo.available` describes the current job's reversal, including rollback of a
failed apply. `undo.blockers[]` names records by kind and safe label with either
`import_superseded` or `native_edit_conflict`. Supersession reads the kit's
history layers; native conflicts compare current native revision, value and
attachment hashes with validated provenance, using the same strict comparison
as undo. This read grants no write authority. Undo rechecks its existing guards
when invoked, and a future edit can change availability.

An erasure-withdrawn snapshot yields null counts, rejected rows, organization
and project IDs, each with `snapshot_withdrawn`; labels are never recovered
from another source. Reads recheck the current owner and destination erasure
epoch before publication. The reviewed fingerprint, original journal,
approval and mutation pipeline are unchanged.

The current kit never recorded job creation, apply completion or undo
completion times. Those fields are null with `job_timestamps_not_recorded`;
approval and Sentry source times are not substituted. Recording future times
requires a Base change: additive nullable columns in import-kit's
`src/storage/schema.ts`, its D1 schema/migration, the `ImportJob` type and
`src/d1/jobs.ts` decoder; set them in job creation and successful final
apply/reversal transactions. Existing historical values must remain null.

The owner-claim trust ring contains public JWKs keyed by `kid`, with no name or
creation date. Those key fields are null with `key_metadata_not_provided`.
Supplying real values requires metadata from the trust producer and an additive
owner-claim configuration contract; first-seen and revocation dates are not
creation dates. No trust or credential model is added here.
