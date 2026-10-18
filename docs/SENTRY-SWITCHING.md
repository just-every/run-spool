# Switching exception intake to Spool

Spool accepts bounded JavaScript, Python and Go exception evidence. This is not a claim of Sentry feature parity or a completed customer migration. Organization import is qualified with synthetic fixtures only. An owner-supplied real export must be reconciled before any Sentry-alternative claim.

For JavaScript applications starting without Sentry, Spool's own SDK, [`@just-every/spool`](../packages/sdk/README.md), is the main way to send errors. This guide is for applications that already run a Sentry SDK.

## What moves

The Sentry error envelope and legacy store endpoints convert exceptions into Spool's existing admission path: project key, exact browser origin, registered release/build, scrubbing, duplicate identity, grouping, bounded storage, diagnosis and alerts. Unsupported items are counted under a fixed taxonomy and discarded. No unsupported payloads are retained. Text feedback from modern feedback events/items and legacy user_report is retained separately under [Text feedback](FEEDBACK.md), with exact occurrence association, owner review and withdrawal. Contact, screenshots and other attachments are excluded. Sessions, tracing/spans, attachments, client reports, replay, profiles, check-ins, logs and metrics do not become product data.

The full verify runs unmodified `@sentry/browser` and `@sentry/node` 11.6.0 with their default integrations. The same program and SDK configuration use a local reference collector DSN and then a Spool DSN; only the DSN changes. Browser capture checks mapped source coordinates at 1440 and 390, and Node capture awaits flush. Exact-head results belong in the completion evidence; package pins alone do not prove runtime behavior. These programs make no Sentry account or service calls.

Transport limits are 256 KiB compressed gzip, 1 MiB expanded/uncompressed, 100 envelope items and 8 KiB per header. Item lengths are bytes; zero-length and binary unsupported items are valid. The entire framing is checked before any event is admitted. Supported encodings are identity and gzip. Query auth, `X-Sentry-Auth`, Bearer auth if supplied, and envelope DSN credentials must agree. The public key grants ingest only and a numeric DSN project alias is bound to one native project. Invalid, revoked or wrong-project keys and unauthorized browser origins cannot admit events. Ingest keys remain valid until revoked.

The outermost reported exception supplies the stack. Frames are reversed from Sentry's oldest-first order and columns are converted from one-based to zero-based once. Spool requires at least one valid file/line frame; JavaScript also requires column, while Python/Go may omit it. Message-only captures and frames without coordinates are rejected explicitly. Request/user/context/module/local-variable data is not persisted; selected exception fields and breadcrumb labels pass the existing scrubber. Debug metadata is matched against raw frame paths before query strings and private local paths are removed.

## Register, upload, then change the DSN

1. Create/select a project in Spool. Grant the application's exact origin (scheme, host and port). Obtain a project ingest DSN from the owner's project/key controls. Keep the former DSN in deployment configuration for rollback.
2. Register the exact SDK `release` and `dist` before capture. Common names such as `web@1.2.0+commit` are accepted without rewriting. A missing `dist` has the explicit build identity `sentry-no-dist`, which must be registered. Missing `release` is rejected with `missing_release_register_required`; a DSN alone cannot invent deployment identity. Spool never infers the latest release. One release currently has one build; use distinct release names for distinct distributions.
3. Create a project **deploy** key. It can only POST release registration and source maps to its project. It cannot read issues, ingest, change triage/rules/origins/settings/grants, create projects, export/import, or access another project. Put it in a CI environment variable, not application source or browser configuration.
4. For JavaScript, build with flat Source Map V3 and source contents, then inject/upload before publishing application bytes. The Spool CLI uses the key by environment **name** and prints only upload counts:

   ```sh
   npx spool-sourcemaps --endpoint https://spool.example --project web \
     --release web@1.2.0 --build build-42 --key-env SPOOL_DEPLOY_KEY dist/app.js
   ```

   Each bundle requires an adjacent `.map`. This injects the standard Sentry debug registration after the bundle's directive prologue, preserves shebangs and strict/sloppy execution, and adjusts generated line/column mappings with matching `debug_id` metadata. Existing matching identities are reused, identical API retries are idempotent, and conflicting map content or release/build identities reject. Up to twenty flat maps of 256 KiB per project are supported; indexed maps and unbounded artifact bundles are not.

   The CLI and the Rollup/Vite build plugin ship in Spool's SDK package, `@just-every/spool` (`npm install --save-dev @just-every/spool`). The plugin is server-side CI tooling:

   ```js
   import { spoolSourceMaps } from '@just-every/spool/vite';
   export default {
     build: { sourcemap: true },
     plugins: [spoolSourceMaps({ endpoint: 'https://spool.example', project: 'web',
       release: 'web@1.2.0', build: 'build-42', keyEnv: 'SPOOL_DEPLOY_KEY' })],
   };
   ```

   A failed registration or upload fails the build. The deploy secret is never injected. The CLI/plugin are Spool tooling; they do not implement Sentry's artifact-bundle upload API. Do not mix injectors on the same bundle.
