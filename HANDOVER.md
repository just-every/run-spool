# Spool handover

## Product and source

Spool is a local-first JavaScript evidence product with one owner and multiple isolated projects. `src/**` is authoritative. Keep the package, seed, repository, edition/source identities and lowercase API/asset paths stable. Base runtime CLI, onboarding, operator-auth, mail, portability and deploy-kit retain the adoption pin recorded in [base-copies.json](base-copies.json); retained source and copy records describe that adoption. Refresh Base only through the recorded authoring/export workflow; never regenerate application code over `src/**`.

The public `node scripts/rer.mjs` lifecycle installs, sets up, serves, verifies, resets and transfers local data. Setup claims or preserves one real owner through native operator-auth, requests ordinary sign-in in the loopback outbox and stops its temporary app. Dev reports ready after health succeeds and stays in the foreground. Dev opens the native owner through the private checkout key by default; `--login` uses ordinary outbox sign-in. The outbox requires that key as well as loopback/request checks. Setup, dev, verify and deploy dry run do not provision remote resources.

The product stores scrubbed D1 events with bounded private source maps, grouping, revision-aware triage, project browser-origin policy, Base portability with native v1/v2 compatibility and manual retention. Owner sessions, ingest keys, read-only agent grants and release/map-only deploy keys have separate authority. Every private handler rechecks native owner or exact project authority directly; preserve the auth, origin, secrets and dispatcher boundaries in [AGENTS.md](AGENTS.md).

Alerts record new issues, later-release regressions and server-received window spikes with rules and delivery logs. The scheduled Worker evaluates windows and dispatches persisted delivery jobs. Base Mail requires provider acceptance. HMAC webhooks leave only through the `INTEGRATION_EGRESS` binding to a separately installed enforcing egress service; there is no ordinary-fetch fallback. Base's egress service is copied at `src/modules/egress-service` (its own Worker); the shipped deploy.json declares no binding, so webhooks stay off until the owner installs that service and adds the `services` entry in docs/ALERT-WEBHOOKS.md.

Supported Sentry exception envelopes/store intake share native admission and scrubbing; unsupported telemetry is counted and discarded. The source-map CLI/Rollup/Vite plugin uses a project deploy key only for release registration and map upload. Breadcrumbs remain an unpublished workspace package. The owner-only Base import-kit adapter provides reviewed dry run, apply/resume and guarded undo; qualification is synthetic-fixture-only until a real owner export passes and is reconciled. The homepage says Spool is a 100% free, open source alternative to Sentry, Bugsnag and Rollbar, naming them only as what it replaces (owner decision, 12 Oct 2026); no feature-parity or completed-migration claim is made.

Managed producer/package/setup metadata, additive durable one-owner claim and optional native-owner-gated editor are implemented source. Editor configuration cannot be authorized by a project grant. The operations check covers source and generated local inputs; hosted installation and edit-to-source acceptance remain separate.

## Verification evidence

The full verify covers real runtime/product/CLI journeys at 1440 and 390, alert outbox/HMAC/rules/delivery, second-origin mapped capture and regression triage, unmodified Sentry browser/node 11.6.0 programs changing only the DSN, fixture import dry run/apply/guarded undo and scopes, and signed first/second claim plus editor at both widths with CSP and logout revocation. [ACCEPTANCE.md](ACCEPTANCE.md) describes the required evidence.

The owner's completion report records exact final heads and actual CI, final local verification, responsive review, local operations and clean-history publish-check results. This handover describes source and required checks; it does not assert those results or replace live/provider acceptance.

## Data custody and owner boundary

Setup preserves the owner and domain data, applies additive migrations and refuses ambiguous legacy state. Recovery requires a private full-database copy with the original configuration and migration ledger; a domain archive excludes credentials. Archives include private maps and browser-origin policy but exclude owner sessions and grants. Restore requires an empty destination and creates neither owner nor grants. Retention remains manual and preserves its visible cutoff, occurrence tombstones and deduplication horizon. Follow [OPERATIONS.md](OPERATIONS.md) before resetting or transferring evidence.

BASE-DATA-003 project erasure is implemented at `c279cd2d1fc02acfbc1160201782935e5324ddef` (GitHub Verify run 38215335300) on Base main's erasure helper (see docs/PROJECT-ERASURE.md): an owner-only route and Settings panel with a count-only preview, typed confirmation and a counts-and-times receipt; one fenced cascade over every project table, anonymised audit, restore fences and the 300-second cap are proven by `test:project-erasure` in verify. One helper file, `src/modules/erasure/plan.mjs`, carries a one-line correctness fix not yet on Base (recorded as an adapted file in edition.json; every other helper file is a byte-identical copy record). Retention remains separate and does not erase a project.

The owner retains Sentry credentials and real export reconciliation, live accounts and mail sender configuration, provider/deploy calls, npm/public visibility changes, repository rename, tags, installation receipts and paid calls. Local deploy dry run makes no provider request. Those external actions require their own authorization and evidence.
