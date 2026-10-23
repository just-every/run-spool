# Observed release health

`tests/sentry-sdk.mjs` [SDK-005] → `tests/session-flow.mjs` runs identical unmodified Node and browser programs against a local reference collector and Spool, changing only DSN. Two releases retain healthy sessions, a Node crash and a browser-unhandled exception. The screen shows observed denominators, older/newer rates, adoption share and Wilson intervals. No horizontal overflow, serious/critical Axe finding or icon-only control at 1440/390. Synthetic identities are hashed before storage; private archive/restore preserves the project key and session aggregates, and erasure removes them.

Pristine main `64d67f55cf7f55a50b5fd0a043d3b5089b9d6b21` counts a session as `sentry_unsupported_session` and returns 404 for release health. No real provider or device is contacted. Browser `unhandled` is not described as a browser process crash. Mobile, Spool SDK, rollout, rollback, cohort and broader identity-policy qualifications remain gaps.
