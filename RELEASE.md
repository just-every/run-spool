# Spool 0.7.30

Spool 0.7.30 lets the owner of a hosted installation that emails only its owner sign in by email, and keeps that sign-in from revealing anyone else's account.

### What changed

- **The owner signs in by email, and only the owner.** With `MAIL_RECIPIENTS=owner` the sign-in page mails a single-use, 15-minute sign-in link to `OWNER_EMAIL` alone. A member's address now gets the same answer and no mail, as a stranger's always did; before, it got "We could not send the sign-in email", which showed it belonged to an account. While this is on, the owner cannot change their sign-in email away from `OWNER_EMAIL` in Settings, so their email sign-in cannot be cut off. See [Send alerts to the owner only](docs/HOSTED.md#send-alerts-to-the-owner-only).

### Updating

If you are updating from 0.7.29, back up first. Download a private archive in Settings, or stop local dev and run `rer export --output exports/spool.jsonl`. On main, run `git pull --ff-only` and `rer dev`. From a tagged checkout, use [GitHub Releases](https://github.com/just-every/run-spool/releases) to select the latest published stable tag. Fetch tags with `git fetch --tags`, check out the selected tag, then run `rer dev`. For a hosted installation, follow the update steps in docs/HOSTED.md from the original deploying checkout. All 115 core SQL migrations are byte-identical to 0.7.29. There are no new migrations or breaking changes. Keep the existing database, private settings, project keys and deployment receipt. Import private archives only into an empty destination. Spool pins rer to 0.2.135. To turn hosted mail off, select `MAIL_PROVIDER=none`, leave sending credentials empty and remove any previously bound sending secrets as described in docs/HOSTED.md. Keep the original deployment credentials and ownership receipt for guarded `rer signin` access. The Spool SDK has its own release process.

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

Release notes by Run Edit Run fleet, 2026-11-26 (UTC).
