# Spool demo

`rer demo` (`rer dev --demo`) starts a disposable local Spool with the saved
owner signed in. Use the private `RER_OPEN` link it prints. Never share that
link. Stop it with `rer demo --stop` or Ctrl-C. Demo data lives under
`.rer/demo/<start>/` and is deleted on stop or expiry; `.wrangler/state` is
not used. A normal local installation is prepared with `rer install` and
`rer setup` before the first demo.

The sample project `cedar-market` (Cedar Market · Storefront) has 288 historical
sample events in six native error groups, three releases, production/staging
environments and open, acknowledged, resolved and suppressed states over the
last seven days. `src/demo.ts` normalizes and groups generated sample envelopes
and writes them through Spool's existing native import store adapter. These
are sample records, not traffic from a real shop. Historical evidence does not
fabricate new-issue notifications. Fixed identities and absent-only writes
preserve edits on repeat calls and allow an interrupted seed to finish.

The first import in `src/server.ts` is Base's unchanged `withDemo` guard.
It limits fetch and sockets to loopback, captures refused sends, seeds once
after the owner exists, and adds the Demo bar. `demoSockets()` is first in
Vite's plugins; demo state, mode and expiry are passed to the runtime. The
Base copy and its exact revision are recorded in `base-copies.json`.

In demo mode, sign-in and alert mail use the development outbox, including
hosted HTTPS demos. This exception changes mail capture only: local auth,
private outbox access and normal owner claims keep their existing gates.
The demo bar shows captured mail without exposing the private outbox route.
The sample project's deployment-owned destinations are `demo-mail` (the demo
owner's outbox) and `demo-webhook` (`https://hooks.example.com/spool-demo`).
The webhook is deliberately unconfigured because `INTEGRATION_EGRESS` is
absent; a rule can record its refusal, but no HMAC request can leave. Runtime
demo configuration derives a per-demo destination integrity key from the
existing session secret and never uses a real mail provider or egress binding.
Outside `RER_DEMO=1`, this configuration and seeding do nothing.

To explore through the owner UI, open Cedar Market, inspect an issue and its
sample stack, change its triage state, or add an alert rule. The corresponding
public APIs are `GET /api/projects`,
`GET /api/projects/cedar-market/issues`,
`GET /api/projects/cedar-market/releases`, and
`GET /api/projects/cedar-market/alerting/destinations`.
Owner writes require the normal session and exact Origin header. Mint a new
ingest credential through `POST /api/projects/cedar-market/keys` with
`{"kind":"ingest"}` and submit an envelope to
`POST /api/ingest/cedar-market` using that bearer token. Local dev credentials
also require the local dev gate. The sample's newest release/build pair is
`storefront@2.9.0` / `cedar-290`.

## Hosted demo

`deploy-demo.json` declares `run-spool.com`; the front serves
`https://demo.run-spool.com/`. Each visitor gets a separate disposable
container after Turnstile, with no internet, a 60-minute lifetime, a 15-minute
idle limit and a ten-container cap. Every application request, including
public ingest, is behind the front's visitor cookie. The container's owner
claim trusts the runtime `AUTH_ORIGIN` only in demo mode; normal deployments
still require `RER_OWNER_CLAIM_APP_ORIGIN`.

The Run demo workflow is manual only. It uses the `run-demo` GitHub environment
and the RunEditRun account `b20c0ca9cab0c2b70e13d7cf724b89bd`, with environment
variable `TURNSTILE_SITE_KEY` and environment secrets `CLOUDFLARE_API_TOKEN`
and `TURNSTILE_SECRET_KEY`.
Production requires real Turnstile keys. `RER_DEMO_OPERATOR_TOKEN` is an
optional environment secret for Base's authenticated operator view. No
repository variables enable deployment. The account needs Workers Paid and
the token needs Containers edit alongside the existing Worker/route rights.

Dispatch with `test_only=true` for `demo-test` at
`https://demo.test.run-spool.com/`, using Cloudflare's published always-passing
Turnstile test keys. Dispatch with `remove=true` and `test_only=true` to remove only the test
demo's owned resources. Production removal is refused by this workflow. The test removal command is:

```sh
# First set deploy-demo.json domain to test.run-spool.com, as the workflow does.
pnpm exec rer deploy --demo --remove --yes --environment demo-test
```

No hosted deployment or live container isolation is claimed by this adoption.
Local evidence, typecheck and relevant existing test results are recorded in
the task's external evidence folder; a hosted proof and owner go-live remain
separate. No homepage CTA is added here.
