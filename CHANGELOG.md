# Changelog

## 0.3.0 — 2026-10-18

Back up first: export a private archive before updating (Settings → **Download private archive**, or stop local dev and run `rer export`). Then run `git pull` and `rer dev` in the existing checkout, or `rer deploy` from the original deploying checkout for a hosted installation. Keep the existing database; no reset or restore is needed.

### What an owner gets

- **Bring Sentry history in through the import door.** Settings → **Business imports** turns on Base's grant-authorised import door (off by default). A signed upload of an owner-generated `spool-sentry-org-export` bundle is planned, applied against the reviewed fingerprint, reconciled and undoable; the Settings row lists each import with who approved it and its fingerprint. Imported projects, releases and issues sit beside new errors in the same project, carry scrubbed text and stay inert: no alerts, keys or sessions are created. Create an ingest key and DSN for the imported project and new errors land next to its history. The owner-session importer `scripts/sentry-import.mjs` remains documented in [Switching from Sentry](docs/SENTRY-SWITCHING.md).
- **Search and export every retained issue** with field queries (`environment:`, `error.type:`, `release:latest`, `before:`/`after:`), and download matching results as JSON or CSV ([search](docs/INVESTIGATION.md)).
- **Bulk triage with preview:** select issues on a page, preview, then acknowledge, resolve in the current release or reopen them atomically ([bulk triage](docs/BULK-TRIAGE.md)).
- **Read every retained event of an issue,** including complete Sentry exception chains, with tag summaries and previous/next navigation ([event investigation](docs/EVENT-INVESTIGATION.md)).
- **Inbound filters** for browser extensions, crawlers, legacy browsers, localhost, IP ranges, message patterns, releases and environments, applied before grouping, alerts and usage ([inbound filters](docs/INBOUND-FILTERS.md)).
- **Sentry text feedback** from `captureFeedback` and `user_report`, reviewed privately with durable withdrawal ([feedback](docs/FEEDBACK.md)).
- **SDK discard reports:** Sentry `client_report` quantities show in Capture receipts and repair evidence, separate from accepted events ([discard reports](docs/CLIENT-REPORTS.md)).
- **Recorded repository source:** stack frames link to the exact repository revision a release's deployment manifest records ([repository source](docs/REPOSITORY-SOURCE.md)).
- **Alert email destinations managed from Alerts → Rules,** with a test send; alert emails and the delivery log open the selected issue.
- Capture's source-map setup is self-contained on the page; issue results stay visible while they refresh; GitHub preview effects are declared for fix branches.

### This release's gate

Run on `main` at `ffdd4991` before this record was written. Locally (1440 and 390), a v0.2.0 install with a resolved issue was upgraded with `git pull` and `rer dev`: migrations 0037–0041 applied and the project, issue and its triage state were kept. The repository's synthetic Sentry export (`tests/fixtures/sentry/organization.json`) moved in through the import door, an unmodified `@sentry/node` 11.6.0 app with only its DSN changed sent errors that grouped into one issue beside the imported one, the new issue was resolved and the imported one suppressed, and the alert feed showed the new-issue alert. Hosted, a fresh `rer deploy` to Cloudflare with SendGrid signed the owner in by an emailed link, took the same export through the owner-session importer, grouped the same Sentry-SDK errors beside it, delivered the new-issue alert email to a real mailbox with a working issue link, and resolved and suppressed the two issues. These are the only acceptance claims of this release.

### Not in this release

- **Homepage claims still ahead of the code:** "alternative to Sentry, Bugsnag and Rollbar" — Sentry intake and import are bounded (below) and there is no Bugsnag or Rollbar import or SDK compatibility; "Export everything to one file" — archives refuse a project above 10,000 events or 20 maps and exclude the import journal; "Node 22 and pnpm are all you need" — rer now supplies pnpm and the pinned Node.
- The Sentry importer is qualified with synthetic fixtures only; a real organization export has not been reconciled. No feature parity or completed migration is claimed.
- Self-hosted `rer deploy` declares no import-door trust bindings (`RER_OWNER_CLAIM_*`), so a self-hosted installation shows the door as needing configuration; the door is for installations that carry those bindings, such as RER Managed.
- Per-project limits are unchanged: 120 outcomes a minute, 10,000 retained events, 20 flat source maps of 256 KiB; indexed maps and `sourceRoot` are not supported. The contract's GOV-003 and SRC-004 carry the larger targets.
- SDK 0.2.0 remains owner-held and unpublished; `npm install @just-every/spool` resolves to 0.1.0. The app release does not publish the SDK.
- The application pins rer 0.2.49.

### Known issues

- Imported issues carry no "imported" label in the issue list; the issue page marks them "Imported historical evidence".

### Migrations

