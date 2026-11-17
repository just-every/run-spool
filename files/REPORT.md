# gr-mt-spool-ci-18 results

Author: Run Edit Run fleet, 2026-11-17.

## Product provenance

Repository: just-every/run-spool
Branch: cloud/gr-mt-spool-ci-18
Base: 7ece18059c1c7924a5b6f9cc816a7af3900136d5
Candidate: ab56406d99540be1a9fc918ad3a318769e203d14
PR: none; Verify runs on branch pushes.
Publication and exact-SHA CI results will be recorded below when complete.

## Investigation

The supplied Verify 43750723397 failed in runtime (ruby), job 132924276019. Its unchanged reconciliation assertion found five extra network_error discard categories in Spool: log_byte=521, log_item=1, monitor=1, span=2 and transaction=1. The ordinary persisted counts still equalled the reference, including three errors. The pinned sentry-ruby 7.1.0 HTTP transport has a two-second read/write response timeout. If Spool accepts an item before the client receives its response, that deadline also produces client-report network_error discards. Comparing two SDK executions then includes timing-dependent discard facts.

The gh archive commands each exited zero with empty stdout under installed gh 2.46.0. Their downloaded archives were already in /tmp/gh-cli-cache. Reading the relevant job entries offline recovered both failures without another GitHub call or a signed blob download. The packet retains complete assertion/stack excerpts, excluding environment listings and artifact transport details.

Current-main Verify 44045714537 has a separate existing failure: verify (runtime), job 133911463949, tests/deployment-history.mjs:71, UND_ERR_SOCKET while making a local scheduled request after restore. Its runtime (ruby) job 133911463874 passed. The same main SHA also has successful Verify runs 44041292455 (push) and 44041298939 (pull_request), and Run site 44045714418. Those runs are background evidence, never candidate CI proof. The distinct deployment-history failure is a follow-up outside this Ruby maintenance change; it has not been called fixed.

## Change

- tests/runtimes/harness.mjs: let the existing reference collector delay acknowledgement after parsing an envelope.
- tests/runtimes/ruby.mjs: exercise a 2,500ms acknowledgement in the Ruby qualification only; other runtimes retain the existing immediate response.
- tests/sdk-runtimes.mjs: pass the runtime's optional delay into the collector.
- tests/runtimes/ruby/app.rb: use a bounded ten-second read/write response timeout through the official SDK option. Keep default integrations, the default transport and the default background worker. Both reference and Spool run the same fixture; only the DSN changes.
- sources.lock.json: regenerate the four changed test-file hashes using the documented lock command.

No assertion, test registration or workflow was removed, skipped or weakened. No app or UI code, CONTRACT.md, ACCEPTANCE.md or docs/CLAIMS.md changed. No credentials, report files or private setup outputs enter the product commit.

## Local results

The controlled delayed collector with the original SDK deadline failed the existing exact-discard assertion. It reported before_send=2 plus network_error counts for error=2, log_byte=1039, log_item=2, monitor=2, span=4 and transaction=2. The unchanged journey then passed with the fixture response timeout set to ten seconds. Its retained reference and Spool counts were event=3, attachment=7, log=3, transaction=4, client_report=2, sessions=1 and check_in=2, with exactly two error-category before_send discards and no unexpected network_error discard facts.

The passing Ruby run also asserts handled/unhandled persistence, restart grouping, release identity, exact item outcomes, no occurrence from discarded errors, exact usage quantities, refusal and undeliverable intake, and issue reads/screens at 1440 and 390. The PNGs contain synthetic test data only.

pnpm install --frozen-lockfile, fleet-owner non-interactive rer setup, rer build, pnpm typecheck, source lock regeneration, pnpm source:check and git diff --check passed. Final meaningful local checks used Node 22.20.0 and pnpm 10.12.4; Ruby was 3.3.10 with Bundler 2.5.22. The initial typecheck also passed on the VM's Node 24.19.0. Setup and build ran through cloud_run. No full local suite or rer verify ran. See local-receipt.json and the actual logs for commands and outcomes.

