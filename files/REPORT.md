# Settings sections carry on current main

Repository: just-every/run-spool
Tag and branch: main-spool-settings-split-1-c3 / cloud/main-spool-settings-split-1-c3
Product head: f7aa07dfc20cbe6f77cccc4244f3ac35f053ac47
Parent main: e667b41342aff156be084e5f0291cf1e42198f15
Carried candidate: 33c29d204f27d85ac3320b49c206eef99177efb0 (c2)

## Plan and implementation

The full plan is in PLAN.md. The checkout used full history and the fleet decrypted-bundle Git helper. The branch began at main and received one squash commit, with no merge commit. The fetched main was unchanged before the commit. A requested precommit rebase command refused the staged squash; no rebase occurred or was needed because HEAD equaled origin/main. No published history was rewritten.

The one product commit contains the net c2 Settings change and regenerated source lock. Settings has seven independently addressable sections: Organization, Projects & keys, Issue processing, Alerts & integrations, Privacy & filtering, Data & archive, and Audit. Existing fragment links choose the containing section. Existing settings and permissions are retained. JSX component occurrence counts match main's Settings view exactly.

The two squash conflicts were sources.lock.json and tests/agent-handoff/ui.mjs. Main's complete agent-handoff file was retained, including sd's saved-policy popup reload wait, named policy-saved-reload/policy-popup-close diagnostics and every other traceStep. The sole reapplied change is /settings -> /settings#settings-projects. Every other changed test file matches c2 byte-for-byte; its diff from main is a section address or navigation addition, except triage's carried Settings assertions. Main has no independently changed version of those other c2 files. No sleeps, retries, timeout changes or assertion weakening were introduced.

CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md match parent main byte-for-byte. Their hashes and the complete per-file carry comparison are in carry-receipt.json. There was no contract-source change, so no contract regeneration was necessary. The documented source lock was regenerated last and its check passed. All reports, receipts and screenshots are outside the product tree.

## Counts and claims

Settings sections: 1 before, 7 after.
Clause statuses before and after: done 23 -> 23; partial 54 -> 54; missing 28 -> 28 (105 total).
Test registrations added: 0; removed: 0. No new test file.
Clause Status, Gap and Evidence changes: none.

CLAIM UX-001 PARTIAL points=none tests=tests/triage-journey.mjs#journey
GAP UX-001: This Settings carry does not qualify the full target team/mobile workflows, native-device coverage, human screen-reader pass or VPAT; main's partial judgment remains authoritative.

## Verification and custody

Actual command outcomes with timestamps and their observed product HEAD are in checks.jsonl; individual logs are selected alongside it. Typecheck, contract-document check and source lock check passed on the product SHA. Setup and the required npx rer build succeeded. The build ran immediately before the product commit on the staged candidate source (the runner therefore records parent main as HEAD); no application/test source changed after that build. Setup output contains private local admission links and is intentionally excluded from this public packet.

The first and only product push succeeded through cloud-push.py. All candidate author/committer identities are Run Edit Run fleet <fleet@runeditrun.com>; trailers are absent. The single-commit provenance is in product-provenance.txt and commit-messages.txt. Product-push.log records transport custody. No PR was required or created under this branch-based fleet landing contract. Main was never pushed.

The exact-SHA Verify is https://github.com/just-every/run-spool/actions/runs/43167189331. Discovery and subsequent REST observations are in ci-discovery.json and ci-polls.jsonl. Polls are at least 300 seconds apart. No other SHA can qualify this candidate.

The cloud cannot perform the fleet Mac's publication scan. Publication scan, guarded landing and main's final generated-view/Verify gates remain with the fleet; this does not claim deployment or landing.


## Local environment qualification note

The first triage attempt used the VM's Node 24.19.0 and failed during page.screenshot at tests/triage-journey.mjs:69 (phone capture screenshot, 15-second default), after the desktop Settings checks had passed. That actual failure is retained in triage-1.log and checks.jsonl. The separate Settings proof was finishing at the same time. This was not treated as a passing journey. Local qualification switched to CI's exact Node 22.20.0 runtime, with browser suites run sequentially; no test source, timeout or retry logic was changed. Three fresh consecutive triage runs are required below. Chromium was /usr/bin/chromium, version 154.0.8037.57, headless with --no-sandbox through the repository's existing browser launcher.

All seven changed Settings sections were captured once at 1440 and 390 in screens/. browser-proof.json records each address, active section and measured document width; all fourteen widths matched the viewport. Synthetic project data was used, with secret fields masked. No browser-profile or real-session data was copied.


