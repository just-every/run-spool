# Connect your app

Spool learns about errors from your application through Spool's own SDK, `@just-every/spool`. Every error belongs to a project and to a release you have registered, so Spool can tell which build it came from.

During first-project setup, **Send test error** checks the new key and release from Spool itself; choose **Continue to workbench** afterwards. To check errors from your own application, follow the steps below.

The **Capture** page in the workbench walks through these steps for the selected project and fills in its own address and the latest release for you.

## 1. Add the Spool SDK

Install the package and initialize it once in your application, with your Spool address, the project and its ingest key:

```sh
npm install @just-every/spool
```

As of 2026-10-15 this installs SDK 0.1.0. SDK 0.2.0 remains owner-held and unpublished on npm. Ordinary capture and source-map upload work with 0.1.0; [exposure measurement](REPRODUCE-AND-FIX.md#3-did-the-fix-reach-the-affected-users) and the plugin's upload-count message require 0.2.0. The Spool app release does not publish the SDK.

```js
import { init } from '@just-every/spool';
init({ endpoint: "http://127.0.0.1:8787", project: "web-app", ingestKey: 'YOUR_INGEST_KEY',
  release: "r42", build: "b1907" });
```

It listens for errors and unhandled promise rejections in the browser, next to anything else you already use. Add explicit labels with `breadcrumb('checkout', 'payment submitted')`; Spool never collects form values, requests or console output on its own, and it removes common secrets before anything leaves the page.

Browsers can only send to Spool from origins you allow: add your application's exact origin on the **Capture** page.

On a server, import `init` and `captureException` from `@just-every/spool/node`. In a Cloudflare Worker, call `captureException(error, options, ctx)` from `@just-every/spool/worker`; it keeps the Worker alive with `ctx.waitUntil` until Spool answers.

## 2. Register the release

Open **Releases** and add the release name and build your application reports, such as `r42` and `b1907`. Register each release in the order you ship them: that order is how Spool knows a resolved issue has come back in a later release. Spool refuses errors from releases it does not know.

## 3. Upload the source maps

Spool matches each bundle to its source map using a **bundle debug ID**, a UUID stored in both the JavaScript bundle and its map. Use the plugin or command below to create that matching pair and upload the map. For a manual upload in **Releases**, use the ID from the prepared map's `debug_id` field (also written as `//# debugId=…` in the bundle), and select the same project, release and build your SDK reports. Typing a new ID into the upload form does not stamp your bundle. Spool keeps maps private and never fetches source files from the internet. A project holds up to 20 flat V3 maps of 256 KiB each.

You can also upload maps from your build with a **deploy key** from **Settings**. A deploy key can only register releases and upload maps for its project. Keep the key in your build's environment, never in your application's source. With Vite or Rollup, add the SDK's plugin:

```js
import { spoolSourceMaps } from '@just-every/spool/vite';
export default {
  build: { sourcemap: true },
  plugins: [spoolSourceMaps({ endpoint: 'https://spool.example', project: 'web', release: 'web@1.2.0', build: 'build-42', keyEnv: 'SPOOL_DEPLOY_KEY' })],
};
```

With any other bundler, run the command-line tool after the build:

```sh
npx spool-sourcemaps --endpoint https://spool.example --project web \
  --release web@1.2.0 --build build-42 --key-env SPOOL_DEPLOY_KEY dist/app.js
```

Each bundle needs its `.map` next to it. Run the tool before publishing the built application: it rewrites the bundle and map with the matching debug ID, so serve those resulting files. Both tools register the release, mark each bundle so the SDK can match its errors to the map, and upload the maps. The command-line tool prints how many maps it uploaded; the Vite/Rollup plugin prints that count in SDK 0.2.0, while the published 0.1.0 plugin is silent on success. A failed upload fails your build.

## 4. Check it works

Trigger an error in your application, then open **Capture** and choose **Check for events**. Open the received issue in **Issues** and check that its stack maps to your original source using the matching release, build and uploaded map.

For a check from inside Spool, first-project setup has **Send test error**, which registers the release shown and sends one sample error with the new key. Choose **Continue to workbench** to see it in **Issues**. Later, **Capture test exception** on **Capture** sends a test using your ingest key and a release you already registered. These tests check ingestion from Spool's own origin; they do not check your app's origin, SDK installation or source maps.

## Keys for anything outside this checkout

Run Spool with `rer dev` and open the private `RER_OPEN` link to create your project and keys. With rer dev v2 (using the rer version pinned in [package.json](../package.json)), your application can use the dev-minted ingest key against local Spool directly. Your build can use a dev-minted deploy key there too. Neither needs the checkout's private owner gate, even when the application or build runs from another repository on this computer.

| Key | Scope | Local dev gate required? |
| --- | --- | --- |
| Ingest | Send events to one project | No |
| Deploy | Register releases and upload source maps for one project | No |
| Agent | Read evidence for one project; no writes | Yes, for dev-minted keys |

Allow your browser application's exact origin on **Capture**, and register its release/build before sending errors. Browser capture deliberately omits owner credentials. Never put `RER_OPEN`, its `rer-dev` fragment value or `SPOOL_DEV_KEY` in a browser app, SDK init, browser environment variable or build output. Ingest admission does not grant owner access or evidence reads.

The `rer-dev` fragment is the private checkout gate used for owner entry and local read-only agent access. For a trusted local coding agent, extract only that value privately into `SPOOL_DEV_KEY` and use the absolute path to Spool's CLI from your app repository; see [local agent access](WITH-YOUR-AGENT.md#local-agent-access). Keep the gate out of shared configuration and source control.

Deployed Spool refuses every dev-minted key, including ingest and deploy keys. Sign in to the deployed installation and create fresh keys for that installation. Private archives exclude all project grants, including dev-minted grants; recreate keys after restore. Local mail is suppressed, so no email or mailbox workaround is needed. Stop with `rer dev --stop` before deploy, verify, reset or data transfer.

## Already using Sentry? Point your DSN here

Spool also accepts JavaScript errors from the unmodified Sentry browser and Node SDKs. Replace only the DSN with the one Spool shows for your project, and keep your release and dist settings. Spool keeps the exceptions and their stack traces; it does not keep sessions, traces, replays or attachments. The [switching guide](SENTRY-SWITCHING.md) has the details.

See [supported languages](SUPPORTED-LANGUAGES.md) for the exact native/Sentry Python and Go grammars, limits, repository path mapping, privacy and unavailable symbolication.

### Use a browser loader tag

For an existing Sentry Loader Script installation, open **Settings → Project keys → Details** for its capture key. Set the shipped SDK version, tracing sample rate, replay session/error sample rates and feedback option there. Spool currently ships the same official `@sentry/browser` 11.6.0 it qualifies directly. All three rates start at zero and feedback starts off; choose any higher rate explicitly. Paste that key's public DSN client key into the unsaved tag field to fill:

```html
<script src="https://YOUR_SPOOL_ORIGIN/sdk/YOUR_INGEST_KEY.min.js" crossorigin="anonymous"></script>
```

The SDK bundle is built into Spool and served from its own origin. No CDN fetch is needed. The default loader buffers `init`, `addBreadcrumb`, `captureMessage`, `captureException`, `captureEvent`, `withScope` and `showReportDialog`. An error, unhandled rejection or capture/report-dialog call loads the SDK once; non-capture calls stay queued. `Sentry.forceLoad()` or `data-lazy="no"` loads immediately. Enabling tracing, replay or feedback also loads immediately. Automatic breadcrumbs before SDK initialization are unavailable.

Define `window.sentryOnLoad` before the tag or call `Sentry.onLoad(callback)` after it. Each callback runs once, with a client initialized for that key. Later `onLoad` registrations run immediately. To keep release identity, call `Sentry.init({release: 'web@1.2.0', dist: 'build-42'})` in the callback; the loader retains the key's DSN and settings. Events without a release use ordinary Sentry intake: they are accepted and counted without inventing a release. Matching release/dist events group and count like directly bundled browser SDK events.

Settings apply on the next script load. Disabling the loader and revoking its capture key are separate actions: disabled, revoked and unknown loader keys all answer 404 with no script or DSN. Disabling a loader does not revoke an SDK already loaded by a page. The script contains only the public DSN and that key's options. It is not an origin authorization mechanism: SDK-006 Origin/Referer and allowed-domain enforcement remain at the unchanged intake door. Spool keeps no answer cache or per-visitor state for the script.

Migration `0061_loader_settings.sql` adds configuration without rewriting existing keys. Private archives retain settings and their one-way key hashes, exclude raw keys and credentials, and restore the settings inertly; create new capture keys after restore. Project erasure removes the settings. Maintainer edits use the existing owner permission, same-origin, revision and audit fences (owner remains maintainer until TEAM-001).

Not qualified here: older SDK version tracks, pre-load automatic instrumentation, the hosted legacy report-dialog endpoint, screenshots (disabled for the feedback widget), or a real Sentry organization loader-key inventory and replacement-tag listing. That listing remains MIG-001. Traces and replay still have their named unsupported outcomes; their storage remains with SDK-005/SDK-007/CTX-001/CTX-002/SDK-025. No provider account, device or consent is used.