## Counts and clause judgments

Before -> after: 23 -> 23 done; 54 -> 54 partial; 28 -> 28 missing (105 clauses). Test registrations added/deleted: 0/0. Existing Ruby qualification extended. No clause status changes or acceptance promotion.

CLAIM SDK-012 PARTIAL points=none tests=tests/sdk-runtimes.mjs#ruby: Spool outcomes reconcile with SDK-sent items
DEFAULT SDK-012: Preserve every existing clause judgment; qualify only the Ruby timing regression in this maintenance round.
GAP SDK-012: The other runtime qualifications were not rerun locally, and all existing contract gaps remain unchanged.

## Plan execution

PLAN.md records the complete plan. Launcher, credential helper, clone-local hooks, identity checks, scoped implementation, deterministic red/green proof, source lock and product commit are complete. Publication scan, guarded product push, exact-SHA Verify and evidence transfer outcomes are recorded in the final custody section below. No main/default branch push, force push, PR change, deploy, tag or release is authorized or performed.

## Publication invocation correction

The first scan invocation used an unqualified project name and a bare repository name. Reading the scanner destination validator showed that this source declares project just-every/spool and requires the full https://github.com/just-every/run-spool destination URL. The first invocation was interrupted by its own PID before any GitHub reference resolver ran; its INCOMPLETE scan.interrupted report is retained. The scan was restarted with the correct committed identities and a 1,800-second history-scan deadline. This changes no product bytes and never counts as a passing scan.

## Clean-tree publication isolation

The corrected scan completed in 423 seconds across 982 commits and 8,211 distinct blobs. It reported 13 findings, all scope=working-tree in ignored local setup/build/test artifacts, including generated local development keys, setup answers and built path references. The committed tree/history had no findings. No finding was waived or filtered. A detached worktree at the exact product commit was created without setup or build outputs, and the complete scanner was run again there. The first complete report is preserved as publication-local-runtime-publication-scan.json; it is a failed gate and never authorizes a push. Actual key files and private runtime state are excluded from the packet.

## Final product custody

The clean exact-tree Base scan finished COMPLETE/PASS with zero findings on commit ab56406d99540be1a9fc918ad3a318769e203d14, tree a899877bba74f0821020c9f8564032432eb0b470. The fleet guard pushed cloud/gr-mt-spool-ci-18 successfully on its first attempt. The candidate identity check covers every commit in origin/main..HEAD (one commit); author and committer are Run Edit Run fleet <fleet@runeditrun.com>, and no trailers are present.

Exact-SHA Verify 44063530140 is in_progress: https://github.com/just-every/run-spool/actions/runs/44063530140 . Seven direct investigation invocations, two completed scanner reference-resolver phases and the candidate lookup consume the conservative ten-call budget. No further poll was made. Terminal custody is PUSHED; candidate CI is pending, with no READY claim or landing. The local implementation and targeted validation are done; result.json records this distinction. No product blocker is established on the candidate at handoff.

The full-history recovery bundle is /home/agent/rer-consolidation/work/push-rescue/gr-mt-spool-ci-18-ab56406.bundle; git bundle verify passed. SHA-256: 43a3784fa500049aade11eeddcc7905f0f506f96bdbf5a6a0f6da644f0028ebf. It is recovery data only. The clone and result.json are retained for the worker.

Follow-up for gr: current-main Verify 44045714537 failed in the independent deployment-history restore/scheduled request, UND_ERR_SOCKET at tests/deployment-history.mjs:71. Its Ruby job passed; this timing fix does not claim to resolve that separate failure. No clause judgment was changed.

The complete public-safe packet is selected explicitly for evidence/gr-mt-spool-ci-18. It contains reports, actual failed and passing test logs, exact-SHA and publication receipts, source-lock output, synthetic screenshots and custody metadata. It excludes setup outputs, private keys, runtime state, environment dumps, held-out material and symlinks. The publication transport prints the final evidence ref/head separately; it conveys reports only.
