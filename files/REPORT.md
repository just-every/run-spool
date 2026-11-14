# gr-mt-spool-ci-7 maintenance result

Status: no-change. The reported Release SDK push failure is already repaired on current main. No product commit, product push, PR, tag, workflow rerun or npm publication was needed or performed.

Repository: just-every/run-spool
Local branch: cloud/gr-mt-spool-ci-7
Current HEAD and fetched origin/main: e206a1ca9a631059818333837062a90bd225443d
Existing repair: 8069a3255289f121700b24c629daa3b16c448e3a (11 November 2026), “Publish the SDK to npm by trusted publishing, with no token”.
Clone: /home/agent/rer-consolidation/work/maint/gr-mt-spool-ci-7/repo
Maintenance result: /home/agent/rer-consolidation/work/maint/gr-mt-spool-ci-7/result.json

## Plan and outcome

1. Initialize fleet identity, refresh the launcher, install bundle-only Git authentication, clone only the declared repository with full history, and create the named cloud branch. Done. Read launcher AGENTS.md, repository AGENTS.md/CLAUDE.md, CONTRACT.md and ACCEPTANCE.md, and the shipped RULES.md. No TESTING.md exists in this checkout. Installed the fleet commit hook preserving repository hooks, and sourced the supplied cloud toolchain (Node v24.19.0, pnpm 10.12.4; declared minimum/pin Node 22.20.0). No repository dependency setup was needed.
2. Inspect the original completed run and its failed job once, then inspect workflow history and release state without causing release effects. Done. The original run was valid but is stale; the issue was repaired later on main.
3. Make the smallest cause-based repair only if the defect remains. No change needed: the original NPM_TOKEN diagnostic and token-authenticated publish were replaced by trusted publishing in the existing repair commit. It is an ancestor of current main. The current workflow blob is identical to the repair and to a later successful main run, not merely similar text.
4. Verify the replacement step locally and confirm real completed CI results on their exact SHAs. Done. Both local OIDC availability cases passed; current main Verify and Run site passed. New tests added: 0. Product files changed: 0. No full local suite was run.
5. Save the exact no-change result and complete non-secret evidence packet; publish only the explicitly selected report files to evidence/gr-mt-spool-ci-7. This report and the accompanying receipts are that packet. No product custody or landing is asserted by evidence publication.

## Original failure and existing repair

Original Release SDK run: https://github.com/just-every/run-spool/actions/runs/40002135351
Original exact SHA: 403567722a31e45ecb0cdcf609d88bb614c197ee
The completed run failed in job token-check (120580668628), step “NPM_TOKEN reaches this repository”. The build job (120580668321), deterministic second-clone tarball comparison and smoke test all succeeded. Publish (120580994757) was skipped on this main branch dry run. These are actual GitHub REST job conclusions, retained in original-run.json and original-jobs.json.

The mandated archive command was invoked once:
`gh run view 40002135351 --repo just-every/run-spool --job 120580668628 --log-failed`
It returned no log text and no stderr. Its individual exit code was not separately recorded. Both actual empty output files are retained. No direct job-log redirect, retry or second archive request was attempted. Therefore this investigation does not claim to have recovered the historical npm error body or to know why that old credential was rejected. The old workflow source called npm whoami with secrets.NPM_TOKEN; it is no longer the workflow on main.

Commit 8069a3255289f121700b24c629daa3b16c448e3a replaced token-check with trusted-publishing-check, reporting OIDC availability and the owner's one-time npm setup. The publish job now has id-token: write, uses npm 11.6.2 with an empty npm user config and no npm token, and retains the tag/version/changelog/main/green-Verify requirements and exact smoke-tested tarball/hash check. It still refuses a genuine npm publication failure; no wanted product test was removed or weakened by this task.

Latest main Release SDK run: https://github.com/just-every/run-spool/actions/runs/43394717532
Exact SHA: e9540f7ae83a5334d11dcaeda44c66df3b5ad94c
Conclusion: completed/success. Build and trusted-publishing-check succeeded; publish was correctly skipped for the branch dry run. Its exact step conclusions are saved in successful-main-jobs.json. An earlier repaired main run, 43082652411 at 92eb639bc15245736eef500b8b839839ec939e2b, also completed/success.

