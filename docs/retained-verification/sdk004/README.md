# Hosted crash-report dialog

`tests/sentry-sdk.mjs` → [SDK-004] `reportDialogFlow` (`tests/report-dialog-flow.mjs`) captures these screens against the emitted Worker with the unmodified browser SDK and queued loader stub. Each path has dialog, sent and issue-feedback captures at 1440 and 390. Data is synthetic. Only the consented description and exact event reference are retained. No icon-only control on the touched screen.

Before on pristine main `64d67f55cf7f55a50b5fd0a043d3b5089b9d6b21`: `/api/embed/error-page/` returned 404. The candidate serves Spool's own script; no Sentry UI is copied or proxied. No real provider or end-user consent was used.
