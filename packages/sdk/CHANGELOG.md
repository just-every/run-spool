# Changelog

## Unreleased

- `@just-every/spool/tunnel` (`spoolTunnel`, `nodeTunnel`) and `@just-every/spool/next` (`spoolTunnelRoute`): server-side tunnels for the Sentry browser SDK's `tunnel` option, so browser capture survives ad-blockers. An envelope is forwarded only when its DSN is one the tunnel was configured with. Redirects are never followed (502), only `POST` is accepted, an abandoned upload or odd request never ends the host process, and the 1 MiB limit is enforced while the body is read and inflated.
- `spool-setup` bin: detects Next.js or Django, prints the change as a `git apply` patch, writes it with `--apply`, installs the SDK with `--install` and sends a test event first; a DSN Spool does not accept, a secret-key or malformed DSN, a link or hard-linked file on a path it writes (also one swapped in during the test event) or a settings module that is not a dotted name writes nothing, and it never writes through a link or into an existing file in place. Other frameworks get guidance.

## 0.2.0

2026-10-15 — unpublished, owner-held source release. npm currently serves 0.1.0. The Spool app's 0.2.0 release does not publish this SDK.

- Optional `client` option: a random install identifier (16 to 64 letters, digits, `-` or `_`) sent with errors so Spool can count affected users; the browser `anonymousClient()` makes one and keeps it in `localStorage` under `spool.client`.
- Browser `exposure(...flows)` reports that the page reached named flows (at most 20) in this release, with capture installed. It needs `client`, never throws, and settles with Spool's outcome.
- The Vite/Rollup plugin reports `Uploaded N source maps.` after a successful upload; the published 0.1.0 plugin does not print this count.
- Long browser stacks are cut at a line boundary within 8,192 characters before identification and sending, preserving usable error evidence.
- Browser location tracking is bounded and evicts only fully refilled locations with no held event or unreported drops. A new location at capacity still reports its outcome without assigning its drops to another issue.

## 0.1.0

- First release of `@just-every/spool`: browser `init` (uncaught errors and unhandled rejections, explicit scrubbed breadcrumbs), Node `init` (reports uncaught exceptions, then exits as Node would), Cloudflare Workers `captureException` with `ctx.waitUntil`, typed release and build identity, the `spool-sourcemaps` CLI and the `/vite` (Rollup) plugin. No runtime dependencies.
- The SDK never throws into or replaces the app's own flow: every function settles with an outcome for any thrown value and in any environment (pages without `crypto.randomUUID`, no `fetch`, Spool unreachable); wrong options settle as `rejected` with reason `invalid_options` instead of throwing; the Node handler always prints the app's own error and exits 1.
- The SDK cannot feed back on itself: it sends with the `fetch` present at `init`, and the browser listener drops an uncaught error repeating one sent in the last 5 seconds and sends at most 30 per minute, so a page whose fetch wrapper reports Spool's refusals as errors sends a handful of requests instead of thousands. The Node handler prints the app's first uncaught error and exits 1 even when `fetch` never settles, ignoring later throws while it reports.
- One noisy error cannot hide a new one, and nothing the browser listener drops is silent: the cap applies per error location (type and top frame, message excluded; 30 at once, then one every 2 seconds), the newest error over the cap is sent once its location may send again, each dropped error settles through `onOutcome` as `dropped` with reason `client_cap` or `duplicate`, and the next event from that location carries the drop count, which Spool shows on the issue (`client_dropped`).
- A burst of distinct errors cannot freeze the page or fill its memory: the browser listener's repeat map prunes only what has expired and holds at most 256 entries, so the cost of each error stays constant however many arrive at once.