## Exact-SHA CI result

Verify run 43167189331 completed/success on f7aa07dfc20cbe6f77cccc4244f3ac35f053ac47, observed 2026-11-12T06:38:48Z through REST. Six GitHub REST calls were used: one discovery, four polls, and one completed-job listing to qualify agent-handoff after the local caps/setup stall. Each poll interval was at least 300 seconds. No job rerun or workflow dispatch was needed. This is actual green, not the generated-view exception.

## Three consecutive triage passes

All three fresh Node 22.20.0 qualification runs passed in sequence on f7aa07dfc20cbe6f77cccc4244f3ac35f053ac47, without intervening code changes or another test between them:

- triage-qualified-1: 2026-11-12T06:23:26Z–06:30:07Z, exit 0.
- triage-qualified-2: 2026-11-12T06:30:07Z–06:36:52Z, exit 0.
- triage-qualified-3: 2026-11-12T06:36:52Z–06:46:32Z, exit 0.

Each reported 22 check groups and 100 captures at 1440 and 390. This includes the Settings create/revoke-by-created-hash flow, reload/history, old Slack/report fragment destinations, archive access, and existing owner, offline and correction assertions. The initial failed Node 24 screenshot attempt remains explicitly recorded; no assertion or timeout was changed to obtain these passes.

## Agent-handoff qualification and local stall

The complete exact-SHA CI job `verify (agent-handoff)` succeeded: job 131012128725, started 06:19:26Z and completed 06:29:58Z on f7aa07dfc20cbe6f77cccc4244f3ac35f053ac47. Its committed workflow runs test:agent-door, test:agent-handoff and test:privacy; therefore the full agent-handoff journey passed on this head. The owner-ui job 131012128787 also succeeded on the same SHA. ci-jobs.json is the actual completed-job REST receipt, obtained after the local failure rather than inferring success from another branch.

The additional local agent-handoff invocation passed the UI stage, including policy-saved-reload (0.089s), policy-popup-close (0.014s), copied commands, issue evidence and scope checks, then retention and scheduled-retention. It failed at the existing 90-second `caps/setup` stall guard while setting up again after reset. The diagnostic carries stale dev-server output because the cap setup command is captured by the command harness, so it does not establish a specific setup root cause. Its children and temporary checkout were stopped/removed. This local invocation is reported as failed, never as a full pass. No timeout, assertion, source, retry or sleep was changed. Exact-head CI supplies the full passing agent-handoff proof; no local retry is being used to conceal the stall.

## Missing default browser in one owner suite

The first local owner-claim invocation reached the unchanged discussion helper, which calls chromium.launch directly instead of the repository browser-launch helper, then failed because Playwright cache build 1243 was absent. The test had already passed its touched notification-preference flow. A task-only executable at the missing cache path now delegates to /usr/bin/chromium --no-sandbox; it changes no repository file or assertion. The default-browser-probe.log proves direct Playwright launch succeeds through this mapping. The failed invocation is preserved, and an owner-claim-qualified invocation will record the result after this environment repair. Exact-SHA CI owner-ui already passed with its installed browser.

## Project-erasure qualification and local fence assertion

The additional local project-erasure invocation completed its authorization, 1440/390 preview/confirmation/receipt, data scan and earlier restoration steps, then failed at tests/project-erasure/fences.mjs:52. The unchanged CLI assertion expected exit 4 / erasure_epoch; the observed refusal was exit 1 / archive_operation_failed. Its browser and checkout cleanup completed. This local invocation is reported as failed, not as a full pass; the generic archive-operation failure does not establish a specific root cause. No fence assertion or product implementation was changed to make it pass.

The full exact-SHA CI `verify (project-erasure)` job 131012128701 succeeded from 06:19:26Z to 06:28:21Z on f7aa07dfc20cbe6f77cccc4244f3ac35f053ac47, qualifying the complete journey, including this fence. ci-jobs.json is the existing actual REST receipt; no extra API call was made. The CLI, erasure implementation and fence helper match main; this carry changes only the Settings URL in its UI helper. Full project-erasure qualification uses that exact-SHA green job while preserving the local refusal mismatch in the packet.

## Rollbar transport qualification

