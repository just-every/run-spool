# Move a Rollbar project to Spool

This bounded importer accepts one project's captured Rollbar API responses, reviews a plan without native writes, then applies that exact fingerprint through the existing owner import door. It does not fetch Rollbar automatically. The limit is 2 MiB and 500 parsed records, including the manifest and private journal records. This is a bounded project migration, with synthetic fixture evidence; it is not proof of a complete organization migration. Register R-4 real buyer field proof remains unrun.

## Capture the source

Use authorized GET requests with `X-Rollbar-Access-Token` and a token with `read` scope. Keep its value in your private credential environment, never a command argument, URL, bundle or report. Rollbar's ingestion scopes `post_client_item` and `post_server_item` cannot read the project. An account token needs the documented project selector on each project endpoint. See [Rollbar authentication](https://docs.rollbar.com/reference/getting-started-1) and [access token scopes](https://docs.rollbar.com/docs/access-tokens).

Save each successful response envelope exactly, including all unknown fields. Do not flatten, rename or invent fields, strip the `err` envelope, or turn a failed request into an empty successful result. Manual capture of these exact responses is supported:

| Bundle location | Authorized source |
| --- | --- |
| `project` | [Get a project](https://docs.rollbar.com/reference/get-a-project), `GET /api/1/project/{project_id}`. This endpoint requires an account token with `read` scope. Keep the complete `{err:0,result:{id,...}}` envelope. |
| `items` | [List all items](https://docs.rollbar.com/reference/list-all-items), `GET /api/1/items/`. Keep every `result.items` page, including resolved and muted items; do not leave an active-only filter in the capture. |
| `occurrences` | Discover IDs through [list occurrences](https://docs.rollbar.com/reference/get_api-1-instances), `GET /api/1/instances`, then capture [each occurrence detail](https://docs.rollbar.com/reference/get_api-1-instance-instance-id), `GET /api/1/instance/{instance_id}`. Each bundle page holds one detail response with `result.id`, `result.item_id` and `result.data`, rather than a list summary. |
| `deploys` | [List all deploys](https://docs.rollbar.com/reference/list-all-deploys), `GET /api/1/deploys`. Keep the exact envelope with `result.deploys`. |
| `item_events` | [List events for an item](https://docs.rollbar.com/reference/list-item-events), `GET /api/1/item/{item_id}/events`, without a type filter. Use the system item ID, not its display counter. Keep comments and history in the raw envelope. |
| `notification_rules`, channel `email` | [Read email rules](https://docs.rollbar.com/reference/get_api-1-notifications-email-rules), `GET /api/1/notifications/email/rules`. |
| `notification_rules`, channel `slack` | [Read Slack rules](https://docs.rollbar.com/reference/get_api-1-notifications-slack-rules), `GET /api/1/notifications/slack/rules`. |
| `notification_rules`, channel `pagerduty` | [Read PagerDuty rules](https://docs.rollbar.com/reference/get_api-1-notifications-pagerduty-rules), `GET /api/1/notifications/pagerduty/rules`. |
| `notification_rules`, channel `webhook` | [Read webhook rules](https://docs.rollbar.com/reference/get_api-1-notifications-webhook-rules), `GET /api/1/notifications/webhook/rules`. |

Follow each endpoint's pagination to exhaustion. Item, deploy and history pages start at 1. Keep the terminal empty page when supplied. For occurrence details, number the captured detail responses consecutively in discovery order. Put `complete: true` on every collection only after exhausting its source. This is your completeness declaration; the importer cannot prove no response was omitted. Do not declare an interrupted or rate-limited capture complete. Quiesce the source for a final capture or record its changing-source limitation before cutover.

The bundle is UTF-8 JSON with this structure; the placeholders below describe exact captured responses, not substitute data:

```text
{
  format: 'spool-rollbar-export', version: 1, exportedAt: '<ISO timestamp>',
  project: <exact project response envelope>,
  collections: [
    {kind: 'items', complete: true,
      pages: [{page: 1, response: <exact items envelope>}, ...]},
    {kind: 'occurrences', complete: true,
      pages: [{page: 1, response: <exact ONE occurrence detail envelope>}, ...]},
    {kind: 'deploys', complete: true,
      pages: [{page: 1, response: <exact deploys envelope>}, ...]},
    {kind: 'item_events', item: <system item ID>, complete: true,
      pages: [{page: 1, response: <exact events envelope>}, ...]},
    {kind: 'notification_rules', channel: 'email', complete: true,
      pages: [{page: 1, response: <exact rules envelope>}]}
  ],
  unavailable: [{kind: '<missing source category>', reason: '<specific reason>'}]
}
```

Items, occurrences and deploys are required. Empty item and deploy lists retain their successful API envelopes. An exhausted occurrence discovery with no available details uses an empty `pages` array; name unavailable occurrence history when source counters exceed those retained details. Include a separate history collection per item and a separate rules collection per channel captured. Every collection's page numbers must be contiguous from 1. Name each missing history in `unavailable` with `kind: 'item_events'`, its numeric `item` and a reason. Name each missing channel with `kind: 'notification_rules'`, its `channel` and a reason; a denied history request, an unconfigured channel and an unknown artifact download are different gaps. Name source maps, symbol files, attachments and any other artifact whose download was not established as unavailable. Never imply bytes were captured because an occurrence contains a URL or artifact name. Do not manufacture an API response for an unavailable source.

Store the bundle privately with restrictive permissions, outside the repository. Preserve the original capture independently. Credentials found in source data may be removed by the server's existing custody policy; inspect the plan's named refusals and losses before applying.

## Review, apply and recover

Sign in as the installation's existing owner. Privately populate `SPOOL_OWNER_COOKIE` with that owner's session cookie through your session tooling. The CLI takes only the environment variable's name; there is no session-value flag. Use an HTTPS origin, or HTTP on loopback for local work. Each POST includes that exact Origin and `X-Import-Source: rollbar-project:<project ID>`; the source ID comes from `String(bundle.project.result.id)`.

```sh
node scripts/rollbar-import.mjs dry-run --endpoint https://spool.example \
  --session-env SPOOL_OWNER_COOKIE --file /private/rollbar-project.json
```

The client uploads the exact bundle in checked 64 KiB chunks, with SHA-256 for each chunk and the complete bundle. It verifies completion before requesting a plan. Read the returned `project`, `namespace`, `uploadId`, `planId`, `fingerprint`, counts, differences, rejected records and diagnostics. A dry run retains private custody and planning state but writes no native records. Check that every source identity and every unavailable category is accounted for. Resolve rejections or explicitly accept the reported losses before approving that fingerprint.

Use the project ID, plan ID and exact fingerprint from the reviewed result:

```sh
node scripts/rollbar-import.mjs apply --endpoint https://spool.example \
  --session-env SPOOL_OWNER_COOKIE --project "$ROLLBAR_PROJECT_ID" \
  --plan "$SPOOL_PLAN_ID" --fingerprint "$SPOOL_REVIEWED_FINGERPRINT"
```

`apply` sends bounded requests until completed. To exercise interruption at a public command boundary, append `--once`: this sends exactly one bounded apply request and returns the server's queued, applying or completed state. If work remains, resume the same reviewed plan:

```sh
node scripts/rollbar-import.mjs resume --endpoint https://spool.example \
  --session-env SPOOL_OWNER_COOKIE --project "$ROLLBAR_PROJECT_ID" \
  --plan "$SPOOL_PLAN_ID" --fingerprint "$SPOOL_REVIEWED_FINGERPRINT"
node scripts/rollbar-import.mjs status --endpoint https://spool.example \
  --session-env SPOOL_OWNER_COOKIE --project "$ROLLBAR_PROJECT_ID" --plan "$SPOOL_PLAN_ID"
node scripts/rollbar-import.mjs reconcile --endpoint https://spool.example \
  --session-env SPOOL_OWNER_COOKIE --project "$ROLLBAR_PROJECT_ID" --plan "$SPOOL_PLAN_ID"
node scripts/rollbar-import.mjs undo --endpoint https://spool.example \
  --session-env SPOOL_OWNER_COOKIE --project "$ROLLBAR_PROJECT_ID" --plan "$SPOOL_PLAN_ID"
```

Resume uses the same reviewed apply route; it does not create another plan or bypass fingerprint review. Status reads progress. Reconcile checks native records and provenance against source identities on the server; inspect its dispositions and mismatches before cutover. Undo runs bounded reversal requests, newest snapshot first, under existing native-edit guards. A changed native target can refuse reversal; inspect the refusal instead of overwriting edits. Each loop stops after 100 requests, leaving the server's durable state available for another status check and continuation.

Download the verified private originals after apply with `originals --project "$ROLLBAR_PROJECT_ID" --plan "$SPOOL_PLAN_ID" --output /private/rollbar-originals.json`, using the same endpoint and session-environment flags. This reads the owner-only `GET /api/imports/rollbar/{project}/{plan}/originals` route and writes a new file with mode 0600; it refuses to overwrite an existing file. Each original includes its hash, size and retained base64 bytes, or a named unavailable reason when credential removal withheld them. The CLI prints only whether the file was saved. Custody is fenced by current owner authority and erasure. Native installation archives carry scrubbed native history and lineage, while excluding private import originals and executable jobs. Preserve your original authorized capture independently.

## Conversion boundaries

Review the server plan as the authority for each mapped issue, occurrence, frame and deploy-derived release. Rollbar item identity is retained in provenance; Spool's future native grouping need not reproduce Rollbar grouping. Source fingerprints, comments, assignments, tracker links, status history and notification rules are retained as read-only private journal evidence. They do not create native users, memberships, comments, external tracker synchronization, grouping rules or active notification destinations. Recreate the needed workflow and alert destinations manually in Spool's supported settings, and verify them before disabling Rollbar alerts. A retained rule is evidence of the old configuration, not a working notification.

Arbitrary Rollbar `custom`, `person` and `request` objects are not migrated into native context. Only telemetry log messages become scrubbed breadcrumb labels; other telemetry stays in private source custody. Retained source custody is not a promise that those fields appear in the native issue. There is no automatic artifact download or symbolication migration. Inspect all named unavailable fields and source records; manually recover original build artifacts where authorized, and re-upload supported maps for Spool.

## Cut over JavaScript capture

1. Select the native destination project after reconciliation. In **Settings**, create a fresh project ingest key and, for CI uploads, a separate deploy key. Existing Rollbar tokens and owner cookies are not Spool ingest credentials. Register the exact release and build in **Releases** before sending errors; register new releases in shipping order. Add the browser application's exact origin on **Capture**.
2. Install `@just-every/spool` in the application and initialize it once. Follow the current package availability and API notes in the [SDK guide](../packages/sdk/README.md) and [capture guide](capture.md). The examples below use the ordinary capture API; owner-held SDK features require their separately supplied release.

Requires [Node.js and npm](https://nodejs.org/en/download) installed and available on PATH in your application’s repository. Spool’s installer keeps its runtime private and does not provide npm on PATH. For browser capture without Node.js or npm, use the [browser helper](capture.md#browser-capture-without-nodejs-or-npm).

```sh
npm install @just-every/spool
```

Browser application, with the project-scoped ingest configuration supplied by your build:

```js
import { init, captureException, breadcrumb } from '@just-every/spool';
init({ endpoint: spoolEndpoint, project: spoolProject, ingestKey: spoolIngestKey,
  release: appRelease, build: appBuild });
breadcrumb('checkout', 'payment submitted');
// In an existing error handler:
await captureException(error);
```

Node application, with credentials held in its environment:

```js
import { init, captureException } from '@just-every/spool/node';
init({ endpoint: process.env.SPOOL_ENDPOINT, project: process.env.SPOOL_PROJECT,
  ingestKey: process.env.SPOOL_INGEST_KEY, release: process.env.APP_RELEASE,
  build: process.env.APP_BUILD });
// In an existing error handler:
await captureException(error, ['checkout: payment submitted']);
```

3. Replace Rollbar's explicit capture calls and remove its automatic capture initialization when the Spool application test passes. Spool captures uncaught errors and unhandled rejections; it does not accept the Rollbar SDK merely by changing its endpoint. Browser breadcrumbs are explicit scrubbed labels, keeping the last 20. Replace necessary Rollbar telemetry with those labels deliberately; avoid personal data. There is no automatic DOM, console or request collection. Audit every custom context dependency because arbitrary Rollbar objects have no native equivalent.
4. Recover original bundles and maps from your build pipeline. Rollbar's artifact references and upload do not transfer them to Spool. Re-upload supported maps using a deploy key from **Settings**. For example, run this after the build and before publishing its resulting files:

```sh
npx spool-sourcemaps --endpoint https://spool.example --project synthetic-spool-1 \
  --release "$APP_RELEASE" --build "$APP_BUILD" --key-env SPOOL_DEPLOY_KEY dist/app.js
```

Keep each map beside its bundle. The tool registers the release and stamps matching debug IDs into bundle and map, then uploads the map privately. Serve those rewritten bundles. Manual uploads in **Releases** need the actual prepared debug ID and matching project, release and build; entering a fresh ID alone does not rewrite a bundle. See the [SDK source-map instructions](../packages/sdk/README.md#source-maps) for the build plugin and supported map limits.
5. Trigger a handled exception, an uncaught exception and an unhandled rejection in the actual browser or Node application. Inspect SDK outcomes and the received issue; check the release, build and original mapped stack. Test browser capture from its real allowed origin. The setup test only proves ingestion from Spool itself. Verify one intended breadcrumb and absence of forbidden context, then remove the old Rollbar capture configuration and retire old grants under your existing operational process. Recheck reconciliation before retiring the retained source account or its private capture.

Aggregate items with `group_status: 2` are rejected: their public occurrence listing can omit constituent items. Export those constituents independently and record any unavailable membership. A current active item is not proof of reactivation by itself; preserve its prior resolution, later activation timestamps and item history.

The API envelopes also follow the official [Rollbar MCP interfaces](https://github.com/rollbar/rollbar-mcp-server/blob/main/src/types/index.ts), [Terraform project fixture](https://github.com/rollbar/terraform-provider-rollbar/blob/master/client/fixtures/project/read.json) and [notification client](https://github.com/rollbar/terraform-provider-rollbar/blob/master/client/notification.go).

These are operator steps, not a claim that production cutover, hosted access or real buyer proof has already run.
