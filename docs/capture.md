# Connect your app

Spool learns about errors from your application through Spool's own SDK, `@just-every/spool`. Every error belongs to a project and to a release you have registered, so Spool can tell which build it came from.

The **Capture** page in Spool walks through these steps for the selected project and fills in its own address and the latest release for you.

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

Upload the `.map` file for each bundle of that release and build in **Releases**. Spool keeps maps private and never fetches source files from the internet. A project holds up to 20 maps of 256 KiB each.

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

Each bundle needs its `.map` next to it. Both register the release, mark each bundle so the SDK can match its errors to the map, and upload the maps. The command-line tool prints how many maps it uploaded; the Vite/Rollup plugin prints that count in SDK 0.2.0, while the published 0.1.0 plugin is silent on success. A failed upload fails your build.

## 4. Check it works

When you create a project, **Send test error** registers the release shown and sends one real error with the new key. The **Capture** page can also send a test exception with your ingest key. It appears in **Issues**, with its stack mapped to your original source once the matching map is uploaded.

## Keys for anything outside this checkout

The default `rer dev` owner persona marks ingest, deploy and agent keys as dev-minted. Those keys require the checkout's private dev gate on each request, so copying them into a separate application can return `invalid_ingest_key`.

To connect an external app, build or agent:

1. Stop the current runtime with Ctrl+C or `rer dev --stop`.
2. Run `rer dev --login` from the Spool checkout.
3. Open its private `RER_OPEN` outbox link, choose the newest sign-in message and follow its one-use link. If needed, request a new message at the printed `RER_SIGN_IN` address and run `rer outbox` in another terminal. Local sign-in sends no email.
4. Open Settings and create replacement keys for the intended project. An ingest key sends events; a deploy key registers releases and uploads maps; an agent key reads that project's evidence. None grants owner administration.
5. Put the new ingest key in your app's SDK configuration and the deploy key in your build's private environment. Register the release/build and allow your app's exact browser origin before capture. Replace the old dev-minted keys in every external client.

Ordinary keys created after this sign-in do not need the dev gate; their project and operation scopes still apply. Keep `RER_OPEN` and the dev gate private to the checkout: the gate can open the owner persona. Browser capture deliberately omits credentials, so do not try to share that gate with your app. Hosted keys created through ordinary email sign-in use the same project scopes.

## Already using Sentry? Point your DSN here

Spool also accepts JavaScript errors from the unmodified Sentry browser and Node SDKs. Replace only the DSN with the one Spool shows for your project, and keep your release and dist settings. Spool keeps the exceptions and their stack traces; it does not keep sessions, traces, replays or attachments. The [switching guide](SENTRY-SWITCHING.md) has the details.

See [supported languages](SUPPORTED-LANGUAGES.md) for the exact native/Sentry Python and Go grammars, limits, repository path mapping, privacy and unavailable symbolication.