The initial additional Rollbar invocation ended with Undici SocketError: other side closed, rather than an assertion failure. It restarts a native fixture on the same address; a task-only HTTP client import now sets Undici pipelining=0, disabling socket reuse across fixture restarts. It adds no retries, response substitution, test edits or timeout changes. The qualification invocation will run the same complete committed journey with fresh public HTTP connections; both invocations remain in checks.jsonl and separate logs. http-client-lifecycle.mjs records this explicit client lifecycle configuration. The first socket failure's precise root cause is not established by its stack alone.

The repaired complete owner-claim invocation passed on the product SHA (07:43:38Z–07:50:21Z), including the previously blocked direct discussion browser launch, notification preferences and the end-user-erasure preview. The default-browser fix was outside the repository.

The named target tests/agent-handoff/ui.mjs subflow also passed locally in full: handoffPanel returned before the next second-origin stage. The later caps/setup parent-journey stall did not occur inside the changed UI test. Likewise the changed project-erasure/ui.mjs subflow completed its assertions and both-width captures before the later unchanged fence helper failed. Complete parent-journey acceptance is additionally proven by their successful exact-head CI jobs.

The suites regenerated 50 tracked retained-proof PNGs. Their actual generated bytes were preserved privately under work/main-spool-settings-split-1-c3/generated-proof/, then the tracked files were restored from HEAD. The selected public packet keeps the clause-specific fourteen Settings screenshots and the restoration metadata. No generated retained-proof image is part of the product change.

## Existing Rollbar selector and scoped Settings proof

The fresh-connection full Rollbar invocation reached its UI and failed before the changed Settings link: tests/rollbar-import/screens.mjs:16 waits for the fixed text `1 matching events`, while the unchanged EventExplorer renders `1 matching event` through plural(1, 'event'). The selector and plural function are identical on origin/main. This is an existing test-wording mismatch outside this Settings carry; it is not being hand-fixed, weakened or deleted in the product commit. Rollbar is not wired into the current push Verify, so the green workflow is not represented as proof that this standalone script passed. Both failed full-script invocations remain reported as failed.

A separate report-only browser capture uses the real public Rollbar dry-run/apply/reconcile doors and opens the changed Settings/Data & archive history route at 1440 and 390. It does not bypass an assertion in the product suite or claim a full Rollbar pass. It records the specific moved link and imported custody panel that this carry changes. The full legacy suite's unrelated issue-status selector remains a follow-up.

## Final touched-suite results

- triage-qualified-1: PASS, exit 0, exact product SHA; triage-qualified-1.log.
- triage-qualified-2: PASS, exit 0, exact product SHA; triage-qualified-2.log.
- triage-qualified-3: PASS, exit 0, exact product SHA; triage-qualified-3.log.
- audit-history: PASS, exit 0, exact product SHA; audit-history.log.
- owner-claim-qualified: PASS, exit 0, exact product SHA; owner-claim-qualified.log.
- sentry-http: PASS, exit 0, exact product SHA; sentry-http.log.
- sentry-sdk: PASS, exit 0, exact product SHA; sentry-sdk.log.
- alerts-ui: PASS, exit 0, exact product SHA; alerts-ui.log.
- rollbar-settings-proof: PASS, exit 0, exact product SHA; rollbar-settings-proof.log.
- typecheck-exact: PASS, exit 0, exact product SHA; typecheck-exact.log.
- source-check-exact: PASS, exit 0, exact product SHA; source-check-exact.log.
- source-check-final: PASS, exit 0, exact product SHA; source-check-final.log.
- contract-check-exact: PASS, exit 0, exact product SHA; contract-check-exact.log.
- settings-browser-proof: PASS, exit 0, exact product SHA; settings-browser-proof.log.

Full agent-handoff: PASS in exact-SHA CI job 131012128725. Full project-erasure: PASS in exact-SHA CI job 131012128701. The additional local caps/setup stall and archive-fence refusal mismatch are explicitly retained above and in the receipt. Audit, owner-claim after browser repair, Sentry HTTP/SDK, Slack alerts UI, together with the complete CI project-erasure journey and report-only Rollbar Settings proof, cover every carried Settings test change through its enclosing public journey. No full local verify was run.

No product blocker remains under the unchanged exact-SHA Verify contract. The standalone Rollbar suite retains its pre-existing main selector mismatch; no full Rollbar pass is claimed. The product is one fleet-authored commit, pushed once, with a green exact-SHA Verify. No PR was created; the fleet owns publication scanning and landing. Evidence publication is report transport only. FINAL-RECEIPT.json contains complete actual command exits, including unsuccessful attempts, and the authoritative CI job receipt.
