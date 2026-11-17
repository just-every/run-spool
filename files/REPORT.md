# gr-mt-spool-ci-13: Release SDK maintenance result

Author: Run Edit Run fleet. Date: 2026-11-17.

Status: no-change. The reported failure is already repaired on main.

Repository: just-every/run-spool.
Local branch: cloud/gr-mt-spool-ci-13.
Current main and local HEAD: 1853e3b3b59d49853b5ee7678f851d6de8343fbf.
Product commits: 0. Product files changed: 0. PR: none. Product branch was not pushed.

## Plan and execution

1. Set fleet identity before other shell work; read and run the launcher, install the decrypted-bundle Git helper, clone only the declared repository with full history and blob filtering, set clone identity, create the named cloud branch, read repository guidance, and install fleet hooks and toolchain.
2. Read the historical failed run metadata and the failed job once, then invoke the prescribed failed-job log archive command once. The failing job was token-check, at NPM_TOKEN reaches this repository. The archive command exited 0 with zero output bytes, so its original npm diagnostic could not be recovered. No log retry or direct blob download was attempted.
3. Compare the old workflow and current main and inspect workflow history. Main already includes commit 8069a3255289f121700b24c629daa3b16c448e3a, dated 2026-11-11, titled “Publish the SDK to npm by trusted publishing, with no token”. It replaces the token-check job and npm-token configuration with npm trusted publishing, grants the publish job id-token: write, uses npm 11.6.2 and an empty npm user config, and retains tag/version/changelog/main/green-Verify gates, exact-tarball hashing, second-clone reproducibility, and empty-project smoke coverage.
4. Establish successful main evidence instead of making a redundant product commit. The latest Release SDK run on main is 43394717532 at e9540f7ae83a5334d11dcaeda44c66df3b5ad94c, completed/success on 2026-11-13. Both build and trusted-publishing-check passed; publish was correctly skipped for a branch dry run. Its build includes the second-clone byte comparison and empty-project tarball smoke test. The workflow file at current HEAD is byte-identical to the file on that successful run, and the successful head and fixing commit are ancestors of current main.
5. Check the seven current workflow Bash bodies with bash -n, run its tokenless trusted-publishing summary locally, confirm ancestry and unchanged workflow bytes, and inspect exact-current-main Verify results. All checks pass.
6. Write the required result.json, full report and actual receipts outside the product tree, review explicit packet files for secrets and symlinks, and publish only the report packet on evidence/gr-mt-spool-ci-13.

## Cause and existing repair

The historical metadata identifies the npm authentication preflight as the failure, while build passed and publishing was skipped. The historical source used NODE_AUTH_TOKEN from the NPM_TOKEN secret and ran npm whoami. A missing token returned success in that source; a nonempty token proceeded to the npm request. The empty archived log means this investigation cannot distinguish expired/invalid authentication from npm registry transport failure. No exact npm error is asserted.

The newer workflow uses OIDC rather than that token dependency, and its main dry-run workflow has since passed twice (43082652411 and 43394717532). The successful workflow bytes are still current. This satisfies the brief's no-change rule: the issue is verified as already fixed, rather than dismissed as unreproduced.

## Validation and results

- PASS: bash -n for all 7 multiline workflow Bash bodies.
- PASS: execute the exact trusted-publishing summary body in this VM, without an OIDC request URL. It reports OIDC unavailable, explains owner setup, emits its intended warning and exits 0. No token is supplied and no npm operation occurs.
- PASS: git merge-base --is-ancestor for fixing commit and successful Release SDK head.
- PASS: git diff --exit-code e9540f7ae83a5334d11dcaeda44c66df3b5ad94c HEAD -- .github/workflows/sdk-release.yml.
- PASS: current main Verify runs 44022478247, 44018323018 and 44008607802 all completed/success at exactly 1853e3b3b59d49853b5ee7678f851d6de8343fbf. These are existing main evidence, not new candidate-branch runs.
- Product tests added/removed/changed: 0/0/0. Existing test count is unchanged; no suite recount is needed for an empty diff. Typecheck and application setup/build were not rerun because no code changed. No tests were weakened, skipped or deleted.
- Contract counts before/after: 23 done, 54 partial, 28 missing, 105 total. Core 23/45/19 (87); Agent surface 0/9/9 (18). Clause status changes: none.
- API budget: 6 task GitHub invocations, including one failed-job log invocation. No workflow dispatch, re-run, PR, comment, tag, release or default-branch write.
- Toolchain bootstrap reports Node v24.19.0 and pnpm 10.12.4; the required supplied bootstrap keeps a newer existing Node. Validation here used Bash and Python, and did not execute application code.

## Boundaries and custody

No product commit, product push or landing is required. There is no READY or PUSHED claim for this no-change result. No publication scanner was needed for a new product candidate because none exists; the evidence packet is separately reviewed and published only to the authorized evidence ref.

Actual npm publication and the npm account's Trusted Publisher settings are not proved by a branch dry run. They were not part of reproducing this historical main dry-run failure and were not changed. The original log command returned empty text, recorded in RECEIPT.json and original-failure.log. There are no remaining maintenance blockers.

The required local result is at work/maint/gr-mt-spool-ci-13/result.json and is copied into this packet. The clone remains available for the local maintenance return; no product work is left unpublished.
