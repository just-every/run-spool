# @just-every/spool

Send JavaScript errors from browsers, Node and Cloudflare Workers to your own [Spool](https://github.com/just-every/run-spool) installation. No runtime dependencies; the browser entry is about 5 KB gzipped.

```sh
npm install @just-every/spool
```

As of 2026-10-15, npm serves 0.1.0. This checkout contains owner-held SDK 0.2.0 source, which remains unpublished. Ordinary capture and source-map upload are available in 0.1.0. Exposure signals, the Vite/Rollup upload-count message, long-stack handling and location-tracking improvements described here require 0.2.0; use a separately supplied 0.2.0 artifact or wait for its authorized npm release. Updating the Spool app does not publish or upgrade the SDK. See [CHANGELOG.md](CHANGELOG.md).

Applications that already run a Sentry SDK keep it: this package also ships the guided `spool-setup` command and server-side tunnels for the SDK's `tunnel` option (`@just-every/spool/tunnel`, `@just-every/spool/next`); see [Switching exception intake to Spool](../../docs/SENTRY-SWITCHING.md). Both are in this source and not in the npm 0.1.0 release.

Every event carries the release and build that produced it. Register that release and build in Spool (Releases, or the build plugin below) before you ship: Spool refuses events from releases it does not know.

## Browser

```js
import { init } from '@just-every/spool';
init({ endpoint: 'https://spool.example.com', project: 'web-app', ingestKey: 'YOUR_INGEST_KEY',
  release: 'web@1.4.0', build: 'b1907' });
```

`init` installs once and captures uncaught errors and unhandled promise rejections. Spool must allow your page's exact origin: add it in first run, in Settings or on the project's **Connect** page. Other calls:

```js
import { captureException, breadcrumb } from '@just-every/spool';
breadcrumb('checkout', 'payment submitted'); // explicit labels only, scrubbed, the last 20 are sent
const result = await captureException(error); // { outcome: 'accepted', issue, eventId }
```

The SDK sends with the `fetch` the page had when `init` ran, so a fetch wrapper installed later never sees Spool's requests. `captureException` calls are always sent. Uncaught errors pass two limits, so a page that reports failed requests as errors cannot turn Spool's refusals into a stream of sends, and one noisy error cannot hide a new one:

- **Repeats.** An uncaught error that repeats one from the last 5 seconds (same type, message and top frame) is not sent again.
- **Cap per location.** Each error location (the error's type and top frame: file, function and line; the message is not part of it, as in Spool's issue grouping) sends at most 30 errors at once, then one every 2 seconds. Over that, the newest error at that location waits and is sent as soon as the location may send again; the one it replaces is dropped. Other locations are not affected, so an error thrown from new code is sent at once while another keeps failing.

Nothing is dropped silently. Each uncaught error the SDK does not send settles through `onOutcome` as `{ outcome: 'dropped', reason: 'client_cap' }` or `{ outcome: 'dropped', reason: 'duplicate' }`. For a tracked location, the next event sent there carries the errors not sent since the previous one; Spool adds those counts per issue and shows them as **Not sent by the SDK**, as `client_dropped` in the issues API and in the issue's packet (a `client_dropped` gap). Repeats with no later event at that location are counted only in `onOutcome`. The SDK keeps a bounded location table; it evicts only fully refilled locations with no held error or unreported drops. If no safe spot is available, an unseen error still settles through `onOutcome` without being attributed to another issue. A stack longer than 8,192 characters is cut at a line boundary before it is identified and sent.

Breadcrumbs are never collected automatically: no DOM values, form text, requests or console output. Messages, frames and labels are scrubbed of common secrets before they leave the page, and again by Spool.

### Affected users and flows

To let Spool measure whether a deployed fix reached the users a failure affected, give each install a random identifier and report the flows it reaches (`client`, `anonymousClient()` and `exposure()` need version 0.2.0 or later):

```js
import { init, anonymousClient } from '@just-every/spool';
const spool = init({ endpoint, project, ingestKey, release, build, client: anonymousClient() });
spool.exposure('checkout');
```

`anonymousClient()` keeps a random 32-character identifier in `localStorage` under `spool.client` (a fresh one per call if storage is unavailable). Pass your own random value instead if you prefer; it must never be a name, address or account ID. `exposure()` settles with Spool's outcome and never throws.

## Node

```js
import { init, captureException } from '@just-every/spool/node';
init({ endpoint: 'https://spool.example.com', project: 'api', ingestKey: process.env.SPOOL_INGEST_KEY,
  release: 'api@2.0.1', build: process.env.GIT_SHA });
await captureException(error);
```

`init` reports uncaught exceptions and unhandled rejections, then prints the error and exits with code 1 as Node would (it waits at most `exitTimeoutMs`, 2000 by default, even if `fetch` never settles). Only the first uncaught error is reported and printed; later ones while it is being reported are ignored, as Node would never have run them. If your code also listens for `uncaughtException`, the process is left to your handler.

## Observed sessions

The unpublished SDK source in this checkout also supports opt-in release health. Add `sessions: true` to browser or Node `init`. A browser page is one session; `pagehide` or `close()` finishes it, and a page restored from the browser's back-forward cache starts a new session. An uncaught browser exception is recorded as **unhandled**, not as a browser process crash. Node observes one process session, finishes a healthy process on `beforeExit`, and records a fatal uncaught exception as **crashed** before the existing bounded exit. A handled exception increments the observed error count without claiming a process crash. Error outcomes and usage stay separate from session outcomes.

For explicit boundaries, `startSession(options)` is exported from the browser, Node and Worker entries:

```js
import { startSession } from '@just-every/spool/worker';
const session = startSession({ endpoint, project, ingestKey, release, build });
try {
  const response = await handle(request);
  ctx.waitUntil(session.end());
  return response;
} catch (error) {
  ctx.waitUntil(session.recordError(true));
  throw error;
}
```

`session.end()` is idempotent. `session.flush()` waits for its latest observation; an initialized browser or Node client exposes `flushSessions()` too, including after `close()`. `sessionSampleRate` selects sessions with a probability from 0 to 1, default 1. `onSessionOutcome` receives accepted, rejected, dropped or unknown outcomes separately from `onOutcome`. Sampling and backpressure drops are named locally; a transport failure remains unknown. There is no durable offline queue, retry or server-side accounting of observations that never arrive. A later explicit observation of the same session keeps its original SID and start time. At most one request and the latest pending observation are kept in memory; each request has a five-second deadline.

The project ingest key and browser origin rules protect the native session door. Its project-minute budget and category header are shared with Sentry sessions; the SDK honors bounded session backoff while error capture continues. An optional random `client` becomes a keyed per-project session identifier; without it, user rates are unavailable. The SDK does not invent an install identity or collect device details. Reports describe observed sessions and known users, with uncertainty; neither sampling nor an absent exception proves healthy exposure. Native device modes, request aggregation, device and OS cohorts, and full identity policy remain gaps in SDK-005.

## Cloudflare Workers

```js
import { captureException } from '@just-every/spool/worker';
export default {
  async fetch(request, env, ctx) {
    try { return await handle(request, env); }
    catch (error) {
      captureException(error, { endpoint: env.SPOOL_ENDPOINT, project: 'edge', ingestKey: env.SPOOL_INGEST_KEY, release: 'edge@3', build: env.BUILD }, ctx);
      return new Response('Internal error', { status: 500 });
    }
  },
};
```

The capture is passed to `ctx.waitUntil`, so the response does not wait for Spool and the Worker stays alive until Spool answers.

## Outcomes

Every capture settles with Spool's answer: `accepted` (with the `issue` it joined), `duplicate`, `rejected` (with a `reason`, such as `unregistered_release_or_build`), `dropped` (over the project's minute or storage budget) or `unavailable`. `unknown` means the request did not complete; it is never reported as success. Pass `onOutcome` to `init` to see each one.

