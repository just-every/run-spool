# Spool panel-only agent handoff continuation

Task: main-spool-agent-handoff-1-c2. Repository: just-every/run-spool.
Product branch: cloud/main-spool-agent-handoff-1-c2.
Candidate: 7b8cc6213c14b0e2af650e2d6289dd0ac59871aa.
Original work: a6ea6cc152fd4a5d4d2ee4298706056fe8e31639.
Merged main: 2e12affd54e9b3bfe759e0eaec60906e3548f876.

## Plan and implementation

The full execution plan is in PLAN.md. The original published handoff history was retained; current main was merged, never rebased. There were no merge conflicts and no additional product or test edits. Main's newer tests, contract judgments, release changes and Base adoption were retained. The source lock was regenerated last and already matched the automatic merge; its check passed. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are unchanged from main. A fresh fetch immediately before publication found main unchanged. Only the named branch was pushed, without force or a skip marker on its head.

The supplied brief records original Verify 43039140439 failing only at runtime (electron) / Install Electron virtual display, with roll-up failures. Main includes 5ec1f171e8a077614cdbcc689e006f9535da9934, committed 2026-11-11 15:06:29 UTC, which changes Install Electron virtual display after the brief's 14:00Z threshold. It skips apt when Xvfb/xvfb-run/xauth are already installed, correctly rewrites mirror+file sources, and bounds fallback installs to three 90-second attempts. The actual patch is retained in electron-display-fix.patch.

The retained product changes make Settings and the issue handoff panel provide runnable commands using real Node and CLI paths and the displayed issue short ID. Credentials stay in hidden prompts and the once-shown key stays separate. The policy prerequisite opens in a new tab so the key remains available. Issue viewing and raw evidence downloading defer agent-setup reads until the panel opens. Packet Markdown retains complete data and readable values. Details are in provenance.json and the product diff on the candidate branch.

## Checks and custody

Setup, build, typecheck, first-party check, source lock check, contract-documents check and workflow validation passed. local-checks.json contains the exact commands and results. The full suite is delegated to branch Verify, as required; no local full Verify was run. No test registration was added, deleted or weakened in this continuation; the default cap remains 200.

All seven candidate commits, including side parents, passed author/committer and trailer inspection. The push guard succeeded on its first attempt. push-receipt.log is the actual transport receipt. The cloud cannot run the fleet's Mac publication scan; the fleet retains that gate before landing. No main/default branch was pushed and no PR was required by this repository's instructions.

The first local handoff run passed its policy-save assertions but stalled in Playwright Page.close on the policy popup for more than five minutes, with no dialog. Only its Chromium process was terminated, and the journey reported stopped/removed cleanup. A minimal independent system-Chromium popup-close probe passed. browser-diagnostic.json and initial-handoff-interrupted.log preserve this result. The unchanged retry passed all nine check groups and produced ten masked captures. It includes the real copied Settings/issue commands, raw-download equality, project and mutation refusals, malicious-selector refusal, next-call HTTP/CLI/MCP revocation, source-map provenance, retention, archive and packet-cap checks. Its packet was 231,566 / 262,144 bytes, with one newest included event out of 9,999 available. The retained-capacity race accepted exactly one final slot and refused seven without partial effects. All MCP/browser/second-origin/HTTP-edge/checkout cleanup stopped successfully, and the temporary checkout was removed. handoff-results.json is the actual journey receipt; handoff-retry.log omits only API debug transport lines. All six changed-screen images were reviewed at 1440 and 390 and are included with four additional retention captures. Exact-SHA Verify run [43105299821](https://github.com/just-every/run-spool/actions/runs/43105299821) completed successfully on 7b8cc6213c14b0e2af650e2d6289dd0ac59871aa. No failed-job rerun or product fix was needed. Five GitHub REST calls were used, including the initial empty discovery, with at least 300 seconds between observations. ci-receipt.json is the actual watcher receipt.

## Clause and count limits

AI-001 remains PARTIAL; no Status, Gap or Evidence cell was changed and no DONE claim is made. The original claim is carried only to the extent qualified by the final journey/CI receipts. Generic exact-project HTTP/CLI/MCP handoff is the tested boundary; named client qualification and model/provider/egress controls remain incomplete.

Before → after: 23 done → 23 done, 53 partial → 53 partial, 29 missing → 29 missing, 105 total → 105 total. AI-001 partial → partial. New tests in this continuation: 0 → 0. counts.json records these values.

No agent-key or policy-rule change, new agent feature, Settings split, other stranger finding, provider deployment or release publication was attempted. Evidence publication is report transport only, separate from product READY and landing.

CLAIM AI-001 PARTIAL points=1,2,3 tests=tests/agent-handoff.mjs#Agent handoff public journey; tests/agent-handoff/ui.mjs#handoffPanel; tests/agent-handoff/selector-refusals.mjs#selectorRefusals

GAP AI-001: Named client qualification and model-egress controls for automated work remain incomplete; no full-clause DONE claim is made.

## Final result

READY candidate: cloud/main-spool-agent-handoff-1-c2 at 7b8cc6213c14b0e2af650e2d6289dd0ac59871aa. The remote ref was checked at the same SHA, the checkout is clean and full-history, and merged main is an ancestor. No current blocker remains. No PR was created; the fleet owns landing. terminal-product.json separates product custody from the report-only evidence transfer. The product clone is to be deleted after successful evidence publication, as requested; the packet stays outside it.