5. Change only the DSN in the existing SDK initialization. Preserve your release, dist, environment and default integrations:

   ```js
   Sentry.init({ dsn: deploymentDsn, release: 'web@1.2.0', dist: 'build-42' });
   ```

6. Trigger a real exception from the deployed/minified app on its own origin. Open the Spool issue, inspect its original path/line/column and compare it to source. Node applications must await `Sentry.flush()` before exiting. An SDK flush confirms transport handling, not acceptance; verify the owner issue packet and outcomes. Release rejections show a reason and Register link in Spool. Registering does not retroactively admit a dropped event; reproduce an actual exception after registration.

Keep the SDK's former DSN available for reversal. Reverting configuration is separate from undoing imported history and does not move events captured after the switch back to Sentry.

## Export format and scope

There is no universal Sentry organization JSON export assumed by this importer. The input is an **owner-generated** `spool-sentry-org-export` version 1 bundle of exact paginated API response objects. The local file holds organization ID/slug/region (`us`, `de`, or `self-hosted`), the requested start/end window, declared omissions, and collections for projects, releases, issues and selected event details. All selected pages must form a cursor chain ending in `nextCursor: null`.

An owner with appropriate Sentry read permissions generates it from the official APIs:

- [List organization projects](https://docs.sentry.io/api/organizations/list-an-organizations-projects/).
- [List organization releases](https://docs.sentry.io/api/releases/list-an-organizations-releases/).
- [List project issues](https://docs.sentry.io/api/events/list-a-projects-issues/). Explicitly request all intended states; the default unresolved query is not all history. Follow every pagination cursor in the intended time window.
- [Retrieve event details](https://docs.sentry.io/api/events/retrieve-an-event-for-a-project/). Supply the intended issue events; an issue summary's total count is not an event export. Record any sampling, inaccessible/deleted events, retention gaps and partial windows under `omissions`.

No token is requested by Spool's importer and no provider is called. Owner-generated bundles must not contain authentication headers, token fields or credential-bearing URLs. Base import-kit rejects these structured credentials. Other confidential source values may remain in exact private originals; restrict the export file accordingly.

```json
{
  "format": "spool-sentry-org-export",
  "version": 1,
  "organization": { "id": "123", "slug": "example", "region": "us" },
  "window": { "start": "2026-01-01T00:00:00Z", "end": "2026-02-01T00:00:00Z" },
  "collections": [
    { "kind": "projects", "project": null,
      "pages": [{ "cursor": null, "nextCursor": null, "response": [] }] },
    { "kind": "releases", "project": null,
      "pages": [{ "cursor": null, "nextCursor": null, "response": [] }] },
    { "kind": "issues", "project": "web",
      "pages": [{ "cursor": null, "nextCursor": null, "response": [] }] },
    { "kind": "events", "project": "web",
      "pages": [{ "cursor": null, "nextCursor": null, "response": [] }] }
  ],
  "omissions": ["Describe selected events, omitted features and source retention here."]
}
```

Preserve API objects verbatim in `response`. Projects need `id`, `slug`, `name`, `dateCreated`. Releases need `version`, `dateCreated`, `projects[].slug`. Issues need `id`, `title`, `status`, `firstSeen`, `lastSeen`. Event details need `eventID`, `groupID`, `dateCreated`/`dateReceived`, release version, and `entries` with exception data. These use the API's `lineNo`, `colNo`, `absPath` fields, not SDK wire fields. Raw stacks are preferred. If only a symbolicated stack was exported, the native diagnostic explicitly records that limitation. Source maps are not recovered from those stacks; upload available original deployment maps separately.

The importer currently bounds a file to 2 MiB, 500 source records and 100 collections/pages per collection. Unsupported collections and fields remain explicitly accounted for as omissions; invalid supported records are shown as rejections. Duplicates with identical source identities collapse; conflicting duplicates fail. Review every rejection before applying.

Imported projects receive deterministic namespaced IDs and no credentials. Vendor issue IDs remain in import provenance; imported vendor groups do not claim equivalence to Spool's generated-frame grouping. Counts represent the exported/admitted historical event subset. History is inert: no alert, webhook, email, ingest grant, session or live admission is created. Native issue state can be triaged after import. Existing unrelated projects remain unchanged.

## Review, apply, inspect and undo

The authenticated owner API is the public boundary for import. Agent, ingest and deploy keys are refused. Set an owner session cookie in a local environment variable through your existing owner session; do not paste it in shell commands or reports.

```sh
node scripts/sentry-import.mjs dry-run --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --file ./organization.json --operation migration-2026-10-10

node scripts/sentry-import.mjs apply --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --file ./organization.json \
  --fingerprint REVIEWED_FINGERPRINT --operation migration-2026-10-10

node scripts/sentry-import.mjs read --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --organization example --job JOB_ID

node scripts/sentry-import.mjs resume --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --organization example --job JOB_ID

node scripts/sentry-import.mjs undo --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --organization example --job JOB_ID
```

Dry run shows the exact scrubbed target rows, rejected records and declared omissions. It creates no job or target records. Apply requires the exact reviewed fingerprint and the same operation key used for dry run. If dry run omits the key, use the generated `operationKey` returned with the plan. Each new operation gives historical events fresh occurrence identities; retries keep the reviewed identities. Repeating that operation resumes the same journal; it cannot silently substitute new source bytes. Apply/undo check the current owner/session in the same SQL transaction as native rows and Base journal writes. Reopening Spool does not lose the checkpoint. Undo runs in reverse dependency order. Exact full-row fences catch native edits even when a revision number was not advanced; a conflict stops reversal and preserves edits. Restore the conflicting row deliberately or keep the import; never bypass the guard. Undo restores exact replaced before-images and removes new rows only while their current evidence still matches.

Retained originals are private owner-only evidence, separate from scrubbed issue packets. Download them to a new access-controlled file with `originals --output FILE`; the CLI refuses overwriting an existing file. Project event retention does not erase that private import journal. Native owner archives include scrubbed historical rows and source identity metadata but deliberately exclude the Base import job/original journal. Download exact originals separately before moving installations; original-job resume and undo remain on the installation that owns the journal. Treat both archives and original downloads as confidential; deleting a native event is not erasure of its original export. This release has no automatic source-journal expiry.

Source references: [envelope framing](https://develop.sentry.dev/sdk/foundations/envelopes/), [transport authentication](https://develop.sentry.dev/sdk/foundations/transport/authentication/), [11.6.0 SDK URL construction](https://github.com/getsentry/sentry-javascript/blob/11.6.0/packages/core/src/api.ts), [11.6.0 debug metadata](https://github.com/getsentry/sentry-javascript/blob/11.6.0/packages/core/src/utils/prepareEvent.ts).

The exact prior-inventory Base JSONL formats (before and immediately after occurrence identities) uses the same 16 MiB compatibility bound as native v1/v2 files. Its original integrity is verified before normalization, and source identity, epoch and permanent erasure journal are retained. Current complete Base archives continue to stream without that whole-file compatibility bound.

See [supported languages](SUPPORTED-LANGUAGES.md) for the exact native/Sentry Python and Go grammars, limits, repository path mapping, privacy and unavailable symbolication.

## Optional Business import door

In Settings, open the **Business imports** row to enable the import door. It is
**off by default**. It uses the installation's existing owner-claim issuer,
installation ID, app origin and public key ring; no second trust configuration
or owner identity is created. Without those bindings (`RER_OWNER_CLAIM_*`) the
row says trust configuration is required. `rer deploy` does not declare them for
a self-hosted installation, so there the door stays unavailable; use the
owner-session importer above. Disabling the door immediately stops Business
requests. **Revoke key** permanently revokes a signing key for this door, including
otherwise valid unexpired grants; rotate to a new key ID to restore access.

Spool vendors Base's optional import-kit door from `rer-v0.2.33`. Its
[grant and HTTP contract](../src/modules/import-kit/src/door/README.md) covers
`POST /api/rer/import/{uploads,plan,apply,status,reconcile,undo}`. The upload is
the same owner-generated Sentry organization bundle documented above, chunked
with SHA-256 checks. The parser retains Spool's 2 MiB / 500-record limits and
uses the existing native Sentry mapping. Planning retains private upload/review
custody and makes no native project, release, issue or event writes. Apply needs
the exact reviewed fingerprint and the signed owner's approval record.

Reconciliation checks the exported/admitted historical subset against the bundle
manifest and its omissions, with source-ID dispositions and server-derived native
counts, revisions and values. It makes no completeness claim against Sentry's
vendor totals. Imports stay inert: no credentials or alert deliveries are created.

The same settings row lists each real import with **approved via Business by
<owner> at <time>, fingerprint <x>**. Its owner-session Undo remains available
with Business disabled or its grant key revoked. Undo protects native edits and
reverses the newest snapshot first. Original bytes remain private to this Spool
installation. Project erasure also withdraws affected door upload/plan snapshots
alongside import-kit originals; other native projects remain intact.
