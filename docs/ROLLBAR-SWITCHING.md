# Switching from Rollbar to Spool

MIG-003 imports one Rollbar project's history through the owner import door, then guides an SDK cutover that keeps diagnostic context and names what does not convert. Proof is a synthetic export in Rollbar's documented REST API response format. A real buyer project and its production-volume dual run are register row R-4; nothing here claims a real Rollbar account was read.

## Build the export bundle

Use a read-scoped project access token that you hold, in an environment variable of your own, and the documented Rollbar REST API. Save each page's response body exactly as Rollbar returned it. The bundle is one JSON file of at most 2 MiB:

```json
{
  "format": "spool-rollbar-project-export", "version": 1,
  "account": { "slug": "example" },
  "project": { "id": 9001, "slug": "web-app", "name": "Web app", "date_created": 1767225600 },
  "window": { "start": "2026-01-30T00:00:00Z", "end": "2026-02-03T00:00:00Z" },
  "collections": [
    { "kind": "items", "pages": [{ "page": 1, "nextPage": null, "response": { "err": 0, "result": { "items": [] } } }] }
  ],
  "omissions": ["Describe anything you chose not to export."]
}
```

Collections are `items` (required), `instances` (occurrences, each carrying its `item_id`), `deploys`, `rules` (notification rules) and `comments`; each appears once. Every response keeps Rollbar's own shape: `items`, `instances`, `deploys` and `comments` nest their rows under a key of the same name, while the notification rules response's `result` is a bare array of rules. Pages are numbered from 1 and chained by `nextPage`, and every page must report `err` 0. Timestamps stay Unix seconds as Rollbar sends them. A source containing a credential value is refused whole, so export without access tokens.

## Review, apply, compare and undo

The Rollbar importer shares the Sentry importer's door, history and undo. It needs the owner session in a local environment variable, the exact app origin, and the Rollbar account and project slugs the bundle names (`--account` and `--project`). The door keeps each project's lineage under its own namespace for that account and project pair, so two accounts that share a project slug import and erase independently.

```sh
node scripts/rollbar-import.mjs dry-run --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --file ./project.json

node scripts/rollbar-import.mjs apply --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --account example --project web-app \
  --plan PLAN_ID --fingerprint REVIEWED_FINGERPRINT

node scripts/rollbar-import.mjs compare --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --account example --project web-app \
  --plan PLAN_ID --file ./project.json

node scripts/rollbar-import.mjs undo --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --account example --project web-app --plan PLAN_ID
```

The dry run writes nothing native. It returns the plan's fingerprint, per-collection counts, every rejected record with its reason, and every record kept without a native row with the reason it was kept. Apply needs the reviewed fingerprint and runs in bounded batches: if it stops, repeat the same command (also from a new owner session) and it resumes the same job. `reconcile` and `status` are the door's own; `undo` removes only imported rows and refuses, preserving the edit, when a native row has changed.

`compare` reads the imported project and sets it against the export, one row per aspect:

| Aspect | Compared | A difference means |
| --- | --- | --- |
| items | source items with an imported issue | an item was rejected or missing |
| occurrences | exported occurrences against the imported issues' counts, and Rollbar's own per-item totals against what the export carries | a count differs; a shortfall in the export itself is named, not hidden |
| stacks | each sampled occurrence's frames, order and coordinates | an imported stack differs from its source |
| deploys | deploys against the releases they became | a deploy revision has no release |
| rules | notification rules in the export against the rules the import retained, with the project's own native alert rules listed beside them | the import retained fewer rules than the export carries |

Deploys and rules report `explained` when they behave as designed (a native rule is one you configured, never one the import made); any `differs` row makes `ok` false.

## What converts and what does not

| Rollbar | Spool |
| --- | --- |
| Project | One project with a deterministic namespaced id; no credentials |
| Item, status active | Open issue; a reactivated item is open and its earlier resolution time stays in the private journal |
| Item, status resolved | Resolved issue; the fix version stays in the private journal |
| Item, status muted or archived | Suppressed issue; Spool has no archive state |
| Occurrence | Historical event under Rollbar's own occurrence uuid, scrubbed; exception chain, frames in Spool order, one-based columns kept as exported |
| Deploy | The deploy's revision becomes a release dated by its earliest deploy or occurrence; several deploys of one revision become one release |
| Occurrence code version | The release it belongs to; one Spool cannot hold imports release-less, and the reason is named |

Not converted, and named per record in the plan: assignment (Rollbar names its own user, so nobody is assigned), tracker links, grouping fingerprints (imported issues keep their own grouping and live events never merge into them), deploy environments, users and finish times, notification rules, comments, and person, request, server and custom data and code context (excluded from native events). Frames without a file, line or column are dropped and counted. Original bytes and every skipped field remain in the installation's private journal, which project event retention does not erase and which project erasure withdraws with its project.

Imported history is inert. It creates no alert, no alert rule, no webhook, no mail, no credential and no live admission, and it proves nothing about current health. Notification rules stay as retained records: rebuild each deliberately in Spool's alert settings and reauthorize its destination, because Spool will not send to a channel the owner has not approved in Spool.

## Cut over the SDK

1. Keep the Rollbar access token and its notifier configuration in deployment settings until the check below passes; this is the rollback.
2. In Spool, open the imported project, grant the application's exact origin and create an ingest key. Browser applications use [`@just-every/spool`](../packages/sdk/README.md); an application that prefers a Sentry SDK keeps it and uses the new DSN, as in [Switching exception intake to Spool](SENTRY-SWITCHING.md).
3. Carry diagnostic context across deliberately:

   | Rollbar notifier setting | Spool setting |
   | --- | --- |
   | access token | project ingest key (never the Rollbar token) |
   | `environment` | `environment` |
   | `codeVersion` | `release`, with `build` for a distribution; use the same revision names the imported deploys carried so release ordering continues |
   | person | the project's identity policy; Spool never copies a person block |
   | custom data and request fields | not carried; send only what the scrubber and project policy allow |
   | telemetry | explicit breadcrumbs, scrubbed |
   | custom fingerprint | grouping rules for the project |
   | source map upload step | the Spool source map CLI or build plugin, before publishing |

4. Trigger a real exception from the deployed application and open the new issue. It is its own live issue beside the imported history; compare its exception, original path, line and column with source.
5. Run both notifiers side by side for a period you choose and compare counts before removing Rollbar. Reverting the configuration is separate from undoing imported history.
