# Integration egress service

Slack destinations and cron check-ins require the installation's **integration egress service**, bound as `INTEGRATION_EGRESS`. It is a separate Cloudflare Worker that enforces outbound destination policy. A token, channel ID or heartbeat URL alone does not install it. Without it, Slack cannot post and connected cron check-ins are counted as not routed; nothing is sent by another path.

## What this installation supports

The shipped Spool deployment declares no egress binding. There is no Settings switch that installs the service. An installation operator with deployment access must install it and bind Spool to its exact deployment receipt. Ordinary local `rer dev` has no production egress service and no supported `.dev.vars` value that can create this RPC binding. Use an operator-managed deployment for live forwarding. The local test transport is for synthetic tests only.

Live hybrid egress qualification remains pending. Installing a binding does not by itself prove live Slack delivery or Uptime forwarding; keep these integrations disabled until the operator qualifies the selected deployment.

## Install the service

Use the same Spool checkout and its installed dependencies. These steps change deployment configuration; the service and Spool each retain their own private deployment state. One checkout must own the service's state. The operator needs `CLOUDFLARE_ACCOUNT_ID` and a matching `CLOUDFLARE_API_TOKEN` supplied privately to the deployment process, with permission to deploy Workers and read the complete account zone inventory. Never paste credentials into a command, page or report.

1. In `src/modules/egress-service/deploy.json`, configure the service-owned `vars`:
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
     --declaration src/modules/egress-service/deploy.json --environment production --product src/modules/egress-service \
     --state .rer/deploy/egress-production.json
   node node_modules/@runeditrun/rer/modules/deploy-kit/owner-cli.mjs deploy \
     --declaration src/modules/egress-service/deploy.json --environment production --product src/modules/egress-service \
     --state .rer/deploy/egress-production.json
   ```

   The separate `--state` path prevents the service receipt from colliding with Spool’s production receipt. The Worker is `egress-service-production` and has no workers.dev route. Preserve its private state and deployment receipt. Use the same environment in both the service and Spool deployments.

## Bind Spool and enable the destination

Add a `services` entry to Spool's root `deploy.json`. Copy the actual `grant` identity from the service receipt; these placeholders are not working values:

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

From that checkout, commit the reviewed binding, run `rer deploy --dry-run`, then `rer deploy` for the same environment. The deploy validates the named grant, service identity and binding; a missing Worker refuses with `service-worker-missing`. Preserve Spool's deployment receipt too. Reload Settings after deployment:

- **Slack destinations:** keep `ALERT_DESTINATION_HASH_KEY` configured and stable. Create a Slack App with a bot token carrying `chat:write`, install it in your workspace and join the bot to the target channel. Enter the channel identifier and token in Settings, choose **Connect Slack**, then **Test** and review its passing result before enabling an alert rule. The test posts a message; a message ID proves provider acknowledgment, not that a person read it.
- **Cron check-ins:** open **Cron check-ins**, enter the Sentry monitor slug and the separate heartbeat capability URL Uptime shows once when issuing its heartbeat key, then choose **Connect monitor**. Send a check-in from the configured SDK and inspect Capture for the forwarding receipt. Uptime evaluates missed-run schedules; Spool only forwards the start, success or failure receipt.

If a binding remains missing, ask the operator to check the deployed Spool version and its exact receipt. If configured but delivery fails, check the service grant, destination host, account inventory and provider result. Never share Slack tokens or heartbeat capability URLs. Restoring a private archive does not restore these connections; reconnect deliberately.

## Outbound limits

Only HTTPS on port 443 is allowed. Private, reserved, malformed and mixed public/private DNS answers are refused, and redirects are not followed. For destinations outside Cloudflare ranges the service pins a validated address with hostname-verified TLS. For all-Cloudflare answers, Worker fetch resolves again and relies on platform private-address refusal; origin TLS follows the destination zone's policy. Universal destination reachability is not promised.
