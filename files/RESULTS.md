# Owner journey results

Author: Run Edit Run fleet (sd), 2026-11-17 UTC.

| Item | Before | Implemented result |
| --- | --- | --- |
| D5 | Free-text responsibility deep below evidence; absent from the queue and Activity | Current-project member picker beside Status; member identity survives reload via erasable person alias; header/list/Assigned to me/Activity show responsibility. Legacy label writes remain API-compatible. |
| D6 | Setup and Capture generated different sample fingerprints; resolving the setup sample did not make Capture regress it | Both call one shared real exception location; fresh events group together. A resolved sample offers resend and accepts a saved key after reload. Results name the persisted new-issue or regression alert whose trigger matches the sent event. |
| D7 | Open issue displayed a preset labelled Resolved | Open issue shows its future reopening rule; Resolve reveals the resolution choices, with explicit confirmation. |
| D9 | New-project test disabled without a reason | Capture test stays enabled, registers its release and sends; a failed registration gives a release-registration link. |
| D15 | First row below the viewport; four large counters and many separate controls | One compact count line, search and collapsed Filters; rows on the first screen, with query-wide filtering, views, export, bulk preview and pagination retained. New/Open/Resolved/Ignored map to the existing real states. |
| D16 | Download and ambiguous agent handoff dominated | Assign, Resolve and Comment are primary; AI coding assistant lives under issue actions with commands in Details; developer download is secondary. |
| D22 | Invalid key offered an ineffective exact-event retry | Selected project name and saved-key/create-key recovery; real Settings destination; exact-event retry only for uncertain transport failures; raw receipt and outbound event in Details. |

Status mapping: New = stored open/unacknowledged; Open = stored acknowledged; Resolved = stored resolved; Ignored = stored suppressed. These are presentation names over real states, not new lifecycle behavior. Assignment checks current project access both before and inside its write transaction; it confers no access and creates no notification. No new store was introduced: existing assignment, activity, audit and erasure/archive mechanisms are reused. Saved views and copied/exported queries retain the Assigned to me predicate, which resolves for the current signed-in person.

The baseline browser measured the first queue row at 978.95px (1440) and 1368.50px (390), with assignment at 4188.64px and 5511.09px respectively on the measured sample. The initial changed-layout proof measured the first row at 407.97px and 414.73px. The final `journey-receipt.json` contains the current exact measurements and check results; images show each touched screen at 1440 and 390, with key fields masked. Behavioral assertions use 1440. The existing phone smoke remains in the triage journey.

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).

Contract counts remain 23 done / 54 partial / 28 missing / 105 total. There are no clause status, Gap or Evidence edits; no new suite entrypoint or removed suite entrypoint; no version, changelog, release, seed identity, rer pin or Base source change. The public fleet's publication scan and landing checks remain its own work.

`PLAN.md` records the full implementation/verification/publication plan. `DIAGNOSTICS.md` records the resolved local findings. The terminal report and check receipts record final command exits, product SHA, CI custody and evidence transfer separately.
