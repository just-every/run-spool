# SDK-023 browser loader

The existing `tests/sentry-sdk.mjs` journey (run through heavy-slot on m1-runner at code head `6efac43f47dacdf8c97e565538cbe3e4daf19327`, 23 October 2026) drives `loaderFlow` through the emitted Worker, public intake, owner API and existing key dialog. Synthetic checkout data only. `key-settings-*` shows the saved per-key controls and filled replacement tag; `key-settings-top-*` shows the top of the same scrollable dialog. `loader-error-*` shows the captured occurrence. Desktop is 1440×1000; phone is 390×1000. The journey asserts reflow and no serious/critical Axe finding. No icon-only control exists on the touched settings screen.

The page uses Playwright 1.63.0's chrome-headless-shell build 1243 with fresh test contexts and the execution host's real HOME. No Electron, provider, device or consent is used. The actual official browser SDK is bundled by Spool, not loaded from a CDN. Native minidumps and SDK-025 storage remain outside this loader proof.
