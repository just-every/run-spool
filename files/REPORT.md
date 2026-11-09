# sd-spool-c-mig004-fix-1: product pushed; full CLI regression blocked

Repository: just-every/run-spool
Branch: cloud/sd-spool-c-mig004-fix-1
Product SHA: fed0194f8095dfba005518f9a912f26939207754
Required sol source: ce4226c2903be0f01a11ef1f471974f2e6563661
Fresh main: aa853b97de89f949da4fa5876ae525e3b1f343aa
Terminal status: BLOCKED on the full required repair-recovery suite, not on generated views.
No PR created. No landing, hosted, device or real-buyer migration claim.

## Plan, provenance and scope

The complete plan is PLAN.md. A fresh full-history, no-depth clone used git clone --filter=blob:none. The sol source branch matched the required SHA exactly (git rev-parse HEAD printed ce4226c2903be0f01a11ef1f471974f2e6563661). The named new branch was created from it and fresh origin/main was merged; main was already contained. Fresh main was fetched again before publication and merged after publication, already up to date. No published history was rewritten and trial branches remain unlanded.

The one new product commit changes Bugsnag coordinate conversion, stability parsing/reporting, Bugsnag tests and guide, the MIG-004 status row and generated source lock. It retains the inherited sol work and historical archive fixture corrections. No test was deleted, skipped or weakened. All report, receipt and browser evidence is outside the product branch.

## Public-door results

The initial sol-head Bugsnag public journey passed before the new product fixes. BASELINE.txt records:
- A1: release_stage object accepted and mapped to production; native release/environment assertions pass.
- A2: snake_case web and Android coordinates produce the original nonempty frames, including the exact line/column and method.
- A3: R8 constructor and class initializer lines upload through the deploy door with HTTP 201, replay with 200, and are retained in an archive that restores with native lookup.

The final complete Bugsnag journey passes (BUGSNAG.txt). Added checks use owner CLI/HTTP upload, reviewed apply, reconciliation, issue/packet reads and the public owner archive:
- release_time becomes the exact native release timestamp.
- iOS bundleVersion and exception errorClass preserve native release/build/type.
- decimal string columns preserve web/iOS frames and zero-based columns.
- The documented stability_trend response OBJECT is admitted with project_id, release_stage_name and daily timeline counts; these remain separate source aggregates, never native sessions or an inferred crash-free rate.
- Two distinct Android events using app.releaseStage reconcile as two native events for one release. Reconciliation, native issue count, packet and archive agree.
- The documented-shape fixture reconciles 3 projects, 4 releases, 3 issues and 4 events. The existing base fixture remains 2 projects, 3 releases, 2 issues and 2 events.
- Cross-project stability objects are refused during a requested catch-up, with no native graph mutation.
- Existing no-write dry run, bounded resume, guarded undo, authority refusals, inert imported history, archive restoration and erasure assertions pass.
- Imported and native Android screens are captured at 1440 and 390: four actual screenshots under screens/.

The optional pre-fix shapes-only diagnostic did not return a completed assertion before its 240-second deadline; its surviving task-owned Node process was terminated and exit 137 was recorded. It is not counted as proof. The first full added-test run passed the positive cases but its new malformed-source assertion encountered catchup_required before parser validation. The invocation now requests catch-up, preserving the expected parser rejection and every original assertion; the full rerun passes.

Official schema consulted: https://api.swaggerhub.com/apis/smartbear-public/bugsnag-data-access-api/2 (ReleaseApiView.release_stage/release_time, _EventExceptionStacktrace.column_number, _EventApp.bundleVersion and ProjectStabilityTrendApiView).

## Required checks and remaining blocker

Passing checks:
- node tests/bugsnag-import.mjs, including bugsnag-cutover and documented shapes: exit 0.
- node tests/multilingual.mjs: exit 0, including historical archive restoration and project erasure.
- pnpm typecheck: exit 0.
- npx -y @runeditrun/rer build: exit 0.
- pnpm run check -- --profile first-party: exit 0.
- Contract generation/check and final source-lock generation/check: exit 0.

The requested initial rer setup installed frozen dependencies and built, but its temporary application failed readiness with a port mismatch (exit 1). The VM's initial toolchain retained Node 24.19.0; Node 22.20.0 was then installed and used for the later isolated work.

