# Connect your app

Spool learns about errors from your application through Spool's own SDK, `@just-every/spool`. Every error belongs to a project and to a release you have registered, so Spool can tell which build it came from.

During first-project setup, **Send test error** checks the new key and release from Spool itself; choose **Continue to workbench** afterwards. To check errors from your own application, follow the steps below.

The **Capture** page in the workbench walks through these steps for the selected project and fills in its own address and the latest release for you.

## 1. Add the Spool SDK

Install the package and initialise it once in your application, with your Spool address, the project and its ingest key:

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
