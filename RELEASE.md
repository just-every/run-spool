# Spool 0.7.28

Spool 0.7.28 reduces Cloudflare D1 reads during scheduled work and issue browsing, acknowledges hosted archive downloads sooner, and improves source-map upload and mobile issue details.

### What changed

- **Read fewer D1 rows on steady minute cron runs.** In measurements with 30 and 89 days of retained history, a steady minute run dropped from about 394,000 and 1.1 million rows respectively to 90 rows at both ages. Counters, change tracking and indexes keep scheduled reads bounded by the work due.
- **Skip rebuilding an unchanged issue list.** A poll with a matching ETag returns HTTP 304 after reading 11 D1 rows.
- **Scheduled work and refresh timing.** Metric rules with windows over 10 minutes are evaluated every 5 minutes (up to 5 minutes of alert lag), the workbench refreshes every 60 s and stops after 5 idle minutes, and follow-up sweeps can lag up to an hour without a trigger.
- **See hosted archive download progress sooner.** Spool acknowledges browser download requests before preparing the archive. In a scratch Cloudflare deployment, the first download after deploy went from 5.61 s to 0.23 s for response headers and from 7.22 s to 11.20 s for the full download. An immediate repeat reached headers in 0.25 s and completed in 13.23 s. After three idle minutes, headers arrived in 0.91 s and the download completed in 12.69 s. The earlier 22.7 s first download remains unexplained.
- **Find the build for a Sentry-created release.** Upload map from an issue selects the occurrence’s build even when Sentry created the release automatically from a session without a distribution identifier. The release history lists observed builds for the picker.
- **Read stack and grouping details on narrow screens.** At 390 px, Raw stack trace and Grouping information have separate, spaced controls that wrap as needed.
- **Follow the first-run guide from setup to handoff.** The guide walks through receiving a test event, saving and naming the ingest key, and handing over the Sentry import.
- **Keep the 30-second CPU limit on Workers Paid.** Deploys carry the limit in the Worker configuration. Workers Free uses Cloudflare's plan limit.

### Updating

If you are updating from 0.7.27, back up first. Download a private archive in Settings, or stop local dev and run `rer export --output exports/spool.jsonl`. On main, run `git pull --ff-only` and `rer dev --host localhost`. From a tagged checkout, use [GitHub Releases](https://github.com/just-every/run-spool/releases) to select the latest published stable tag. Fetch tags with `git fetch --tags`, check out the selected tag, then run `rer dev --host localhost`. For a hosted installation, follow the update steps in docs/HOSTED.md from the original deploying checkout. All 114 core SQL migrations from 0.7.27 are byte-identical. One new migration applies on the next start or deploy. Keep the existing database, private settings, project keys and deployment receipt. Import private archives only into an empty destination. Spool pins rer to 0.2.134. To turn hosted mail off, select `MAIL_PROVIDER=none`, leave sending credentials empty and remove any previously bound sending secrets as described in docs/HOSTED.md. Keep the original deployment credentials and ownership receipt for guarded `rer signin` access. The Spool SDK has its own release process.

- `migrations/core/0121_bounded_reads.sql` backfills D1 counters and summaries, tracks issue-list and follow-up changes, and adds indexes for bounded reads. Private archive restores rebuild the summaries from restored data.

### Known limits

- Hosted split proposals can still exceed the Cloudflare Workers Free plan’s 50 D1 binding calls per invocation.
- Native error intake, Sentry transactions, feedback and located logs can still return HTTP 403 on a project’s first identity-key collision when scrubbing rules are active.
- Active ticks that assemble new digests, expire retained data or process many due deliveries can still exceed the Cloudflare Workers Free plan’s 50 D1 binding calls per invocation.
- Transaction measurements retain bounded observations. Spool does not store spans, transaction tags or request data.
- Imported rules that target issue owners stay disabled because they require native ownership rules. Rules that use Sentry’s unsupported `EventAttributeCondition` also stay disabled. The import names each skipped rule and its reason. Issue-owner notification selection uses its explicit fallback until verified issue ownership is available. Live provider delivery needs separate qualification. Deliberately mail-off hosted installations send no sign-in links, invitations or email alerts.
- Passkey enrollment and sign-in are available to the local owner on `localhost`. Keep the private terminal sign-in link as a recovery option.
- Local development sends no email. Email verification for ownership transfer remains unavailable there; only an owner session opened through the local access link uses local confirmation.
- Browser restore is limited to 16 MiB. Use the CLI for larger current JSONL archives. Legacy JSON uploads over 16 MiB are refused and can end in a connection reset after the restore engine has begun reading.
- Agent setup requires an owner to save all six policy answers, choose Yes or No for paid AI and create a project agent key. The agent CLI runs from a Spool checkout; it is not an npm-published package. Local agent calls also require the private dev gate described in the panel.
- Erasing the owner is held while other stored agent text contains a different address that ends with the owner's address. The erasure match is case-sensitive.
- Before the first project is created, opening a missing project URL as the owner redirects to setup instead of showing a not-found page.
- Retained hosted archives still require separate Managed-to-native release qualification. If an archive is refused with `schema_mismatch`, restore into the release you exported from. Retrying a cut-off hosted restore can be refused until its five-minute lease expires; wait before retrying.
- Bugsnag and Rollbar imports remain bounded to 2 MiB and 500 records. The Sentry organization import accepts up to 1,000 parsed records including its manifest, within 2 MiB, and the import door has separate request limits. Larger migrations, real-account migration and live provider delivery remain unqualified.
- End-user erasure matches supported retained identities and attributable captured copies. Unknown aliases, partial identifiers, grouping-sensitive text, exception/stack/context copies, anonymous aggregates and external copies remain outside its matcher. Consented feedback contact, screenshots and replies are not matched by that contact; the owner must withdraw the report in the feedback inbox. Deleting matching events also deletes feedback attached to those exact occurrences.

Product screenshot: .github/assets/release/spool-issue-page-1600.png

Release notes by Run Edit Run fleet, 2026-11-25 (UTC).
