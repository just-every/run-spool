# gr-mt-spool-ci-20 maintenance report

Author: Run Edit Run fleet, 2026-11-17.

Repository: just-every/run-spool.
Branch: cloud/gr-mt-spool-ci-20.
Current candidate: fe4eaff04430dce0c63266a1f08a992a1790ea81.
Starting main: 337a4cacd736ad172f397f318bb766fa5402ed9a.
First pushed candidate: 78a5a167bd88e2a9766846f94437eebb67cab9f8.

## Problem and resulting behavior

Two existing acceptance journeys reused local workerd HTTP connections across long browser/restore work and runtime stop/start transitions. Both observed failures were TypeError: fetch failed, caused by UND_ERR_SOCKET / other side closed. The candidate applies the existing fixture policy, Connection: close, to their managed HTTP requests. Scheduled deployment checks use the existing close-connection native cron helper and consume their responses before continuing. Product readiness and setup requests also close their connections, preventing those requests from leaving an idle connection for the next runtime on the same origin.

The code still exercises the actual emitted Worker, migrated persisted D1, ordinary HTTP and real Chromium. All existing assertions remain, including concurrent admission/accounting, authorization, archive integrity/refusals, independent restore, inert deployment history and retention. No HTTP request is replayed.

Product changes are limited to tests/deployment-history.mjs, tests/product-runtime.mjs and the two corresponding source-lock digests. Application code, homepage/copy/owner screens, workflows, dependencies, identities and contract judgments are unchanged. The latest change is a second plain fleet commit; the first published commit was not rewritten. Before the follow-up, fetch and merge of origin/main reported already up to date.

## Actual CI evidence

1. Reported main Verify 44045714537, head 7ece18059c1c7924a5b6f9cc816a7af3900136d5: failed runtime job 133911463949 at tests/deployment-history.mjs:71:646, the scheduled request after archive restore. The newer main commit only changed the Ruby Rack fixture and source lock; a local Git comparison confirms the deployment journey and worker helper were unchanged from the failed SHA. Relevant log: main-runtime-failure.log.
2. First candidate Verify 44076996424, exact head 78a5a167bd88e2a9766846f94437eebb67cab9f8: deployment REL-001 and REL-002 passed in CI, including the previously failing restored scheduled trigger. Audit, old-archive and runtime checks also passed. The runtime shard then failed later in tests/product-runtime.mjs:77:12, POST /api/restore, request ordinal 690, with the same UND_ERR_SOCKET / other side closed. Every other test/runtime job passed; the two aggregate jobs failed because that shard failed. Relevant files: candidate-failed-jobs.json and candidate-runtime-failure.log.
3. The follow-up closes the product journey's managed connections across its repeated use of the same origin. Its complete local Worker/D1 and Chromium journey now passes. Latest exact-SHA branch Verify 44083568724 is in progress on fe4eaff04430dce0c63266a1f08a992a1790ea81: https://github.com/just-every/run-spool/actions/runs/44083568724 . The direct ten-call budget is exhausted. Final custody is PUSHED; there is no READY or green claim for this head.

This report does not claim the default branch is green or that the final candidate is READY. The fleet owns guarded landing and exact-main checks.

## Counts and clauses

Standalone affected journeys: 2 before / 2 after. Assertion call sites: deployment 49 before / 49 after; product 86 before / 86 after; total 135 before / 135 after. No registration was added, skipped, deleted or weakened. The source diff leaves the same assertion method counts and expectations.

Full-target clauses remain 23 done / 54 partial / 28 missing / 105 total. Core remains 23 / 45 / 19 / 87; agent surface remains 0 / 9 / 9 / 18. There are no clause status changes or new acceptance claims. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md were not changed.

## Plan and local validation

The full plan is PLAN.md. Actual command receipts are local-receipt.json, local-first-candidate-receipt.json, assertion-counts.json and product-worker-final-receipt.json.

