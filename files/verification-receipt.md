# Local verification receipt

Published product HEAD `b24f4426c3900816e10e066d0bf95d06e10901a6`  
Node 22.20.0, pnpm 10.12.4, headless system Chromium.

| Check | Observed result |
| --- | --- |
| Contract generation and check, fresh dependency install, workflow permissions, native export, first-party checks, source check, offline Base verification, build, integration, agent surface and types | Exit 0 on the published HEAD. See `published-build-receipt.txt`. |
| Release source inspection | Exit 0 on the published HEAD. The committed seed, package and release metadata agree at 0.7.14. |
| Owner product runtime | Exit 0 on the published HEAD. The emitted Worker, Chromium capture, delayed release, retention and independent archive restore passed. |
| Public archive export and restore | Exit 0 on the published HEAD. The emitted Worker exported populated plain D1 before and after late 0111 and restored each archive into an independent fresh database. |
| Loader populated upgrade | Exit 0 on the published HEAD. Existing project, key and occurrence survived, and the same key accepted another occurrence after migration 0061. |
| Owner setup | Exit 0 on the published HEAD. Team roster, role mapping, scoped key permissions and archive restoration passed. |
| Invitation, email alerts and erase preview | Focused browser checks passed on the published HEAD. Each changed surface was captured at 1440 and 390. The stale erasure request returned 409, cleared confirmation and preserved the project. Fresh confirmation completed the erase and removed the project from the switcher data. |
| Historical archive suite | Exit 0 before main’s dependency-only update. Both snapshots around late 0111 restored, the published legacy archive retained its rows and columns, and occupied destinations, foreign schema and corrupt bindings refused. |
| Owner triage and accessibility | Exit 0 on the published HEAD. The run covered 22 groups and produced 110 captures at 1440 and 390. It included the dated private backup and the operator conflict recovery. |
| Alerts UI and runtime | Both exited 0 with the same product source prior to the final dependency rebase. |
| Agent handoff | The run passed the touched selector refusals, project scoping, CLI and MCP checks, and retention coverage. Full local attempts stalled waiting for a rer dev server during a restart and on the retry’s first startup. |
| Project erasure full journey | The local attempt stalled waiting for rer dev before reaching the erasure journey. The published-HEAD isolated browser journey passed preview, stale-confirmation recovery and completed erasure. |

The standalone SDK suite first hit a local socket close before its loader step. The focused loader upgrade ran to completion separately. The first owner runtime attempt read a disappearing emitted file while the app was being rebuilt. The owner runtime passed on a stable build of the published HEAD. The full published-HEAD owner browser run produced the key and backup screenshots after proceeding through the dated download and archive-content assertions. No raw test logs, fixture addresses, archive bytes or key values are included.
