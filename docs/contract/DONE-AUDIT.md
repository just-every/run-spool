Old reference: `b2849a002c453ba7e3b985f7c28587b92efc29b8` (main, 28 October 2026). Clauses done there: AI-005, ALERT-004, AUDIT-001, BASE-DATA-003 (merged into ERASE-001), ERR-001 to ERR-009, GROUP-001, OPS-001, REL-001, SDK-001, SDK-006, SDK-009 (split into SDK-009 and SDK-028), SDK-010, SDK-012, SDK-013, SDK-020, SDK-023 and TEAM-004.

# Carried-done audit

One row per outcome of every acceptance point of every part of a clause that was done at the old reference. **Asserting test** is the line of the assertion (or of the call whose expected status a test helper asserts) in a file the part's Evidence cell lists. **Result** is `asserted`, `none` or `moved`. A `none` row demotes its clause to partial, and that clause's Gap names the outcome and says what is asserted. Where the assertion exists only in a file the clause does not cite, the `none` row names that file; such a part is a fresh-judge candidate, never a done row here. A `moved` row is a pointer or proof boundary that left the point, with its destination.

A row that cites a status-only line (a 200 check, a count read without the records it counts, or one record read where the point says nothing else changes) does not count as asserted: every absence ("nothing else changes", "never twice"), every multi-term reconciliation and every point with several outcomes on one line was re-read against the asserting line, and demoted where that line does not assert it.

