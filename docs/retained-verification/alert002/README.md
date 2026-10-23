# Slack issue alert adapter

`tests/alerts-egress.mjs` → [ALERT-002] `slackFlow` in `tests/slack-flow.mjs` drives the real destination, reviewed-test, rule, intake, scheduler, history, archive/restore and erasure doors. The only Slack double is the documented `chat.postMessage` response at `INTEGRATION_EGRESS`. Tokens and channel fixtures are synthetic; no Slack installation is contacted.

`tests/alerts-ui.mjs` → [ALERT-002] `slackUI` in `tests/slack-ui.mjs` uses its existing browser and records the existing Alerts settings and delivery screens at 1440 and 390. It connects, tests, reviews, creates a rule, observes the provider message identifier, rotates and revokes. No horizontal overflow or serious/critical Axe finding; no icon-only control on the touched screen. A posted identifier is provider acknowledgment, never human receipt.

Pristine main `64d67f55cf7f55a50b5fd0a043d3b5089b9d6b21` rejects a Slack-kind destination with HTTP 400. Migration 0064 adds private reconnect-only connections and safe historical acknowledgments; existing populated rows are preserved. The connection token never travels in an archive; restored rules remain disabled. Real Slack qualification is NOT RUN.