The workflow blob at the repair commit, latest successful release SHA and current main is exactly 14ce602bb7eb550fb9b877f911b10b8d898a3a24 (SHA-256 1755ce0f4c8d487d35d1eddb9bb0b19862433b4b48d96888f69c21642f12f81f). Both the repair and the successful main SHA are ancestors of current main. This verifies an already-fixed item, rather than treating an unreproduced report as false positive.

## Local checks and current CI

- Extracted and executed the unmodified current “Report OIDC availability and the owner's setup steps” shell body using bash -euo pipefail with a temporary summary file. OIDC request URL absent: exit 0 and summary reports no; present using an inert example.invalid URL: exit 0 and summary reports yes. Neither case requested a token or contacted a provider. The exact shell body, actual stdout and structured local-verification.json are in this packet. These are one-off verification cases, not new committed tests.
- `git merge-base --is-ancestor 8069a3255289f121700b24c629daa3b16c448e3a HEAD` and the same command for e9540f7ae83a5334d11dcaeda44c66df3b5ad94c: exit 0.
- `git diff 8069a3255289f121700b24c629daa3b16c448e3a HEAD -- .github/workflows/sdk-release.yml`: empty.
- `git fetch origin main`: succeeded; HEAD equals origin/main e206a1ca9a631059818333837062a90bd225443d. `git status --porcelain`: empty. Candidate identity/trailer inspection `git log origin/main..HEAD --format="%an <%ae>%n%cn <%ce>%n%(trailers:only,unfold)"`: empty, because no product commits were made.
- Exact current main Verify runs 43580557779 and 43578422344: completed/success at e206a1ca9a631059818333837062a90bd225443d. Run site 43580557817: completed/success on that same SHA. No claim is made that Release SDK ran on this latest SHA: its path filters did not select these later unrelated changes. The unchanged release workflow's actual green SHA is stated above.
- Typecheck, product tests, full verify, setup, build and browser proof: not run because no product code, contracts, UI or tests changed. No running server or browser was started. No background processes remain from this task.

## Release state and limits

A read-only public npm registry lookup found latest @just-every/spool at 0.1.0 and the checkout SDK version 0.2.0 absent. No attempt was made to publish 0.2.0, recreate a tag, rerun a historical workflow, alter account secrets, or configure the owner's npm Trusted Publisher. The successful branch dry run does not prove a tagged npm publish or owner's Trusted Publisher configuration. Those release actions are outside this maintenance repair and remain at the workflow's existing owner-controlled release door.

## Counts, clauses and publication

Before/after counts are unchanged: Core 23 done / 45 partial / 19 missing (87 total); Agent surface 0 done / 9 partial / 9 missing (18 total); full target 23 done / 54 partial / 28 missing (105 total). Clause status changes: none. No CLAIM is submitted because this maintenance task changed no clause or acceptance proof. Test registrations added/removed: 0/0. Product commits: 0. Files changed in the product tree: 0. Contract, generated views and source lock remain unchanged.

No product publication scan was needed or run: there is no product candidate or product push, and the fleet's Base publication scanner is not installed here. This does not block the explicit already-fixed/no-change outcome or authorize a product publication. Evidence is transported separately using the supplied report-only entrypoint; selected files are actual public-safe reports and receipts, without credentials, private environment material, held-out gates or symlinks. Security true in result.json means this task's retained output contains no injected secrets and introduced no product change, not a claim of a Base COMPLETE/PASS scan.

GitHub budget: six authorized command invocations (original run metadata; original jobs; one failed-job archive command; latest main Release SDK run list; latest successful release jobs; exact current-main run discovery). No polling or workflow dispatch. The archive invocation may itself make multiple internal HTTP requests; it is counted as the brief specifies. No budget-driven uncertainty remains about the no-change conclusion.

Blockers for this maintenance item: none. No product branch is pushed; no PR is created; no READY landing claim is issued. Default adopted: resolve the stale maintenance item as already fixed and leave npm release/account state untouched. Preserve the clean clone as the maintenance output requested by the brief.
