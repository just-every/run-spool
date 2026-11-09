# Switching from Bugsnag to Spool

Spool imports a Bugsnag (SmartBear) organization's history through the same owner import door as the Sentry importer: a reviewed plan that writes nothing, an apply that needs the reviewed fingerprint and resumes, a reconcile, and an undo that never overwrites a native edit. This is qualified with synthetic exports only. A real buyer's own export and cutover are register row R-5.

## What the export is

The importer reads one JSON file, `spool-bugsnag-org-export`, holding the pages your own authorized Bugsnag Data Access API calls returned, unchanged. Spool never calls Bugsnag and never holds a Bugsnag token; it does not import a project's notifier API key. Each collection names its kind and project, and each page keeps its cursor chain and the response exactly as Bugsnag answered (a list, or for the stability trend one object), so a missing page is refused rather than imported short.

| Collection | Bugsnag response it holds | What Spool does |
| --- | --- | --- |
| `projects` | organization projects | native project (name, creation time); type and release stages kept in the private journal |
| `releases` | project releases, one row per release stage | one native release per app version, ordered by `release_time`; the build is the version code or bundle version |
| `errors` | project errors | native issues; open, fixed and ignored map directly, snoozed becomes suppressed, and a snooze rule or assignee is named as not imported |
| `events` | project events (snake_case fields as the Data Access API returns them, or the camelCase notifier fields such as `errorClass`, `bundleVersion` and `frameAddress`; line and column numbers may be digit strings) | historical events with exception locations, native frames, breadcrumb labels, app version, release stage and OS name; the affected user, request, device identifiers and metadata stay out |
| `stability` | stability trend, the response object (`timeline_points`) or a list of them | session denominators for the review only |
| `collaborators`, `integrations`, `symbols` | roster, integrations, symbol references | named as not imported; see below |

Input is limited to 2 MiB and 500 records, the same as the Sentry importer. Event bodies are usually a sample of an error's events: the review shows each error's source total beside the events actually imported.

## Review and reconcile

```sh
node scripts/bugsnag-import.mjs dry-run --endpoint https://spool.example --session-env SPOOL_OWNER_SESSION --file bugsnag-fixture-org.json
node scripts/bugsnag-import.mjs apply --endpoint https://spool.example --session-env SPOOL_OWNER_SESSION --organization fixture-org --plan PLAN --fingerprint FINGERPRINT
node scripts/bugsnag-import.mjs reconcile --endpoint https://spool.example --session-env SPOOL_OWNER_SESSION --organization fixture-org --plan PLAN
```

The plan, status and reconcile answers carry a `vendor` section:

* `reconciliation`: errors, and events as three separate numbers: the total Bugsnag counted, the rows the export holds and the rows Spool imported. Each error is `reconciled`, `sampled` (the export holds fewer events than Bugsnag counted, by a stated number), `mismatch` or `rejected`.
* `stability`: per release and release stage, the event counts and the session counts side by side, never combined. The crash-free rate is the share of sessions without an unhandled crash, shown only when the export holds a positive session count that is consistent. When the export lacks historical sessions, or says it omits them, the rate is `null` with the reason `historical_sessions_missing`: Spool never fabricates a rate from events or from zero. Spool stores no imported sessions, and imported history never proves current health.
* `unmigratable`: each collection that is named but not imported, with its reason.
* `cutover`: for each project, how its capture and symbol upload move.

## Cutover

Keep the Bugsnag notifier running until Spool shows live errors, so you can roll back by leaving it in place. Imported history sends no alerts, grants no access and creates no keys.

**Web.** Replace the Bugsnag browser notifier with [`@just-every/spool`](../packages/sdk/README.md) or keep a Sentry browser SDK and change only its DSN to the project's Spool DSN. Set the release to the same app version string your build uploads symbols under. Replace the Bugsnag source-map upload step in CI with Spool's:

```sh
npx spool-sourcemaps --endpoint https://spool.example --project web-app --release web@2.0.0 --build b1 --key-env SPOOL_DEPLOY_KEY dist/app.js
```

A project deploy key can only register releases and upload maps. Register the first Spool release under a new name: an imported release keeps the build it had in Bugsnag (none, for a web project), and one release has one build.

**Mobile.** Bugsnag's mobile notifiers cannot send to Spool. Use Sentry's iOS or Android SDK with the project's Spool DSN, with the release set to your Bugsnag app version and the dist set to its version code or bundle version: the capture then joins the imported release instead of creating a second one. Its first live events are new issues beside the imported history.

**Native symbols.** Replace Bugsnag's dSYM, ProGuard/R8, NDK and Dart symbol upload step in CI with the unmodified `sentry-cli debug-files upload`, pointed at Spool (`SENTRY_URL`, `SENTRY_ORG`, `SENTRY_PROJECT` and the project's deploy key as `SENTRY_AUTH_TOKEN`). Spool stores each file under the project and its debug ID, and the review names that command for every native symbol reference. Spool does not yet symbolicate with them (SDK-002): imported native events show the original stack exactly as the notifier sent it, with image, addresses and the symbol Bugsnag resolved, and are not symbolicated again.

## Undo and erasure

Undo removes the imported graph and stops, naming the records, if any imported issue was edited in Spool. Erasing an imported project withdraws the private source custody of the export that named it, with its uploaded bytes and plan history.
