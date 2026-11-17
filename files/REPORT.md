# gr-mt-spool-dep-2 maintenance result

Author: Run Edit Run fleet. Date: 2026-11-17 UTC.

Result: **no-change**. GHSA-698v-4r3x-3vcv (Dependabot alert references 20 and 18) is already addressed in the current default branch. This run verified the dependency state; it did not query or change the alerts' administrative status.

Repository: just-every/run-spool.
Inspected local branch: cloud/gr-mt-spool-dep-2.
Current HEAD, origin/main and advertised remote main: `b261dba72dfbcb30cb9d271fe81cdeea206c89eb`.
Existing fix: `e206a1ca9a631059818333837062a90bd225443d`, “Upgrade Vite to 8.2.4”, authored 2026-11-14; confirmed ancestor of main.

## Plan and outcome

1. Apply the required global fleet identity, refresh the launcher, read its AGENTS.md, install the decrypted-bundle Git helper and push guard, and clone only the declared product repository with full history and blob filtering. Completed. Set clone-local fleet identity and create the named cloud branch from origin/main.
2. Read AGENTS.md, CLAUDE.md, CONTRACT.md, ACCEPTANCE.md, package.json, lockfiles and Verify configuration. TESTING.md is absent. Apply the provided toolchain setup: Node v24.19.0 is newer than the 22.20.0 minimum selected by that setup; pnpm 10.12.4 matches the packageManager pin.
3. Determine whether a narrowly scoped dependency update is needed. No: package.json devDependencies.vite is exactly 8.2.4; the root importer specifier, resolved version, packages entry and snapshot agree. Every Vite package/snapshot resolves to 8.2.4. The secondary mail lockfile contains no Vite package or snapshot. No affected 8.2.0–8.2.3 Vite resolution remains.
4. Establish that the existing fix is on the actual current default branch. `git ls-remote --symref origin HEAD refs/heads/main` confirms HEAD points to main and main equals the inspected SHA. `git merge-base --is-ancestor e206a1ca9a631059818333837062a90bd225443d origin/main` passes. The existing commit changed the manifest, lockfile peer contexts/integrity, and source lock together.
5. Check exact-SHA CI and record the no-change result. A single REST discovery call returned completed/success Verify runs **44103866483** and **44087040126**, both on `b261dba72dfbcb30cb9d271fe81cdeea206c89eb`. Run site **44103866862** also completed/success on that SHA. These are existing main runs, not newly triggered branch runs. No workflow was dispatched, rerun or polled.
6. Save the complete non-secret report, verification receipt, CI discovery response, existing-fix patch, verifier script and required result.json outside the product checkout; publish only the explicitly selected packet through evidence/gr-mt-spool-dep-2. No product push, commit, PR, tag, release, deployment or landing is needed for the brief's explicit no-change outcome.

## Verification and commands

- `git rev-parse HEAD origin/main`: matching `b261dba72dfbcb30cb9d271fe81cdeea206c89eb`.
- `git ls-remote --symref origin HEAD refs/heads/main`: default main confirmed, matching SHA.
- `git log --all --format=... --grep=vite -i -12` and `git show e206a1ca9a631059818333837062a90bd225443d -- package.json pnpm-lock.yaml`: existing upgrade located and inspected.
- `git merge-base --is-ancestor e206a1ca9a631059818333837062a90bd225443d origin/main`: exit 0.
- `python3 .../packet/verify-no-change.py .../repo`: PASS; parsed both lockfiles with PyYAML, checked manifest/importer agreement and all Vite package/snapshot versions, original affected version, main ancestry, remote ref equality and clean state. Actual detailed output is verification-receipt.json.
- `git diff --exit-code origin/main HEAD` and `git status --porcelain`: no differences or untracked product files.
- `git log origin/main..HEAD --format="%an <%ae>%n%cn <%ce>%n%(trailers:only,unfold)"`: empty; zero candidate product commits.
- `gh api 'repos/just-every/run-spool/actions/runs?head_sha=b261dba72dfbcb30cb9d271fe81cdeea206c89eb&per_page=100' --jq ...`: one API call; selected non-secret response retained in ci-runs.json.
- Local install, regeneration, setup, build, typecheck and product journeys were not rerun: this run changes no source, dependency or lockfile. Existing exact-main successful Verify provides recorded CI status. No claim of a newly executed local build or Windows reproduction is made.
- Publication scan was not run because there is no product change, product commit or product push. Evidence transport is the separate required report-only entrypoint; evidence publication is not product READY or landing.

## Counts and scope

Current affected Vite resolutions: **0 before / 0 after** this run. Historical original fix: **1 before / 0 after**, Vite **8.2.2 → 8.2.4**.
Product changed files: **0**. New product commits: **0**. Tests added/removed: **0 / 0**.
No clause text, Status, Gap, Evidence or generated document changes. Existing generated progress remains Core 23 done / 45 partial / 19 missing (87 total), Agent surface 0 done / 9 partial / 9 missing (18 total), Full target 23 done / 54 partial / 28 missing (105 total).
No unrelated upgrades. No owner decision needed. No blockers. No new PR.

## Artifacts and custody

Required local result: `$HOME/rer-consolidation/work/maint/gr-mt-spool-dep-2/result.json`.
Complete packet: `$HOME/rer-consolidation/work/gr-mt-spool-dep-2/packet/`.
Only these explicitly selected regular files are published: REPORT.md, result.json, verification-receipt.json, ci-runs.json, verify-no-change.py, existing-fix.patch.
The report-only evidence manifest records the product branch and inspected product SHA. It does not signal a product push, READY, acceptance or landing. The original maintenance brief permits no-change without a commit or merge after verification that current main is already fixed; that is the outcome here.
