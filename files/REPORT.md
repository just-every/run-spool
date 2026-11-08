# fv-electron-cache-3 report

Repository: just-every/run-spool
Product branch: cloud/fv-electron-cache-3
Product head: 3e4dad287e582509ce05047b02d0b6a40ccc05cc
Current-main base: a088c374707959f48f80051eeabc02c003113396
PR: none; the brief delegates landing to the fleet.

## Plan

1. Configure fleet identity, refresh launcher, install bundle-only Git authentication and commit/push guards.
2. Read repository rules, the prior 3fadabff change and Verify 42484564470's failed build log.
3. Carry only the authorized Electron cache change onto current main; preserve main's newer files.
4. Use the repository's own lock command, verify exactly two generated hash updates, run actionlint, rer check and source-lock check.
5. Make one fleet-authored product commit, inspect every candidate identity and message, push the named branch once.
6. Observe exact-SHA Verify through one REST watcher with at least 300 seconds between observations, then publish this report and actual receipts separately to the evidence ref.

## Findings and changes

Prior commit 3fadabff2f18b813512dc5df6dcebf924a0bda72 changed verify.yml and its acknowledged hash in base-copies.json. Verify 42484564470 build job 128743543830 failed at source:check with: “Stale lock or source/tool integrity mismatch; run changes to inspect intentional edits before lock”. The log did not enumerate hashes; the local changes command identified exactly those two modified paths.

Main advanced from 0ac17384fa3edb3d4f782e9f4f8ece1963ffe8ef to a088c374707959f48f80051eeabc02c003113396. Applied the prior two-file diff directly to current main, using the authorized equivalent single squashed commit. No published history was rewritten, and main's newer contract, generated views and source changes are retained.

The candidate adds actions/cache@v4 for ~/.cache/electron only in the Electron runtime job. The key includes runner OS and the Electron package.json hash, with an OS restore prefix. Regenerated sources.lock.json using node scripts/edition-authoring/cli.mjs lock. Exactly two SHA256 values changed, for .github/workflows/verify.yml and base-copies.json; no other lock values changed.

Product diff: 3 files, 11 insertions, 3 deletions. No product application code, contract clause or generated view changes.

## Local validation

All checks passed with exit 0: actionlint 1.7.12 on verify.yml; rer check; rer check --profile first-party; source lock generation and check; contract-docs check (0 errors, 0 warnings, current views); offline Base copy verification; git diff --check; structural assertion of exactly two expected lock-hash changes.

The prescribed toolchain selected Node 24.19.0 (above the repository's 22.20.0 minimum) and pnpm 10.12.4; rer installed and ran its pinned 0.2.96 version. Local install emitted the engine-version warning and ignored Sentry CLI build-script warning. Neither check failed. Exact-SHA CI uses the workflow's Node 22.20.0 pin.

Fleet author/committer identity and empty trailers were inspected before pushing. Product push succeeded on attempt 1. The checkout remains clean.

## Clause counts and custody

Before → after: Core 22 done / 44 partial / 21 missing / 87 total → unchanged. Agent surface 0 done / 8 partial / 10 missing / 18 total → unchanged. No clause status changes.

Verify run: 42485822028, https://github.com/just-every/run-spool/actions/runs/42485822028
Exact candidate SHA: 3e4dad287e582509ce05047b02d0b6a40ccc05cc
Status at report creation: in_progress; final observation will be recorded below and in receipt.json.

No landing or acceptance claim follows from evidence publication. All packet files selected for publication are non-secret reports or actual receipts, separate from the product tree.

## Final CI observation

Run 42485822028 on 3e4dad287e582509ce05047b02d0b6a40ccc05cc: status=in_progress, conclusion=None.

No failed-job rerun was used. No PR was created. No product push retries were needed.
Candidate remains PUSHED, pending Verify completion. READY is not claimed.

Eight of the ten GitHub CLI calls were used (including two actionlint release-asset reads). Final observation was still in_progress after fifteen minutes. Remaining calls were reserved for failed-job diagnosis; no failure conclusion was observed. Returning PUSHED, not READY. The fleet can continue watching run 42485822028 on the exact candidate SHA.
