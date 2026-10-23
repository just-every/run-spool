# Cron check-ins routed to Uptime

Scheduled-job and heartbeat monitoring is [Uptime](https://github.com/just-every/run-uptime)'s product. Spool accepts the check-ins that unmodified Sentry SDKs send (`Sentry.withMonitor`, `captureCheckIn`, Python `@monitor` and `capture_checkin`, `CaptureCheckIn` in Go and the other server SDKs) at your DSN and forwards each one to the Uptime heartbeat you connect. Spool does not evaluate schedules, margins or missed runs: Uptime does.

## Connect a monitor

In Settings, under **Cron check-ins**, enter the monitor slug your SDK sends and the separate capability URL Uptime shows once when it issues a heartbeat key, which has the form `https://<uptime>/api/heartbeats/<monitor>/url/<token>`. Spool accepts only an https URL of that shape on a public host. The URL is a secret: it is stored by this installation, never shown again (Settings lists the host only), never returned by the API, and excluded from archives, exports, audit entries and logs. Saving, enabling, disabling and removing a connection are owner-only and audited. A project holds up to 20 connections.

By default no monitor is connected and forwarding is off. Connected check-ins leave only through the installation's egress service (`INTEGRATION_EGRESS`, the door alert webhooks use). Without one they are counted as not routed and nothing is sent by any other path.

## What is forwarded

One POST per check-in, one attempt, a bounded wait (4 seconds by default; the Worker variable `CHECKIN_FORWARD_TIMEOUT_MS` sets it between 20 ms and 10 s), no retry queue:

| Sentry status | Uptime receipt |
| --- | --- |
| `in_progress` | `<url>/start` |
| `ok` | `<url>/success` |
| `error` | `<url>/fail` (no exit code is invented) |

The body is `{}` and the only header is `content-type`. Sentry's duration, monitor config (schedule, margin, runtime, timezone, thresholds), release, environment and check-in id have no receiving field in Uptime's heartbeat door, so they are not forwarded; Uptime measures duration from its own start and finish receipts. Receipts keep the order in which Spool receives the check-ins, so a job whose start and finish are sent back to back can arrive reordered when the SDK sends them concurrently.

## Counted, never dropped

Every check-in is counted under exactly one reason in project outcomes and on the Capture receipts screen:

| Reason | Meaning |
| --- | --- |
| `check_in_routed` | Uptime answered 2xx |
| `check_in_unrouted` | no connection for that monitor slug |
| `check_in_disabled` | connection present, forwarding switched off |
| `check_in_egress_unconfigured` | connection present, no egress service installed |
| `check_in_forward_failed` | non-2xx answer, timeout or transport error |
| `check_in_refused` | an enabled inbound filter, or the per-project limit of 120 check-ins a minute |
| `check_in_item_too_large` | an item over the published 100 KiB limit, refused alone |
| `check_in_invalid` | not a check-in (bad slug, id or status) |

A check-in never creates an occurrence, issue, alert or accepted-error unit, and a failure to forward never fails the other items of its envelope. The DSN key, allowed origins and inbound filters apply as they do to every other item.

## Linking the job's errors

Node `@sentry/core` 11.6.0 (`server-runtime-client.js` `captureCheckIn`, `contexts.trace`) and Python `sentry-sdk` 2.72.0 (`scope.py` `_apply_contexts_to_event`, applied to check-ins in `client.py`) stamp the check-in and the errors raised in the job with the same trace id. Spool keeps a bounded link (the latest 1,000 check-ins, seven days) from trace id to monitor slug, status and outcome, and an occurrence's detail names the check-ins that share its trace. That is the only link the data carries: `sentry-go` v0.50.0 serializes no `contexts` on a check-in (`interfaces.go`, `checkInMarshalJSON`), and `sentry-elixir` 14.0.0 attaches `contexts` only when the caller passes them (`lib/sentry/check_in.ex`), so those check-ins link nothing. With `withMonitor`, runs share the process trace unless `isolateTrace` is set, in which case the link names that run alone.

## Not built

Schedules, missed-run detection and incident handling (Uptime's), forwarding the Sentry monitor config or duration, per-monitor retries, and any proof against a real Uptime installation: Spool's journey uses a recorded double of the documented heartbeat door.
