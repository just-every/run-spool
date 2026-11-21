# Integration egress service

Slack destinations and cron check-ins require the installation's **integration egress service**. It is a separate Cloudflare Worker that enforces outbound destination policy. A token, channel ID or heartbeat URL alone does not install it. Without it, Slack cannot post and connected cron check-ins are counted as not routed; nothing is sent by another path.

Follow [Connect Slack](#connect-slack) or [Connect cron check-ins](#connect-cron-check-ins) to get the values for Settings. The deployment operator can [install the service](#install-the-service) and [bind it to Spool](#bind-spool-and-enable-the-destination).

## What this installation supports

There is no Settings switch that installs the service. An installation operator with deployment access must install it and bind Spool to its deployment. Use an operator-managed deployment for live forwarding.

Keep these integrations disabled until your operator has checked live Slack delivery or Uptime forwarding on your installation.

Your installation operator can follow [Base's egress-service owner steps](https://github.com/runeditrun/base/blob/3637852064bf6ddadd15418518964d99d615cc46/modules/egress-service/OWNER-STEPS.md) to install the service.

## Connect Slack

Use your own Slack workspace. If app installs require approval, ask its administrator. Your Spool deployment operator must [bind the egress service](#bind-spool-and-enable-the-destination) with `slack.com` in its grant and preserve Spool's managed `ALERT_DESTINATION_HASH_KEY` secret.

1. Open [Your Apps in Slack](https://api.slack.com/apps). Choose **Create New App**, name it, and select the workspace that contains your destination channel. In your app settings, open **OAuth & Permissions**. Under **Bot Token Scopes**, add `chat:write`. [Slack's app setup guide](https://docs.slack.dev/app-management/quickstart-app-settings/)
2. On the same page, choose **Install to Workspace**, then **Allow**. Back in **OAuth & Permissions**, copy the **Bot User OAuth Token** from **OAuth Tokens**. Keep it private. [Slack's bot token guide](https://docs.slack.dev/tools/node-slack-sdk/getting-started/)
3. In Slack, open the destination channel and use `/invite` with the app's bot name. Click the channel name at the top and copy the **Channel ID** at the bottom of the channel details. [Slack's channel ID instructions](https://docs.slack.dev/tools/python-slack-sdk/tutorial/uploading-files/#sharing-a-file-within-a-channel)
4. In your Spool project, open **Settings → Alerts & integrations → Slack destinations**. Set **Slack destination name** to a label you will recognise in alert rules. Paste the channel ID into **Slack channel identifier** and the token into **Slack bot token**, then choose **Connect Slack**.
5. Choose **Test** for that destination and check the test post in the selected channel. Once Spool shows a passing result, choose **Review passing test**. In **Alerts → Rules**, select the reviewed destination before enabling its rule. A message ID records Slack's acknowledgment of the post.

## Connect cron check-ins

Use an Uptime installation you own with a public HTTPS address. Give its hostname to the Spool deployment operator for the [egress grant](#bind-spool-and-enable-the-destination). The service refuses hosts in the Cloudflare account's own zones or its Workers suffix, even if listed in the grant.

1. In Uptime, open **Monitors → New monitor → Fill in the form yourself**. Under **What to check**, choose **Scheduled job (heartbeat)**. Give it a name, set the expected interval and grace period for your job, and choose **Save monitor**. Keep Uptime's private runner running so it can evaluate the receipts. If you created the monitor from a definition file, open it and choose **Resume**. [Uptime's heartbeat setup](https://run-uptime.com/docs/monitors#incoming-heartbeat) · [Private runner setup](https://run-uptime.com/docs/runner)
2. In **Connect your job**, copy the one-time **Check-in URL**. On an existing monitor, choose **Create or replace check-in URL…**. Replacing it immediately retires the previous URL and key. Use the full URL as shown, ending in `/api/heartbeats/<monitor>/url/<token>`. Keep it private. [Uptime's heartbeat jobs guide](https://run-uptime.com/docs/heartbeat-jobs)
3. In your Spool project, open **Settings → Issue processing → Cron check-ins**. For **Monitor slug**, enter the exact slug from the job's Sentry SDK instrumentation, such as the first argument to `Sentry.withMonitor` in Node.js. For **Uptime heartbeat capability URL**, paste the URL from step 2, then choose **Connect monitor**. [Sentry's SDK check-in guide](https://docs.sentry.io/platforms/javascript/guides/node/crons/#job-monitoring)
4. Run the job with its Sentry SDK configured to use your Spool DSN. In Spool's **Capture** receipts, look for **Cron check-in forwarded to Uptime**. That receipt records that Uptime accepted the forwarded check-in. Uptime's monitor evaluates missed runs on the schedule you configured there. [Find your project's Spool DSN](capture.md#already-using-sentry-point-your-dsn-here)

<details>
<summary>Details</summary>

## Install the service

**Owner account required.** An installation operator needs access to the owner's Cloudflare account and deployment checkout. Supply `CLOUDFLARE_ACCOUNT_ID` and a matching `CLOUDFLARE_API_TOKEN` privately to the deployment process, with permission to deploy Workers and read the complete account zone inventory. Never paste credentials into a command, page or report.

The installation steps below use Spool’s copy of that service. Obtain the owner’s authorization before testing with an external receiver.

Use the same Spool checkout and its installed dependencies. These steps change deployment configuration; the service and Spool each retain their own private deployment state. One checkout must own the service's state.

1. Create an installation-owned declaration from the shipped service declaration, leaving the vendored module intact:

   ```sh
   cp src/modules/egress-service/deploy.json egress-deploy.json
   ```

   Preserve its project identity and disabled public route. In `egress-deploy.json`, configure the service-owned `vars`:
   - `EGRESS_OWNED_ZONES`: a JSON array containing **all** zones the account owns (use an explicit `[]` only if there are none).
   - `EGRESS_WORKERS_SUFFIX`: the account's exact `<account-subdomain>.workers.dev` suffix.
   - `EGRESS_GRANTS`: a JSON array with an `EgressRestricted` entry whose `allowedHosts` lists the exact receiver hosts. Include `slack.com` for Slack and the host from each Uptime heartbeat URL for cron check-ins. The checked-in grants allow no hosts.

   Keep the full inventory current when account ownership changes. Owned zones and the account's Workers suffix cannot be destinations. An optional `EGRESS_ALLOWED_HOSTS` list narrows every caller further. Do not widen the service to arbitrary destinations just to make a test pass.
2. Build the existing module from the Spool checkout root:

   ```sh
   node src/modules/egress-service/build.mjs
   ```
3. Commit the reviewed configuration in your deployment checkout, then validate and deploy the separate service using the deploy tool already installed with rer:

   ```sh
   node node_modules/@runeditrun/rer/modules/deploy-kit/owner-cli.mjs dry-run \
     --declaration egress-deploy.json --environment production --product src/modules/egress-service \
     --state .rer/deploy/egress-production.json
   node node_modules/@runeditrun/rer/modules/deploy-kit/owner-cli.mjs deploy \
     --declaration egress-deploy.json --environment production --product src/modules/egress-service \
     --state .rer/deploy/egress-production.json
   ```

   The separate `--state` path prevents the service receipt from colliding with Spool’s production receipt. The Worker is `egress-service-production` and has no workers.dev route. Preserve its private state and deployment receipt. Use the same environment in both the service and Spool deployments.

## Bind Spool and enable the destination

**Deployment owner required.** The service deploy command above writes private ownership state to `.rer/deploy/egress-production.json` (the `--state` argument). Its `receipt` object is the egress Worker's deployment receipt. Use the completed service deployment's state, not Spool's own receipt or the terminal's short deployment summary. Keep the whole state file private and out of Git; it is needed for future upgrades and removal.

The receipt has no ready-made `grant` object. Assemble the entry for Spool's root `deploy.json` from these fields:

| Consumer field | Where to get it in the service state file |
| --- | --- |
| `grant.allowedHosts` | Parse `receipt.config.vars.EGRESS_GRANTS` as JSON; select the entry whose `entrypoint` is `EgressRestricted` and copy its `allowedHosts` array. It must include `slack.com` for Slack and each connected Uptime receiver host. |
| `grant.sourceSha` | Copy `receipt.source.sha`, the committed checkout SHA packaged when the service was deployed. Do not use the Base documentation revision or a later Spool commit. |
| `grant.fingerprint` | Copy `receipt.fingerprint`. |
| `grant.provider` | Copy `receipt.provider.versionId`, `receipt.provider.deploymentId` and `receipt.provider.etag` together from that same receipt. |

Run this from the deployment checkout to print only the service binding metadata, without dumping the private state or any credentials. Copy its `services` entry into Spool's root `deploy.json`:

```sh
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const state = JSON.parse(readFileSync('.rer/deploy/egress-production.json', 'utf8'));
const receipt = state.receipt;
if (!receipt || state.pendingUpload || state.pendingSecret) {
  throw new Error('Complete the egress service deployment first');
}
const grants = JSON.parse(receipt.config.vars.EGRESS_GRANTS);
const selected = grants.find(row => row.entrypoint === 'EgressRestricted');
if (!Array.isArray(selected?.allowedHosts) || !selected.allowedHosts.length) {
  throw new Error('Deploy an EgressRestricted grant with receiver hosts first');
}
const { versionId, deploymentId, etag } = receipt.provider;
console.log(JSON.stringify({ services: [{
  binding: 'INTEGRATION_EGRESS',
  project: 'runeditrun/egress-service',
  entrypoint: 'EgressRestricted',
  grant: {
    allowedHosts: selected.allowedHosts,
    sourceSha: receipt.source.sha,
    fingerprint: receipt.fingerprint,
    provider: { versionId, deploymentId, etag }
  }
}] }, null, 2));
NODE
```

The result has this shape. This copyable example contains no secret; replace every placeholder with the service receipt's values and use only your actual receiver hosts:

```json
{
  "services": [{
    "binding": "INTEGRATION_EGRESS",
    "project": "runeditrun/egress-service",
    "entrypoint": "EgressRestricted",
    "grant": {
      "allowedHosts": ["slack.com", "<your Uptime receiver host>"],
      "sourceSha": "<service source SHA>",
      "fingerprint": "<service receipt fingerprint>",
      "provider": {
        "versionId": "<service version ID>",
        "deploymentId": "<service deployment ID>",
        "etag": "<service ETag>"
      }
    }
  }]
}
```

Merge this entry with existing configuration, preserving all other fields. A service upgrade requires updating the consumer's pinned grant and identity from the new receipt. Do not substitute a plain fetch or a provider dashboard change.

From that checkout, commit the reviewed binding, run `~/.local/bin/rer deploy --dry-run`, then `~/.local/bin/rer deploy` for the same environment. The deploy validates the named grant, service identity and binding; a missing Worker refuses with `service-worker-missing`. Preserve Spool's deployment receipt too. Reload Settings after deployment.

If a binding remains missing, ask the operator to check the deployed Spool version and its exact receipt. If configured but delivery fails, check the service grant, destination host, account inventory and provider result. Never share Slack tokens or heartbeat capability URLs. Restoring a private archive does not restore these connections; reconnect deliberately.

## Outbound limits

Only HTTPS on port 443 is allowed. Private, reserved, malformed and mixed public/private DNS answers are refused, and redirects are not followed. For destinations outside Cloudflare ranges the service pins a validated address with hostname-verified TLS. For all-Cloudflare answers, Worker fetch resolves again and relies on platform private-address refusal; origin TLS follows the destination zone's policy. Universal destination reachability is not promised.

</details>

— Run Edit Run fleet, 2026-11-18.
