# Changelog

## 0.6.0 — 2026-10-20

Back up first: export a private archive before updating (Settings → **Download private archive**, or stop local dev and run `rer export --output exports/spool.rer`). In a checkout of `main`, run `git pull` and `rer dev`; in a checkout of an earlier tag, run `git fetch --tags && git checkout v0.6.0` and `rer dev`. For a hosted installation, run `rer deploy` from the original deploying checkout. This release adds three migrations (`0054` through `0056`, 56 in total), which `rer dev` and `rer deploy` apply; keep the existing database, private settings, project keys and deployment receipts, and do not reset or restore into the populated installation.

### What an owner gets

- **Resolve in the next release or a named release (SDK-009).** The issue page and bulk triage offer **Plain · next accepted event**, **In current release**, **In next release** and **In a named release**. Next release freezes the latest release under the project's ordering rule and reopens only above it; a named release reopens at that release or later; an older-release event never reopens either. A Sentry event without a dist is now kept apart from one that sends the literal dist `sentry-no-dist`, and repeats with no release after a release resolution are counted on the issue without reopening it ([Sentry releases](docs/SENTRY-RELEASES.md)).
- **Needs attention and an alternate destination (ALERT-004).** **Alerts → Needs attention** lists every alert send pending for five minutes, every alert open and unacknowledged for 24 hours, every passed deployment deadline and every expired fix lease, with its attempts and one audit fact each. A project can name one existing destination as its alternate (default **No alternate**); it gets one notice per item, and a failed alternate notice is shown but never sends another. A send whose outcome is unknown needs your explicit reconciliation or resend. Restored history never sends.
- **Fuller Sentry events (SDK-010).** Admitted Sentry SDK events keep the whole exception chain and exception groups, full frames with SDK-sent source context and local variables (secret-named variables masked), tags, contexts, message events and the request URL, method and allowed headers. Query strings keep their diagnostic parameters after scrubbing. Each event names what it excludes: user identity and request cookies, bodies and environment are not captured yet.
- **Archives without audit history restore.** An archive whose safe audit payload is empty (an installation with rows but no recorded audit facts, such as a database RER Platform migrated and filled) now restores, with no carried facts. A truncated or garbled payload is still refused as `invalid_safe_audit_archive`, and nothing is restored.
- **0.5.1 archives restore into 0.6.0.** This release's gate found that every archive written by 0.5.1 was refused by `rer import` with `schema_mismatch`, because the three new migrations add no archived table and only the newest was recorded. Fixed before release (`94d607d`).
- **Large Sentry imports and Business cutover (rer 0.2.72).** The application pins rer 0.2.72, with every Base copy refreshed from it. The import door creates multi-megabyte imports in bounded steps, so a 150-issue (1.4 MB) organization import no longer exceeds one import request. Erasing an imported project also withdraws the import tool's archived exports. RER Business installations gain a read-only, RER-signed cutover status read (`POST /api/rer/cutover-status`).

### This release's gate

Gated on `94d607d` (main `77b289b` plus this release's restore fix, rer 0.2.72): on a pristine checkout `pnpm install --frozen-lockfile` and `rer check --profile first-party` passed every clause, SC-13 included. Locally at 1440 and 390, an owner created a project from `/setup`, the documented Node SDK (`@just-every/spool/node`, published 0.1.0) sent a real thrown error twice into one grouped issue, the alert feed showed the new-issue alert, the owner resolved it, and the same error in the next release reopened it as "Regressed in web@1.1.0" with a regression alert. The same loop ran on a fresh Cloudflare deployment with SendGrid: emailed sign-in, a delivered new-issue alert email whose link opened the issue, and a delivered regression email. A populated 0.5.1 installation (all three key kinds, releases, a private map, open, resolved and suppressed issues, grouping rules, inbound filters, an alert rule and RER Platform's `rer_migrations` ledger) upgraded in place with `rer dev`: `0054` through `0056` applied, every row of every table was kept, its 0.5.1 ingest key still authenticated and its 0.5.1 inbound filter still applied. Two `rer export` archives written by 0.5.1 from databases carrying that ledger, one populated and one with an empty safe audit payload, restored with `rer import` into fresh installations with every carried row and audit fact.