The SDK never throws into your code or replaces your error: no function throws, no promise rejects, whatever was thrown and wherever it runs (a page without `crypto.randomUUID`, no `fetch`, Spool unreachable). What it could not send settles as `rejected` with a `reason`: `invalid_options` (a wrong or missing `init` option, named in `detail`), `not_initialized` (a capture before `init`), `no_parseable_stack` (a thrown value without a stack, such as a string) or `invalid_event`. Wrong options do not stop your app from starting, so check `onOutcome` once after setup.

## Source maps

Spool maps minified frames to your original source with the maps you upload. Uploading needs a project **deploy key** (Settings), which can only register releases and upload maps. Keep it in your build's environment and pass the variable's name, never the key.

Vite or Rollup:

```js
import { spoolSourceMaps } from '@just-every/spool/vite';
export default {
  build: { sourcemap: true },
  plugins: [spoolSourceMaps({ endpoint: 'https://spool.example.com', project: 'web-app', release: 'web@1.4.0', build: 'b1907', keyEnv: 'SPOOL_DEPLOY_KEY' })],
};
```

Any other bundler, after the build:

```sh
npx spool-sourcemaps --endpoint https://spool.example.com --project web-app \
  --release web@1.4.0 --build b1907 --key-env SPOOL_DEPLOY_KEY dist/app.js
```

Both register the release and build, add a debug ID to each bundle and upload its map; a failed upload fails the build. The SDK reads those debug IDs at capture time, so `init` needs no extra option.

## Already using Sentry?

Spool also accepts errors from the unmodified Sentry browser and Node SDKs: replace only the DSN with the one Spool shows for your project. See the [switching guide](https://github.com/just-every/run-spool/blob/main/docs/SENTRY-SWITCHING.md).

MIT licence.