Additive, applied automatically: `migrations/core/0037_alert_destinations.sql`, `0038_investigation_indexes.sql`, `0039_inbound_filters.sql`, `0040_feedback.sql`, `0041_business_import_door.sql` (41 total).

### Carried from the untagged 0.2.1 record (16 October)

- Keep local development mail silent and open the owner through the private `RER_OPEN` entry. Remove captured-mail pages and preserve native hosted sign-in and erasure checks.
- Adopt rer 0.2.24 with its matching Base records, bounded archive I/O and resumable import custody helpers; keep the populated demo work and its runtime-only sender configuration.
- Keep push verification sharded within its time budget; run the slower public command journey on release tags and nightly. Fix the owner-erasure test runtime’s transport-port race.
- This is a compatibility and security patch over 0.2.0, with no product migrations or contract changes. Export before updating, preserve the existing installation and restart with `rer dev`. SDK 0.2.0 remains unpublished.
- Product screenshot: [Cedar Dispatch issues at 1440](.github/assets/release/spool-0.2.1-issues-1440.png), captured from the current local app with synthetic business data and real SDK ingestion.

- Mark credential fixtures and examples explicitly synthetic so hosted source checks accept them.

- Pin rer 0.2.23 and adopt Base's Worker-compatible Managed mail transport and relay headers; remove the local redirect shim. Prefill owner sign-in from `login_hint` using Base's email policy and explain unavailable mail in plain language. Clarify deploy, sign-in, capture and release documentation after the passing stranger journey.

- Pin rer 0.2.22 and support Base's `rer` mail adapter for RER Managed sign-in and alerts. RER supplies and hides the mail settings, with no provider account or copied key; Free and Assisted self-hosting provider choices remain unchanged.

- Fix local capture and source-map uploads with dev-created project keys, including Capture test exception; keep owner and agent access gated and refuse dev grants on hosted installations. Pin rer 0.2.22, document dev v2 and private agent setup, and explain that restored installations require fresh project keys.
- Fix-branch grants now accept a minted GitHub token only when GitHub reports its repositories as exactly the granted one (case-insensitive); a missing, empty, wider or different list revokes the token unused and refuses with a plain reason.
- The reproducer button reads "Record reproducer" with the occurrence id beside it, and Spool's sample error no longer offers the form. The release form leads with name and build; the deployment manifest and server (Go/Python) path-mapping fields sit under an optional section.

## 0.2.0 — 2026-10-15

- Reproduce supported mapped JavaScript failures in an isolated local sandbox, propose a GitHub fix branch under an explicit expiring grant, and measure rollout with affected-client and flow reports. Missing coverage remains inconclusive; exposure signals require the unpublished SDK 0.2.0.
- Accept bounded native and Sentry Python/Go exception evidence and the documented OTLP/HTTP JSON error-log profile. Python/Go source evidence does not enable JavaScript source maps or sandbox execution; traces and metrics remain unsupported.
- Add occurrence split/merge previews, guarded correction undo, operator-label assignment, literal suppression policies and release/environment deployment manifests.
- Add owner self-erasure after a verified successor handoff, with explicit attribution holds and restore fences; preserve owner-only project erasure and its external-copy limits.
- Add a private, one-use owner sign-in link through `rer signin` for the original hosted deploying checkout when mail is unavailable.
- Keep issue grouping stable across recognized JavaScript bundle content hashes while preserving distinct named files and original occurrence provenance.
- Keep exposure storage available at capacity by evicting the oldest rows and reporting the eviction. Manual retention removes exposure by its last report; discarded denominators keep measurement inconclusive.
- Explain first-run dev-key scope and the ordinary-sign-in steps needed to connect external apps, builds and agents.

### Upgrade from 0.1.0

Stop local dev with `rer dev --stop` and export a private archive before updating. In the existing checkout, run `git pull`, then `rer dev` for local use. For hosted use, retain the original deploying checkout, its private deployment receipt and account settings, then run `rer deploy` after updating it. Additive migrations `migrations/core/0020_dependencies.sql` through `migrations/core/0036_owner_signin.sql` apply automatically (17 new migrations, 36 total). Existing evidence, triage states and project keys are preserved. Keep the existing database and private settings; no reset or archive restore is needed for this upgrade.

SDK 0.2.0 remains owner-held and unpublished on npm. `npm install @just-every/spool` currently resolves to 0.1.0; the app version and tag do not publish the SDK. See [SDK changes](packages/sdk/CHANGELOG.md) and [exposure requirements](docs/REPRODUCE-AND-FIX.md#3-did-the-fix-reach-the-affected-users).

## 0.1.0

First public release: one owner, isolated projects, bounded JavaScript evidence and source maps, triage and regression, read-only agent access, private archives and empty-target restore.
