# Unchanged Spool mail-off landing carrier

Author: Run Edit Run fleet. Date: 2026-11-15 UTC.

Repository: just-every/run-spool
Tag: main-spool-mail-off-1-c2
Branch: cloud/main-spool-mail-off-1-c2
Head: 428560c3aa2d6c3eb984a751aff9aa5c0e706c42

## Plan

1. Configure fleet Git identity and initialize the launcher, credential helper, push guard and clone-local commit hooks.
2. Clone the declared repository with full commit history and deferred blob checkout. Fetch cloud/main-spool-mail-off-1 and assert its exact head is the gated commit above.
3. Check out cloud/main-spool-mail-off-1-c2 at that exact commit. Inspect every candidate commit, including side parents, for allowed author, committer and trailers. Preserve the existing tree and history without edits, commits, rebases or merges.
4. Push only the named product branch through cloud-push.py, then verify both old and new remote branch heads.
5. Read existing Verify run 43739268265 once through REST and require completed/success at the same full SHA. Dispatch no workflow, rerun no workflow, and do not wait for a new run.
6. Publish these explicitly selected reports and receipts through the separate evidence ref, then delete the product clone.

## Actual results

The fetched original branch matched the required SHA exactly. The new branch was pushed successfully on the guard's first attempt. A subsequent Git ref probe confirmed that both cloud/main-spool-mail-off-1 and cloud/main-spool-mail-off-1-c2 point to that same full SHA.

No new product commit, product edit, rebase or merge was made. The worktree remained clean. Both candidate commits relative to the cloned origin/main have fleet authors and committers and no trailers; identity-audit.txt and custody-receipt.json contain the actual audit.

Existing Verify 43739268265 is named Verify, completed with success, and has head_sha 428560c3aa2d6c3eb984a751aff9aa5c0e706c42 on the original branch. Its URL is https://github.com/just-every/run-spool/actions/runs/43739268265. The lookup used one GitHub REST call. No Verify was dispatched, rerun or polled. No PR was created; this is the existing guarded fleet landing path.

The assignment specifically required carrying the gated tree unchanged and excluded tests, builds, scans and follow-up implementation. No local product test, build, browser journey or publication scan was run. The original Opus pass and corrected publication-scan result are supplied brief provenance, not new checks performed here. The Mac lander retains publication scanning and landing custody. C1-C5 and G1 follow-ups and the separate release remain deferred as the assignment directs.

## Counts and clause custody

Before and after are identical: 105 total clauses; 23 done, 54 partial, 28 missing. Core: 87 total, 23 done, 45 partial, 19 missing. Agent surface: 18 total, 0 done, 9 partial, 9 missing. New product commits 0; changed tracked files 0; added tests 0; status changes 0. OPS-001 remains partial and ALERT-003 remains partial. Generated views and source lock are unchanged.

The original claim and defaults are carried verbatim; this carrier run adds no acceptance claim:

CLAIM OPS-001 PARTIAL points=4 tests=tests/commands.mjs#deploy-dry-run
DEFAULT OPS-001: Mail-off requires explicit none and guarded rer signin.
DEFAULT ALERT-003: Optional mail may be off; required delivery remains unavailable.

## Evidence and limits

The packet selects REPORT.md, custody-receipt.json, identity-audit.txt, push-receipt.json and verify-receipt.json. It contains actual non-secret results only. Evidence publication is separate from product readiness and cannot signal acceptance or landing. No credentials, environment dumps, private gate material, product source copies or symlinks are selected.

Blockers: none. Terminal product custody is the pushed named branch at the unchanged gated head and its existing exact-SHA successful Verify.
