# Spool alert control names

Fleet task `sd-spool-s8-edit-names-2` for `just-every/run-spool`. Branch `cloud/sd-spool-s8-edit-names-2`. Builder Run Edit Run fleet.

## Plan

1. Use a depth-one blobless checkout of main and the built Worker's normal test harness. Use the Sentry import fixture with a team-bound metric rule, apply the reviewed import, assign the imported project to the team, and approve the proposals as the owner.
2. Open Alerts, select Rules, and open Details. Use exact Playwright button-role names to record the collision on main.
3. Add the object type to the accessible name of Edit in both lists and retain the row label in the name. Review the other row controls and extend the existing Sentry import journey to check both editor paths.
4. Run the build steps in workflow order, the touched UI and import suites, and the contract and source checks. Verify the candidate against current main, push the named branch, and check the exact-SHA Verify run.
5. Repeat the original import and approval on the candidate, check the role names and editor headings, and capture each form at 1440 and 390 pixels. Publish this packet on the evidence ref.

## Reproduction

Main `533ad0256f36b06811106a35756354239baccbf3` had two exact button-role matches for `Edit Synthetic error thresholds` after approval. One was in Alert destinations and the other was in Per-project rules. The fixture used the public Sentry import door and the owner approval endpoint. `ALERTS-BEFORE.json` records the accessible names from the lists and the page.

## Change

Every destination Edit uses `Edit destination <label>`. Every rule Edit uses `Edit rule <name>`. The buttons display “Edit” in their rows. The destination form opens under “Edit destination” and the rule form under “Edit rule.” The other destination row actions are Test and Review passing test. Rules also have separately named Details controls. These action names have distinct prefixes and the two lists have no direct Delete or Disable buttons. The stored destination label for the synthetic metric still names the rule. The destination row identifies its recipient team separately.

The existing Sentry import alert journey now applies and approves a metric rule bound to the imported team before testing both Edit buttons from the full page at 1440 pixels. The existing Alerts and Slack UI journeys use the typed names while exercising their original interactions.

## Candidate results

Product head `8157a49c55c94207abf64b23c4521617043ebe3f` was pushed once from the current main parent. The same synthetic import and owner approval gave one exact match each for “Edit destination Synthetic error thresholds” and “Edit rule Synthetic error thresholds.” Clicking each by its page-wide role and name opened the corresponding heading and populated the expected name field.

| Scope | Button names on main | Button names on the candidate |
| --- | ---: | ---: |
| Destination and rule rows | 19 distinct of 20 | 20 distinct of 20 |
| Entire Alerts page with Rules details open | 31 distinct of 32 | 32 distinct of 32 |

`ALERTS-AFTER.json` records all accessible names on the exact pushed head. The four PNGs show each form at 1440 and 390 pixels. Each screenshot contains the expected form heading and the pages fit both widths.

The local Verify build commands passed in their workflow order with pinned Node and pnpm. The public rer setup and build completed. The Alerts UI suite, Sentry owner import suite, signed Business import suite and the focused alert import journey passed. The VM interrupted an additional umbrella command during its HTTP leg. A direct Sentry owner import retry passed after a loopback connection reset on its first attempt. The proof and checks use synthetic data.

The contract generator passed with zero prose errors or warnings. Main's generated view files were restored and the source lock was regenerated and checked last. Status totals stayed at 23 done, 54 partial and 28 missing across 105 clauses. The test suite entrypoints stayed the same and the alert import test gained the two editor checks.

CLAIM UX-001 PARTIAL points=1 tests=tests/alerts/imported-edit-ui.mjs#importedAlertEditNames — the Alerts list names each destination and rule control by what it edits

GAP UX-001: Full team and mobile workflows, the revoked and offline states, and field proof for a human screen-reader pass and VPAT remain outside this result.

## Exact-head Verify

Run 44649900881 completed with failure on the full product SHA above. The build, runtimes, and contract documents passed. The root failure was job 136002576552, `verify (agent-handoff)`. Miniflare's synchronous D1 fetcher asserted on the worker response message ID while the test took a native data snapshot at `tests/agent-door/policy-integrity-contract.mjs:46`. That test, the native agent door, and the dependency inputs match the candidate base. The failing test is outside this task's lease. Jobs 136010825107 and 136010856208 propagated the shard failure. The exact-SHA Verify requirement remains blocked.

[Verify run 44649900881](https://github.com/just-every/run-spool/actions/runs/44649900881)