### Not in this release

- **Homepage claims still ahead of the code:** "alternative to Sentry, Bugsnag and Rollbar": Sentry intake and import are bounded (below) and there is no Bugsnag or Rollbar import or SDK compatibility. "Export everything to one file": archives refuse a project above 10,000 events or 20 maps, exclude alert email destinations (restored alert rules are disabled), deployment callbacks and notices, follow-up queues and attempts, and the import door and its journal. "Node 22 and pnpm are all you need. Setup asks for your email": rer supplies pnpm and the pinned Node, and first `rer dev` chooses a local owner without asking. "Every feature, on your own computer": local development suppresses all mail, so sign-in, alert, deadline and alternate-destination email need a hosted installation with a mail provider.
- SDK-010 was qualified with unmodified Node and browser SDKs and constructed Python and Java envelopes; unmodified Python and Java SDK runs (SDK-001) are not done. Sessions, traces, replays and the other Sentry item types stay unsupported (SDK-005, SDK-007).
- Needs attention is qualified with test receivers at the network edge; no real chat, paging or ticket channel is certified. The owner is the accountable and alternate operator until project roles (TEAM-001).
- Release resolution from commits and pull requests (TEAM-004) and unmodified `sentry-cli` or build-plugin registration (SRC-003) are not implemented; deployment history still takes no repository read-back (SRC-002).
- Sentry intake stays bounded: no Brotli or zstd, no streaming size limits beyond the current 256 KiB compressed and 1 MiB expanded, and user identity diagnostics remain partial (SDK-008, SDK-011).
- The Sentry importer is qualified with synthetic fixtures only; a real organization export has not been reconciled. No feature parity or completed migration is claimed.
- Self-hosted `rer deploy` declares no import-door trust bindings (`RER_OWNER_CLAIM_*`), so Business grants and the cutover read stay unavailable there.
- Per-project limits are unchanged: 120 outcomes a minute, 10,000 retained events, 20 flat source maps of 256 KiB; indexed maps and `sourceRoot` are not supported.
- Hosted project erasure timing on D1 is not measured.
- SDK 0.2.0 remains owner-held and unpublished; `npm install @just-every/spool` resolves to 0.1.0. The app release does not publish the SDK.

### Known issues

- **Retrying a cut-off hosted restore at once is refused for up to five minutes.** Right after a hosted restore is cut off, a retry can answer `Storage operation not confirmed` and then `import_running` until the cut-off restore's lease lapses (five minutes after its last activity); the page does not show that time. Wait, then restore again; it completes. The `/setup` error also offers an unrelated "Sign in again".
- Imported issues carry no "imported" label in the issue list; the issue page marks them "Imported historical evidence".
- The Sentry SDK's default deduplication drops an identical exception repeated within one process, so a single run reports it once; separate runs group into the same issue.

### Migrations

