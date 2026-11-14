# gr-mt-spool-ci-6: verified no-change

Repository: just-every/run-spool

Result: no-change. The reported failure is already resolved on the current default branch. No product commit, product push, PR, deployment, or landing is needed.

Product checkout: `/home/agent/rer-consolidation/work/maint/gr-mt-spool-ci-6/repo`

Local branch: `cloud/gr-mt-spool-ci-6`

HEAD, origin/main, and rechecked remote main: `e206a1ca9a631059818333837062a90bd225443d`

## Plan and completed work

1. Set fleet Git identity, review and run the launcher refresh, install bundle-only Git authentication, push guard, and evidence transport. Clone the declared repository with full commit history and blob filtering; configure local identity and commit hooks; create the named cloud branch from origin/main.
2. Read AGENTS.md and CLAUDE.md (which includes AGENTS.md), CONTRACT.md and the generated acceptance/claims views. TESTING.md is absent. Read the inline fleet rules. No UI or product behavior change is in scope.
3. Inspect the historical completed failure and its jobs, read the failed job archive once, then discover current main's exact-SHA workflow results. Inspect the current owner-ui job steps and workflow source.
4. Verify the current main still matches the remote default branch. Run the formerly failing Chromium installation locally and launch/close the prescribed system Chromium on Node 22.20.0. Preserve all actual public report and receipt files outside the product tree.
5. Return the required result.json as no-change and publish only the explicitly selected evidence packet through the evidence ref. Product branch remains an unchanged local pointer; no READY or PUSHED product claim is made.

## Evidence and conclusions

Historical Verify run [40340247075](https://github.com/just-every/run-spool/actions/runs/40340247075), on `cf0e18ab089d73330a8cd38004c8d1ef8f3d53ac`, failed in owner-ui job `121633148793`, step `Run pnpm exec playwright install chromium`. Jobs: 22 success, 1 failure, 1 cancelled. The job archive command returned exit 0 and zero bytes. It was invoked once, and no direct job-log blob or retry was attempted. The underlying historical install error is unavailable; this report does not invent a root cause or claim the historical failure was a false positive.

Current main is independently proven fixed by [Verify 43580557779](https://github.com/just-every/run-spool/actions/runs/43580557779) and [Verify 43578422344](https://github.com/just-every/run-spool/actions/runs/43578422344), both completed/success on `e206a1ca9a631059818333837062a90bd225443d`. [Run site 43580557817](https://github.com/just-every/run-spool/actions/runs/43580557817) also completed/success on that exact SHA. The inspected Verify run has 27 successful jobs, 4 skipped jobs and no failures or cancellations. Owner-ui job `132404404977` passed browser installation/probe, Run suites, and hosted output/hydration checks. The previously cancelled wizard job now passed as well.

Existing workflow repairs on main include runner-owned browser and dependency caches, Chromium launch probing before apt fallback, and bounded dependency installation (`scripts/install-chromium-deps.py`). Existing adoption commit `ab21ceb` includes these workflow adaptations. These predate this task; they are context, not changes made here. The exact-SHA successful browser step and suites are the basis for resolving the maintenance item.

## Local validation

- `pnpm install --frozen-lockfile`: exit 0. The user-supplied toolchain initially kept VM Node 24.19.0; pnpm warned that the package pins Node 22.20.0. Installed Node 22.20.0 from npm for the pinned check and browser probe. pnpm is 10.12.4.
- `pnpm exec playwright install chromium`: exit 0; Playwright Chromium and headless shell v1243 installed successfully. The pinned-runtime invocation is saved separately in `chromium-install-pinned.log`.
- Node 22.20.0 Playwright launch with `executablePath: '/usr/bin/chromium'`, headless mode and `--no-sandbox`: exit 0; page title assertion passed and the browser closed in finally.
- `git diff --exit-code` and `git status --porcelain=v1`: clean tracked and untracked product tree.
- Remote `refs/heads/main` rechecked via `git ls-remote`: still `e206a1ca9a631059818333837062a90bd225443d`.
- No source files were touched, so no additional product tests, typecheck, build, setup, or full local Verify was necessary. No dev server was started. Every launched browser was closed; no test server was left running.

## Counts, contract and security

Product files changed: 0 before/after. Product commits: 0. Tests added/removed/weakened: 0/0/0. No test was skipped or weakened by this task.

Historical failed/cancelled jobs: 1/1. Current exact-main failed/cancelled jobs: 0/0. These are different workflow revisions, so total job counts are not a test coverage comparison.

Acceptance counts unchanged: Core 23 done, 45 partial, 19 missing (87); Agent surface 0 done, 9 partial, 9 missing (18); full target 23 done, 54 partial, 28 missing (105). Homepage claims unchanged: 3 done, 7 partial, 0 missing (10).

Clause status changes: none. No CLAIM lines apply to this maintenance no-change result. CONTRACT.md, source lock, ACCEPTANCE.md and docs/CLAIMS.md are untouched.

Product publication scanner: not applicable because there is no new product tree or product push. The evidence packet contains only explicitly selected regular report, public workflow metadata and receipt/log files. No credentials, environment dump, private held-out material or symlinks are selected. Evidence publication is separate from product READY or landing.

GitHub budget: five CLI/API invocations, within ten. No active-run polling, re-run or dispatch was required. Historical logs were requested once after completion.

Blockers: none. Limitation: historical log content was unavailable; current exact-SHA success establishes the explicit no-change outcome. No owner ruling is required. The default is to close this stale maintenance item without merging anything.

The required result.json is retained both under `work/maint/gr-mt-spool-ci-6/result.json` and in this packet. The fresh unchanged clone is retained as the maintenance output requested by the brief.
