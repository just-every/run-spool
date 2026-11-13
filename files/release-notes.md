Spool 0.7.9 clarifies capture setup, missing release information and locally suppressed email, and explains what Slack and cron forwarding need before you connect them.

### What you can now do

- **Read missing release and build information in plain words.** Issues, event details, Releases, source-map setup and deployment history show “No release” or “No build supplied” when that information was not sent. Source-map setup leaves a missing build field empty for you to enter your application's build identifier.
- **Tell when local email was not sent.** Alert deliveries and digest history show “suppressed locally” for email suppressed in local development. Digest history also says “No email sent.” Provider acceptance still does not prove recipient delivery.
- **Find the setup steps for Slack and cron forwarding.** Settings explains the account permissions and separate integration egress service these connections need. The linked guide shows how the deployment operator installs that service and assembles Spool's binding from its deployment receipt. Slack needs your own workspace and bot installation permission; cron forwarding needs your own Uptime heartbeat. Local development has no production egress binding, and these instructions do not establish live delivery.

- **Set up browser capture without npm.** Capture links to the browser helper file and shows how to initialise it in your app. SDK and source-map instructions explain that your application needs its own Node.js and npm; Spool's private installer runtime does not put them on your shell's PATH.
- **Recognise sample evidence and source-map limits.** Spool's built-in test errors are labelled as sample evidence on the issue, without map-upload or reproducer steps. Setup distinguishes the published npm SDK 0.1.0 CLI and prepared-map picker, which accept flat maps up to 256 KiB, from the upload service and current checkout CLI, which accept flat or indexed maps up to 1 MiB. The larger/indexed CLI support remains in unpublished SDK 0.2.0 source. All paths respect the optional project storage byte cap, with no lifetime map count.

### Updating

Back up first: download a private archive in Settings, or stop local dev and run `rer export --output exports/spool.jsonl`. From 0.7.8 on main, update with `git pull --ff-only` and `rer dev`; from a tag, run `git fetch --tags && git checkout v0.7.9` and `rer dev`. For a hosted installation, use `rer deploy` from the original deploying checkout. Keep the database, private settings, project keys and deployment receipt. There are no new migrations or breaking changes after 0.7.8; previously applied migration files are unchanged, so do not reset. Import private archives only into an empty destination. The application still pins rer exactly to 0.2.107. This application release does not publish the Spool SDK.

### Known limits

- Local development sends no email, so ownership-transfer email verification cannot be completed there. Copyable invitations do not change that limit.
- Browser restore is limited to 16 MiB. Larger current JSONL archives need the CLI; legacy JSON archives over 16 MiB remain refused. A refused legacy JSON upload over 16 MiB can still end in a connection reset: the fix drains only what the restore engine has not already begun reading. Refused requests on the agent-door `/mcp` route are not covered by this fix.
- Agent setup still requires an owner to save all six policy answers and create a project agent key. The agent CLI runs from a Spool checkout; it is not an npm-published package. Local agent calls also require the private dev gate described in the panel.
- Erasing the owner is held while other stored agent text contains a different address that ends with the owner's address. The erasure match is case-sensitive.
- Before the first project is created, opening a missing project URL as the owner redirects to setup instead of showing a not-found page.
- Retained hosted archives still require separate Managed-to-native release qualification. If an archive is refused with `schema_mismatch`, restore into the release you exported from. Retrying a cut-off hosted restore can be refused until its five-minute lease expires; wait before retrying.
- Bugsnag, Rollbar and Sentry imports remain bounded to 2 MiB and 500 records; larger sets are refused rather than partly applied. A real-account migration and live mail delivery through Cloudflare remain unqualified.

Product screenshot: .github/assets/release/spool-issue-page-1600.png
