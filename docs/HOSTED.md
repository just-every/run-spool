# Hosting Spool

## Managed mail

With RER Managed hosting, Configure supplies and hides all four mail inputs: `MAIL_PROVIDER=rer`, `MAIL_FROM`, `MAIL_RELAY_URL` and the private `MAIL_API_KEY`. RER assigns the sender and relay URL and stores an installation/environment credential in encrypted private settings. You need no provider account and copy no mail key. The provider credential stays with RER. Spool uses Base's `rer` mail adapter for sign-in links and email alerts.

This checkout pins rer 0.2.25. Free and Assisted self hosting retain their existing provider choices and require the chosen provider's sender and credentials. The manual Cloudflare/SendGrid procedure below remains available for your own account.

## Run Spool on your Cloudflare account

`rer deploy` puts this checkout on your own Cloudflare account as one Worker with its D1 database, at `https://spool-<environment>.<your-subdomain>.workers.dev`. Choose your environment name once as `SPOOL_ENV` below (default `production`). Use a lowercase identifier starting with a letter, with letters, digits and single hyphens between segments (at most 32 characters), and keep using the same one in later terminals too.

For the Free or Assisted account procedure below, you need:

- this checkout, set up as in the [README](../README.md#run-it-on-your-computer) (Node 22 or later from [nodejs.org](https://nodejs.org/en/download), git and public rer; Node must already be on PATH, then rer supplies the pinned runtimes);
- a Cloudflare account with a workers.dev subdomain, its account ID, and an API token that can edit Workers scripts and D1;
- a SendGrid API key that can send mail, and a sender address verified in SendGrid. Sign-in links are sent by email.

The [Run page](https://run-spool.com/run) uses one line, `npx -y @runeditrun/rer dev just-every/run-spool`, for the first local start; it handles installation and setup. The `setup` form below prepares this checkout without leaving a dev runtime running. You do not need pnpm on PATH.

## First install

1. Install and set up Spool on this computer:

   ```sh
   npx -y @runeditrun/rer setup just-every/run-spool
   cd run-spool
   SPOOL_ENV=production # choose your environment name here
   ```

   Explicit setup prompts for missing required answers in an interactive terminal. With non-TTY input, use `rer setup --answers <private-json-file> --non-interactive`; piping an email alone is not an answer file. Setup stops its temporary app when complete; `rer dev` starts a local server if you need one. These local answers do not replace the hosted settings below.

2. Create the private settings file for this environment. The command generates the session secret, the one-time setup token and the alert destination hash key. It also starts with no alert destinations (`[]`):

   ```sh
   umask 077 && mkdir -p .rer/deploy && cat > .rer/deploy/"$SPOOL_ENV".env <<EOF
   CLOUDFLARE_ACCOUNT_ID=
   CLOUDFLARE_API_TOKEN=
   OWNER_EMAIL=
   MAIL_FROM=
   MAIL_API_KEY=
   SESSION_SECRET=$(node -p "require('node:crypto').randomBytes(32).toString('hex')")
   SETUP_TOKEN=$(node -p "require('node:crypto').randomBytes(32).toString('hex')")
   ALERT_DESTINATIONS=[]
   ALERT_DESTINATION_HASH_KEY=$(node -p "require('node:crypto').randomBytes(32).toString('base64')")
   EOF
   ```

   Open the generated `.rer/deploy/<environment>.env` in a text editor and fill in the first five lines: your Cloudflare account ID and API token, the email address you will sign in with, the verified SendGrid sender, and the SendGrid API key. Keep these values out of shell commands. The file can be read only by you. Git ignores it, and `rer reset` keeps it. Keep it for every later deploy of this environment.

3. Stop local dev, then deploy and claim the hosted owner:

   ```sh
   rer dev --stop
   set -a && . .rer/deploy/"$SPOOL_ENV".env && set +a
   rer deploy --environment "$SPOOL_ENV"
   ```

   `rer deploy` builds this commit, creates the Worker and its database, applies the migrations, uploads the settings as secrets and checks `/health`. It also sends the one-time setup token to claim `OWNER_EMAIL` as the hosted owner, then removes `SETUP_TOKEN` from the deployed Worker secrets. No separate claim command is needed. An already claimed installation keeps its owner, and later deploys to this environment keep the setup token retired. Keep the original deploying checkout, the private environment file and `.rer/deploy/<environment>.json` deployment ownership record/receipt for as long as this deployment exists. Git ignores these private files; a fresh clone does not recover them. The record is needed for removal as well as future updates. After a successful claim, remove the `SETUP_TOKEN` line from that file; an existing owner needs no setup token for sign-in, updates or archives. rer issues and retires a fresh bootstrap token if an update needs to finish owner finalization.

4. Add `/sign-in` to the hosted origin printed by deploy, open that address, enter your `OWNER_EMAIL` and follow the link in the email. A fresh installation then opens `/setup`: create your first project or choose **Restore a private archive** before creating one. Select an archive up to 16 MiB and choose **Restore into empty installation**, then create new project keys. Archives contain private source maps but exclude owner sessions and credential grants.

Alert destinations start empty. Add, edit and test email destinations from **Alerts → Rules** ([steps](ALERT-WEBHOOKS.md#manage-email-destinations)); no secret update or redeploy is needed. Webhooks remain operator-managed as described in that guide. Keep `ALERT_DESTINATION_HASH_KEY` unchanged while deliveries are active. Secrets are uploaded on the first deploy, and later deploys keep the deployed values.

## Sign in without email

If you cannot receive the sign-in email, run this from the original deploying checkout with its retained private deployment record and the same Cloudflare credentials:

```sh
rer signin --env-file .rer/deploy/"$SPOOL_ENV".env --environment "$SPOOL_ENV"
```

`rer signin` prints a private owner sign-in link once, without sending email. Open it now: it works once, expires within 15 minutes and is never saved by rer. Its use is recorded in the owner's audit log. The command uses the Cloudflare credentials to issue the link for the already claimed owner; it does not create a second owner. Set `SPOOL_ENV` to the environment you deployed before running these commands in a new terminal; the rer default is `production`. You can also supply the account credentials through the environment, as in the deploy command above. Keep this link private.

## Update to a newer Spool

1. Export first. Sign in to your hosted Spool, open **Settings** and choose **Download private archive**. Keep the downloaded `spool-private-archive.jsonl` until the update is confirmed.

2. Set `SPOOL_ENV` to your existing environment name, then stop local dev, update this checkout and deploy it to the same environment:

   ```sh
   rer dev --stop
   git pull --ff-only
   rer install
   set -a && . .rer/deploy/"$SPOOL_ENV".env && set +a
   rer deploy --environment "$SPOOL_ENV"
   node scripts/hosted.mjs check --environment "$SPOOL_ENV"
   ```

   `git pull --ff-only` stops when the histories diverge or local changes conflict with the incoming changes; nonconflicting local edits may be preserved. Deploying to the same environment updates the same Worker and database: new migrations are applied and existing evidence, keys, settings and your owner stay. `node scripts/hosted.mjs check` confirms that the hosted installation is healthy and running this checkout's commit.

3. Sign in as before; your projects and evidence are there. If the deploy fails, it names the failed step; fix the cause and run the same deploy again. The archive restores only into an empty installation ([restore procedure](../OPERATIONS.md#data-movement-and-retention)).

## Remove a hosted installation

Removal deletes this environment's Worker and its recorded owned resources, including the D1 database and its evidence. Export anything you need from **Settings → Download private archive** first. Keep the private archive outside the checkout. If you later import that browser download through the CLI, run `chmod 600 /path/to/spool-private-archive.jsonl` first; see [restore](../OPERATIONS.md#data-movement-and-retention).

Set `SPOOL_ENV` to the environment being removed. Run removal from the **original checkout that deployed this environment**, with its retained private `.rer/deploy/<environment>.json` ownership record/receipt and credentials for the same Cloudflare account:

```sh
rer dev --stop
set -a && . .rer/deploy/"$SPOOL_ENV".env && set +a
rer deploy --remove --yes --environment "$SPOOL_ENV"
```

The general command is `rer deploy --remove --yes`, with `--environment <name>` when selecting an environment; the default is `production`. Use the exact environment used to deploy. rer checks resource ownership and removes the Worker and each D1, R2, KV and queue it created for that environment, with their data. It reads back removal before completing; it does not delete unrelated account resources. This Spool declaration uses one Worker and D1 database.

A fresh clone without the private deployment record deletes nothing and asks you to use the deploying checkout. Do not discard that checkout or its record before removal, and do not fabricate a replacement record. If removal reports remaining resources, retain the record, resolve the stated cause and rerun the same command. `rer reset --yes` only resets local state and preserves deployment receipts; it is not hosted removal.