Three: `0054_release_resolution_dist.sql` (rebuilds `issue_resolutions` with the next and named resolution modes, keeping every row, and marks retained Sentry events that arrived with no dist as `[sentry:no-dist]`), `0055_follow_up.sql` (alternate destinations, Needs attention items, notices and their audit links; existing alerts are recorded as local feed history) and `0056_import_door_archives.sql` (the import door's archive tables, which private archives exclude). Upgrading from 0.5.1 applies these three; upgrades from earlier releases also apply the migrations listed under those releases below.

## 0.5.1 — 2026-10-19

Back up first: export a private archive before updating (Settings → **Download private archive**, or stop local dev and run `rer export --output exports/spool.rer`). In a checkout of `main`, run `git pull` and `rer dev`; in a checkout of an earlier tag, run `git fetch --tags && git checkout v0.5.1` and `rer dev`. For a hosted installation, run `rer deploy` from the original deploying checkout. This release adds five additive migrations (`0049` through `0053`, 53 in total), which `rer dev` and `rer deploy` apply; keep the existing database, private settings, project keys and deployment receipts, and do not reset or restore into the populated installation.

### What an owner gets

- **An interrupted hosted restore no longer blocks the installation.** 0.5.0's known issue is fixed: a restore cut off mid-way (tab closed, connection dropped) now holds a five-minute inactivity lease instead of a permanent claim. Until it lapses another restore answers `import_running` with the time it becomes abortable; after that the next restore from `/setup` discards the stale staging and completes. No remove and redeploy is needed (rer 0.2.69, Base portability import lease).
- **Deployment history (REL-001).** A deploy key or the owner can record a deployment's start, progress with exposure percentage, success, failure and rollback per environment, with its build, repository, commit and the ordered included commits, through `POST /api/projects/<project>/deployments` and its callbacks. Retried callbacks are idempotent and a changed retry is refused. A start that passes its owner-supplied deadline is marked timed out and sends one notice to the named email destination. **Releases → Deployment history** shows each deployment's steps. Commit ancestry is what CI recorded; Spool does not read the repository to confirm it ([Sentry releases](docs/SENTRY-RELEASES.md)).
- **Action audit (AUDIT-001).** Every change Spool makes (owner triage and settings, deploy-key and ingest writes, run tokens, erasure, notifications, archive exports and restores) now commits one attributed, privacy-safe fact in the same database transaction: who or which service (as a permanent alias), what, on which subject, when and the outcome. Denied, stale or failed attempts record their real outcome and never claim completion. **Settings → Organization audit** pages through it and exports JSON or CSV. Private archives carry the safe history and restore appends it; erasing an actor or project removes the alias links and leaves earlier facts as they were.
- **Scrubbing keeps identifiers whole.** UUIDs and W3C trace ids whose last groups are all digits were partly replaced with `[number]` by the card-number scrub; they are now read whole first.
- The application pins rer 0.2.69, with Base portability, import-kit door, Lobby, run-site and one-click sign-in copies refreshed from it. Retained archives that carry RER Platform's `rer_migrations` ledger are placed by that ledger.
- Releases: uploading a source map right after registering a release no longer races the registration on the Releases page.

### This release's gate

Gated on main at `86d2ad2`: a populated 0.5.0 installation upgraded in place applied `0049` through `0053` and kept every row (its 0.5.0 ingest key and inbound filter still applied); a 0.5.0 `rer export` archive of a database carrying RER Platform's `rer_migrations` ledger restored into a fresh installation with every table identical except the documented disabled alert rule; the README one-line install ran a separate browser app with the published SDK and the Sentry SDK side by side (mapped source, scrubbing with UUIDs kept whole, evidence packet, resolve then regression in a later release, read-only agent key, deployment history, organization audit, archive restored into a fresh copy) at 1440 and 390; and the same jobs ran on a fresh Cloudflare deployment with an emailed sign-in and a delivered new-issue alert email. The hosted backup restored after remove and redeploy, and a hosted restore cut off six seconds in was refused with `import_running` while its lease held, then the next restore completed without a redeploy.

### Not in this release

- **Homepage claims still ahead of the code:** "alternative to Sentry, Bugsnag and Rollbar": Sentry intake and import are bounded (below) and there is no Bugsnag or Rollbar import or SDK compatibility. "Export everything to one file": archives refuse a project above 10,000 events or 20 maps, exclude alert email destinations (restored alert rules are disabled), deployment callbacks and notices (restored deployment history is read-only) and the import door and its journal. "Node 22 and pnpm are all you need. Setup asks for your email": rer supplies pnpm and the pinned Node, and first `rer dev` chooses a local owner without asking. "Every feature, on your own computer": local development suppresses all mail, so sign-in, alert and deployment-timeout email need a hosted installation with a mail provider.
- Deployment history takes no repository read-back (SRC-002) and no unmodified `sentry-cli` or build-plugin registration (SRC-003); member deployment authority waits for project roles (TEAM-001).
- The audit covers Spool's own writes; Base-owned operator-auth and import-kit writes are attributed by their request observation, not inside Base's transaction. There is no organization-wide audit yet.
- Project roles (TEAM-001) are not implemented; the owner acts as maintainer for grouping rules and filters.
- Sentry intake stays bounded: no Brotli or zstd, no streaming size limits beyond the current 256 KiB compressed and 1 MiB expanded, and user identity diagnostics remain partial (SDK-008, SDK-011).
- The Sentry importer is qualified with synthetic fixtures only; a real organization export has not been reconciled. No feature parity or completed migration is claimed.
- Self-hosted `rer deploy` declares no import-door trust bindings (`RER_OWNER_CLAIM_*`), so Business grants stay unavailable there.
- Per-project limits are unchanged: 120 outcomes a minute, 10,000 retained events, 20 flat source maps of 256 KiB; indexed maps and `sourceRoot` are not supported.
- Hosted project erasure timing on D1 is not measured.
- SDK 0.2.0 remains owner-held and unpublished; `npm install @just-every/spool` resolves to 0.1.0. The app release does not publish the SDK.

### Known issues

- **Retrying a cut-off hosted restore at once is refused for up to five minutes.** Right after a hosted restore is cut off, a retry can answer `Storage operation not confirmed` and then `import_running` until the cut-off restore's lease lapses (five minutes after its last activity); the page does not show that time. Wait, then restore again; it completes. The `/setup` error also offers an unrelated "Sign in again".
- Imported issues carry no "imported" label in the issue list; the issue page marks them "Imported historical evidence".
- The Sentry SDK's default deduplication drops an identical exception repeated within one process, so a single run reports it once; separate runs group into the same issue.

### Migrations

Five: `0049_deployment_history.sql` (deployment runs, steps, notices and actor labels), `0050_release_order_keys.sql` (clears the old cached release-ordering keys, which are recomputed on read), `0051_safe_audit.sql` (the append-only audit tables), `0052_release_order_cache.sql` (a separate table for those derived keys) and `0053_audit_transactions.sql` (the per-transaction audit context, and value-free legacy facts written once for journal rows that existed before the upgrade). No existing row is removed or rewritten except the cleared derived keys. Upgrading from 0.5.0 applies these five; upgrades from earlier releases also apply the migrations listed under those releases below.

## 0.5.0 — 2026-10-19

Back up first: export a private archive before updating (Settings → **Download private archive**, or stop local dev and run `rer export --output exports/spool.rer`). In a checkout of `main`, run `git pull` and `rer dev`; in a checkout of an earlier tag, run `git fetch --tags && git checkout v0.5.0` and `rer dev`. For a hosted installation, run `rer deploy` from the original deploying checkout. This release adds no migrations (48 total), so nothing changes in the database; keep the existing database, private settings, project keys and deployment receipts, and do not reset or restore into the populated installation.

### What an owner gets

- **Inbound filters cover every accepted kind of report.** Settings → **Inbound filters** now apply before every category Spool accepts, not only errors. Allowed domains (Origin/Referer) are checked for every request; trusted IP, crawler, legacy-browser and localhost checks also apply to Sentry feedback and client reports; error-only rules (messages, browser extensions, hydration and chunk-load errors) stay on errors. Filter counts match what unmodified Sentry browser and Node SDKs actually send, including their automatic client reports, and Settings names the fields a category does not carry ([inbound filters](docs/INBOUND-FILTERS.md)).
- **Grouping rules for native JavaScript, Python and Go errors.** Project Settings previews stack and fingerprint rules across every retained event and saves them as immutable versions for later native and Sentry intake. Each event explains its grouping from the exact rule version it was admitted under, and library frames collapse in the event view. From an issue, split selected occurrences into a new issue or merge them into another, with a preview, an audit entry and undo; original membership is kept. Saving rules never moves existing occurrences ([grouping rules](docs/GROUPING-RULES.md)).
- **Sturdier Sentry intake.** Deflate-encoded envelopes are accepted beside gzip; an unsupported encoding returns 415 naming it and is counted; a malformed event item inside a correctly framed envelope is counted as `invalid_item` while the valid errors beside it are still admitted.
- **Business imports open at the owner's first claim on RER Business installations.** An installation RER provisions for an approved Business plan carries `RER_IMPORT_DOOR=on` with its owner-claim trust bindings; there the owner's first claim opens the Business import door, and a door the owner later turns off stays off. Self-hosted `rer deploy` never sets the variable, so nothing changes on your own Cloudflare account. The door also accepts RER's Business export namespace `sentry`.
- The application pins rer 0.2.66, with refreshed Base import-door and owner-claim copies.
- `rer deploy --dry-run` without Cloudflare credentials now builds and then stops with exit 3, naming every input a real deploy still needs (rer's behaviour since 0.2.58); with the credentials it also checks the target's secret bindings. The guides describe this.

### This release's gate

Run on `main` at `e43ae42` before this record was written, at 1440 and 390. Locally, a fresh one-line `npx -y @runeditrun/rer dev just-every/run-spool` install created a project from `/setup` and received **Send test error**. A separate browser app on its own origin, using the published `@just-every/spool` 0.1.0 beside the Sentry browser SDK, threw a real TypeError in Chromium: Spool mapped the minified frame to `src/account.ts:42` through maps uploaded with `npx spool-sourcemaps`, while the Sentry SDK's copy reached a second project. Resolving the issue and shipping the next release reopened it as "Regressed in shop@1.1.0". A Node error carrying an email, a password and a token was stored scrubbed, with no raw value anywhere in the database. The evidence packet downloaded; a read-only agent key read issues and packets through `spool-agent` and was refused every write, the other project and the archive; the Settings archive restored into a fresh installation from `/setup` with both projects, the regression and the mapped stack. A populated 0.4.0 installation (all three key kinds, releases, a private map, native and Sentry SDK events, resolved and suppressed issues, grouping rules, inbound filters, an alert rule and a platform migration ledger) was upgraded to this commit with `rer dev`: every row of every table was kept, its 0.4.0 keys still ingested and its 0.4.0 inbound filter still applied. A `rer export` archive written by 0.4.0 from that database restored with `rer import` into a fresh installation of this commit. Hosted, a fresh `rer deploy` to Cloudflare with SendGrid signed the owner in by an emailed link; the same app jobs ran against it; the new-issue alert email reached a real mailbox and its link opened the issue; then a Settings backup, `rer deploy --remove`, a fresh `rer deploy` and a restore from `/setup` brought the projects and issues back. These are the only acceptance claims of this release.

### Not in this release

- **Homepage claims still ahead of the code:** "alternative to Sentry, Bugsnag and Rollbar": Sentry intake and import are bounded (below) and there is no Bugsnag or Rollbar import or SDK compatibility. "Export everything to one file": archives refuse a project above 10,000 events or 20 maps, exclude alert email destinations (restored alert rules are disabled) and exclude the import door and its journal. "Node 22 and pnpm are all you need. Setup asks for your email": rer supplies pnpm and the pinned Node, and first `rer dev` chooses a local owner without asking. "Every feature, on your own computer": local development suppresses all mail, so sign-in and alert email need a hosted installation with a mail provider.
- Project roles (TEAM-001) are not implemented; the owner acts as maintainer for grouping rules and filters.
- Sentry intake stays bounded: no Brotli or zstd, no streaming size limits beyond the current 256 KiB compressed and 1 MiB expanded, and user identity diagnostics remain partial (SDK-008, SDK-011).
- The Sentry importer is qualified with synthetic fixtures only; a real organization export has not been reconciled. No feature parity or completed migration is claimed.
- Self-hosted `rer deploy` declares no import-door trust bindings (`RER_OWNER_CLAIM_*`), so Business grants stay unavailable there; the owner's importer uses the door without them.
- Per-project limits are unchanged: 120 outcomes a minute, 10,000 retained events, 20 flat source maps of 256 KiB; indexed maps and `sourceRoot` are not supported.
- Hosted project erasure timing on D1 is not measured.
- SDK 0.2.0 remains owner-held and unpublished; `npm install @just-every/spool` resolves to 0.1.0. The app release does not publish the SDK.

### Known issues

- **An interrupted hosted restore blocks later restores.** If the browser tab closes or the connection drops while `/setup` is restoring an archive into a hosted installation, the unfinished restore stays registered and every later restore is refused with `import_running` (the page also offers an unrelated "Sign in again"). The installation is still empty, so recover by running `rer deploy --remove --yes` and `rer deploy` from the deploying checkout, then restore again and keep the page open until the workbench appears.
- Imported issues carry no "imported" label in the issue list; the issue page marks them "Imported historical evidence".
- The Sentry SDK's default deduplication drops an identical exception repeated within one process, so a single run reports it once; separate runs group into the same issue.

### Migrations

None. The database stays at 48 migrations (`migrations/core/0001` through `0048_import_door_scopes.sql`); upgrading from 0.4.0 applies nothing. Upgrades from earlier releases apply the migrations listed under those releases below.

## 0.4.0 — 2026-10-19

Back up first: export a private archive before updating (Settings → **Download private archive**, or stop local dev and run `rer export --output exports/spool.rer`). Then run `git pull` and `rer dev` in the existing checkout, or `rer deploy` from the original deploying checkout for a hosted installation. Keep the existing database, private settings, project keys and deployment receipts; do not reset or restore into the populated installation.

### What an owner gets

- **One import door for Sentry history.** The owner's importer, `scripts/sentry-import.mjs`, now runs through Base import-kit's import door at `/api/operator/import/*` with the owner session: `dry-run` uploads the owner-generated `spool-sentry-org-export` bundle and returns a plan with its fingerprint, counts and rejections; `apply` needs that reviewed fingerprint; `reconcile` re-derives every source ID's disposition; `undo` reverses newest first. Business grants use the same pipeline, so Settings → **Business imports** lists the owner's own imports ("approved by") beside Business ones, each with Undo. Each Sentry organization is one door namespace, `sentry-org:<slug>`; a newer bundle of an imported organization is a reviewed catch-up (`--catchup`). Imported projects and issues sit beside new errors and stay inert. See [Switching from Sentry](docs/SENTRY-SWITCHING.md).
- **Older archives restore into a fresh installation.** Private archives written by earlier releases, including CLI exports that carry platform bookkeeping, restore into an empty 0.4.0 installation from `/setup` or with `rer import`.
- **Project erasure is an accepted job.** Confirming erasure returns at once with a durable job; the panel follows its bounded steps, leaving the page does not cancel it, and only **Project erased** marks completion ([project erasure](docs/PROJECT-ERASURE.md)).
- The application pins rer 0.2.61, with refreshed Base portability, import-kit, owner-claim and operator-auth copies. Door fixes from Base: erasure covers door rows, failed applies end `failed`, a namespace allow-list, a permanent door key and a per-request statement budget.

### This release's gate

Run on `main` at `8b81bef` before this record was written. Locally (1440 and 390): a v0.3.1 install with a resolved issue was upgraded with `git pull` and `rer dev`; migrations 0044–0048 applied and the project, issue and its resolved state were kept. On that upgraded install the repository's synthetic Sentry export (`tests/fixtures/sentry/organization.json`) moved in through the import door with `scripts/sentry-import.mjs` dry run, apply and reconcile, and Settings → **Business imports** listed it as approved by the owner. An unmodified `@sentry/node` 11.6.0 app with only its DSN changed sent errors that grouped into one issue beside the imported one; the new issue was resolved, the imported one suppressed, and the alert feed showed the new-issue alert. A browser archive and a `rer export` archive, each made by v0.3.1, restored into fresh installations of this head (from `/setup` and with `rer import`) with their project and issue. Hosted, a fresh `rer deploy` to Cloudflare with SendGrid signed the owner in by an emailed link, took the same export through the import door, grouped the same Sentry-SDK errors beside it, delivered the new-issue alert email to a real mailbox with a working issue link, and resolved and suppressed the two issues. These are the only acceptance claims of this release.

### Not in this release

- **Homepage claims still ahead of the code:** "alternative to Sentry, Bugsnag and Rollbar" — Sentry intake and import are bounded (below) and there is no Bugsnag or Rollbar import or SDK compatibility; "Export everything to one file" — archives refuse a project above 10,000 events or 20 maps and exclude the import door and its journal, so undo and reconciliation stay on the installation that ran the import; "Node 22 and pnpm are all you need. Setup asks for your email" — rer supplies pnpm and the pinned Node, and first `rer dev` chooses a local owner without asking; "Every feature, on your own computer" — local development suppresses all mail, so sign-in and alert email need a hosted installation with a mail provider.
- The Sentry importer is qualified with synthetic fixtures only; a real organization export has not been reconciled. No feature parity or completed migration is claimed.
- Self-hosted `rer deploy` declares no import-door trust bindings (`RER_OWNER_CLAIM_*`), so Business grants stay unavailable there; the owner's importer uses the door without them.
- Per-project limits are unchanged: 120 outcomes a minute, 10,000 retained events, 20 flat source maps of 256 KiB; indexed maps and `sourceRoot` are not supported. GROUP-001 and SDK-009 remain partial as recorded for 0.3.1.
- Hosted project erasure timing on D1 is not measured.
- SDK 0.2.0 remains owner-held and unpublished; `npm install @just-every/spool` resolves to 0.1.0. The app release does not publish the SDK.

### Known issues

- Imported issues carry no "imported" label in the issue list; the issue page marks them "Imported historical evidence".
- The Sentry SDK's default deduplication drops an identical exception repeated within one process, so a single run reports it once; separate runs group into the same issue.

### Migrations

Additive, applied automatically: `migrations/core/0044_import_preparation_steps.sql`, `0045_import_custody_replace.sql`, `0046_import_erasure_progress.sql`, `0047_import_door_apply_failures.sql`, `0048_import_door_scopes.sql` (48 total). Jobs created by the owner-session importer before the door keep `read`, `originals`, `resume` and `undo`; the old `/api/imports/sentry/plan` and `/apply` routes are gone.

## 0.3.1 — 2026-10-18

- Rephrase the Sentry non-goal for the RunEditRun Site import: organization import has been exercised with synthetic fixtures only, and owner-export qualification is pending. The importer, its qualification limits and the Site claim guard are unchanged.
- Add previewed project stack and fingerprint rules for later Sentry intake, immutable admission policy snapshots and grouping explanations. Rules and snapshots survive private archive restore; existing occurrences are not regrouped. This is partial GROUP-001; see [grouping rules](docs/GROUPING-RULES.md) for remaining gaps.
- Accept Sentry events without a release, auto-create optional releases, preview release ordering and strict-registration policies, and support plain resolution on the next accepted unsuppressed event. Fence bulk resolution previews and preserve independent release-resolution boundaries, including in sliced private archives (SDK-009 through `72cc548`). This is partial SDK-009; see [Sentry release identity](docs/SENTRY-RELEASES.md) for remaining gaps.
- Align select chevrons 14 px from the border and dim them when disabled.
- Set the measured verification disk floor to 4 GiB (`822cd55`); preserve historical archive fixtures at their original schema.

Export a private archive before updating from 0.3.0. In the existing checkout, run `git pull`, then `rer dev` locally or `rer deploy` from the original deploying checkout. Keep the existing database, private settings, project keys and deployment receipts; do not reset or restore into the populated installation. Additive migrations `0042_grouping_rules.sql` and `0043_sentry_releases.sql` apply automatically (43 total). Earlier upgrade instructions remain below. The app still pins rer 0.2.49 and does not publish SDK 0.2.0. This release does not extend the hosted or importer qualification recorded for 0.3.0.

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