pnpm test:repair-recovery was run three times:
1. VM Node 24: exit 1 at managed setup, before archive assertions.
2. Exact Node 22.20.0: exit 1 at managed setup, before archive assertions.
3. Exact Node 22.20.0, with no concurrent browser/Worker probes: exit 1 at stage archive. Recording, computed verdict and UI checks were reached; the stack identifies tests/repair-recovery/archive.mjs:56, which calls resetRestore. Its managed setup command returned command_failed at tests/agent-handoff/runtime.mjs:43 via tests/command-runner.mjs:87. The full populated-restore/CLI-transfer/retention journey therefore has no passing receipt. All task-owned capture/browser/process/directory cleanup completed.

This full-suite failure is the remaining blocker. Its underlying setup cause is not established. The managed harness, installer and Vite configuration files are unchanged from main; no hunks outside the Bugsnag lease were changed. The earlier historical restore regression is separately proved below, but that proof does not replace a passing full required command.

PRE-REPAIR-PROBE.mjs and PRE-REPAIR-PROBE.txt record a focused public-API check on Node 22.20.0. An owner creates a project, registered release, native event, repair and passed check. The actual preRepairArchive fixture is generated from its public archive. Two fresh installations restore the historical and populated archives through POST /api/restore with HTTP 200. Each retains the native event; historical restores zero repairs/checks and populated restores one of each. No private archive bytes or credentials are selected for this packet. The probe's initial unregistered-release refusal was corrected by registering its release through the public door; its actual first output is retained separately.

## Contract and mechanical results

Only MIG-004 changes status: missing -> PARTIAL.
All 105 clauses (done/partial/missing): 23/52/30 -> 23/53/29.
Published: unchanged 9/3/0 of 12.
Target and push-further: 14/49/30 -> 14/50/29 of 93.
MIG-003 and every other judgment remain unchanged.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; lock_check=pnpm source:check exit=0; views=node src/base/contract-docs.mjs write exit=0; views_check=node src/base/contract-docs.mjs check exit=0.
Generated ACCEPTANCE.md and docs/CLAIMS.md were restored whole from origin/main before the final lock regeneration. Neither view is committed. This checkout's generator accepts no touched-clause argument.

MIG-004 is not DONE. Apple dSYM/Mach-O and Android NDK symbol decoding/cutover remain unsupported; the public native-symbols door refuses a dSYM request with HTTP 400 and names ProGuard. Imported readable native history and Android ProGuard lookup do not qualify Apple/NDK decoding. Bounded synthetic samples do not prove complete collection mapping or vendor-wide completeness; collaborators/integrations and unavailable artifacts remain named losses. Field register R-5 remains not run.

## CI and product custody

Product push succeeded through the cloud guard on attempt 1. The new commit has fleet author/committer identity. All 17 candidate commits, including side parents, passed independent identity/trailer inspection; no OpenAI/Codex co-author survives. No main/default or trial branch was pushed. Product checkout is clean and all completed product work is pushed.

Exact-SHA Verify run: 42693082052
https://github.com/just-every/run-spool/actions/runs/42693082052
head_sha: fed0194f8095dfba005518f9a912f26939207754
Actual conclusion: completed/failure.

Build job 129417749956 failed only because ACCEPTANCE.md and docs/CLAIMS.md differ from generated output. Its full failed-step log was read once using:
gh run view 42693082052 --repo just-every/run-spool --job 129417749956 --log-failed
The log confirms source/contract prose checks before the view check, then exactly the two generated-view differences. Aggregate jobs shards (spool) 129418014670 and verify 129418066870 failed downstream; runtime/test matrices were skipped after build. This is the brief's permitted generated-view-only CI exemption. No actual green workflow is claimed. The BLOCKED return is for the separate required local repair-recovery failure.

Four GitHub calls were used with at least 300 seconds between calls for this run, including discovery. GITHUB-CALLS.jsonl, CI-STATUS.json, CI-JOBS.json and CI-BUILD-FAILED.txt retain actual receipts.

The complete relevant non-secret packet is selected explicitly for evidence/sd-spool-c-mig004-fix-1. Evidence publication changes no product checkout/head/index. After successful transfer the requested product clone and its node_modules are removed; packet and receipts remain under the fleet work directory.

CLAIM MIG-004 PARTIAL: acceptance 1 has bounded documented API-shape reconciliation, not full collection/vendor completeness.
CLAIM MIG-004 PARTIAL: acceptance 2 has web and Android ProGuard capture/symbol CI; Apple dSYM/NDK cutover remains a named gap.
CLAIM MIG-004 PARTIAL: acceptance 3 shows unavailable historical denominators without fabricated sessions or crash-free rates.
