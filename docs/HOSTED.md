# Hosting Spool

## Managed mail

With RER Managed hosting, Configure supplies and hides all four mail inputs: `MAIL_PROVIDER=rer`, `MAIL_FROM`, `MAIL_RELAY_URL` and the private `MAIL_API_KEY`. RER assigns the sender and relay URL and stores an installation/environment credential in encrypted private settings. You need no provider account and copy no mail key. The provider credential stays with RER. Spool uses Base's `rer` mail adapter for sign-in links and email alerts.

This checkout uses the rer version pinned in [package.json](../package.json). Free and Assisted self hosting can deliberately turn mail off or choose an enabled provider with its sender and credentials. The manual Cloudflare/SendGrid procedure below remains available for your own account.

## Run Spool on your Cloudflare account

`rer deploy` puts this checkout on your own Cloudflare account as one Worker with its D1 database, at `https://spool-<environment>.<your-subdomain>.workers.dev`. Choose your environment name once as `SPOOL_ENV` below (default `production`). Use a lowercase identifier starting with a letter, with letters, digits and single hyphens between segments (at most 32 characters), and keep using the same one in later terminals too.

For the Free or Assisted account procedure below, you need:

- this checkout, set up as in the [README](../README.md#run-it-on-your-computer) (git is required; the installer brings rer, Node and pnpm);
- a Cloudflare account with a workers.dev subdomain, its account ID, and an API token that can edit Workers scripts and D1;
- for enabled email, a SendGrid API key that can send mail and a verified sender address; alternatively select `MAIL_PROVIDER=none` and use the guarded owner sign-in below.

Choose a tagged checkout from [Spool's GitHub Releases](https://github.com/just-every/run-spool/releases). The steps below prepare it without leaving a dev runtime running. Node and pnpm do not need to be on PATH.

## First install

1. Set `SPOOL_TAG` to your chosen release tag, then install and set up Spool on this computer:

   ```sh
   git clone --branch "$SPOOL_TAG" --single-branch https://github.com/just-every/run-spool.git run-spool
   cd run-spool
   curl -fsSL https://runeditrun.com/install.sh | sh -s -- setup
   export PATH="$HOME/.local/bin:$PATH"
   SPOOL_ENV=production # choose your environment name here
   ```

   If you already followed the README, work from that `run-spool` checkout and skip the clone, `cd` and installer lines. Run the PATH line in each new terminal, or use `~/.local/bin/rer` wherever this guide says `rer`; the installer does not edit your shell profile.

   Explicit setup prompts for missing required answers in an interactive terminal. With non-TTY input, use `rer setup --answers <private-json-file> --non-interactive`; piping an email alone is not an answer file. Setup stops its temporary app when complete; `rer dev` starts a local server if you need one. These local answers do not replace the hosted settings below.

2. Create the private settings file for this environment. It starts with no alert destinations (`[]`). Leave generated secrets out: `rer deploy` generates the session secret, one-time setup token and alert destination hash key itself.

   ```sh
   umask 077 && mkdir -p .rer/deploy && cat > .rer/deploy/"$SPOOL_ENV".env <<'EOF'
   OWNER_EMAIL=
   MAIL_PROVIDER=sendgrid
   MAIL_FROM=
   MAIL_API_KEY=
   ALERT_DESTINATIONS=[]
   EOF
   ```

   Open the generated `.rer/deploy/<environment>.env` in a text editor and fill in the owner email, verified SendGrid sender and SendGrid API key. To turn email off deliberately, set `MAIL_PROVIDER=none` and leave `MAIL_FROM` and every sending credential empty. Keep these values out of shell commands. The file can be read only by you. Git ignores it, and `rer reset` keeps it. Keep it for every later deploy of this environment.

3. Use your credential helper or shell environment to supply `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to rer. Keep all `CLOUDFLARE_*` and `CF_*` fields out of the private settings file. Stop local dev, then deploy and claim the hosted owner:

   ```sh
   rer dev --stop
   rer deploy --env-file .rer/deploy/"$SPOOL_ENV".env --environment "$SPOOL_ENV"
   ```

   If you skipped local setup in a fresh checkout, add `--owner-name "Your name"` to the first deploy command. Spool requires a first-owner display name with rer 0.2.130. The deploy command above uses the name saved by local setup. `OWNER_EMAIL` supplies the sign-in address.

   `rer deploy` builds this commit, creates the Worker and its database, applies the migrations, uploads the settings as secrets and checks `/health`. It also sends the one-time setup token to claim `OWNER_EMAIL` as the hosted owner, then removes `SETUP_TOKEN` from the deployed Worker secrets. Cloudflare can take several minutes to apply the D1 migrations. rer reports progress during the wait. Owner claim runs automatically. An already claimed installation keeps its owner, and later deploys to this environment keep the setup token retired. Keep the original deploying checkout, the private environment file, `.rer/deploy/<environment>.secrets.env` generated secrets and `.rer/deploy/<environment>.json` deployment ownership record/receipt for as long as this deployment exists. Git ignores these private files; a fresh clone does not recover them. The record is needed for removal as well as future updates. rer keeps the generated session and alert hash secrets in the private `.rer/deploy/<environment>.secrets.env` file and reuses them on updates. It retires the one-time setup token automatically and issues a fresh one if an update needs to finish owner finalization. Do not replace the saved secrets during an update.

4. Add `/sign-in` to the hosted origin printed by deploy, open that address, enter your `OWNER_EMAIL` and follow the link in the email. A fresh installation then opens `/setup`: create your first project or choose **Restore a private archive** before creating one. Select an archive up to 16 MiB and choose **Restore into empty installation**, then create new project keys. Archives contain private source maps but exclude owner sessions and credential grants.

Alert destinations start empty. Add, edit and test email destinations from **Alerts → Rules** ([steps](ALERT-WEBHOOKS.md#manage-email-destinations)); no secret update or redeploy is needed. Webhooks remain operator-managed as described in that guide. Keep `ALERT_DESTINATION_HASH_KEY` unchanged while deliveries are active. Secrets are uploaded on the first deploy, and later deploys reuse the retained generated values.

## Turn email off deliberately

Set `MAIL_PROVIDER=none` in the private environment file for the deployment. Leave `MAIL_FROM`, `MAIL_API_KEY`, `MAIL_ACCOUNT_ID` and `MAIL_RELAY_URL` empty; sending credentials together with `none` refuse before build or upload. Spool needs no sender or DKIM setting while mail is off. A missing, `later` or `direct` selection never means off. Enabled Resend, SendGrid, Cloudflare or managed RER mail still requires its sender and API key; Cloudflare also requires its account ID and RER its assigned relay URL.

Run the same `rer deploy` command for the selected environment. The deployment binds `none` to the runtime and reports the guarded sign-in command below. If mail credentials were already bound to that Worker, use `rer deploy --unset-secret MAIL_API_KEY --env-file .rer/deploy/"$SPOOL_ENV".env --environment "$SPOOL_ENV"` and remove any previously bound `MAIL_ACCOUNT_ID` and `MAIL_RELAY_URL` the same way. Deploy preflight reports existing bound credentials by name; selecting off alone does not delete a secret retained on the Worker.

The sign-in page directs the deploying owner to `rer signin`. Email sign-in links and invitations return `503 mail_unavailable`, including known and unknown addresses. Alerts stay visibly blocked without a send or a provider acceptance. Capture, issues and project settings keep working after guarded owner admission; signed-out private pages remain protected. Hosted installs expose no local-development entry or invitation link. To enable mail later, select a provider and use `rer deploy --set-secret` for its configured provider inputs in the same environment, retaining its ownership receipt.

— Run Edit Run fleet, 2026-11-15.

## Sign in without email

When email is off or you cannot receive the sign-in email, run this from the original deploying checkout with its retained private deployment record and the same Cloudflare credentials:

```sh
rer signin --env-file .rer/deploy/"$SPOOL_ENV".env --environment "$SPOOL_ENV"
```

`rer signin` prints a private owner sign-in link once, without sending email. Open it now: it works once, expires within 15 minutes and is never saved by rer. Its use is recorded in the owner's audit log. The command requires this deployment's recorded Worker, account, project, environment and ownership receipt, and checks that the live Worker still matches that receipt before issuing a grant. A different checkout, account or replaced Worker cannot mint access. The command uses the Cloudflare credentials to issue the link for the already claimed owner; it does not create a second owner. Set `SPOOL_ENV` to the environment you deployed before running these commands in a new terminal; the rer default is `production`. Supply the account credentials through the environment, as for deploy. Keep this link private.

## Update to a newer Spool

1. Export first. Sign in to your hosted Spool, open **Settings** and choose **Download private archive**. Keep the downloaded `spool-private-archive.jsonl` until the update is confirmed.

2. Set `SPOOL_ENV` to your existing environment name and `SPOOL_TAG` to the release you are upgrading to. Load your Cloudflare credentials as for the first deploy, then stop local dev, update the checkout and deploy it to the same environment:

   ```sh
   rer dev --stop
   git fetch --tags
   git checkout "$SPOOL_TAG"
   rer install
   rer deploy --env-file .rer/deploy/"$SPOOL_ENV".env --environment "$SPOOL_ENV"
   rer run hosted check --environment "$SPOOL_ENV"
   ```

   If Git refuses to check out the tag because of local changes, preserve those changes before retrying. Deploying to the same environment updates the same Worker and database: new migrations are applied and existing evidence, keys, settings and your owner stay. `rer run hosted check` uses the pinned Node supplied by rer and confirms that the hosted installation is healthy and running this checkout's commit.

3. Sign in as before; your projects and evidence are there. If the deploy fails, it names the failed step; fix the cause and run the same deploy again. The archive restores only into an empty installation ([restore procedure](../OPERATIONS.md#data-movement-and-retention)).

## Remove a hosted installation

Removal deletes this environment's Worker and its recorded owned resources, including the D1 database and its evidence. Export anything you need from **Settings → Download private archive** first. Keep the private archive outside the checkout. If you later import that browser download through the CLI, run `chmod 600 /path/to/spool-private-archive.jsonl` first; see [restore](../OPERATIONS.md#data-movement-and-retention).

Set `SPOOL_ENV` to the environment being removed. Run removal from the **original checkout that deployed this environment**, with its retained private `.rer/deploy/<environment>.json` ownership record/receipt and credentials for the same Cloudflare account:

```sh
rer dev --stop
rer deploy --remove --yes --env-file .rer/deploy/"$SPOOL_ENV".env --environment "$SPOOL_ENV"
```

The general command is `rer deploy --remove --yes`, with `--environment <name>` when selecting an environment; the default is `production`. Use the exact environment used to deploy. rer checks resource ownership and removes the Worker and each D1, R2, KV and queue it created for that environment, with their data. It reads back removal before completing; it does not delete unrelated account resources. This Spool declaration uses one Worker and D1 database.

A fresh clone without the private deployment record deletes nothing and asks you to use the deploying checkout. Do not discard that checkout or its record before removal, and do not fabricate a replacement record. If removal reports remaining resources, retain the record, resolve the stated cause and rerun the same command. `rer reset --yes` only resets local state and preserves deployment receipts; it is not hosted removal.
