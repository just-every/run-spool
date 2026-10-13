# Run Spool on your Cloudflare account

`rer deploy` puts this checkout on your own Cloudflare account as one Worker with its D1 database, at `https://spool-<environment>.<your-subdomain>.workers.dev`. These steps use the environment name `production`; any lowercase name works, as long as you use the same one every time.

You need:

- this checkout, set up as in the [README](../README.md#run-it-on-your-computer) (Node 22.20.0, pnpm 10.12.4);
- a Cloudflare account with a workers.dev subdomain, its account ID, and an API token that can edit Workers scripts and D1;
- a SendGrid API key that can send mail, and a sender address verified in SendGrid. Sign-in links are sent by email.

## First install

1. Install and set up Spool on this computer:

   ```sh
   pnpm install
   pnpm exec rer setup
   ```

2. Create the private settings file for this environment. The command generates the session secret, the one-time setup token and the alert destination hash key. It also starts with no alert destinations (`[]`):

   ```sh
   umask 077 && mkdir -p .rer/deploy && cat > .rer/deploy/production.env <<EOF
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

   Open `.rer/deploy/production.env` in a text editor and fill in the first five lines: your Cloudflare account ID and API token, the email address you will sign in with, the verified SendGrid sender, and the SendGrid API key. Keep these values out of shell commands. The file can be read only by you. Git ignores it, and `rer reset` keeps it. Keep it for every later deploy of this environment.

3. Deploy, then make yourself the owner:

   ```sh
   set -a && . .rer/deploy/production.env && set +a
   pnpm exec rer deploy --environment production
   pnpm run hosted claim --environment production
   ```

   `rer deploy` builds this commit, creates the Worker and its database, applies the migrations, uploads the settings as secrets and checks `/health`. Spool's pinned rer (0.2.1) does not claim the hosted owner, so `hosted claim` does it: it sends the deployed one-time setup token to the new installation, which makes `OWNER_EMAIL` its owner. It prints `Owner claimed` and the sign-in address. Running it again changes nothing and reports the owner as kept.

4. Open the printed `/sign-in` address, enter your `OWNER_EMAIL` and follow the link in the email. A fresh installation then opens first-run setup to create your first project.

Alert destinations start empty; [ALERT-WEBHOOKS.md](ALERT-WEBHOOKS.md) describes their records. Keep `ALERT_DESTINATION_HASH_KEY` unchanged while deliveries are active. Secrets are uploaded on the first deploy, and later deploys keep the deployed values.

## Update to a newer Spool

1. Export first. Sign in to your hosted Spool, open **Settings** and choose **Download private archive**. Keep the downloaded `spool-private-archive.jsonl` until the update is confirmed.

2. Update this checkout and deploy it to the same environment:

   ```sh
   git pull --ff-only
   pnpm install
   set -a && . .rer/deploy/production.env && set +a
   pnpm exec rer deploy --environment production
   pnpm run hosted check --environment production
   ```

   `git pull --ff-only` stops if this checkout has commits or changes of its own. Deploying to the same environment updates the same Worker and database: new migrations are applied and existing evidence, keys, settings and your owner stay. `hosted check` confirms that the hosted Spool now answers from this checkout's commit.

3. Sign in as before; your projects and evidence are there. If the deploy fails, it names the failed step; fix the cause and run the same deploy again. The archive restores only into an empty installation ([OPERATIONS.md](../OPERATIONS.md#owner-account-deployment)).
