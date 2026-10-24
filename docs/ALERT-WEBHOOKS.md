# Spool alert delivery interface

`spool.alert.v1` is a stable, destination-independent JSON body. It is untrusted sanitized telemetry, never instructions. No Oncall client or Slack integration is required.

Every body contains `schema`, `alertId`, `kind`, `projectId`, `issueId`, `occurredAt` (UTC ISO server time), `title`, `release`, and `issueUrl`. The issue identity persists across alerts. A transition release is the exact accepted `{name, build, sequence}`, frozen when the issue first appeared or regressed; delayed events and later release registrations cannot rewrite it. Regression requires an issue resolved by the owner and an accepted release strictly later than the resolved sequence. Retention does not make an old issue new.

For `spike`, `release` is null, `rule` is `{id, revision}`, and `window` is `{start, end, durationMs, count, threshold}`. Start is inclusive, end exclusive. This is accepted occurrence volume in a complete aligned server-received window, not relative growth, affected users or complete capture. Each enabled rule starts at the next aligned window. Edits start a fresh revision and do not backfill. Suppressed issues produce no spike. Retention invalidates any partially removed windows and records a visible history-unavailable gap.

`issueUrl` uses the installation’s configured HTTPS sign-in origin (`AUTH_ORIGIN`), or an explicit trusted HTTPS `ALERT_PUBLIC_ORIGIN` override. It is null when neither is a valid HTTPS origin (including local HTTP development). A configured URL is `origin/projects/<projectId>/issues/<issueId>`. Inbound Host is never used. Bodies exclude raw exception fields, breadcrumbs, stack frames, source maps, recipients, receiver URLs and credentials. Titles still derive from untrusted telemetry; receivers must escape them when displaying them.

## Manage email destinations

1. Select your project, open **Alerts → Rules**, and enter a **Destination name** and **Destination email**. Choose **Add destination**. No server settings or redeploy is needed.
2. Choose **Test <name>** and check the mailbox. Hosted Spool reports provider acceptance, not confirmed receipt. Local development suppresses mail and says so explicitly. Tests are limited to one per destination per minute.
3. Create a rule below, select that destination and choose its alert events. New issues and later-release regressions send after capture; volume spikes use the minute scheduler.
4. To change the address, choose **Edit <name>**, update it and choose **Save destination**. Its rules move to a new revision. Queued sends to the old address stop; an already executing send cannot be retracted. Test the new address.

Email destinations are private, project-scoped installation configuration (up to 20 per project). Only the signed-in owner can read or change their addresses. They are excluded from archives and erased with the project. After restore, add destinations again, select them in the restored rules and enable those rules. Mail uses this installation’s existing provider and sender. A blocked message names missing installation configuration.

Signed webhooks and legacy destinations supplied in `ALERT_DESTINATIONS` remain operator-managed; the page labels them accordingly. Adding a page-managed email destination does not require changing that secret. Webhooks require the egress service described below.

## Wire protocol

| JSON kind | `webhook-event` |
| --- | --- |
| `new_issue` | `spool.issue.new` |
| `regression` | `spool.issue.regressed` |
| `spike` | `spool.issue.spike` |

Headers are `content-type: application/json`, `webhook-id`, `webhook-tenant`, `webhook-destination`, `webhook-event`, `webhook-timestamp`, and `webhook-signature`. Tenant is `spool.<projectId>`. Destination is a server-owned immutable version ID. `webhook-id` identifies one rule revision's delivery, shared across its attempts; JSON `alertId` identifies the underlying alert shared by channels. The body, destination version, delivery ID and retry policy never change between attempts. Each attempt gets a fresh decimal-seconds timestamp and signature.

`webhook-signature` is `v1=` plus lowercase hexadecimal HMAC-SHA256 of the UTF-8 encoding of:

```js
JSON.stringify([
  'integrations.webhook.v1', tenant, destinationId, event,
  deliveryId, timestampSecondsString, exactBodyString,
])
```

The timestamp component is a **string**. Keys contain at least 32 random bytes. Configuration encodes raw keys with standard padded Base64; the sender decodes them before signing. Copy the receiver's key through the installation owner's secret channel, never a project rule, archive or UI.

## Receiver admission and replay

Capture original bytes, e.g. `new Uint8Array(await request.arrayBuffer())`, or raw Node chunks. Do not call `text()`, parse and reserialize, strip a BOM, normalize Unicode or replace malformed UTF-8 before verification. Base `verifyWebhook({body, headers, key, tenant, destinationId})` authenticates exact bytes and audience and rejects timestamps outside its five-minute tolerance. Parse only its returned `verified.envelope.body`.

