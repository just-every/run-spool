# Spool agent handoff — main-spool-agent-handoff-1

Repository: just-every/run-spool
Product branch: cloud/main-spool-agent-handoff-1
Final product head: 5979f3e449d11c30a1ebc65f0148ba5350aa24bc
Published preservation head: e7bff21474507420605c58beaed8b8e45a1fad7e
Main incorporated before candidate: 5886617d17da50761fb442f66b03ce623d5e9559
PR: none; this brief returns the named branch to the fleet lander.
CI: exact-SHA Verify 42989170168 is still in progress on the final head after the task’s tenth permitted GitHub call. No READY claim is made. Previous Verify 42984934345 failed on 56df5649f90f4df47b0dc2ee89d266217a1ff6c1. ci-receipt.json and ci-first-head.json retain both actual records.

## Plan and delivered behavior

The full plan is PLAN.md. The implementation follows that plan: inspect the native doors; reuse one complete command in Settings and on an issue; improve Markdown presentation without changing the packet projection; extend the existing public journey; run touched checks, synchronize main, regenerate the source lock last, publish the branch, and return evidence separately.

Settings → Create agent key now discovers the actual Node executable and absolute CLI path from the local dev Worker. This includes rer’s private Node runtime, so Node need not be on PATH. Copy setup lines exports the correct project URL, reads credentials at hidden prompts, prompts for the short issue ID shown on the issue page, and runs the Markdown packet command from any repository. No placeholder checkout path or unexplained ISSUE_ID remains in the local panel command.

The first notice identifies an unsaved policy and links to the owner’s six answers at /agents. The link opens a new tab to preserve the once-shown key; policy status refreshes when the owner returns. Key and policy authorization rules are unchanged. The new dev-only runtime-path route requires the current owner session, rejects bearer credentials even alongside an owner cookie, returns no-store responses, and is absent from the deployed Worker. Hosted screens accept the absolute Node and checkout paths on the agent’s computer; the hosted server cannot infer a local checkout.

Hand to agent on an issue opens the same setup with the displayed short ID already filled in. Runtime and policy reads start only when that dialog opens; ordinary issue viewing and raw download start no agent-setup requests. The existing handoff helper asserts that behavior. Both Settings and issue commands were copied and executed through Bash against the public CLI; they read exactly the same packet. Clipboard, once-shown-key preservation, reload secrecy, private runtime-path refusals, raw JSON download equality, accessibility and reflow were exercised at 1440. Six masked captures show the changed Settings and issue screens at 1440 and 390.

Markdown now presents ordinary values without JSON string quotes, uses the issue’s short ID, and renders first seen, last seen and event receipt dates as readable UTC dates. Telemetry remains within dynamically sized code spans; line breaks are collapsed in summaries. The unchanged full packet remains inside its safe JSON fence under Raw data — complete packet. UI downloads and the evidence detail explicitly identify the JSON as raw data, including internal identifiers and alert payloads.

## Validation and actual receipts

- pnpm test:agent-handoff: passed all nine groups; packet 231566/262144 UTF-8 bytes; ten captures in the complete suite. The touched public CLI assertions establish readable values and UTC dates while retaining whole HTTP/CLI/official-MCP equality, scope, revocation, inert telemetry and unchanged archived rows. Capacity proof retained 10000 events, with one final-slot acceptance and seven refusals. Every owned process stopped and the suite checkout was removed. See agent-handoff.txt and agent-handoff-results.json.
- Final targeted execution of the updated handoffPanel: passed. It follows the actual new-tab policy link and executes both copied commands. The final six changed-screen captures and final-ui.json/final-ui.txt cover the completed UI state; unrelated retention screenshots from the full suite are outside this packet’s screen selection.
- Production npx -y @runeditrun/rer build: exit 0; see build.txt.
- pnpm test:accessibility on the final working source: passed all 21 groups, with 92 captures at 1440 and 390; see owner-ui.txt and owner-ui-results.json. This includes the workspace/issue recovery path that timed out in the first CI run. The manifest records the pre-commit HEAD; the journey executed the newly built working source. Its unrelated screenshots are not selected for this handoff packet.
- pnpm typecheck under Node 22.20.0: exit 0.
- pnpm source:check after source-lock regeneration and main integration: exit 0.
- node src/base/contract-docs.mjs check: exit 0, no errors or warnings; generated documents remain current.
- Supplemental pnpm test:agent-door did not complete locally. The first attempt lacked that helper’s Chromium environment variable. With /usr/bin/chromium configured, Node 24 lost a worker connection (SocketError: other side closed); a repeat under Node 22.20.0 failed with fetch failed/read ECONNRESET at protocolContract’s state read. These transport failures are retained in supplemental-checks.json and the three actual logs. No assertion was removed, weakened or skipped. Exact-SHA branch Verify remains required.

