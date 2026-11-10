# Switching Bugsnag history and capture to Spool

This guide covers a buyer-authorized Bugsnag organization export and a separate SDK cutover. The importer reads Bugsnag API records directly, under `bugsnag-org:<organization.id>`. It does not turn them into a Sentry export. Historical import does not send notifications, create credentials or start live capture. Local synthetic evidence does not qualify a real buyer migration; MIG-004 register row R-5 still needs an authorized web and mobile project, reconciled source data and actual cutover evidence.

## Capture the authorized source

Use the owner's authorized access to the [Bugsnag Data Access API](https://docs.bugsnag.com/api/data-access/). Spool's CLI reads a local export and never requests a Bugsnag token or calls Bugsnag. Keep provider credentials in the capture tool's private environment or credential store. Never put tokens, authentication headers or credential-bearing URLs in the export, shell arguments, reports or source control.

Record the chosen organization, projects, absolute UTC start and end times, error states, release stages and event sampling before exporting. Include fixed and ignored errors if they belong in the intended scope. An error's aggregate event count is not a list of event occurrences. Retrieve the intended full event reports, with their exceptions, app and original stack fields. The [official API examples](https://docs.bugsnag.com/api/data-access/examples/) describe filtered error reads and event data requests; the API reference linked from the Data Access guide specifies the available endpoints and permissions.

Capture the raw organization object with `id` and `name`; list its projects, then each project's errors, events and releases. Preserve the documented field names and values without constructing SDK payloads. Exclude credential fields such as project `api_key` and `upload_api_key`, and record their removal in `omissions`; retain the submitted export bytes exactly. Request `full_reports=true` when listing events on an error, or retrieve each full event with `GET /projects/{project_id}/events/{event_id}`. A default event-list response can be a summary, not a complete report. Retain native `exceptions[].stacktrace` records and their original method, file, line and address fields as exported. Record inaccessible records, deleted data, retention gaps, sampling, absent reports and unsupported artifact exports in `omissions`. The [official Data Access v2 schema](https://api.swaggerhub.com/apis/smartbear-public/bugsnag-data-access-api/2) defines these response shapes. An asynchronous event-data export job is not itself an event report; inspect its actual downloaded format before adapting it, and never put a signed download URL in the bundle.

