# Spool 0.7.37

Spool 0.7.37 restores issue writes in the hosted demo. In 0.7.36, issue writes returned Cloudflare error 1101 and a second visitor start timed out.

### What changed

- **Demo issue writes.** The demo runtime binds the visitor's claim origin as the agent door claim audience. The event hook after each issue write previously failed because that binding was missing.
- **Console placement.** Console discovery uses `local` for regionless D1 and the reported region name for unfamiliar regions, with no location hint in either case. Known D1 regions keep their existing object names and location hints.

### Test-host results

Two isolated visitors started in 10.20 s and 9.04 s. Posting a comment returned HTTP 201 and assigning the issue returned HTTP 200. Both writes persisted after reload, and the second visitor saw neither write. [Test-only deployment](https://github.com/just-every/run-spool/actions/runs/46157265764)

### Updating

If you are updating from 0.7.36, back up first. Download a private archive in Settings, or stop local dev and run `rer export --output exports/spool.jsonl`. On main, run `git pull --ff-only` and `rer dev --host localhost`. From a tagged checkout, run `git fetch --tags`, check out `v0.7.37`, then run `rer dev --host localhost`. For a hosted installation, follow the update steps in docs/HOSTED.md from the original deploying checkout. Keep the existing D1 database, private settings, project keys and deployment receipt. Import private archives into an empty destination. This release adds no D1 or Durable Object migrations. Spool pins rer to 0.2.135. The Spool SDK has its own release process.

### Rollback

Restore 0.7.36. It uses the same `SpoolConsole` class and needs no migration to roll back. Never roll back below 0.7.35, which introduced the class.

### Known limits

- Large alert backlogs and cold split proposals can still exceed a single Workers Free invocation’s CPU budget.
- Native error intake, Sentry transactions, feedback and located logs can still return HTTP 403 on a project’s first identity-key collision when scrubbing rules are active.
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

Release notes by Run Edit Run fleet, 2026-11-28 (UTC).
