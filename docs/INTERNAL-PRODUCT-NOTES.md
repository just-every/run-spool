# Internal product implementation notes

sd, 2026-11-17T15:04:15Z. Implementation, publication and verification notes moved out of shipped product help. These retained snapshots describe their original context; they are not a current acceptance record.

## From capture.md

As of 2026-11-12 this installs SDK 0.1.0. SDK 0.2.0 remains owner-held and unpublished on npm. Ordinary capture and source-map upload work with 0.1.0; [exposure measurement](REPRODUCE-AND-FIX.md#3-did-the-fix-reach-the-affected-users) and the plugin's upload-count message require 0.2.0. The Spool app release does not publish the SDK.

Spool matches each bundle to its source map using a **bundle debug ID**, a UUID stored in both the JavaScript bundle and its map. Use the plugin or command below to create that matching pair and upload the map. For a manual upload in **Releases**, use the ID from the prepared map's `debug_id` field (also written as `//# debugId=…` in the bundle), and select the same project, release and build your SDK reports. Typing a new ID into the upload form does not stamp your bundle. Spool keeps maps private and never fetches source files from the internet. The upload service and current checkout CLI accept flat or indexed V3 maps up to 1 MiB each. The published npm SDK 0.1.0 CLI and the prepared-map picker on **Releases** accept only flat V3 maps up to 256 KiB. There is no lifetime map count; all paths respect the optional project artifact-storage byte cap. The larger/indexed CLI support is in the unpublished 0.2.0 source, not npm 0.1.0.

Each bundle needs its `.map` next to it. Run the tool before publishing the built application: it rewrites the bundle and map with the matching debug ID, so serve those resulting files. Both tools register the release, mark each bundle so the SDK can match its errors to the map, and upload the maps. With the published SDK 0.1.0, a successful command-line upload exits 0 and prints `{"uploaded":1}` for one map, without any extra flag. This version does not accept `--json`. Its Vite/Rollup plugin is silent on success; a refused upload fails the build. Confirm success by triggering an error in the exact stamped build and checking its original-source frame as described below. Newer unpublished SDK source adds a readable upload summary; do not expect it from npm 0.1.0.

Spool currently ships the same official `@sentry/browser` 11.6.0 it qualifies directly.

Settings apply on the next script load. Disabling the loader and revoking its capture key are separate actions: disabled, revoked and unknown loader keys all answer 404 with no script or DSN. Disabling a loader does not revoke an SDK already loaded by a page. The script contains only the public DSN and that key's options. It is not an origin authorization mechanism: SDK-006 Origin/Referer and allowed-domain enforcement remain at the unchanged intake door. Spool keeps no answer cache or per-visitor state for the script.

Migration `0061_loader_settings.sql` adds configuration without rewriting existing keys. Private archives retain settings and their one-way key hashes, exclude raw keys and credentials, and restore the settings inertly; create new capture keys after restore. Project erasure removes the settings. Maintainer edits use the existing owner permission, same-origin, revision and audit fences (owner remains maintainer until TEAM-001).

Not qualified here: older SDK version tracks, pre-load automatic instrumentation, the hosted legacy report-dialog endpoint, screenshots (disabled for the feedback widget), or a real Sentry organization loader-key inventory and replacement-tag listing. That listing remains MIG-001. Traces and replay still have their named unsupported outcomes; their storage remains with SDK-005/SDK-007/CTX-001/CTX-002/SDK-025. No provider account, device or consent is used.

## From FRAMEWORK-SETUP.md

These guides cover exception capture; publishing a guide does not qualify every feature of that framework's SDK.

The manual instructions below use published packages. As of 2026-11-12, npm serves `@just-every/spool` 0.1.0 with only the `spool-sourcemaps` command. The `spool-setup` wizard and Spool tunnel helpers are in the repository’s unreleased SDK source (currently versioned 0.2.0), not on npm; see [unpublished guided setup](#unpublished-guided-setup). Installing the Spool app does not publish or upgrade that SDK.

Only fresh Next.js App Router and Django applications are exercised by Spool's guided-setup journey. The other frameworks have manual instructions, not generated patches or fresh-framework qualification. Runtime qualification, hosted delivery, trusted tunnel addresses and native devices retain their separate limits in the [engineering notes](SENTRY-SWITCHING.md#runtime-qualification).

The guided command reports success only when Spool returns its own receipt for the test event.

The unpublished wizard generates patches only for Django; FastAPI uses manual setup.

This is manual setup guidance; Spring framework behavior is not qualified by the fresh Next.js and Django journey.

This is a manual integration guide; fresh Rails qualification is not claimed.

Laravel setup is manual and not fresh-framework qualified here.

This is manual ASP.NET Core guidance, not fresh-framework qualification;

Serve the rewritten JavaScript: the tool stamps a matching debug ID into each bundle and its map, registers the release and uploads the map privately. The capture release and dist must equal the upload's release and build. A refused upload fails the build; trigger a real error after deployment and check its original file and line in Spool. SDK 0.1.0 prints `{"uploaded":1}` for one successful CLI upload and exits 0; it does not accept `--json`. Its Vite/Rollup plugin is silent on success. Confirm the original-source frame rather than expecting the newer unpublished SDK’s readable summary. Current artifact bounds apply; this guide makes no large-map or native-symbolication claim.

Spool’s `spoolTunnelRoute` and `nodeTunnel` helpers are in unreleased source, not the published SDK 0.1.0. Do not import `@just-every/spool/next` or `@just-every/spool/tunnel` after an npm install of that version. With a separately supplied artifact that includes those exports, the browser can use `tunnel: '/monitoring'` and a same-origin server handler. The [engineering notes](SENTRY-SWITCHING.md#runtime-qualification) describe that separate qualification and its limits.

### Unpublished guided setup

The repository’s current SDK source is versioned 0.2.0; its **Unreleased** changes include `spool-setup` for fresh Next.js App Router and Django applications. This wizard is **not yet on npm**, and the earlier owner-held 0.2.0 artifact is not a guarantee that it contains the wizard. Check the [SDK release notes](../packages/sdk/CHANGELOG.md). Use the manual instructions above with today’s npm packages.

Only if you have a separately supplied SDK artifact that includes the `spool-setup` bin, install that artifact in your application with its own Node.js and npm, then run its installed command:

```sh
npx --no-install spool-setup --dsn "$SPOOL_DSN" --dir .
```

Review the printed patch before applying it. The command writes nothing until `--apply`; add `--install` to install the packages. For Django, choose your virtual environment with `--python .venv/bin/python`. A test event must receive Spool’s own receipt before any patch is printed or written. The wizard runs on macOS, Linux and WSL2. It is not a step for the published npm 0.1.0 package.

## From GROUPING-RULES.md

Every admitted native and Sentry event records its exact policy and revision. Event grouping information explains the variant, contributing frames, effective in-app classification and matched rule lines from that snapshot. Library frames collapse in the event view while SDK-sent evidence remains intact. A later policy edit cannot rewrite that explanation or alter the raw-input retry identity. Policy activation and admission have transaction revision fences, owner writes are audited, and private archives preserve policies and event snapshots. Project erasure includes the policy store. Personal identifiers in structural grouping policy cause the existing explicit owner-erasure hold rather than an unsafe rewrite.

`GET/PUT /api/projects/:project/grouping-rules` and `POST .../preview` require the project owner, same-origin writes and current authority. Preview is keyset-paginated at 100 events with an explicit next cursor. The UI consumes every page. PUT requires the current revision; stale saves return 409.

GROUP-001 historical regrouping is the explicit selected-occurrence split/merge correction with preview, version, audit, immutable original membership and guarded undo. Native stacks keep their existing v1 identity unless an explicit rule changes the first contributing frame or fingerprint. Native evidence supplies type, message, family, frame path and function; module/package/tags/SDK metadata are unavailable without Sentry evidence. Policy changes also mark repair coverage gaps rather than implying healthy capture from absence. The owner acts as maintainer until TEAM-001 implements project roles; TEAM-001 inherits policy authority, and MIG-001 inherits grouping-rule import/preview before completion. `GET .../versions` exposes retained immutable policy versions; legacy pre-version-history audit rows retain their revision and digest without inventing unavailable policy text.

## From NOTIFICATIONS.md

The native HTTP door is `GET` or `PUT` at `/api/projects/{project}/notifications/preferences`. A save supplies the current `revision` and the complete `email` boolean map with keys `resolution`, `regression`, `assignment`, `comment`, `mention`, `issue_alert`, `deploy` and `weekly_report`. A stale revision is refused. Unknown fields and query selectors are refused; the authenticated person is always the subject, including for an owner or administrator. Project credentials cannot use this door. Removed members and people without current project access cannot read or change preferences.

Each preference read, save and refusal records a privacy-safe audit fact. Private archives retain the choices as historical rows with account bindings removed. Restoring preserves that history without activating any choice, sending mail or reattaching it to a current person. Older archives start with no preference rows. Project erasure deletes all project preferences. Installation-owner erasure deletes that person's preferences and attribution links while keeping permanent safe audit chronology. Downloaded archives remain the holder's separate custody.

## From GITHUB-CONNECTION.md

Making it a required secret would also force every installation to provide GitHub credentials.

The current hosted deployment does **not support the optional GitHub connection secret**. Its `deploy.json` does not declare `GITHUB_CONNECTION`; `rer deploy --set-secret GITHUB_CONNECTION` refuses it as undeclared. There is no supported hosted credential-entry route today. Use local Spool for this workflow or ask your installation operator for a release with optional integration deployment support.

## From INTEGRATION-EGRESS.md

Slack destinations and cron check-ins require the installation's **integration egress service**, bound as `INTEGRATION_EGRESS`.

The shipped Spool deployment declares no egress binding. There is no Settings switch that installs the service. An installation operator with deployment access must install it and bind Spool to its exact deployment receipt. Ordinary local `rer dev` has no production egress service and no supported `.dev.vars` value that can create this RPC binding. Use an operator-managed deployment for live forwarding. The local test transport is for synthetic tests only.

Live hybrid egress qualification remains pending. Installing a binding does not by itself prove live Slack delivery or Uptime forwarding; keep these integrations disabled until the operator qualifies the selected deployment.

Read [Base's egress-service owner steps and live qualification procedure](https://github.com/runeditrun/base/blob/965e8d4e105f6f4d281dacb3c099f6a958a886e7/modules/egress-service/OWNER-STEPS.md). This link uses the Base revision recorded for Spool's vendored egress module in `base-copies.json`. The historical probe authorizations there do not authorize a new live run; an owner must separately authorize qualification and supply a safe external receiver outside the account's own zones. The installation steps below use Spool's copy of that module.

## From SUPPORTED-LANGUAGES.md

Spool's native `POST /api/ingest/{project}` and Sentry envelope/store intake accept JavaScript, Python and Go exception evidence under the same project ingest grant, browser-origin policy, release check (native intake requires a registered release/build; Sentry intake follows [Sentry release identity](SENTRY-RELEASES.md) and creates an unseen release automatically by default), admission budgets, deduplication and scrubbing. The browser/Worker SDK, source-map tooling and sandbox reproducer remain JavaScript only. OTLP support is unchanged; it does not accept Python/Go exceptions. No telemetry URL is fetched and no telemetry executes.

Retired wording, contradicted by current identity intake and Sentry evidence handling:

> Sentry user, request, extra, locals and source-context fields are discarded.

## From getting-started.md

These instructions describe `main`, which may be ahead of the latest tagged Spool release, `v0.7.11`. For that release, clone it yourself with `git clone --branch v0.7.11 https://github.com/just-every/run-spool.git run-spool` and follow the instructions shipped with the tag.

## From install.md

These instructions describe `main`, which may be ahead of the latest tagged Spool release, `v0.6.0`. For that release, clone it yourself with `git clone --branch v0.6.0 https://github.com/just-every/run-spool.git run-spool` and follow the instructions shipped with the tag.