[Bugsnag pagination](https://developer.smartbear.com/bugsnag/docs/data-access-pagination) uses the response `Link` header. Follow the URL marked `rel="next"` verbatim after checking that it remains on the authorized API origin; pagination differs by resource. Select API v2 explicitly and respect the endpoint page limit: releases permit at most ten records per page. Honor provider rate limits and report a failed or truncated capture. Do not infer completion from page length or construct an offset yourself. Preserve the chain in the bundle: the first `cursor` is `null`, each `nextCursor` equals the next page's `cursor`, and the last `nextCursor` is `null`. Use credential-free next-link values as cursor strings. If the chosen export is a subset, describe its selection and source endpoint in `omissions`; do not label a truncated chain complete. Keep any returned total counts separately with the capture evidence; they are not invented event rows.

## Bundle format

The owner creates a `spool-bugsnag-org-export` version 1 JSON wrapper around those responses. `projects` has `project: null`; `errors`, `events` and `releases` use the Bugsnag project ID in `project`. `organization` is the raw Bugsnag object, and `response` is an array of raw API records. The wrapper is Spool's import format, not a universal Bugsnag export format. An optional project-scoped `stability` collection carries the documented `GET /projects/{project_id}/stability_trend` response object directly as `response` on one page with both cursors null. Keep its `project_id`, `release_stage_name` and `timeline_points`; do not invent an `id` or flatten it into event rows. The report keeps its daily session counts separate from release aggregates and sampled events, with no inferred crash-free rate.

This empty structural example contains no historical events. Replace its organization and collection scope with the authorized capture; do not manufacture records to fill a missing collection.

```json
{
  "format": "spool-bugsnag-org-export",
  "version": 1,
  "organization": { "id": "synthetic-spool-1", "name": "synthetic-spool-1" },
  "window": { "start": "2026-01-01T00:00:00Z", "end": "2026-02-01T00:00:00Z" },
  "collections": [
    { "kind": "projects", "project": null,
      "pages": [{ "cursor": null, "nextCursor": null, "response": [] }] },
    { "kind": "errors", "project": "synthetic-spool-2",
      "pages": [{ "cursor": null, "nextCursor": null, "response": [] }] },
    { "kind": "events", "project": "synthetic-spool-2",
      "pages": [{ "cursor": null, "nextCursor": null, "response": [] }] },
    { "kind": "releases", "project": "synthetic-spool-2",
      "pages": [{ "cursor": null, "nextCursor": null, "response": [] }] }
  ],
  "omissions": ["Empty structural example only; no source history was captured."]
}
```

The complete file is bounded to 2 MiB and 500 source records including the manifest, with at most 100 collections and 100 pages per collection. Every exported project must have error, event and release collections, even when their authorized responses are empty. A rejected oversize export is not a successful full-organization import. Reduce the explicitly declared source window or selection and review the resulting scope. Do not silently split history into overlapping unrelated imports. Protect the file with private permissions, for example `chmod 600 bugsnag-organization.json`, and keep it out of source control. Scrubbed native evidence and privately retained exact originals have different privacy boundaries.

## Review and apply through the owner door

Obtain the current owner session through the installation's existing sign-in flow and place its complete cookie header value in a private environment variable named `SPOOL_OWNER_SESSION`. Do not paste the value into a command or report. Agent, ingest and deploy keys do not authorize an import. The endpoint must be the exact Spool origin: HTTPS outside loopback, no credentials, path, query or fragment. Requests carry the owner's cookie, the exact `Origin` and `X-Import-Source: bugsnag-org:<organization.id>`; redirects are refused.

```sh
node scripts/bugsnag-import.mjs dry-run --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --file ./bugsnag-organization.json

node scripts/bugsnag-import.mjs apply --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --organization synthetic-spool-1 \
  --plan PLAN_ID --fingerprint REVIEWED_FINGERPRINT

node scripts/bugsnag-import.mjs status --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --organization synthetic-spool-1 --plan PLAN_ID

node scripts/bugsnag-import.mjs reconcile --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --organization synthetic-spool-1 --plan PLAN_ID

node scripts/bugsnag-import.mjs undo --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --organization synthetic-spool-1 --plan PLAN_ID
```

Use the real organization ID printed by dry run. Upload sends the exact bytes in SHA-256-checked 64 KiB chunks through the existing owner-session import door. Dry run stores private upload and review custody and writes no native projects, releases, issues or events. Review its source counts, rejections, omissions, unmapped fields and proposed native differences. Apply requires the plan ID and the exact reviewed 64-character fingerprint; it performs up to 100 bounded requests. If interrupted, `resume` is an alias for `apply` and requires the same organization, plan and reviewed fingerprint. It never silently approves a changed plan.

For a newer capture of the same organization, use `dry-run --catchup`, inspect the changes and review the new fingerprint before applying. Status and reconciliation use the saved plan ID. Reconcile the admitted historical subset against source-ID dispositions and native values; explain every rejected or omitted record before cutover. Review source deletion differences explicitly. Keep the capture window, API totals and sampling evidence beside the report: a successful subset reconciliation does not prove vendor-wide completeness.

Undo the newest import first. Undo checks native row fences and stops on conflicting native edits. Inspect the conflict and deliberately resolve it or keep the import; do not bypass the guard. Reversing imported history does not change an application's SDK configuration or move live events back to Bugsnag. Exact originals and upload custody remain private to this installation; event retention and native archive export are not a complete export or erasure of import custody. See [the shared import door boundaries](SENTRY-SWITCHING.md#review-apply-inspect-and-undo).

## Count events and sessions separately

Bugsnag sessions provide a denominator for stability; events are error occurrences. [Bugsnag's session documentation](https://docs.bugsnag.com/platforms/javascript/capturing-sessions/) notes that an error can occur outside a session. An event total, affected-user total, release count or number of imported rows cannot replace `sessions_count`.

Keep exported release stability inputs such as `total_sessions_count` and `unhandled_sessions_count` and their version, stage, time window and semantics as source metadata. If another authorized export exposes `sessions_count`, preserve its documented meaning rather than treating it as an event count. Compare those inputs separately from sampled error and event counts. An omitted or null historical session count means unknown. It must not become zero sessions, inferred sessions, a crash-free percentage or a reconstructed live session stream. Even when a numeric session denominator is exported, it is not equivalent to the sampled imported-event numerator. This importer does not recreate historical sessions or a native release-health dashboard.

## Mapping and losses to review

The preview and reconciliation report are authoritative for the actual bundle. The import journal retains exact authorized source objects privately; that retention does not mean every field becomes native product data.

| Source evidence | Spool behavior and conversion boundary |
| --- | --- |
| Organization and projects | Deterministic Bugsnag-scoped native projects with source lineage; no owner, collaborator account or project credential is created. Organization settings and roles do not become native settings. |
| Errors and triage | Exported error identities become historical issues. `open` maps to open, `fixed` to resolved, and `ignored` or `snoozed` to suppressed. Snooze expiry, assignment, vendor grouping, workflow rules and source resolution semantics are not reproduced. Unsupported states or malformed parents are reported. |
| Events and stacks | The admitted exported subset becomes scrubbed historical exception evidence. Original exported native stack records remain in private source custody. A readable exported location is evidence of the source stack, not proof that Spool decoded a native symbol file. Missing coordinates, unsupported fields and unavailable full reports remain explicit losses. |
| App and releases | App version, stage and build map to release `version@stage+build`, with stage as environment and build as the native build identity. Absent build maps to `unspecified`. Missing or ambiguous required identities are reported; no deployment or latest build is guessed. Compare the actual mapped identity to the SDK configuration before switching. |
| Stability | Exported `total_sessions_count` and `unhandled_sessions_count` remain source inputs for separate reconciliation. Missing historical sessions remain unknown; no sessions or crash-free rates are manufactured. |
| Collaborators and integrations | Authorized records or references may remain private source evidence, with unmapped dispositions. Users, teams, memberships, alert rules, webhooks, notification destinations and external credentials are not activated. |
| Source maps and symbols | Exported artifact references do not contain the corresponding artifact bytes. A reference does not recover a map, dSYM, ProGuard mapping, binary or NDK symbol file. Retain matching artifacts from the original build separately. |
| Other event data | User, request, device, custom metadata, thread details, breadcrumbs and secondary exceptions may exceed the native evidence model; inspect per-record unmapped fields. Exact private originals are broader than the scrubbed issue packet. |
| History and totals | Sampling, provider retention, inaccessible records and unsupported collections stay declared. Native counts describe admitted exported occurrences, not the aggregate vendor counter. Import is inert and creates no live session, alert delivery or SDK capture. |

## Web capture and source-map CI

Bugsnag's notifier protocol is not a Spool ingest protocol. Replace the Bugsnag web notifier with the corresponding unmodified Sentry SDK supported by Spool, such as `@sentry/browser` or `@sentry/node`, and configure its Spool project DSN. Replace manual notify calls, middleware and application hooks with the corresponding Sentry APIs. Do not point a Bugsnag API key or its `endpoints` option at Spool. Follow the [Sentry JavaScript setup](https://docs.sentry.io/platforms/javascript/) and [Spool's supported intake and runtime qualification](SENTRY-SWITCHING.md#runtime-qualification).

Carry the existing app version into an explicit Sentry `release`, the Bugsnag release stage into `environment`, and the build identity into `dist`. The historical importer names releases `version@stage+build` to preserve separate stage and build identities; match that name when live events should join the imported release. An absent exported build uses `unspecified`. Keep a written mapping if a release must be renamed to satisfy Spool's release rules; use that same release and build everywhere in CI and SDK initialization. Recreate intended stage filters and privacy scrubbing deliberately. A renamed option does not copy Bugsnag callbacks, plugins or workflow behavior. See the [Bugsnag JavaScript configuration reference](https://docs.bugsnag.com/platforms/javascript/configuration-options/) for the old settings.

Before publishing a minified build, register that exact release and upload its matching JavaScript maps with a Spool project deploy key using [Spool's source-map CLI or Vite plugin](SENTRY-SWITCHING.md#register-upload-then-change-the-dsn). Replace the Bugsnag map-upload step with this upload; do not reuse the Bugsnag token. Keep deploy grants in CI secrets and use the documented environment-variable-name option. Keep browser origins exact and preserve the same release, build and debug identity in uploaded maps and captured events. Do not mix map injectors on one bundle.

Trigger a real exception in the deployed web build. Verify its project, version, stage, build and original path, line and column in Spool; a successful SDK flush alone does not prove admission. Record the first live event and the cutover time separately from imported history. Retain the previous deployment configuration for rollback until that evidence is reviewed.

## Mobile SDK and native symbol cutover

Replace the mobile Bugsnag SDK with the corresponding unmodified Sentry SDK and set the Spool project DSN: [Apple setup](https://docs.sentry.io/platforms/apple/), [Android setup](https://docs.sentry.io/platforms/android/) or [React Native setup](https://docs.sentry.io/platforms/react-native/). Replace notify calls, startup hooks and handled-exception capture as required by that SDK. This is a migration recipe, not a claim that every native crash transport or mobile SDK has been qualified against Spool. Check the [current supported-language boundaries](SUPPORTED-LANGUAGES.md) and prove a real device event before treating a mobile switch as complete.

Preserve app version, stage and build separately: carry Bugsnag `appVersion` to the explicit Sentry release mapping, `releaseStage` to environment, and Apple `bundleVersion` or Android `versionCode` to the build mapping used for `dist`. Keep native binary build UUIDs and corresponding symbols with the original build; they are not interchangeable with an application version. Review [Bugsnag Apple settings](https://docs.bugsnag.com/platforms/ios/configuration-options/) and [Android settings](https://docs.bugsnag.com/platforms/android/configuration-options/) when inventorying these values.

For Android Java frames, Spool accepts a bounded **ProGuard or R8 mapping** for one exact registered release and build. In CI, replace the Bugsnag ProGuard upload step with these Spool requests, using a deploy key for that project:

1. Register the release and build with `POST /api/projects/:project/releases`, JSON `{ "name": "<release>", "build": "<build>" }`.
2. Upload the matching text with `POST /api/projects/:project/native-symbols`, JSON `{ "release": "<release>", "build": "<build>", "format": "proguard", "mapping": "<mapping file text>" }`.
3. Publish that same build with the Sentry SDK's explicit release and dist. Java capture frames need the obfuscated class in `module`, method in `function` and a line number; a column is optional. Verify an actual mapped exception in the issue packet.

Both routes accept the exact project's deploy bearer; the owner's same-origin session also authorizes them. The map is immutable for the release and build: identical bytes are idempotent, and replacement content is refused with 409. Upload before capture; importing an old symbol reference does not upload a map. The mapping is limited to 1 MiB, the JSON request to 2 MiB, 30,000 lines, 5,000 classes, 20,000 members and 4,096 characters per line.

An upload step can read the credential directly from the CI environment without putting its value in shell arguments. Set `SPOOL_ENDPOINT`, `SPOOL_PROJECT`, `SPOOL_RELEASE`, `SPOOL_BUILD`, `SPOOL_MAPPING_FILE` and the secret `SPOOL_DEPLOY_KEY` in CI, then run:

```sh
node --input-type=module <<'JS'
import { readFile } from 'node:fs/promises';
const endpoint = new URL(process.env.SPOOL_ENDPOINT);
if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
    endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw new Error('HTTPS origin required');
const project = encodeURIComponent(process.env.SPOOL_PROJECT);
const release = process.env.SPOOL_RELEASE, build = process.env.SPOOL_BUILD;
const key = process.env.SPOOL_DEPLOY_KEY;
if (!key || !release || !build || !process.env.SPOOL_PROJECT) throw new Error('CI configuration required');
async function send(path, body) {
  const response = await fetch(`${endpoint.origin}/api/projects/${project}/${path}`, {
    method: 'POST', redirect: 'error',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Symbol CI refused (HTTP ${response.status})`);
}
const mapping = await readFile(process.env.SPOOL_MAPPING_FILE, 'utf8');
await send('releases', { name: release, build });
await send('native-symbols', { release, build, format: 'proguard', mapping });
console.log('Release registered and mapping uploaded');
JS
```

Original filenames require R8 source-file metadata such as `# {"id":"sourceFile","fileName":"MainActivity.kt"}` beneath the class mapping. An original line requires unambiguous explicit line ranges. Ambiguous inlining and absent source metadata remain named gaps; Spool does not invent an original filename or line. Preserve the full build mapping and app identifiers, as the [Bugsnag ProGuard upload guidance](https://docs.bugsnag.com/build-integrations/bugsnag-cli/upload-android-proguard/) also requires for matching.

### Apple dSYM and Android NDK uploads: stored, not yet decoded

Spool accepts the two Bugsnag native upload shapes on the same route, `POST /api/projects/:project/native-symbols`, as `multipart/form-data` with the project's deploy bearer (the owner's same-origin session also authorizes it). No release registration is needed: Bugsnag matches these files by build identity, and so does Spool.

| Bugsnag upload | Spool field | Stored under |
| --- | --- | --- |
| `bugsnag-cli upload dsym` / the dSYM upload API | `dsym`: the zipped `.dSYM` bundle (`Contents/Resources/DWARF/<binary>`) | each Mach-O UUID in it (a universal binary gives one per architecture) |
| `bugsnag-cli upload android-ndk` | `soSymbolFile`: the unstripped `.so`, with `sharedObjectName` and optional `arch` | its GNU build id |

`apiKey` and `projectRoot` are accepted and ignored (the deploy bearer authenticates; build-machine paths are not stored). Send exactly one file field. The route refuses with the real reason: not a ZIP archive, no DWARF file in the bundle, not a Mach-O dSYM (an app binary is refused), a shared object without a GNU build id, a stripped library, an `arch` that does not match the ELF machine. Identical bytes for a UUID or build id replay as 200, different bytes for the same identity are refused with 409, and files count against the project's artifact storage cap (429). Each stored file is limited to 786,432 bytes (413 above that); the request is limited to 8 MiB. Owners list what is stored with `GET /api/projects/:project/native-debug-files`.

**Spool does not yet decode these files.** It reads only their identity (Mach-O UUID, ELF build id, architecture). It has no Mach-O/DWARF or ELF symbol reader, and its event frame model keeps no instruction address or module, so a native crash frame is not resolved through a stored file, and no original frame is ever claimed from one. The upload response says `symbolication: unsupported`, and a Bugsnag import dry run reports each project's Mach-O/ELF frames under `nativeStacks` and as a `native_frames` conversion loss. Treat the upload as keeping your debug files with the right project and identity for when decoding exists, not as native symbolication.

For the historical acceptance sample, compare the original exported native frames to the private original and the mapped issue evidence. Record which frames were already readable at source, which coordinates survived, and which remain unavailable. For new Android events, prove the original file and line from the matching uploaded map on a real build. A retained old native stack does not prove a new mobile crash can be decoded. Apple and NDK uploads are stored but native frames are not symbolicated, so that cutover remains incomplete; a synthetic Android pipeline check does not qualify a real buyer device or complete register row R-5.
