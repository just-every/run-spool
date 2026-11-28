# Spool 0.7.36

Spool 0.7.36 places its hosted console Durable Objects near the D1 primary. In a scratch deployment with reused connections, the signed-in Issues page fell from 1,120 to 125 ms and the sign-in page fell from 521 to 82 ms. Peak CPU in the timed requests was 2 ms in the Worker and 21 ms in `SpoolConsole`.

### What changed

- **Console placement.** The Worker discovers the D1 primary region at runtime and caches the result per isolate. It uses region-named objects `auth:d1:<region>` and `workbench:d1:<region>` under the existing `SpoolConsole` class and `spool-console-v1` migration. The objects are stateless. This release changes no Durable Object classes or migrations and adds no D1 migrations.
- **Fewer D1 calls.** Batching cuts Issue Search from 19 to 11 D1 calls and issue packets from 27 to 18. The signed-in root reuses its session check before redirecting to the workbench.

### Updating

If you are updating from 0.7.35, back up first. Download a private archive in Settings, or stop local dev and run `rer export --output exports/spool.jsonl`. On main, run `git pull --ff-only` and `rer dev --host localhost`. From a tagged checkout, run `git fetch --tags`, check out `v0.7.36`, then run `rer dev --host localhost`. For a hosted installation, follow the update steps in docs/HOSTED.md from the original deploying checkout. Keep the existing D1 database, private settings, project keys and deployment receipt. Import private archives into an empty destination. After deploying, open sign-in and the signed-in workbench once to place both objects. Spool pins rer to 0.2.135. The Spool SDK has its own release process.

### Rollback

Use a forward patch as the rollback path. Cloudflare refuses a version rollback across the Durable Object class change introduced in 0.7.35. If the placement change must be reverted, redeploy 0.7.35 as a new deployment. That release exports the same `SpoolConsole` class and retains the `CONSOLE` binding and `spool-console-v1` migration.

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
