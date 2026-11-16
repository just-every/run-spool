# gr-ci-spool-flake-1-pc1

Repository: just-every/run-spool
Product branch: cloud/gr-ci-spool-flake-1-pc1
Product head: 99cc280c93ba18eb534bc4f1685fff8ca351e15e
Base main: adc3de69b9ae0ff60e41897f8ff7662fd656d560
PR: none, as requested.

## Plan and disposition

1. Refresh the fleet launcher; install bundle-backed Git authentication and commit hooks; clone only the declared repository and check out the fleet-created continuation branch.
2. Preserve both published commits: b4e6caa9278811f09b1888bcab45a9b0db0b83f9 (close execution fixture connections) and 99cc280c93ba18eb534bc4f1685fff8ca351e15e (refresh its source lock). Inspect the historical failures, source, and exact-head workflow state before deciding whether another fix is justified.
3. Run the execution journey once, typecheck, contract-document check, and source-lock check. Use an ephemeral real-Worker socket probe to distinguish the predecessor's pooled transport from the saved change. Do not add a permanent test, retry, skip, timeout increase, or weaker assertion.
4. Observe the continuation branch's natural exact-SHA Verify through REST, within the ten-call budget and minimum five-minute polling interval. Do not dispatch or rerun CI. Publish selected non-secret reports separately from product custody.

No additional product change was justified: the continuation already contains the transport fix and its source lock. No commit was rewritten, rebased, amended, or replaced. No new product commit, product push, PR, or merge to main was made in this continuation. The remote continuation ref was confirmed at the exact saved head; remote main remained the stated base.

## Request and lifecycle analysis

At tests/execution-journey.mjs:95 the restored installation has already imported the owner archive, exercised restored execution authority and browser panels, and measured a fresh run. It requests an owner erasure plan, POSTs /api/projects/shop/erasure, and follows the accepted durable job. tests/project-erasure/follow.mjs advances POST /api/erasures/<id>/resume until that same job reports phase complete, retaining the existing 300-second completion assertion and job-identity assertion.

These are sequential HTTP calls to the actual emitted Worker on loopback port 15477 with persisted D1; the original installation is on 15476. runtime.ready is awaited and the initial installation's earlier same-port restart explicitly awaits app.stop(). There is no restart at archive-stage line 95, no concurrent resume burst, and no replacement of product behavior with a mock. The archive-stage work can leave another pooled connection idle while workerd's server closes it. The saved helper sends Connection: close on each fixture request, ending the pool lifetime after each response, including across the earlier restart.

The historical ECONNRESET itself was not reproduced in this continuation, so this report does not claim a deterministic reproduction of that failure or independently establish its exact historical socket timing. The connection-lifetime mechanism is directly measured below.

## Before/after evidence

- Historical original run 43775640016 attempt 1: the job API records verify (execution) failure (job 133001575860); the brief identifies fetch failed in followErasure at the archive stage. The bounded gh run view reads exited 0 with empty output, even with --attempt 1 and the exact failed job ID. Each exact failed-job log was requested once; no blocked-blob fallback was attempted. Therefore the historical stack and ECONNRESET detail remain brief-provided evidence, not a newly retrieved log assertion.
- Saved candidate run 43784114100 attempt 1: execution succeeded. Only verify (owner-ui) failed among the test suites; shards (spool) and verify failed as dependent gates. Attempt 2 is completed/success at the identical saved SHA, with owner-ui and execution both successful. This rerun predated this continuation and was not triggered here.
- The bounded owner-ui failed-job log command returned text ending in the successful rerun's managed sign-in result, rather than the failed attempt's assertion. The report retains the actual response and does not infer a new owner-ui cause from it.
- An ephemeral probe used the actual emitted Worker and three GET /api/projects requests per mode, with full response consumption. The predecessor's keep-alive mode used socket IDs [1, 2, 2]: one reuse. The saved Connection: close mode used [2, 3, 4]: zero reuse between its requests. Socket IDs are diagnostic labels, not network identifiers. This proves the saved request boundary eliminates pooled reuse; it does not reproduce the historical reset. No permanent probe/test was added to the product.
- One full local execution journey passed, including owner archive export/import, restored execution, erasure completion, old-archive replay refusal, erased-token refusal, and preservation of zero rows after replay. Archived corpus: 11 reproducers, 20 runs, 3 workflows, 236 receipts. The final erasure removed reproducers 12→0, runs 21→0, tokens 2→0, workflows 3→0, receipts 236→0, exposures 168→0, attention 3→0, and steps 227→0.

## Local validation

- npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive: exit 0; installed frozen dependencies and built the app. Raw setup output is excluded because it can contain private local entry data.
- pnpm test:execution: exit 0, run once through cloud_run with /usr/bin/chromium and the repository's --no-sandbox browser launcher. Existing 1440/390 journey captures were produced locally. No UI changed.
- pnpm typecheck: exit 0.
- node src/base/contract-docs.mjs check: exit 0; zero errors/warnings, generated documents current.
- pnpm source:check: exit 0.
- Ephemeral connection probe: exit 0 on Node 22.20.0. The setup, typecheck, source check, and full execution run used the supplied toolchain script's selected Node 24.19.0 and pnpm 10.12.4; it keeps an installed newer Node. CI uses the repository's pinned Node 22.20.0.
- Product checkout and index are clean. Candidate identity inspection includes all commits in origin/main..HEAD, including side parents: both author and committer are Run Edit Run fleet <fleet@runeditrun.com>, with no trailers.

## Contract, publication, and limits

Clause status changes: none. CLAIM: none. Before/after counts are unchanged: Core 23 done / 45 partial / 19 missing (87); Agent surface 0 / 9 / 9 (18); Full target 23 / 54 / 28 (105). CONTRACT.md, ACCEPTANCE.md, docs/CLAIMS.md, and all source bytes remain unchanged by this continuation.

The fleet's final publication scan and landing remain on its own machine, as the cloud adaptation requires. No COMPLETE/zero-findings scan is claimed here. The report-only evidence ref does not constitute product acceptance, landing, or a replacement for the exact-SHA workflow. No product work is unpushed; the preserved SHA was already published when the continuation began.

## Natural continuation Verify

Run 43788176180 belongs to cloud/gr-ci-spool-flake-1-pc1 at the exact saved head. Discovery and subsequent REST observations are retained in the packet. Final observation at 2026-11-16T02:13:28Z: completed/success, head_sha 99cc280c93ba18eb534bc4f1685fff8ca351e15e. Run URL: https://github.com/just-every/run-spool/actions/runs/43788176180. The run is attempt 1 on the continuation branch; no rerun or dispatch was issued. All ten allowed GitHub calls were used. There is no remaining product or CI blocker. The unavailable historical failed-assertion log and lack of an original ECONNRESET reproduction remain explicitly qualified evidence limitations, not passing reproductions.
