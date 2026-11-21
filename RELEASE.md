# Spool 0.7.17

Spool 0.7.17 brings more alert rules across when you import a Sentry organization and updates the bundled rer toolchain.

### What changed

- **Bring over more Sentry alert rules.** Spool now maps numeric severity filters and conditions for issues that reappear. It compares metric trigger recipients by meaning, so differences in the export format alone no longer prevent a match. Metric queries can retain paths and wildcards such as `/v1/*` and `5*`. Sentry’s crash-rate alias retains its crash-free comparison and thresholds. The importer recognizes issue-owner recipients and preserves imported team names. In a representative synthetic export, eight of ten rules mapped to native rules, and the import named both remaining rules with a reason.
- **Restore archives and sign in locally with rer 0.2.126.** The archive restore improvements handle more supported migration histories. Explicit local persona links open the selected account with a short-lived grant. The egress and webhook guides link to the operator steps for the bundled service revision.

### Updating

From 0.7.16: Back up first. Download a private archive in Settings, or stop local dev and run `rer export --output exports/spool.jsonl`. From 0.7.16 on main, update with `git pull --ff-only` and `rer dev`. From a tag, run `git fetch --tags && git checkout v0.7.17` and `rer dev` once that tag is published. For a hosted installation, use `rer deploy` from the original deploying checkout. There are no new migrations or breaking changes. The migration inventory is 108 core SQL files, all byte-identical to v0.7.16. Keep the existing database and avoid resetting it. Keep private settings, project keys and the deployment receipt. Import private archives only into an empty destination. The application pins rer exactly to 0.2.126. To turn hosted mail off deliberately, select `MAIL_PROVIDER=none`, leave sending credentials empty and remove any previously bound sending secrets as described in docs/HOSTED.md. Keep the original deployment credentials and ownership receipt for guarded `rer signin` access. This application release does not publish the Spool SDK.

### Known limits

- Transaction measurements retain bounded observations. Spool does not store spans, transaction tags or request data.
- Imported rules that target issue owners stay disabled because they require native ownership rules. Rules that use Sentry’s unsupported `EventAttributeCondition` also stay disabled. The import names each skipped rule and its reason. Issue-owner notification selection uses its explicit fallback until verified issue ownership is available. Live provider delivery needs separate qualification. Deliberately mail-off hosted installations send no sign-in links, invitations or email alerts.
- Local development sends no email. Email verification for ownership transfer remains unavailable there; only an owner session opened through the local access link uses local confirmation.
- Browser restore is limited to 16 MiB. Larger current JSONL archives need the CLI; legacy JSON archives over 16 MiB remain refused. A refused legacy JSON upload over 16 MiB can still end in a connection reset: the fix drains only what the restore engine has not already begun reading. Refused requests on the agent-door `/mcp` route are not covered by this fix.
- Agent setup still requires an owner to save all six policy answers and create a project agent key. The agent CLI runs from a Spool checkout; it is not an npm-published package. Local agent calls also require the private dev gate described in the panel.
- Erasing the owner is held while other stored agent text contains a different address that ends with the owner's address. The erasure match is case-sensitive.
- Before the first project is created, opening a missing project URL as the owner redirects to setup instead of showing a not-found page.
- Retained hosted archives still require separate Managed-to-native release qualification. If an archive is refused with `schema_mismatch`, restore into the release you exported from. Retrying a cut-off hosted restore can be refused until its five-minute lease expires; wait before retrying.
- Bugsnag and Rollbar imports remain bounded to 2 MiB and 500 records. The Sentry organization import accepts up to 1,000 parsed records including its manifest, within 2 MiB, and the import door has separate request limits. Larger migrations, real-account migration and live provider delivery remain unqualified.
- End-user erasure matches supported retained identities and attributable captured copies. Unknown aliases, partial identifiers, grouping-sensitive text, exception/stack/context copies, anonymous aggregates and external copies remain outside its matcher. Consented feedback contact, screenshots and replies are not matched by that contact; the owner must withdraw the report in the feedback inbox. Deleting matching events also deletes feedback attached to those exact occurrences.

Product screenshot: .github/assets/release/spool-issue-page-1600.png

Release notes by Run Edit Run fleet, 2026-11-21 (UTC).