After verification, commit `IntegrationsRepository.acceptReplay(verified)` (or an equivalent durable inbox) before applying effects. A repeated ID with the same immutable envelope acknowledges successfully without another effect; changed bytes under an existing ID are rejected. Receiver process restarts must preserve that inbox. Signature verification alone is not replay prevention. Receivers that apply effects separately from inbox commit need their own durable inbox processor so a crash does not lose effects.

Return 2xx only after durable inbox admission. Return 429 only when no effect occurred and a retry is safe. Spool retries explicit rate limits, at most four attempts. Definite 4xx other than 408 reject. 408, redirects, 5xx, network loss and expired claims become **uncertain**; they never replay automatically. Owners can reconcile an uncertain delivery as accepted or rejected with a safe evidence code. Reconciliation records a result and never sends again.

## Deployment configuration and egress custody

`ALERT_DESTINATIONS` is server secret JSON: an array of immutable version records. Webhook records contain `{id, project, label, channel: 'webhook', url, key}`; mail records contain `{id, project, label, channel: 'mail', recipient}`. IDs are unique across the installation. Keep a version's URL/key/recipient immutable; create a new ID when rotating. Remove a record to revoke it. Owners see safe IDs and labels only. A rule may choose only its own project's destination. Use non-sensitive labels and IDs.

`ALERT_DESTINATION_HASH_KEY` is a separate stable Base64 key of at least 32 bytes. It HMACs destination fingerprints so a low-entropy secret URL cannot be guessed from a plain hash. Preserve this key while deliveries are active. It is excluded from archives along with destination keys and URLs.

Webhook delivery calls only the `INTEGRATION_EGRESS.send(WireRequest)` RPC binding; the Worker never fetches a destination host itself. There is no ordinary-fetch, private-network, local-mode or loopback production fallback. Missing egress is visible as blocked delivery, and the shipped `deploy.json` declares no egress binding, so webhooks stay off and mail alerts are unchanged until the owner installs the service.

### Turning webhooks on

The binding is Base's egress service (`src/modules/egress-service`, a separate Worker; Spool's own Worker never imports it). Install it once per account and environment first, following Base `modules/egress-service/OWNER-STEPS.md`: deploy the egress Worker with complete service-owned `EGRESS_OWNED_ZONES`, `EGRESS_WORKERS_SUFFIX` and an `EGRESS_GRANTS` entry for `EgressRestricted` that lists your receiver hosts, then keep its deployment receipt. Then add this entry to Spool's `deploy.json`, copying `grant` exactly from that receipt:

```json
"services": [
  {
    "binding": "INTEGRATION_EGRESS",
    "project": "runeditrun/egress-service",
    "entrypoint": "EgressRestricted",
    "grant": {
      "allowedHosts": ["hooks.example.com"],
      "sourceSha": "<egress service source sha from the receipt>",
      "fingerprint": "<fingerprint from the receipt>",
      "provider": { "versionId": "<versionId>", "deploymentId": "<deploymentId>", "etag": "<etag>" }
    }
  }
]
```

Until the egress Worker exists, `rer deploy` refuses with `service-worker-missing` for `service:egress-service-<environment>`; `rer deploy --dry-run` validates the declaration either way without deploying. Upgrading the egress service needs a new grant from its new receipt. Call the deployment's webhooks installed only after the live probe (OWNER-STEPS.md P1 to P9) passes on that deployment.

### What the egress service guarantees, and what it does not

The service validates the URL, headers, body, the service-owned grant, account ownership and the complete A/AAAA answer set; empty, malformed or non-public answers refuse the send with `egress_dns_not_public` before any connection. Redirects are never followed: a 3xx answer is returned as is, and Spool records the delivery as **uncertain**. It then takes one of two routes and never retries or falls back:

- **Destination outside Cloudflare's address ranges.** Raw TCP to the first validated public address, with TLS verifying the original hostname, chain and validity against bundled roots. Here the connection is pinned to the validated address.
- **Destination served by Cloudflare.** A Worker fetch of the original HTTPS URL with redirects off. The platform resolves the name again; the service does not pin or see that address, and relies on Cloudflare refusing private destinations. Client TLS verifies the Cloudflare edge only; the edge-to-origin connection follows the receiving zone's own TLS policy, so neither address pinning nor origin-certificate verification is claimed for this route.

