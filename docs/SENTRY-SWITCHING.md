# Switching exception intake to Spool

Spool accepts bounded JavaScript, Python and Go exception evidence. This is not a claim of Sentry feature parity or a completed customer migration. Organization import is qualified with synthetic fixtures only. An owner-supplied real export must be reconciled before any Sentry-alternative claim.

For JavaScript applications starting without Sentry, Spool's own SDK, [`@just-every/spool`](../packages/sdk/README.md), is the main way to send errors. This guide is for applications that already run a Sentry SDK.

## What moves

The Sentry error envelope and legacy store endpoints convert exceptions into Spool's existing admission path: project key, exact browser origin, registered release/build, scrubbing, duplicate identity, grouping, bounded storage, diagnosis and alerts. Unsupported items are counted under a fixed taxonomy and discarded. No unsupported payloads are retained. Text feedback from modern feedback events/items and legacy user_report is retained separately under [Text feedback](FEEDBACK.md), with exact occurrence association, owner review and withdrawal. Contact, screenshots and other attachments are excluded. Sessions, tracing/spans, attachments, client reports, replay, profiles, check-ins, logs and metrics do not become product data.

The full verify runs unmodified `@sentry/browser` and `@sentry/node` 11.6.0 with their default integrations, and one parallel job per server runtime runs an unmodified Sentry SDK program (see [Runtime qualification](#runtime-qualification)). The same program and SDK configuration use a local reference collector DSN and then a Spool DSN; only the DSN changes. Browser capture checks mapped source coordinates at 1440 and 390, and Node capture awaits flush. Exact-head results belong in the completion evidence; package pins alone do not prove runtime behavior. These programs make no Sentry account or service calls.

Transport limits are 256 KiB compressed (gzip or deflate), 1 MiB expanded/uncompressed, 100 envelope items and 8 KiB per header. Item lengths are bytes; zero-length and binary unsupported items are valid. The entire framing is checked before any event is admitted. Supported encodings are identity, gzip and deflate. Unsupported encodings return 415 with the encoding named; header/query-authenticated refusals are counted as `unsupported_content_encoding`. Within a correctly framed envelope, malformed event JSON is counted and returned as `invalid_item`; valid companion errors are still admitted. Malformed envelope framing and whole-request size failures still reject the whole request. Brotli and zstd remain unsupported. Query auth, `X-Sentry-Auth`, Bearer auth if supplied, and envelope DSN credentials must agree; the protocol version (`sentry_version`) may be 5 to 7, since the Elixir SDK still sends 5. The public key grants ingest only and a numeric DSN project alias is bound to one native project. Invalid, revoked or wrong-project keys and unauthorized browser origins cannot admit events. Ingest keys remain valid until revoked.

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

## Runtime qualification

Each runtime below runs one real, unmodified Sentry SDK program in Verify: first against a plain reference collector, which records every envelope item the SDK itself produced, then against Spool with only the DSN changed. Both runs set the standard `SENTRY_RELEASE` and `SENTRY_DIST` variables. Each program starts a transaction with a span, writes a structured log, adds an attachment, tracks a session where its SDK offers one, captures a handled exception (the SDK-012 server fixtures also exercise cause chains where supported), a message that it discards, and (the eight server programs except Rust) a cron check-in, flushes, crashes through the SDK's own unhandled-error path, and is started again. The journey then reconciles Spool's public API with what the SDK sent: every error is a persisted occurrence (the restarted process groups into the same issue), the crash is stored as unhandled, the release and dist equal what the SDK sent and the release is created automatically, the handled issue opens in the app at 1440 and 390, and the project outcomes equal the SDK's own item counts (accepted errors, `feedback_accepted`, `client_discarded:<category>:<reason>`, and `sentry_unsupported_<category>` for sessions, traces, logs, attachments and check-ins that do not yet become product data). A wrong key or an unreachable intake never fails the application.

| Runtime | SDK run | Unhandled path | Sessions | Also sent |
| --- | --- | --- | --- | --- |
| Node.js | @sentry/node 11.6.0 | default uncaught-exception integration | default session tracking | feedback API, client report, spans and logs; restart grouping; no-release/inferred-SHA intake and release-less counts/alerts |
| Python | sentry-sdk 2.72.0 | `excepthook` | application mode (`start_session`, `end_session`) | client report; no feedback API in this SDK |
| Go | sentry-go v0.50.0 | recovered panic, level `fatal` (`RecoverWithContext` sets no handled flag, `client.go:805`) | none: the module has no session API | client report |
| Java | io.sentry:sentry 8.61.0 | `UncaughtExceptionHandler` | `Sentry.startSession`, `Sentry.endSession` (release from `SENTRY_RELEASE` with external configuration on) | feedback attached to its issue; client report |
| Ruby | sentry-ruby 7.1.0 | Rack `CaptureExceptions` (Ruby has no global crash hook) | request mode, through the Rack middleware | no client report from this short process: `Sentry.close` forces the report flush (`lib/sentry-ruby.rb:303`) before it stops the worker (`:312`) that records the `before_send` discard (`lib/sentry/client.rb:252`); sending synchronously would deliver it, but then a refused or unreachable intake raises out of `Sentry.close` (`lib/sentry/transport.rb:188`) and fails the application |
| PHP | sentry/sentry 4.34.0 | the registered error and exception handlers | none: no session item type (`src/EventType.php`) | no client report: a `before_send` drop is only logged (`src/Client.php:354-366`), and the SDK never calls its `ClientReportAggregator` |
| .NET | Sentry 6.12.1 | `AppDomain` unhandled exception | `AutoSessionTracking` | feedback attached to its issue, client report |
| Rust | sentry 0.49.3 | panic integration | `auto_session_tracking` | client report; no check-in is sent (not exercised); native-style frames without file and line (SDK-002 symbolication) |
| Elixir | sentry 14.0.0, tracing through its OpenTelemetry packages | a crashing process, reported by the SDK's logger handler; the program attaches its cart in that process, since sentry 14.0.0 loses the crash report when the crashing process's caller holds an attachment (the handler passes the caller's context as capture options, `lib/sentry/logger_utils.ex:30`, which `lib/sentry/event.ex:196` refuses, and swallows the error, `lib/sentry/logger_handler.ex:475`) | none: no session option (`lib/sentry/config.ex`) | client report for a sampled-out message, sent on the SDK's 30-second timer (`lib/sentry/client_report/sender.ex:23`); a `before_send` exclusion records none (`lib/sentry/client.ex:102`); no exception cause in Elixir |

Real runs found and fixed four intake gaps, now covered by these journeys: sentry-go sends `exception` as a bare array, sentry-go sends client-report timestamps as RFC 3339 text, sentry-ruby labels its error events `type: "event"`, and sentry-elixir sends protocol version 5 in `X-Sentry-Auth`.

The Python journey also covers the inherited release and fidelity checks: an event with no release (no environment variable, not a git checkout) is accepted, creates no release and raises one new-issue alert that names no release; the SDK infers the release from a git checkout and Spool creates it; with both in one project the issue total keeps the release-less event while the release-scoped figures count it apart (the Releases screen and `noReleaseEvents`, `!has:release`), and the Releases and Alerts screens are read at 1440 and 390; an `ExceptionGroup` keeps every member; locals keep ordinary values and redact `password` and `api_key`; and a real Django request over WSGI keeps its URL, method and headers with the cookie removed and the secret query value masked. The Java journey sends a `Caused by` chain with a suppressed exception and keeps all three, each with its relation.

Browser JavaScript uses unmodified @sentry/browser 11.6.0 at 1440 and 390 with default integrations, sessions, tracing, logs, attachments, replay and the actual feedback widget. The same program runs against the reference collector and Spool; every item reconciles, handled and automatic failures group across reloads without duplicate occurrences, and the build-plugin map resolves the original line. Actual window hiding emits the SDK's client report, whose bounded reason and exact quantity are read from capture receipts before reloading. Unsupported telemetry is counted; its storage remains SDK-025. Node's matching qualification is `tests/sdk-runtimes.mjs node`; the browser journey is `tests/sentry-sdk.mjs`.

Electron now passes Q1–Q7 in push Verify `runtime (electron)`: a tiny main/renderer app is packaged with @electron/packager 20.3.0 into an unpacked Electron 45.0.0 directory and run under Linux Xvfb with @sentry/electron 8.3.0. Both processes capture handled and automatic unhandled errors; flush/relaunch keeps both handled groups without duplicate occurrences. Sessions, transactions, logs, attachments, renderer replay, feedback and SDK client reports all reconcile with the reference collector. Its public issue and diagnostics views are read at 1440 and 390. The same supported online `makeElectronTransport` is used for both collectors; `SentryMinidump` is explicitly disabled. Native minidumps, abnormal-session recovery and durable offline delivery are not claimed here. No Electron app runs on macOS.

Not run here: Unity, iOS, Android, React Native, Flutter and Kotlin Multiplatform (SDK-014 to SDK-019). The device runtimes need simulators, emulators or devices, and Unity a licence.

## Guided setup

`npx -p @just-every/spool spool-setup --dsn <project DSN> --dir <app>` detects the framework from the app's own manifests, prints the change as a patch that `git apply` accepts, and writes nothing. Add `--apply` to write exactly that patch, `--install` to run the package install (`--python` and `--spool-package` choose the interpreter and the Spool package spec), and `--no-test-event` to skip the test event. The test event goes through Spool's public intake before anything is printed as a patch or written, and counts as accepted only when the DSN's own host answers with Spool's receipt for it; a refusal, a redirect (never followed) or a host that is not Spool stops the command with nothing written. A DSN with a secret key (`key:secret@`) is refused without being printed or written, and so is one with spaces or control characters; only the canonical `key@host/number` form is written. A file or folder on a path the command writes that is a link (inside the project or out of it), a file to change that has another hard link, and a `DJANGO_SETTINGS_MODULE` that is not a dotted name of ASCII letters, digits and underscores each stop the command before anything is sent or written, and the dry run prints no patch for them (`git apply` likewise refuses a path through a symbolic link). Writing follows no link and changes no file in place: each folder is opened without following links and pinned as the working directory, each change is a new file renamed over its target once the target is checked against the plan (a new file must still be absent; a changed one must be the same single-link file with the same bytes; its permissions are kept), and around each rename the folders are checked to still be where the plan names them. Anything on those paths that changed after the command read the project (during the test event, say) stops it, and changes already made are undone; a change landing between the last check and the rename call itself is replaced, as with `git apply`. `--dir` itself may be a link: it is resolved once. The command needs no-follow file opens, so it runs on macOS, Linux and WSL2, not native Windows. Rerunning is idempotent.

- **Next.js** (app router): installs `@sentry/nextjs` and `@just-every/spool`, creates `instrumentation-client.js` (DSN, `tunnel: '/monitoring'`, optional release from `NEXT_PUBLIC_SPOOL_RELEASE`), the `app/monitoring/route.js` tunnel handler, `.env.local`, `next.config.mjs` and `spool-build.mjs`.
- **Django**: installs `sentry-sdk`, appends the `sentry_sdk.init` block to the settings module, `sentry-sdk` to `requirements.txt` and the DSN to `.env`.
- Express, React, FastAPI, Spring, Rails, Laravel and ASP.NET Core: the command names the framework and prints the setup steps below; it writes nothing.

Next.js setup writes `productionBrowserSourceMaps: true` and a production build command. If an existing Next config differs, merge that option into it as the reviewed output directs. Run `node --env-file=.env.local spool-build.mjs` in CI with `SPOOL_ENDPOINT`, `SPOOL_PROJECT`, `NEXT_PUBLIC_SPOOL_RELEASE`, `SPOOL_BUILD` and a project deploy grant in `SPOOL_DEPLOY_KEY`. The command builds with webpack, sets the SDK's dist to `SPOOL_BUILD`, and invokes the existing `spool-sourcemaps` command for application-route chunks. Next's shared framework/runtime chunks are outside this bounded upload; the current per-map and project artifact limits still apply. A missing grant or refused upload fails the command. Keep the grant in CI secrets, never in committed configuration. Django explicitly states that Python has no source maps to configure (G2 is the JavaScript-framework point).

## Browser capture past ad-blockers

Ad-blocker lists block the Sentry SDK's default ingest request (EasyPrivacy has `/?sentry_key=` and `/?sentry_version=`), and Sentry's Next.js `tunnelRoute` option only rewrites to `https://o<org>.ingest.sentry.io`, so it cannot carry events to Spool. Spool ships three tunnels for the SDK's standard `tunnel` option; change only that option to a same-origin path:

- Node and Express: `import { nodeTunnel } from '@just-every/spool/tunnel'; app.post('/monitoring', nodeTunnel({ dsn: process.env.SPOOL_DSN }))`. `spoolTunnel` is the same handler over a Fetch `Request`/`Response`.
- Next.js: `export const { POST } = spoolTunnelRoute({ dsn: process.env.SPOOL_DSN });` from `@just-every/spool/next`, in `app/monitoring/route.js`.
- Python: [`packages/tunnel-python/spool_tunnel.py`](../packages/tunnel-python/README.md), a standard-library WSGI app and `forward()` function.

Each tunnel reads the envelope's DSN header and forwards only when it names a DSN the tunnel was configured with; another key, host or project is refused (403) and nothing is forwarded. It forwards the browser's `Origin`, `Referer` and `User-Agent`, so Spool's allowed origins and inbound filters still decide, returns Spool's `X-Sentry-Rate-Limits`, and forwards the client address as `X-Forwarded-For`. Spool does not yet honour a forwarded address from a trusted tunnel (SDK-008), so events carry the tunnel server's own address until it does. A tunnel never follows a redirect: an upstream 3xx is answered with 502 and nothing reaches the host it names. Only `POST` is accepted (anything else is 405, and an abandoned upload ends that request, not the server), and the 1 MiB envelope limit is enforced while the body is read and again while it is inflated, so a small gzip body that expands far past the limit is refused (413) without being expanded. The `tunnel-flow` journey runs a real `@sentry/browser` page and a fresh Next.js app (`next build`, `next start`) under the EasyPrivacy Sentry rules in the Ghostery blocking engine; this is an engine and an excerpt of the list, not a browser extension.

## Framework setup

The runtime SDK underneath each framework is the one qualified above. Change only the DSN and read it from the environment (`SPOOL_DSN`):

- **React/Next.js**: `spool-setup`, above. React without Next: `Sentry.init({ dsn, tunnel })` from `@sentry/react` before rendering.
- **Express**: `@sentry/node`; call `Sentry.init({ dsn: process.env.SPOOL_DSN })` from a file you import first, then `Sentry.setupExpressErrorHandler(app)` after your routes.
- **Django / FastAPI**: `sentry_sdk.init(dsn=os.environ["SPOOL_DSN"])` before the app is created; the Django, FastAPI and Starlette integrations are defaults. Django request data is run through a real WSGI request above.
- **Spring**: `io.sentry:sentry-spring-boot-starter-jakarta` with `sentry.dsn=${SPOOL_DSN}`.
- **Rails**: `sentry-ruby` and `sentry-rails`, `config.dsn = ENV["SPOOL_DSN"]` in an initializer.
- **Laravel**: `sentry/sentry-laravel`, `php artisan sentry:publish --dsn=$SPOOL_DSN`.
- **ASP.NET Core**: the `Sentry.AspNetCore` package and `UseSentry(o => o.Dsn = ...)`.

Only Next.js and Django are run through their framework here; the others rely on the qualified runtime SDK and the framework integration the SDK's own documentation names.

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

The importer runs through Spool's one import door, Base import-kit's pipeline at `POST /api/operator/import/{uploads,plan,apply,status,reconcile,undo}`: upload, plan, reviewed fingerprint, apply, reconcile and undo. Business uses the same door with signed grants (below), and both share one history and undo. The door needs the current owner session, the exact app `Origin` and an `X-Import-Source` header naming the namespace `sentry-org:<organization slug>`; the bundle must belong to that organization. Agent, ingest and deploy keys are refused. Set an owner session cookie in a local environment variable through your existing owner session; do not paste it in shell commands or reports.

```sh
node scripts/sentry-import.mjs dry-run --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --file ./organization.json

node scripts/sentry-import.mjs apply --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --organization example \
  --plan PLAN_ID --fingerprint REVIEWED_FINGERPRINT

node scripts/sentry-import.mjs reconcile --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --organization example --plan PLAN_ID

node scripts/sentry-import.mjs undo --endpoint https://spool.example \
  --session-env SPOOL_OWNER_SESSION --organization example --plan PLAN_ID
```

Dry run uploads the exact bytes in SHA-256-checked 64 KiB chunks and returns the plan: its fingerprint, counts, rejected records with reasons, and differences against the organization's previous import. It writes no native records. Apply needs the plan ID and the exact reviewed fingerprint; it repeats bounded requests until the server reports the job `completed`, and repeating it answers the same job. `status` reads the job; `reconcile` re-derives every source ID's disposition (present, or explained with its reason) and the native counts, revisions and values from Spool's data. A newer bundle of an imported organization is a catch-up: add `--catchup` to the dry run; unchanged records stay, changed records it created are proposed as guarded replacements and records gone at source are only listed. One bundle's historical events keep one set of occurrence identities; a different bundle gives fresh ones. Apply and undo check the current owner session in the same SQL transaction as native rows and the Base journal. Undo runs newest import first, in reverse dependency order. Exact full-row fences catch native edits even when a revision number was not advanced; a conflict stops reversal and preserves edits. Restore the conflicting row deliberately or keep the import; never bypass the guard. Settings → **Business imports** lists every import ("approved by" for the owner's own, "approved via Business by" for Business) with an Undo.

The uploaded bytes and each plan's snapshot stay private to this installation, separate from scrubbed issue packets. Project event retention does not erase them. Native owner archives include scrubbed historical rows and source identity metadata but deliberately exclude the import door and Base import journal; undo and reconciliation remain on the installation that holds them. Keep the export file itself confidential; deleting a native event is not erasure of its original export. This release has no automatic source-journal expiry.

Jobs created by the owner-session importer before the import door keep their journal: `read`, `resume`, `undo` and `originals --output FILE` take `--organization` and `--job` for them (the CLI refuses overwriting an existing originals file). New imports always run through the door.

Source references: [envelope framing](https://develop.sentry.dev/sdk/foundations/envelopes/), [transport authentication](https://develop.sentry.dev/sdk/foundations/transport/authentication/), [11.6.0 SDK URL construction](https://github.com/getsentry/sentry-javascript/blob/11.6.0/packages/core/src/api.ts), [11.6.0 debug metadata](https://github.com/getsentry/sentry-javascript/blob/11.6.0/packages/core/src/utils/prepareEvent.ts).

The exact prior-inventory Base JSONL formats (before and immediately after occurrence identities) uses the same 16 MiB compatibility bound as native v1/v2 files. Its original integrity is verified before normalization, and source identity, epoch and permanent erasure journal are retained. Current complete Base archives continue to stream without that whole-file compatibility bound.

See [supported languages](SUPPORTED-LANGUAGES.md) for the exact native/Sentry Python and Go grammars, limits, repository path mapping, privacy and unavailable symbolication.

## Optional Business import door

In Settings, open the **Business imports** row to enable the import door. It is
**off by default**. It uses the installation's existing owner-claim issuer,
installation ID, app origin and public key ring, whatever the claim mode
(bootstrap or signed); no second trust configuration or owner identity is
created. Without those bindings (`RER_OWNER_CLAIM_*`) the
row says trust configuration is required. `rer deploy` does not declare them for
a self-hosted installation, so there Business grants stay unavailable; the
owner's importer above uses the same door without them.

An installation RER provisions for a Business plan the owner approved also
carries `RER_IMPORT_DOOR=on`. There the owner's first claim opens the door
(Base's `enableDoorAtFirstClaim`), and every later claim answer, sign-in and
owner import repeats the same call, which only creates the settings row while
none exists. So a later claim, or a claim by someone else, changes nothing, and
a door the owner turned off stays off until the owner turns it on again.
`rer deploy` never sets the variable. Disabling the door immediately stops Business
requests. **Revoke key** permanently revokes a signing key for this door, including
otherwise valid unexpired grants; rotate to a new key ID to restore access.

Spool vendors Base's import-kit door from `rer-v0.2.72`, byte for byte with no
local divergence; a multi-megabyte export's first apply creates its job in
bounded staged steps and may answer a still `queued` job. Its
[grant and HTTP contract](../src/modules/import-kit/src/door/README.md) covers
`POST /api/rer/import/{uploads,plan,apply,status,reconcile,undo,archive,restore-check}`. A grant's
namespace must be `sentry-org:<organization slug>`, `sentry` (the namespace
RER's Business export names, one per installation; a later bundle there is a
catch-up of the earlier one), or a namespace an earlier import already holds;
any other namespace is refused with 403 `unknown_import_source` before anything
is written. The upload is the same
owner-generated Sentry organization bundle documented above, chunked with
SHA-256 checks. The parser retains Spool's 2 MiB / 500-record limits and
uses the existing native Sentry mapping. Planning retains private upload/review
custody and makes no native project, release, issue or event writes. Apply needs
the exact reviewed fingerprint and the signed owner's approval record.

Reconciliation checks the exported/admitted historical subset against the bundle
manifest and its omissions, with source-ID dispositions and server-derived native
counts, revisions and values. It makes no completeness claim against Sentry's
vendor totals. Imports stay inert: no credentials or alert deliveries are created.

The same settings row lists each real import with **approved via Business by
<owner> at <time>, fingerprint <x>** (the owner's own imports read **approved
by**). Its owner-session Undo remains available
with Business disabled or its grant key revoked. Undo protects native edits and
reverses the newest snapshot first. Original bytes remain private to this Spool
installation. Project erasure also withdraws affected door upload/plan snapshots
and tool archives alongside import-kit originals, including an archive kept in
Business's own `sentry` namespace, which it finds by the projects the
archive's own bytes name; other native projects remain intact.

When Business switches Sentry off, it uploads the final export and calls the
door's `archive` grant action: Spool keeps the exact bytes in its own D1 as
`business-archive/<tool>/<takenAt>` (migration `0056_import_door_archives.sql`),
and `restore-check` parses them again with the Sentry reader and mapping with no
native write. The owner-session importer answers both 404.

### Cutover read

`POST /api/rer/cutover-status` with `{"since": "<ISO time>"}` is Business's
read for the DSN switch and its difference report. It answers
`{events_since, last_event_at, created_since: {issues, events}}`: the events
Spool's ingest received since `since` (imported Sentry history never counts),
the newest received event's time, and the issues and events created in Spool
rather than imported since then. It returns counts and a time only, never a
project, issue, title, payload, name, email or key, and writes nothing. It needs
an RER-signed grant of action `cutover-status` for this installation under the
owner-claim key ring (Base's `verifyRerGrant`). Without that trust it answers
404; without a grant 401; another action, an expired grant, another
installation, owner or audience, a wrong key, or a key revoked under **Revoke
key** 403; a malformed body 400; any method but POST 405.