| Clause | Point | Outcome | Asserting test | Result |
| --- | --- | --- | --- | --- |
| ERR-001 | 1 | A valid native envelope is accepted, and its outcome reads `accepted` | `tests/product-runtime.mjs:101` | asserted |
| ERR-001 | 2 | An invalid envelope (an unknown `headers` field) is refused with 400 | `tests/product-runtime.mjs:156` | asserted |
| ERR-001 | 2 | An oversize envelope (a 32,769-character stack) is refused with 400; the runtime helper asserts the status passed in this call | `tests/multilingual.mjs:63` | asserted |
| ERR-001 | 2 | A foreign-project envelope is refused | none: no cited test sends an envelope with another project's ingest key | none |
| ERR-001 | 2 | A conflicting retry (same event ID, changed raw secret) is refused with 409 | `tests/product-runtime.mjs:103` | asserted |
| ERR-001 | 2 | The conflicting retry leaves the stored rows unchanged: the issue count stays at its two accepted occurrences and one alert | `tests/product-runtime.mjs:105` | asserted |
| ERR-001 | 2 | The invalid, oversize and foreign-project refusals leave the stored rows unchanged | none: no cited test reads the rows before and after those refusals | none |
| ERR-001 | 3 | Exceeding the per-minute limit returns 429 (a 140-request burst sees both 201 and 429) | `tests/product-runtime.mjs:171` | asserted |
| ERR-001 | 3 | The per-minute 429 carries `Retry-After` | none: no cited test reads the header | none |
| ERR-001 | 3 | The per-minute refusal is counted under its reason (`minute_budget`) | none: the cited test reads outcomes only to exclude `storage_failure` | none |
| ERR-001 | 3 | No partial rows: the burst's aggregate count equals the admitted count | `tests/product-runtime.mjs:171` | asserted |
| ERR-001 | 4 | Exceeding the retained-event limit returns 429 with the counted reason `retained_event_budget` | none in a cited file: asserted in tests/agent-handoff/caps.mjs line 70, which this clause does not cite | none |
| ERR-001 | 4 | The retained-event 429 carries `Retry-After` and leaves no partial rows | none | none |
| ERR-002 | 1 | An exact retry is answered `duplicate` | `tests/product-runtime.mjs:102` | asserted |
| ERR-002 | 1 | The issue keeps one occurrence per event ID and one aggregate increment: one issue, count 2 after the first event, its exact retry, its conflicting retry and one concurrent new ID | `tests/product-runtime.mjs:105` | asserted |
| ERR-002 | 2 | One local alert is raised | `tests/product-runtime.mjs:105` | asserted |
| ERR-002 | 3 | The same event ID with a changed raw secret is an explicit 409 conflict | `tests/product-runtime.mjs:103` | asserted |
| ERR-002 | 3 | The conflict leaves no partial rows (the count and alerts above are read after it) | `tests/product-runtime.mjs:105` | asserted |
| ERR-003 | 1 | Canaries are absent from the stored events, read through the private archive export of every stored row; the loop asserts no secret on each of the 14 recorded paths | `tests/privacy-table.mjs:81` | asserted |
| ERR-003 | 2 | Canaries are absent from the owner issue list and the owner issue page packet | `tests/privacy-table.mjs:81` | asserted |
| ERR-003 | 3 | Canaries are absent from the agent packet, the CLI packet (Markdown and JSON) and MCP `get_packet` | `tests/privacy-table.mjs:81` | asserted |
| ERR-003 | 4 | Canaries are absent from the archive export | `tests/privacy-table.mjs:81` | asserted |
| ERR-003 | 5 | Canaries are absent from alert email (non-empty: asserted at line 58) and webhook payloads | `tests/privacy-table.mjs:81` | asserted |
| ERR-003 | 6 | Every ordinary line survives on all 14 paths, which also proves each recorded path is non-empty | `tests/privacy-table.mjs:82` | asserted |
| ERR-004 | 1 | An anonymous packet read is refused with 401 (scope helper line 27, run here) | `tests/agent-handoff.mjs:74` | asserted |
| ERR-004 | 2 | A wrong-scope grant is refused: a read-only agent grant gets 403 on owner reads and on every mutation (scope helper lines 11 and 23), and ingest and deploy keys cannot read a packet (line 25) | `tests/agent-handoff.mjs:74` | asserted |
| ERR-004 | 3 | A foreign-project grant is refused: cross-project reads return 403 or 404 without the other project's text (scope helper line 9) | `tests/agent-handoff.mjs:74` | asserted |
| ERR-004 | 4 | A revoked agent grant is refused on the next HTTP, CLI and MCP call | `tests/agent-handoff.mjs:87` | asserted |
| ERR-004 | 5 | Agent and deploy keys minted by a fenced session are refused with 401 | `tests/dev-credentials.mjs:100` | asserted |
| ERR-004 | 6 | Every archived row and the key list are unchanged after the denied mutations (scope helper line 24) | `tests/agent-handoff.mjs:74` | asserted |
| ERR-004 | 7 | The map door refuses a project grant with 403, so no private map bytes are served (scope helper line 11) | `tests/agent-handoff.mjs:74` | asserted |
| ERR-004 | 7 | The CLI JSON packet, the same projection as the HTTP packet, carries no `sourcesContent` (packet helper `noSecrets`) | `tests/agent-handoff.mjs:78` | asserted |
| ERR-004 | 7 | The MCP `get_packet` result carries no `sourcesContent` (packet helper `noSecrets`) | `tests/agent-handoff.mjs:84` | asserted |
| ERR-005 | 1 | Captured before its matching map is uploaded, the minified second-origin exception keeps its generated frame, marked as missing a map | `tests/triage-journey.mjs:62` | asserted |
| ERR-005 | 2 | Captured after the upload, its first stack fact shows the original path, line and column | `tests/triage-journey.mjs:68`, `tests/triage-journey.mjs:69` | asserted |
| ERR-005 | 2 | An unmodified browser SDK event maps to its original line at admission | `tests/sentry-sdk.mjs:77` | asserted |
| ERR-005 | 3 | The earlier admission diagnostics stay unchanged after the late upload, with current lookup labelled separately | none in a cited file: asserted in tests/agent-handoff.mjs lines 60 and 73 and tests/product-runtime.mjs line 123, which this clause does not cite | none |
| ERR-005 | 4 | A mismatched map keeps generated frames with a reason | none in a cited file: the `identity_mismatch` diagnostic is asserted in tests/product-runtime.mjs line 154, which this clause does not cite | none |
| ERR-005 | 5 | Confidential source is excluded from the evidence packet | none in a cited file: the `sourcesContent` exclusion is asserted in tests/agent-handoff.mjs and tests/product-runtime.mjs, which this clause does not cite | none |
| ERR-006 | 1 | When its fingerprint arrives in a newer release, a regression alert is raised and delivered once (native journey's `regression` helper, run here) | `tests/alerts-native.mjs:13` | asserted |
| ERR-006 | 1 | The resolved issue reopens: its state reads open after the newer-release event | none in a cited file: asserted in tests/product-runtime.mjs line 155, which this clause does not cite; the cited native journey reads only the alert and its delivery | none |
| ERR-006 | 2 | A later event from an older release leaves the resolved issue closed | none in a cited file: asserted in tests/product-runtime.mjs line 152, which this clause does not cite | none |
| ERR-006 | 3 | A split preview through the owner HTTP door moves nothing | `tests/operator-flow.mjs:27` | asserted |
| ERR-006 | 3 | A merge preview through the owner HTTP door moves nothing | none: the merge preview's plan is read, but no count is read between preview and apply | none |
| ERR-006 | 3 | A preview through the issue view moves nothing | none: the issue-view journey reads the plan and then applies it, without reading the issue between the two | none |
| ERR-006 | 4 | A split applies and undoes through the owner HTTP door | `tests/operator-flow.mjs:30` | asserted |
| ERR-006 | 4 | The split's undo through the owner HTTP door restores the count | `tests/operator-flow.mjs:37` | asserted |
| ERR-006 | 4 | A merge applies through the owner HTTP door: the target holds both issues' events | `tests/operator-flow.mjs:42` | asserted |
| ERR-006 | 4 | The merge's undo through the owner HTTP door restores the source issue's count | `tests/operator-flow.mjs:46` | asserted |
| ERR-006 | 4 | A split applies through the issue view: the issue loses the moved event | `tests/operator-ui.mjs:24` | asserted |
| ERR-006 | 4 | The split's undo through the issue view restores the count | `tests/operator-ui.mjs:29` | asserted |
| ERR-006 | 4 | A merge applies and undoes through the issue view | none: the issue-view journey runs only a split | none |
| ERR-006 | 5 | A stale correction preview is refused with 409 | `tests/operator-flow.mjs:51` | asserted |
| ERR-006 | 6 | After apply, the moved event keeps its original membership beside its current one | `tests/operator-flow.mjs:30` | asserted |
| ERR-006 | 6 | After undo, every event's original membership and payload stay unchanged | `tests/operator-flow.mjs:130` | asserted |
| ERR-007 | 1 | MCP `get_packet` returns the same projection as the HTTP packet, read as a whole | `tests/agent-handoff.mjs:84` | asserted |
| ERR-007 | 1 | The CLI packet matches the HTTP packet's projection | none: the CLI output is compared only by issue id, short ID and one event's text (lines 76, 78 and 81), never as a whole projection | none |
| ERR-007 | 2 | At the count bound the newest events are kept, the oldest removed first, and the available count and `events_omitted` gap are named | `tests/agent-handoff.mjs:89` | asserted |
| ERR-007 | 2 | At the byte bound the included, available and omitted counts are named, newest first, and a packet with no event that fits still names its count (caps helper, run here) | `tests/agent-handoff.mjs:92` | asserted |
| ERR-007 | 3 | A retention cutoff adds the `retention_gap` with its cutoff and removed count | `tests/agent-handoff.mjs:89` | asserted |
| ERR-007 | 3 | Imported history carries its import gap (import helper `importGap`, run on this line) | `tests/agent-handoff.mjs:89` | asserted |
| ERR-007 | 3 | Refused invalid and oversized intake appears in the `windowed_loss` gap, which says loss before transport is unknown | `tests/agent-handoff.mjs:90` | asserted |
| ERR-007 | 4 | The CLI Markdown and JSON packets and the MCP results carry none of the planted secrets, while ordinary text survives | `tests/agent-handoff.mjs:76`, `tests/agent-handoff.mjs:78`, `tests/agent-handoff.mjs:84` | asserted |
| ERR-007 | 5 | After a map with source content is uploaded, the packet names source content excluded | `tests/agent-handoff.mjs:60` | asserted |
| ERR-007 | 5 | The CLI JSON packet and the MCP packet, equal to the HTTP packet, then carry no `sourcesContent` or source canary (packet helper `noSecrets`) | `tests/agent-handoff.mjs:78`, `tests/agent-handoff.mjs:84` | asserted |
| ERR-007 | 6 | The packet grant can write nothing: every mutation is refused with 403 and the archive is unchanged (scope helper lines 23 and 24, run here) | `tests/agent-handoff.mjs:74` | asserted |
| ERR-007 | 7 | A cross-project read is refused through HTTP (scope helper line 9), the CLI (exit 3) and MCP (exit code 3) | `tests/agent-handoff.mjs:74`, `tests/agent-handoff.mjs:82`, `tests/agent-handoff.mjs:84` | asserted |
| ERR-008 | 1 | The owner records a repair through the HTTP door, recorded by `owner` (recording helper lines 19 and 20, run here) | `tests/repair-recovery.mjs:36` | asserted |
| ERR-008 | 2 | Agent (403), ingest (401) and deploy (401) grants are refused on every repair write, and the rows stay unchanged (recording helper lines 15 and 16) | `tests/repair-recovery.mjs:36` | asserted |
| ERR-008 | 3 | Deployed with nothing captured from its release, the repair reads inconclusive with named reasons (verdict helper lines 10 to 12, run here) | `tests/repair-recovery.mjs:37` | asserted |
| ERR-008 | 4 | After the owner records the exercised flow, a healthy window reads no recurrence after exercise (verdict helper line 19) | `tests/repair-recovery.mjs:37` | asserted |
| ERR-008 | 5 | An older-release event is listed with `counted: false` and the issue stays resolved (verdict helper lines 23 and 24) | `tests/repair-recovery.mjs:37` | asserted |
| ERR-008 | 6 | A rejected-event spike in the window reads inconclusive with `windowed_loss` (verdict helper lines 27 and 28) | `tests/repair-recovery.mjs:37` | asserted |
| ERR-008 | 7 | The same fingerprint in the repaired release reads recurred (verdict helper line 31) | `tests/repair-recovery.mjs:37` | asserted |
| ERR-008 | 8 | No repair write adds an outbox message, delivery row or alert (the recording helper's `quiet` asserts each after every write, run here) | `tests/repair-recovery.mjs:36` | asserted |
| ERR-008 | 8 | A real regression from captured evidence is routed | `tests/repair-recovery.mjs:38` | asserted |
| ERR-009 | 1 | A populated installation exports through the browser download | none in a cited file: the download is asserted in tests/multilingual.mjs and tests/commands.mjs, which this clause does not cite; the cited test reads the archive over HTTP | none |
| ERR-009 | 1 | A populated installation exports through `rer export` | none in a cited file: asserted in tests/commands.mjs, which this clause does not cite | none |
| ERR-009 | 2 | The archive restores into an independent empty destination, and every private domain row compares equal | `tests/product-runtime.mjs:191` | asserted |
| ERR-009 | 2 | An old native archive restores into a fresh migrated target with every row | `tests/old-archive.mjs:107` | asserted |
| ERR-009 | 3 | Restored work holds no active grant | none: the cited tests assert only that the archive carries no credentials, sessions or ingest key (`tests/product-runtime.mjs:179`); no cited test reads grants after a restore | none |
| ERR-009 | 3 | Restored work starts no dispatch and no current repair proof | none: no cited test reads dispatch or repair proof after a restore | none |
| ERR-009 | 4 | A tampered archive (a broken checksum, then poisoned rows under a valid checksum) is refused with 400, leaving the destination empty | `tests/product-runtime.mjs:183`, `tests/product-runtime.mjs:184` | asserted |
| ERR-009 | 4 | A corrupted archive binding is refused, leaving the destination empty | `tests/old-archive.mjs:137` | asserted |
| ERR-009 | 5 | A conflicting archive (a mismatched schema) is refused, leaving the destination empty | `tests/old-archive.mjs:132` | asserted |
| ERR-009 | 6 | An import into a nonempty target is refused and the target's project is unchanged | `tests/old-archive.mjs:126` | asserted |
| ERR-009 | 7 | After a manual retention cutoff, repair snapshots keep their coverage gaps | none in a cited file: the cited tests read the retained packet after a cutoff (tests/product-runtime.mjs line 194), not a repair snapshot | none |
| OPS-001 | 1 | A fresh checkout's public `rer install` completes | `tests/commands.mjs:37` | asserted |
| OPS-001 | 1 | `rer setup` completes, keeps the private settings byte for byte and stops its runtime | `tests/commands.mjs:56` | asserted |
| OPS-001 | 1 | `rer dev` starts (the `ready` helper waits for its ready event) and serves the first-project journey at 1440 (journey helper, run here) | `tests/commands.mjs:60`, `tests/commands.mjs:63` | asserted |
| OPS-001 | 2 | `rer export` writes a populated archive that excludes credentials, operators and the mail outbox | `tests/commands.mjs:83` | asserted |
| OPS-001 | 2 | `rer import` restores it into the reset destination, keeping every row and object | `tests/commands.mjs:101` | asserted |
| OPS-001 | 3 | `rer reset` without `--yes` is refused, and with it clears local state while keeping deployment custody and exports | `tests/commands.mjs:87` | asserted |
| OPS-001 | 4 | The deployment dry run builds and then names its missing inputs | `tests/commands.mjs:111` | asserted |
| OPS-001 | 4 | The dry run makes no provider HTTP call | `tests/commands.mjs:117` | asserted |
| OPS-001 | 5 | Setup with a different owner email is refused and the existing settings stay byte for byte | `tests/commands.mjs:58` | asserted |
| OPS-001 | 6 | Setup rejects an unsafe answer path | none: the cited test refuses a symlinked private settings file (line 35), not an answers path | none |
| OPS-001 | 7 | A second signed managed claim is refused with 409 and changes nothing | `tests/owner-claim.mjs:76` | asserted |
| OPS-001 | 8 | Anonymous editor access is denied | none in a cited file: editor access is asserted in tests/owner-editor.mjs, which this clause does not cite | none |
| OPS-001 | 8 | Project-grant editor access is denied | none in a cited file: asserted in tests/owner-editor.mjs, which this clause does not cite | none |
| ERASE-001 | 1 | No planted canary (event text, map content, recipient, title, repair note, import originals, project name and more) remains in any D1 table or column | `tests/project-erasure.mjs:59` | asserted |
| ERASE-001 | 1 | No canary remains in the development outbox or a fresh archive | `tests/project-erasure.mjs:60`, `tests/project-erasure.mjs:61` | asserted |
| ERASE-001 | 2 | The preview carries counts without personal values or identifiers | `tests/project-erasure.mjs:45` | asserted |
| ERASE-001 | 2 | The receipt carries counts and times only | `tests/project-erasure-cap.mjs:40` | asserted |
| ERASE-001 | 3 | Anonymous, ingest, agent and deploy, unknown, wrong-confirmation and cross-origin requests are refused with every row, receipt and outbox entry unchanged (doors helper, run here) | `tests/project-erasure.mjs:51` | asserted |
| ERASE-001 | 3 | A stale owner-erasure plan is refused with 409 and changes nothing | `tests/owner-erasure.mjs:99`, `tests/owner-erasure.mjs:100` | asserted |
| ERASE-001 | 4 | A project holding 10,000 events is erased within 300 seconds | `tests/project-erasure-cap.mjs:39` | asserted |
| ERASE-001 | 5 | A sole owner is held for a verified successor | `tests/owner-erasure.mjs:23` | asserted |
| ERASE-001 | 5 | After owner erasure exactly one active owner remains | `tests/owner-erasure.mjs:126` | asserted |
| ERASE-001 | 6 | An interrupted owner erasure resumes to completion (interrupted-erasure helper, run here) | `tests/owner-erasure.mjs:159` | asserted |
| ERASE-001 | 7 | A pre-erasure archive is refused by the same installation and by a fresh destination that first received the post-erasure archive (fences helper, run here) | `tests/project-erasure.mjs:66` | asserted |
| TEAM-004 | 1 | A commit citing the issue's short ID in mixed case, registered through the deploy-key release door, links at once | `tests/release-identity-flow.mjs:120` | asserted |
| TEAM-004 | 1 | The link is on the issue's commit timeline with its SHA, citation, release and author | `tests/release-identity-flow.mjs:124` | asserted |
| TEAM-004 | 1 | The same commit delivered by merging a pull request links the issue | moved: GitHub and GitLab pull and merge request citations are SRC-002's, which carries their provider receipts (Requirement) | moved |
| TEAM-004 | 1 | The same commit registered through `sentry-cli releases set-commits` links the issue | moved: `sentry-cli` commit registration is SRC-003's (Requirement) | moved |
| TEAM-004 | 2 | The issue resolves in that release (`resolvedIn`), with the commit, citation and author recorded | `tests/release-identity-flow.mjs:124` | asserted |
| TEAM-004 | 3 | A newer-release occurrence reopens it, with one regression alert carrying its short ID and resolution | `tests/release-identity-flow.mjs:134`, `tests/release-identity-flow.mjs:135` | asserted |
| TEAM-004 | 4 | An older-release occurrence leaves it resolved | `tests/release-identity-flow.mjs:133` | asserted |
| TEAM-004 | 5 | The other project's issue gains no link (the linked list is exactly the two own-project citations), stays open, and its link log stays empty | `tests/release-identity-flow.mjs:120`, `tests/release-identity-flow.mjs:123` | asserted |
| TEAM-004 | 5 | The citation is logged with its literal text, SHA and reason `other_project` | `tests/release-identity-flow.mjs:121` | asserted |
| TEAM-004 | 6 | An auto-created release named by the commit's full SHA resolves the cited issue when the registration delivers that commit | `tests/release-identity-flow.mjs:159` | asserted |
| SDK-001 | 1 | Q1: `@sentry/browser` handled and automatic exceptions persist, read through the API | `tests/runtimes/browser.mjs:75` | asserted |
| SDK-001 | 1 | Q1: the handled issue and the mapped unhandled issue read through the UI at 1440 and 390 (the width loop at line 10) | `tests/runtimes/browser.mjs:91` | asserted |
| SDK-001 | 1 | Q2: the automatic browser error persists as unhandled | `tests/runtimes/browser.mjs:75` | asserted |
| SDK-001 | 1 | Q3: flush and reload group the handled and the unhandled captures without a duplicate occurrence | `tests/runtimes/browser.mjs:76` | asserted |
| SDK-001 | 1 | Q4: every browser SDK item has one persisted or counted outcome, with only the DSN changed | `tests/runtimes/browser.mjs:71` | asserted |
| SDK-001 | 1 | Q5: release and dist equal what the SDK sent, and the release is auto-created | `tests/runtimes/browser.mjs:83`, `tests/runtimes/browser.mjs:85` | asserted |
| SDK-001 | 1 | Q6: the SDK's lifecycle client report is received and counted, with its `before_send` discards | `tests/runtimes/browser.mjs:52`, `tests/runtimes/browser.mjs:55` | asserted |
| SDK-001 | 1 | Q6: the capture screen shows SDK discards at 1440 and 390 | `tests/runtimes/browser.mjs:93` | asserted |
| SDK-001 | 1 | Q7: an event refused under the registered-sequence rule creates no issue | `tests/sentry-sdk.mjs:66` | asserted |
| SDK-001 | 1 | The feedback widget submits, and the inventory sent to Spool, equal to the reference with only the DSN changed, includes feedback and replay items | `tests/runtimes/browser.mjs:66`, `tests/runtimes/browser.mjs:69` | asserted |
| SDK-001 | 2 | The build-plugin map resolves the actual original failure line | `tests/runtimes/browser.mjs:89` | asserted |
| SDK-001 | 3 | Q1: every `@sentry/node` error event is a persisted occurrence, the handled chain persists, and the UI reads it | `tests/sdk-runtimes.mjs:44`, `tests/sdk-runtimes.mjs:56` | asserted |
| SDK-001 | 3 | Q2: the Node crash persists as unhandled | `tests/sdk-runtimes.mjs:47` | asserted |
| SDK-001 | 3 | Q3: the restarted process groups into the same issue (count 2) | `tests/sdk-runtimes.mjs:45` | asserted |
| SDK-001 | 3 | Q4: Node outcomes reconcile with the items the SDK sent | `tests/sdk-runtimes.mjs:38` | asserted |
| SDK-001 | 3 | Q5: release and dist equal what the SDK sent, and the release is auto-created | `tests/sdk-runtimes.mjs:51`, `tests/sdk-runtimes.mjs:53` | asserted |
| SDK-001 | 3 | Q6: the Node SDK's client reports (a required item) reconcile in the outcomes | `tests/sdk-runtimes.mjs:38` | asserted |
| SDK-001 | 3 | Q7: a forged key and an unreachable intake create nothing | `tests/sdk-runtimes.mjs:63` | asserted |
| SDK-001 | 4 | Node intake with no release is accepted and invents no release | `tests/runtimes/node.mjs:23` | asserted |
| SDK-001 | 4 | The release-less event raises one new-issue alert naming no release | `tests/runtimes/node.mjs:27` | asserted |
| SDK-001 | 4 | An inferred git SHA is the release, created automatically | `tests/runtimes/node.mjs:32` | asserted |
| SDK-001 | 5 | The release-scoped no-release count and `!has:release` search each count the release-less event | `tests/runtimes/node.mjs:35` | asserted |
| SDK-006 | 1 | Every named filter is enabled through the policy door and records recent matches (browser extensions, legacy browsers, localhost, crawlers, React hydration, chunk loads, IP addresses, messages, releases, environments and allowed domains) | `tests/inbound-filter-flow.mjs:46` | asserted |
| SDK-006 | 2 | Matching native events are answered 202 naming their filter, and create no issue or alert | `tests/inbound-filter-flow.mjs:41`, `tests/inbound-filter-flow.mjs:43` | asserted |
| SDK-006 | 2 | Matching events from the unmodified Node SDK create no occurrence or alert | `tests/inbound-filter-flow.mjs:142` | asserted |
| SDK-006 | 2 | Filtered events consume no accepted (billable) admission: 125 more filtered events still answer 202, and accepted stays 3 | `tests/inbound-filter-flow.mjs:42`, `tests/inbound-filter-flow.mjs:48` | asserted |
| SDK-006 | 3 | Usage counts the filtered units (139), and each filter shows its own match count | `tests/inbound-filter-flow.mjs:48`, `tests/inbound-filter-flow.mjs:46` | asserted |
| SDK-006 | 3 | Filtered units from real SDK traffic reconcile exactly with the SDK's wire categories | `tests/inbound-filter-flow.mjs:138` | asserted |
| SDK-006 | 4 | A non-matching event is accepted (201) | `tests/inbound-filter-flow.mjs:20` | asserted |
| SDK-006 | 4 | An allowed origin is accepted with its CORS grant | `tests/inbound-filter-flow.mjs:44` | asserted |
| SDK-006 | 5 | A non-allowed `Origin` is refused with 403 and no CORS grant through native ingest, and every real SDK request from it is refused with 403 | `tests/inbound-filter-flow.mjs:45`, `tests/inbound-filter-flow.mjs:140` | asserted |
| SDK-006 | 6 | A non-allowed `Referer` is refused with 403 and no CORS grant | `tests/inbound-filter-flow.mjs:45` | asserted |
| SDK-006 | 7 | After the message filter is disabled, a later matching event is accepted (201), and the SDK's later error too | `tests/inbound-filter-flow.mjs:47` | asserted |
| SDK-009 | 1 | Unmodified Node SDK errors with no release are accepted | `tests/release-identity-flow.mjs:42` | asserted |
| SDK-009 | 1 | An unmodified Node SDK error carrying a full-SHA release from its environment is accepted and auto-creates that release | `tests/release-identity-flow.mjs:43` | asserted |
| SDK-009 | 1 | Those events create an issue, found by release-less search | `tests/release-identity-flow.mjs:42` | asserted |
| SDK-009 | 1 | Those events raise their new-issue alerts | none in a cited file: the release-less new-issue alert is asserted in tests/runtimes/node.mjs, which this clause does not cite | none |
| SDK-009 | 2 | The auto-created releases record their first-seen time and creating SDK | `tests/release-identity-flow.mjs:22` | asserted |
| SDK-009 | 3 | The release-less event counts in the issue and in `!has:release` search | `tests/release-identity-flow.mjs:20` | asserted |
| SDK-009 | 3 | Release-scoped views name the events as "no release" | none in a cited file: the no-release count and its view are asserted in tests/runtimes/node.mjs, which this clause does not cite | none |
| SDK-009 | 4 | A later native registration enriches the same release, keeping its sequence and first-seen time and removing the auto-created label | `tests/release-identity-flow.mjs:28` | asserted |
| SDK-009 | 5 | A plain-resolved issue that receives the same error in the same release reopens with one regression alert | `tests/release-identity-flow.mjs:25` | asserted |
| SDK-009 | 6 | The two semver and two SHA releases are auto-created and listed in the stated order | `tests/release-identity-flow.mjs:77` | asserted |
| SDK-009 | 6 | Resolved in the next release, events in the frozen latest and with no release stay resolved, and the first ordered release above it reopens the issue | `tests/release-identity-flow.mjs:76` | asserted |
| SDK-009 | 6 | Resolved in the next release again, events in every known semver and SHA release and with no release stay resolved | `tests/release-identity-flow.mjs:78` | asserted |
| SDK-009 | 6 | Resolved in a named SHA release, events in the releases ordered before it stay resolved and an event at the target reopens it | `tests/release-identity-flow.mjs:80` | asserted |
| SDK-009 | 6 | Resolved in an earlier named SHA release, an event in a later SHA release reopens it | `tests/release-identity-flow.mjs:81` | asserted |
| SDK-009 | 6 | An older-release event does not regress it | `tests/release-identity-flow.mjs:79` | asserted |
| SDK-009 | 7 | A release-less event is counted on the issue (`seen_without_release`) without reopening it | `tests/release-identity-flow.mjs:76` | asserted |
| SDK-009 | 8 | An invalid release name is accepted, creates no release and is counted as `sentry_release_invalid_release_name` | `tests/release-identity-flow.mjs:32` | asserted |
| SDK-028 | 1 | The mixed history lists in first-seen order with latest `def456` | none in a cited file: asserted in tests/release-order-flow.mjs, which tests/deployment-history.mjs runs and this clause does not cite | none |
| SDK-028 | 2 | Under semver the history lists `1.2.0-rc.1`, `1.2.0`, `1.10.0`, `abc123`, `def456` | none in a cited file: asserted in tests/release-order-flow.mjs, which this clause does not cite | none |
| SDK-028 | 3 | Repeated calls and every permutation sort the same, and comparison triples are transitive | none in a cited file: asserted in tests/release-order-flow.mjs, which this clause does not cite | none |
| SDK-028 | 4 | The first-seen and byte-order tie breaks hold | none in a cited file | none |
| SDK-028 | 5 | Under semver order, late older and same-release events leave a resolved issue resolved and a later release regresses it | `tests/release-identity-flow.mjs:31` | asserted |
| SDK-028 | 5 | `release:latest` and release comparisons follow the chosen order | none in a cited file: `release:latest` is asserted in tests/release-order-flow.mjs, which this clause does not cite | none |
| SDK-028 | 6 | Under registered sequence only, chosen with its preview, an unregistered release and a missing release are each refused (422) with the named reason | `tests/release-identity-flow.mjs:35` | asserted |
| SDK-028 | 6 | Those refusals are counted in project outcomes and usage | none: the cited test reads only the refusal response | none |
| SDK-010 | 1 | A Python-shaped chained exception keeps both exceptions, each with its own frames, SDK-sent context line and local variables, at the owner detail door | `tests/fidelity-flow.mjs:39` | asserted |
| SDK-010 | 2 | The `password` local is masked at the owner detail door, and the ordinary local survives | `tests/fidelity-flow.mjs:39`, `tests/fidelity-flow.mjs:40` | asserted |
| SDK-010 | 2 | The packet carries no local variables at all | `tests/fidelity-flow.mjs:41` | asserted |
| SDK-010 | 2 | The `password` local is masked in storage and in exports | none: the cited test reads neither the archive nor an export | none |
| SDK-010 | 3 | The same wrapper with two root causes makes two issues | `tests/fidelity-flow.mjs:14` | asserted |
| SDK-010 | 3 | Both root causes raise new-issue alerts | `tests/fidelity-flow.mjs:15` | asserted |
| SDK-010 | 4 | An `ExceptionGroup` with two children is accepted (the `send` helper asserts 200) | `tests/fidelity-flow.mjs:46` | asserted |
| SDK-010 | 4 | The children show under Related Exceptions, and an `asyncio.TaskGroup` failure is accepted | none: the cited test sends no TaskGroup and reads no Related Exceptions view | none |
| SDK-010 | 4 | Node `cause`, Next.js wrapped `cause` and Java `Caused by` chains each show with the root cause marked | none: the cited test sends a Java chain (line 54) but reads no root-cause marking, and sends no Node or Next.js chain | none |
| SDK-010 | 5 | The event keeps its `browser.name` tag | `tests/fidelity-flow.mjs:39` | asserted |
| SDK-010 | 5 | The event keeps the SDK's browser and os contexts | none: the cited test sends the contexts (line 10) but reads back only the tag and `extra` | none |
| SDK-010 | 5 | The issue's tag summary shows `tenant` with its count and percentage | `tests/fidelity-flow.mjs:23` | asserted |
| SDK-010 | 5 | The tag summary shows `browser.name` and `os.name` with counts and percentages | none: only the `tenant` summary row is read | none |
| SDK-010 | 5 | `tenant:acme browser.name:Chrome` finds the issue, with the tag facet count | `tests/fidelity-flow.mjs:17` | asserted |
| SDK-010 | 6 | The request keeps its method, and the cookie and authorization values are scrubbed | `tests/fidelity-flow.mjs:39`, `tests/fidelity-flow.mjs:40` | asserted |
| SDK-010 | 6 | The request shows its URL and the allowed headers | none: the cited test reads the method and query string, not the URL or allowed headers | none |
| SDK-010 | 7 | A `captureMessage` template groups its parameter variants into one issue | `tests/fidelity-flow.mjs:48` | asserted |
| SDK-010 | 8 | A 1,200-frame recursion keeps 1,000 frames with 200 omitted | `tests/fidelity-flow.mjs:53` | asserted |
| SDK-010 | 8 | The copied raw stack trace shows both tracebacks with no masked value revealed | none: the cited test performs no copy of the raw view | none |
| SDK-012 | 1 | Q1: for each of the eight runtimes every SDK error event persists, the handled chain persists, and the UI reads it (this loop runs every runtime) | `tests/sdk-runtimes.mjs:44`, `tests/sdk-runtimes.mjs:56` | asserted |
| SDK-012 | 1 | Q2: each runtime's crash persists as unhandled, by the SDK's own marking (sentry-go by level fatal) | `tests/sdk-runtimes.mjs:47` | asserted |
| SDK-012 | 1 | Q3: each restarted process groups into the same issue | `tests/sdk-runtimes.mjs:45` | asserted |
| SDK-012 | 1 | Q4: each runtime's outcomes reconcile with the items its SDK sent | `tests/sdk-runtimes.mjs:38` | asserted |
| SDK-012 | 1 | Q5: release and dist equal what each SDK sent, and the release is auto-created | `tests/sdk-runtimes.mjs:53` | asserted |
| SDK-012 | 1 | Q6: client-report discards reconcile for Python, Go, Java, .NET, Rust and Elixir | `tests/sdk-runtimes.mjs:38` | asserted |
| SDK-012 | 1 | Q6: client-report discards appear for PHP and Ruby | none: sentry/sentry 4.34.0 and sentry-ruby 7.1.0 send no client report from these programs, so no discard reaches usage | none |
| SDK-012 | 1 | Q7: a forged key and an unreachable intake create nothing, for each runtime | `tests/sdk-runtimes.mjs:63` | asserted |
| SDK-012 | 1 | Each runtime runs in its own push Verify job | moved: a proof boundary, kept in the Requirement | moved |
| SDK-012 | 2 | Python intake with no release invents no release and raises one release-less new-issue alert naming no release | `tests/runtimes/python.mjs:38`, `tests/runtimes/python.mjs:40`, `tests/runtimes/python.mjs:42` | asserted |
| SDK-012 | 2 | The SDK-inferred git SHA is the release, created automatically, and the release-scoped no-release count is 1 | `tests/runtimes/python.mjs:49`, `tests/runtimes/python.mjs:50`, `tests/runtimes/python.mjs:53` | asserted |
| SDK-012 | 3 | The `raise … from` chain persists as its two exceptions | `tests/sdk-runtimes.mjs:44` | asserted |
| SDK-012 | 4 | An `ExceptionGroup` keeps its children and group mechanism | `tests/runtimes/python.mjs:61` | asserted |
| SDK-012 | 5 | Default `include_local_variables` keeps an ordinary local and redacts `password` and `api_key` | `tests/runtimes/python.mjs:27` | asserted |
| SDK-012 | 6 | The SDK runtime context and default integrations are kept | `tests/runtimes/python.mjs:28` | asserted |
| SDK-012 | 7 | Django request data over a real request keeps the URL, method, query and headers, with secrets masked | `tests/runtimes/python.mjs:64`, `tests/runtimes/python.mjs:66` | asserted |
| SDK-012 | 8 | Java `Caused by` and suppressed exceptions are kept with their mechanisms | `tests/runtimes/java.mjs:26` | asserted |
| SDK-013 | 1 | Q1: the main process's handled chain persists and the UI reads it | `tests/sdk-runtimes.mjs:44`, `tests/sdk-runtimes.mjs:56` | asserted |
| SDK-013 | 1 | Q2: the main process's uncaught error persists as unhandled | `tests/runtimes/electron.mjs:23` | asserted |
| SDK-013 | 1 | Q3: the main process's handled capture groups across relaunch (count 2) | `tests/sdk-runtimes.mjs:45` | asserted |
| SDK-013 | 1 | Q4: every item the packaged app sent has one outcome | `tests/sdk-runtimes.mjs:38` | asserted |
| SDK-013 | 1 | Q5: release and dist equal what the SDK sent, auto-created | `tests/sdk-runtimes.mjs:51`, `tests/sdk-runtimes.mjs:53` | asserted |
| SDK-013 | 1 | Q6: the app's client reports reconcile with the items it sent | `tests/sdk-runtimes.mjs:38` | asserted |
| SDK-013 | 1 | Q6: the capture screen shows SDK discards | `tests/runtimes/electron.mjs:28` | asserted |
| SDK-013 | 1 | Q7: a forged key and an unreachable intake create nothing | `tests/sdk-runtimes.mjs:63` | asserted |
| SDK-013 | 2 | Q1 and Q3: the renderer's handled error persists and groups across relaunch (count 2), read through the UI | `tests/runtimes/electron.mjs:20`, `tests/runtimes/electron.mjs:27` | asserted |
| SDK-013 | 2 | Q2: the renderer's uncaught error persists as unhandled | `tests/runtimes/electron.mjs:23` | asserted |
| SDK-013 | 2 | Q4 to Q7 for renderer items: the same run's reconciliation, release identity and refusal checks cover both processes, with one occurrence per main and renderer capture | `tests/runtimes/electron.mjs:25`, `tests/sdk-runtimes.mjs:38`, `tests/sdk-runtimes.mjs:51`, `tests/sdk-runtimes.mjs:63` | asserted |
| SDK-020 | 1 | G1: the Django change applied equals the reviewed patch | `tests/setup-flow.mjs:112` | asserted |
| SDK-020 | 1 | G1: the Next.js change applied equals every reviewed byte | `tests/setup-flow.mjs:154` | asserted |
| SDK-020 | 2 | G2: the Next.js source-map configuration is written and the real production error maps to its original line | `tests/setup-flow.mjs:221` | asserted |
| SDK-020 | 2 | G2: Django setup says Python has no source maps | `tests/setup-flow.mjs:101` | asserted |
| SDK-020 | 3 | G3: the test event is accepted and reported by Spool's receipt | `tests/setup-flow.mjs:111` | asserted |
| SDK-020 | 4 | G4: a bad DSN is refused | `tests/setup-flow.mjs:43` | asserted |
| SDK-020 | 4 | G4: unsafe paths, inside or outside the project, are refused and write nothing | `tests/setup-flow.mjs:84` | asserted |
| SDK-020 | 5 | G5: the seven framework guides are published | none: the guides exist only in docs/SENTRY-SWITCHING.md, a GitHub-only engineering note; no cited test reads them | none |
| SDK-023 | 1 | The default loader requests no SDK before a capture, and non-capture calls stay buffered | `tests/loader-flow.mjs:44` | asserted |
| SDK-023 | 2 | `Sentry.onLoad` and the late-ready hook run with the key's DSN, once | `tests/loader-flow.mjs:67` | asserted |
| SDK-023 | 3 | The first capture loads one SDK bundle and is stored | `tests/loader-flow.mjs:48` | asserted |
| SDK-023 | 4 | A release-less loader occurrence is accepted into the same issue | `tests/loader-flow.mjs:111` | asserted |
| SDK-023 | 4 | Every loader and direct event is counted exactly once in the outcomes | `tests/loader-flow.mjs:129` | asserted |
| SDK-023 | 5 | Loader and direct errors group together, with one new occurrence | `tests/loader-flow.mjs:78` | asserted |
| SDK-023 | 5 | Each event's release and dist equal the direct SDK's, or none for the release-less one | `tests/loader-flow.mjs:82` | asserted |
| SDK-023 | 5 | The key's changed settings take effect on reload | `tests/loader-flow.mjs:103` | asserted |
| GROUP-001 | 1 | Equivalent failures from the labelled corpus group into one issue | `tests/operator-flow.mjs:18` | asserted |
| GROUP-001 | 1 | Distinct failures stay apart | `tests/operator-flow.mjs:15` | asserted |
| GROUP-001 | 2 | A custom rule's preview scans retained events and leaves evidence unchanged | `tests/grouping-rules-flow.mjs:59` | asserted |
| GROUP-001 | 2 | The activated rule groups later events | `tests/grouping-rules-flow.mjs:65` | asserted |
| GROUP-001 | 2 | An explicitly selected historical event is split under the preview, keeping its contribution snapshot | `tests/grouping-rules-flow.mjs:42` | asserted |
| GROUP-001 | 3 | After the correction, outcomes, occurrences and original payloads are unchanged, so alert rates stay inspectable | `tests/grouping-rules-flow.mjs:43` | asserted |
| GROUP-001 | 3 | After undo the grouping snapshot is restored | `tests/grouping-rules-flow.mjs:44` | asserted |
| GROUP-001 | 3 | The repair keeps its `grouping_changed` coverage gap | `tests/grouping-rules-flow.mjs:47` | asserted |
| GROUP-001 | 4 | The `stack.module:vendor.* -app` and `-group` rules are previewed, later events group by the remaining frames, and the vendor frame reads not in-app | `tests/grouping-rules-flow.mjs:67` | asserted |
| GROUP-001 | 4 | A `-app` frame starts collapsed in the issue view | `tests/grouping-rules-flow.mjs:90` | asserted |
| GROUP-001 | 5 | A frame an unmodified SDK sends with `in_app: false` reads not in-app and does not contribute | `tests/fidelity-flow.mjs:25` | asserted |
| GROUP-001 | 6 | One wrapper with two root causes makes two issues | `tests/fidelity-flow.mjs:14` | asserted |
| GROUP-001 | 6 | The grouping information names the chain variant and marks each frame's contribution with its reason | `tests/fidelity-flow.mjs:25` | asserted |
| GROUP-001 | 7 | A fingerprint rule on the inner exception's `error.type` is followed by later events | `tests/fidelity-flow.mjs:62` | asserted |
| GROUP-001 | 8 | The `__traceback_hide__` frame reads hidden | `tests/grouping-rules-flow.mjs:67` | asserted |
| GROUP-001 | 8 | The `__traceback_hide__` frame is excluded from the hash | none: the cited event is grouped by a custom fingerprint rule, so no frame-based hash is read | none |
| REL-001 | 1 | A deployment started from CI with the deploy key is recorded, with four steps | `tests/deployment-history.mjs:38` | asserted |
| REL-001 | 1 | The CI run's progress and success steps read back as progress and success | none: the cited test asserts only the run's step count (line 38); no cited test reads the steps' states | none |
| REL-001 | 1 | Every recorded run lists its included commits (the screens helper asserts each run's commit list, run here) | `tests/deployment-history.mjs:27`, `tests/deployment-history.mjs:40` | asserted |
| REL-001 | 1 | A failed deployment reported from CI is recorded as failed | none: the cited test posts a failed callback but never reads that run's state back | none |
| REL-001 | 2 | Repeated success callbacks answer 200 | `tests/deployment-history.mjs:32` | asserted |
| REL-001 | 2 | The repeated callbacks add no step: the run keeps its four steps | `tests/deployment-history.mjs:38` | asserted |
| REL-001 | 3 | An abandoned start gets one timed-out step and one notice over two ticks | `tests/deployment-history.mjs:38` | asserted |
| REL-001 | 4 | A production rollback records its rollback release | `tests/deployment-history.mjs:38` | asserted |
| REL-001 | 5 | A delayed older first-seen capture cannot regress a resolved issue (release-order helper, run here) | `tests/deployment-history.mjs:17` | asserted |
| REL-001 | 6 | An auto-created release enriched through the native API keeps its first-seen time and sequence and loses its auto-created label | `tests/deployment-history.mjs:52` | asserted |
| ALERT-004 | 1 | A webhook refused with 429 before acceptance retries once and is accepted, with the same body and message id | `tests/alerts-runtime.mjs:51` | asserted |
| ALERT-004 | 2 | A send that fails after its send boundary becomes uncertain, and a later tick sends nothing more | `tests/alerts-runtime.mjs:58` | asserted |
| ALERT-004 | 3 | After a Worker restart the fix workflow recorded before it continues from its durable state (connected-workflow helper, run on the workflow id from before the restart) | `tests/execution-journey.mjs:40`, `tests/execution-journey.mjs:42` | asserted |
| ALERT-004 | 4 | An expired provider lease refuses the step (409), leaves the row uncertain and reuses the one accountable follow-up (execution follow-up helper lines 32 to 35) | `tests/execution-journey.mjs:56` | asserted |
| ALERT-004 | 5 | A disabled rule reads disabled and sends nothing for a later event | `tests/alerts-runtime.mjs:54`, `tests/alerts-runtime.mjs:55` | asserted |
| ALERT-004 | 6 | A lost provider response becomes uncertain owner work, a stale decision is refused, and owner reconciliation completes it (alert follow-up helper lines 8, 23 and 25) | `tests/alerts-runtime.mjs:59` | asserted |
| ALERT-004 | 6 | Repeated evaluation adds no duplicate follow-up fact, and a failed alternate never retries or notifies itself (alert follow-up helper lines 11, 20 and 21) | `tests/alerts-runtime.mjs:59` | asserted |
| ALERT-004 | 7 | After a restore, a scheduled tick sends nothing, queues no mail and every restored rule is disabled | `tests/alerts-runtime.mjs:100` | asserted |
| AUDIT-001 | 1 | Owner actions record their actor, action, subject and outcome | `tests/audit-history.mjs:26` | asserted |
| AUDIT-001 | 1 | Agent actions record their actor and outcome | `tests/audit-history.mjs:55` | asserted |
| AUDIT-001 | 1 | Denied requests record a `denied` outcome for agent, anonymous and owner actors | `tests/audit-history.mjs:35`, `tests/audit-history.mjs:36` | asserted |
| AUDIT-001 | 1 | Member actions record their actor and outcome | none: no cited test performs a member action; members arrive with TEAM-001 | none |
| AUDIT-001 | 2 | A restart preserves every safe fact | `tests/audit-history.mjs:73` | asserted |
| AUDIT-001 | 3 | Restore keeps the destination's chronology and appends the archived facts unchanged | `tests/audit-history.mjs:93` | asserted |
| AUDIT-001 | 4 | Project erasure leaves the earlier chronology unchanged and records its completion | `tests/audit-history.mjs:129`, `tests/audit-history.mjs:130` | asserted |
| AUDIT-001 | 4 | Actor (owner) erasure never rewrites prior chronology and erases the actor bindings | `tests/owner-erasure.mjs:112`, `tests/owner-erasure.mjs:113` | asserted |
| AUDIT-001 | 5 | The exported history carries no canary, key, key hash, project name or owner address | `tests/audit-history.mjs:71` | asserted |
| AI-005 | 1 | For deceptively similar and rebuilt failures, the proposal lists inside and outside counterexamples, including the rebuilt event | `tests/operator-flow.mjs:118` | asserted |
| AI-005 | 1 | The proposal names exactly the affected events | `tests/operator-flow.mjs:121` | asserted |
| AI-005 | 2 | It shows the per-issue rate change | `tests/operator-flow.mjs:121` | asserted |
| AI-005 | 2 | It shows each rule's alert condition before and after | `tests/operator-flow.mjs:122` | asserted |
| AI-005 | 3 | After the owner rejects one proposal it reads rejected and no application projection changes | `tests/operator-flow.mjs:119` | asserted |
| AI-005 | 4 | After the owner approves another it reads approved with its exact preview, and applying it reads applied | `tests/operator-flow.mjs:125`, `tests/operator-flow.mjs:127` | asserted |
| AI-005 | 5 | Undo restores every original event and membership | `tests/operator-flow.mjs:130` | asserted |
| AI-005 | 5 | The repair keeps its `grouping_changed` coverage gap after undo | `tests/operator-flow.mjs:131` | asserted |