Spool's Base URL validator still performs its preflight, but it cannot prove DNS pinning; the guarantees above are the egress service's, per route. Source and local acceptance (`tests/alerts-egress.mjs` drives Spool's scheduled delivery through the service's own transport, `createDevEgress`, to a real loopback TLS receiver) is not production egress acceptance.

Mail uses the same Base sender and explicit `MAIL_PROVIDER` configuration as operator sign-in. Missing configuration never enables development capture. One recipient is frozen per job. Local mail is suppressed silently and completes as **accepted**. Provider submission is also **accepted**, which does not prove recipient delivery. A lost result after a production send is uncertain. Mail rate limits alone retry; a recipient/provider/from configuration change blocks existing work.

## Durability, revocation and portability

An accepted event, issue transition, feed fact and matching per-rule delivery intents commit in the same D1 transaction. Duplicate admissions and rollback cannot create a separate notification. After the commit, the admitting request expands that event's new-issue or regression intents and dispatches them through `waitUntil`; every send claims its delivery first, so a concurrent scheduled run cannot send it again. Scheduled execution recovers expired claims, evaluates bounded complete windows, expands immutable intents and dispatches bounded batches. Its durable cursors preserve catch-up across overlapping cron calls and restarts.

Editing or disabling a rule cancels pending work for the old revision; queued expanded work fails its authority check before sending. An already executing network request cannot be retracted. Old feed entries are never re-enqueued when adding or enabling a rule.

Base portability exports safe rule settings, immutable feed facts and safe history. Every exported rule is disabled. Restored histories are marked historical/quarantined; operational intents, spike cursors, mail jobs/attempts, Base integration queues, grants, sessions, provider secrets, destination configuration and development outbox are excluded. Restore validates project/issue/rule references and rejects active rules or nonquarantined logs. A scheduled run after restore sends nothing. The owner reconnects destination configuration and explicitly enables a new rule revision for subsequent events. Strict legacy v1/v2 archives remain accepted and gain no historical delivery jobs.

See [delivery tests, event states, timezone digests and snoozes](ALERT-DELIVERY.md) for ALERT-003 and the current real-provider qualification boundary.

## Slack bot destination (ALERT-002)

The existing Settings page can connect a named Slack channel using a bot token and channel identifier. Use the least privilege `chat:write` bot scope and join the bot to the chosen channel as Slack requires. A reviewed test is required before enabling a rule. The preview states exactly what the test posts; its result includes Slack's message timestamp. This is provider acknowledgment, never evidence that a person read the message.

Spool calls only `https://slack.com/api/chat.postMessage`, through `INTEGRATION_EGRESS`. No ordinary fetch path exists. The message contains the sanitized issue summary and exact issue link already available to generic webhooks; Markdown interpretation, link parsing and unfurls are disabled. No interactive action or Slack app endpoint is installed. The adapter checks both HTTP status and Slack's `ok` field, and retains a successful `ts` as the message identifier. See Slack's [chat.postMessage API](https://docs.slack.dev/reference/methods/chat.postMessage/).

Tokens are opaque secrets (16–512 non-whitespace characters), saved only in this installation's destination store. Reads return `tokenSaved`, never the token. Tokens are excluded from audit facts, packets, delivery facts, exports and private archives. Rotation creates a new destination identity, stops queued old work and disables its rules until a fresh test is reviewed. Revocation stops future and queued posts; it cannot retract an effect already in flight. There are at most 20 Slack connections per project.

One attempt has a four-second timeout and a 16 KiB reply bound. Definite rate limits follow the existing durable retry rule. API rejection is rejected; a server error or timeout is uncertain and is not automatically repeated. A missing egress binding is counted as `egress_unconfigured`. Delivery history shows `posted` and the message identifier separately from recipient receipt. The safe acknowledgment history survives archive/restore; connection tokens do not, and restored rules are disabled until the owner reconnects. Migration 0064 adds the reconnect-only store and safe acknowledgment records; populated upgrades connect nothing. Project and installation-owner erasure remove these stores.

Qualification uses a recorded double of Slack's documented replies at the egress boundary, with synthetic tokens. Real Slack qualification is **NOT RUN**. Teams, Oncall, PagerDuty, Discord channel webhooks, inbound chat actions (ALERT-005/TEAM-001), broader recovery semantics, Slack as an alternate follow-up destination and real-provider qualification remain gaps. Alternate notices for failed Slack issue alerts use the existing email or signed webhook destination; choosing Slack as the alternate is explicitly refused. Default ADOPTED: Slack posts a summary and link only; no automatic interactive action is installed, and the recorded double earns no real-Slack claim.