- Fleet launcher, decrypted-bundle Git credential helper and clone-local forwarding commit hooks installed. Only the declared product repository was cloned, with complete history. The exact committed tree is materialized from Git blobs and modes for publication; local setup/build state is excluded.
- Node 22.20.0 and pnpm 10.12.4 match CI. Chromium is /usr/bin/chromium with --no-sandbox.
- pnpm install --frozen-lockfile: passed.
- npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive through cloud_run: passed. Private setup output is not published.
- npx -y @runeditrun/rer build through cloud_run: passed.
- Unmodified deployment journey: passed once locally. The original failure was intermittent; the completed main CI archive establishes the observed failure. This is not a false-positive/no-change claim.
- node tests/deployment-history.mjs after the first fix: passed locally, and then passed in exact-SHA CI 44076996424. Existing desktop and phone screenshots were produced by that journey.
- node tests/product-runtime.mjs after the follow-up: the complete emitted Worker/D1 and real Chromium journey passed, including independent restore and retention. Its captured child exit was 0, both completion messages were present, and product-worker-final-receipt.json says failed=false with no cleanup failures. The enclosing terminal session reported exit 1; that wrapper result is retained rather than presented as the command's captured exit.
- pnpm typecheck: passed after each change.
- node scripts/edition-authoring/cli.mjs lock, then pnpm source:check: passed after each change. Lock generation was last; only the touched journeys' digests changed.
- node src/base/contract-docs.mjs check: passed, zero errors and warnings. Generated views remain untouched.
- git diff --check: passed. Candidate authors and committers are Run Edit Run fleet <fleet@runeditrun.com>, with plain messages and no trailers or skip markers. All candidate commits, including any side parents, are inspected before each product push; the guard repeats inspection before retries and reinstalls the shared Git setup after any refresh.

Only the touched journeys and typecheck ran locally; no full local Verify or full suite was run. Full branch Verify remains the independent wall.

## Publication and custody

The first scan reached its default 300-second deadline and returned INCOMPLETE; publication-scan-initial.json retains it. A longer scan completed but included local setup/build files and used an incorrect repository argument (the scanner expects a GitHub URL). Its value-free report is publication-scan-working-tree.json. No push occurred on either of those results.

The corrected first-candidate scan inspected its clean committed tree and full selected/public-base history: COMPLETE/PASS, zero findings, exact commit and tree, historyScanned=true and environmentChecked=true. That report is publication-scan-first-candidate.json. The terminal wrapper returned 1 despite the structured PASS, which was independently validated before publication; the canonical Base release helper also consumes the structured report. No finding was waived.

The current candidate's own clean-tree full-history scan exited 0 with COMPLETE/PASS and zero findings: commit fe4eaff04430dce0c63266a1f08a992a1790ea81, tree 806588f42208ae5e8f68f0f3f2ad37f2a7fa8057, historyScanned=true and environmentChecked=true, 984 commits / 984 messages, 444.93 seconds. Actual reports: publication-scan.json and publication-process-receipt.json. The follow-up guarded push succeeded on its first attempt; git ls-remote independently confirmed fe4eaff04430dce0c63266a1f08a992a1790ea81 at the named cloud ref. Both product commits remain intact.

A verified bundle for each candidate is retained outside the clone. bundle-receipt.json records the current bundle path, head and SHA-256. A bundle is recovery data, not proof of push, READY or landing. The first non-secret report packet was already saved separately to evidence/gr-mt-spool-ci-20 while CI ran; evidence-save-receipt.txt records that save. The final packet is published to that evidence ref independently of the product branch. No PR is required by the repository instructions; none was created.

## GitHub inspection and limits

Each completed failed runtime job used exactly one gh run view <run> --repo just-every/run-spool --job <job> --log-failed invocation. gh 2.46.0 returned success and no filtered text, but cached complete run-log ZIPs. The relevant failure sections were extracted locally without another GitHub request. Environment sections and unrelated output are excluded from the packet.

One optional command, gh api repos/just-every/run-spool/actions/artifacts/14312140130/zip, followed its redirect and received Forbidden from the blob service; gh printed no numeric HTTP status. The sanitized error is main-runtime-artifact-error.txt, with its signed query removed. No retry was made. Both actual failure assertions were obtained from the cached log archives.

The ten-call investigation/status/log budget counts direct GitHub CLI invocations; ci-receipt.json lists them. The mandatory scanner's GraphQL resolver phases use the separate GraphQL quota and are recorded separately. An earlier receipt combined those phase counts with direct calls as a conservative estimate; that was corrected to avoid presenting phase counts as measured core REST requests. The tenth and final direct call discovered Verify 44083568724, in_progress, on the current exact SHA. No more status calls were made. Terminal custody is PUSHED, never READY, until the independent exact-SHA wall completes. No extra workflow is dispatched or rerun.

## Terminal handoff

PUSHED branch=cloud/gr-mt-spool-ci-20 head=fe4eaff04430dce0c63266a1f08a992a1790ea81

No unresolved local assertion or publication finding remains. The required latest Verify is still in progress, so this is a custody handoff, not acceptance or a landing request that waives CI. No PR was created, no main/default branch was pushed or advanced, and no workflow was manually dispatched or rerun. The fleet can inspect the exact run above and apply its independent gates. result.json is saved beside the maintenance output and included in the final evidence packet. Both verified recovery bundles remain outside the product clone.