checks.json records actual command exits and timestamps. Local journey proof used an isolated checkout overlaid with the working source; final-ui.json separately covers the final policy-link behavior. Exact-SHA CI is the authoritative complete wall. product-provenance.json verifies the published product head, tree and clean checkout. commit-identities.txt contains all candidate identities and trailers.

## Counts, clauses and boundaries

Contract status counts before → after: 23 done → 23 done; 53 partial → 53 partial; 29 missing → 29 missing. No clause judgment changed. AI-001 remains partial and ERR-007 remains done. The existing handoff journey remains one journey; zero test registrations added or removed. No cap increase, dependency pin change, generated-view commit or CONTRACT.md edit was made. See counts.json.

CLAIM AI-001 PARTIAL points=1 tests=tests/agent-handoff.mjs#Agent handoff public journey
CLAIM ERR-007 PARTIAL points=1 tests=tests/agent-handoff.mjs#Agent handoff public journey
GAP AI-001: Named-client qualification, owner field/model/provider/budget selection and broader egress controls remain outside this brief; no full-clause DONE claim is made.
DEFAULT AI-001: Preserve the current key and policy rules and the existing explicit hidden-input local gate flow.

The preservation save, first candidate and final deferred-loading fix were pushed through cloud-push.py, on the first attempt each. Every candidate author/committer and trailer was inspected before each push. Main was fetched and merged after the published save; it was already current. The final head has no CI skip marker. Only the named product branch was pushed; no main/default branch, PR or other repository was changed. Product commits contain no fleet evidence.

Publication scanning and landing remain with the fleet’s Mac lander as specified by the cloud brief. Evidence publication is report transport only and is not product READY, acceptance or landing. The final CI outcome and terminal custody are recorded below before evidence publication.

## First Verify and follow-up

Verify 42984934345 completed with failure on 56df5649f90f4df47b0dc2ee89d266217a1ff6c1. Build and the full agent-handoff shard succeeded. Owner UI failed at tests/triage-journey.mjs:135 while waiting 15000ms for network idle after workspace recovery. The issue handoff component was starting runtime/policy reads while its dialog was closed. The follow-up defers that component until Hand to agent opens, adds the no-background-read assertion, and passes the full owner UI journey locally. This removes the added background work; the new exact-SHA CI remains the gate for the final behavior. No timeout or acceptance assertion was weakened.

Runtime also failed in the first run. Its archive retrieval command was invoked once:

`gh run view 42984934345 --repo just-every/run-spool --job 130404279704 --log-failed`

It failed with `failed to get run log: zip: not a valid zip file`; HTTP status was not supplied. The blocked archive was not retried. The assertion behind that runtime failure remains unknown. ci-jobs.json retains all job outcomes; ci-owner-ui.txt retains the actual failed assertion with the workflow environment block omitted, and ci-runtime.txt retains the archive error. The failed aggregate shards/verify jobs derive from those two suite failures. ci-diagnostics.json accounts for the eight calls used through diagnosis. The final watcher has only the remaining two calls and uses the required 300-second interval. No rerun or workflow dispatch was requested.

## Terminal result

PUSHED: final product branch is published and its remote head is verified. Verify 42989170168 remains in_progress on 5979f3e449d11c30a1ebc65f0148ba5350aa24bc at the last permitted poll. Ten of ten GitHub calls are used. The earlier run’s red owner UI and runtime jobs remain explicitly reported; no green result from another SHA is substituted. Required exact-SHA Verify and the fleet publication/landing gates remain outstanding.

Local build, owner UI (21 groups), handoff (9 groups), final handoff UI proof, typecheck, source check and contract check pass. The full local agent-door transport failures are retained separately; the first CI agent-handoff shard, which includes agent-door, passed. There are no contract judgment changes or new test registrations.

The actual report and receipt packet is published only to evidence/main-spool-agent-handoff-1. The product clone is removed after successful evidence publication; the packet remains outside it for fleet recovery.

PUSHED branch=cloud/main-spool-agent-handoff-1 head=5979f3e449d11c30a1ebc65f0148ba5350aa24bc
