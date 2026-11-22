# Spool 0.7.18

Spool 0.7.18 adds passkey sign-in for the local owner and clarifies how to install Spool, invite a member and give an agent project access.

### What changed

- **Sign in on localhost with a passkey.** Open the private owner link from `rer dev --host localhost`, then choose **Settings → General → Local passkey → Add passkey**. Return with **Sign in with a passkey** and keep the private terminal link for recovery. Explicit local persona links open the selected account with a short-lived, session-scoped grant.
- **Start from a published release.** The README discovers the newest stable tag. The Run page displays a published tag and gives a command to install it. The install guides use that same tag or link to the Run page. The hosted guide starts from a tagged checkout and shows how to fill in the generated per-environment settings template, supply Cloudflare credentials separately and reuse the original deployment records for updates. The local invitation guide uses **Join**, matching the button the invitee sees.
- **Set up a project agent with the right permissions.** The guide and Settings explain the six required policy answers and the Yes or No choice for paid AI. A project agent key reads that project's evidence and can submit inert grouping proposals for owner review. Settings provides copyable commands with the installation's actual Node and CLI paths. The business setup guide explains how to pass the separate first-owner sign-in line privately as `sign_in`.
- **Check GitHub setup and review work more easily.** An owner can check the configured GitHub App installation before starting a fix. The Slack and Uptime controls link to their setup instructions, and personal and team digests show issue short IDs when available. Issue discussion updates keep the current revision in sync after a comment is saved.

### Updating

From 0.7.17: Back up first. Download a private archive in Settings, or stop local dev and run `rer export --output exports/spool.jsonl`. From 0.7.17 on main, run `git pull --ff-only` and `rer dev --host localhost`. From a tag, run `git fetch --tags && git checkout v0.7.18` and `rer dev --host localhost` once that tag is published. For a hosted installation, follow the update steps in docs/HOSTED.md from the original deploying checkout. The core inventory has 109 SQL files. The 108 migrations from v0.7.17 are byte-identical. The one new migration applies on the next start or deploy. Keep the existing database, private settings, project keys and deployment receipt. Import private archives only into an empty destination. There are no breaking changes. Spool still pins rer to 0.2.126. To turn hosted mail off, select `MAIL_PROVIDER=none`, leave sending credentials empty and remove any previously bound sending secrets as described in docs/HOSTED.md. Keep the original deployment credentials and ownership receipt for guarded `rer signin` access. This application release does not publish the Spool SDK.

- `migrations/core/0115_local_owner_passkeys.sql` — Adds storage for localhost owner passkeys. Existing owners can enroll after opening their private terminal sign-in link.

### Known limits

- Transaction measurements retain bounded observations. Spool does not store spans, transaction tags or request data.
- Imported rules that target issue owners stay disabled because they require native ownership rules. Rules that use Sentry’s unsupported `EventAttributeCondition` also stay disabled. The import names each skipped rule and its reason. Issue-owner notification selection uses its explicit fallback until verified issue ownership is available. Live provider delivery needs separate qualification. Deliberately mail-off hosted installations send no sign-in links, invitations or email alerts.
- Passkey enrollment and sign-in are available to the local owner on `localhost`. Keep the private terminal sign-in link as a recovery option.
- Local development sends no email. Email verification for ownership transfer remains unavailable there; only an owner session opened through the local access link uses local confirmation.
- Browser restore is limited to 16 MiB. Larger current JSONL archives need the CLI; legacy JSON archives over 16 MiB remain refused. A refused legacy JSON upload over 16 MiB can still end in a connection reset: the fix drains only what the restore engine has not already begun reading. Refused requests on the agent-door `/mcp` route are not covered by this fix.
- Agent setup requires an owner to save all six policy answers, choose Yes or No for paid AI and create a project agent key. The agent CLI runs from a Spool checkout; it is not an npm-published package. Local agent calls also require the private dev gate described in the panel.
- Erasing the owner is held while other stored agent text contains a different address that ends with the owner's address. The erasure match is case-sensitive.
- Before the first project is created, opening a missing project URL as the owner redirects to setup instead of showing a not-found page.
- Retained hosted archives still require separate Managed-to-native release qualification. If an archive is refused with `schema_mismatch`, restore into the release you exported from. Retrying a cut-off hosted restore can be refused until its five-minute lease expires; wait before retrying.
- Bugsnag and Rollbar imports remain bounded to 2 MiB and 500 records. The Sentry organization import accepts up to 1,000 parsed records including its manifest, within 2 MiB, and the import door has separate request limits. Larger migrations, real-account migration and live provider delivery remain unqualified.
- End-user erasure matches supported retained identities and attributable captured copies. Unknown aliases, partial identifiers, grouping-sensitive text, exception/stack/context copies, anonymous aggregates and external copies remain outside its matcher. Consented feedback contact, screenshots and replies are not matched by that contact; the owner must withdraw the report in the feedback inbox. Deleting matching events also deletes feedback attached to those exact occurrences.

Product screenshot: .github/assets/release/spool-issue-page-1600.png

Release notes by Run Edit Run fleet, 2026-11-22 (UTC).
