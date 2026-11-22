# Spool 0.7.20

Spool 0.7.20 keeps supported JavaScript errors grouped through source-map stamping, shows progress during private archive downloads and makes hosted setup and agent handoff easier to follow.

### What changed

- **Keep the same issue when you stamp a source map.** Spool can group a native JavaScript error with its earlier occurrence when SDK debug-ID stamping shifts the generated line and Spool can confirm the match from recorded evidence. The fix applies to new occurrences.
- **See when an archive is being prepared.** Settings announces “Preparing your archive…” while it prepares the private download, then shows the downloaded filename.
- **Start hosting from the same stable release as the Run page.** The Cloudflare guide on the Hosting page uses the shared stable-tag selector. Supply Cloudflare credentials through your credential helper or shell environment and keep them out of the private deployment settings file.
- **Find the agent handoff on the issue page.** Open **Fix with an AI coding assistant** in the evidence packet. For hosted Spool, the handoff explains where rer stores its Node executable, including when you set `XDG_DATA_HOME`.

### Updating

If you are updating from 0.7.19, back up first. Download a private archive in Settings, or stop local dev and run `rer export --output exports/spool.jsonl`. On main, run `git pull --ff-only` and `rer dev --host localhost`. From a tagged checkout, run `git fetch --tags && git checkout v0.7.20` and `rer dev --host localhost` once v0.7.20 is published. For a hosted installation, follow the update steps in docs/HOSTED.md from the original deploying checkout. All 109 core SQL migrations from 0.7.19 are byte-identical. One new migration applies on the next start or deploy. Keep the existing database, private settings, project keys and deployment receipt. Import private archives only into an empty destination. There are no breaking changes. Spool pins rer to 0.2.129. To turn hosted mail off, select `MAIL_PROVIDER=none`, leave sending credentials empty and remove any previously bound sending secrets as described in docs/HOSTED.md. Keep the original deployment credentials and ownership receipt for guarded `rer signin` access. The Spool SDK has its own release process.

- `migrations/core/0116_stamp_grouping.sql` adds an index for matching native JavaScript stack locations before and after debug-ID stamping. Eligible older archives can still be restored into an empty installation.

### Known limits

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

Release notes by Run Edit Run fleet, 2026-11-22 (UTC).
