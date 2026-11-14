# gr-mt-spool-dep-6: Vite security maintenance

Repository: just-every/run-spool
Branch: cloud/gr-mt-spool-dep-6
Candidate: 3165877f046ca026c108f2b09cccdce845c3219d
Main at admission and pre-commit fetch: b9e7e575097e0dd0fc0662ce1ed507fa0d41f0d8

## Change and scope

Pinned the direct dev dependency Vite to the first patched release, 8.2.4, from 8.2.2. Regenerated pnpm-lock.yaml using pinned pnpm 10.12.4, updating its Vite integrity and peer references. Regenerated sources.lock.json last; only package.json and pnpm-lock.yaml entries changed. No other package version changed. No application, UI, contract, generated acceptance view, or test source changed.

The brief identifies five advisories across ten alerts (21–30): GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22, GHSA-vfpm-58rq-9qcg, GHSA-r825-w8mm-5pxw and GHSA-587h-7wmj-h5pm. Its supplied patched threshold is 8.2.4. This report verifies the dependency resolution against that threshold; it does not claim GitHub has closed the alerts before landing.

Before/after: Vite 8.2.2 → 8.2.4; vulnerable locked Vite package versions 1 → 0; total locked package versions 547 → 547; unrelated package upgrades 0. All 12 installed Vite dependency paths resolve 8.2.4 (installed-vite.json). Generated clause counts remain 23 done, 54 partial, 28 missing. Clause changes/promotions: none. Tests added/removed/weakened: 0/0/0.

## Plan

The complete plan is PLAN.md. Refresh the fleet launcher and Git helpers, clone fresh full history, read project instructions, update only Vite with the pinned package manager, run focused checks, regenerate the source lock, commit with the fleet identity/hooks, require a complete passing publication scan, push only the named cloud branch, inspect exact-SHA Verify through REST, and return the actual packet on its separate evidence ref. The fleet owns landing and deployment.

## Local results

Node v22.20.0 and pnpm 10.12.4 were used. All listed checks completed with exit 0:

- pnpm add --save-dev --save-exact vite@8.2.4 --lockfile-only
- pnpm install --frozen-lockfile
- npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive (through cloud_run; private setup output excluded)
- npx -y @runeditrun/rer build (through cloud_run)
- pnpm typecheck
- pnpm integration:check (setup digest and producer workflow already matched; no regeneration needed)
- node src/base/contract-docs.mjs check (no contract or view changes needed)
- node scripts/edition-authoring/cli.mjs lock, followed by pnpm source:check
- RER_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node tests/runtime.mjs (through cloud_run, Chromium --no-sandbox)
- git diff --check

The existing focused runtime journey exercised DB health, generated site/docs output, browser navigation at 1440px, owner admission, direct API/document gates, second-claim refusal, and immediate revocation on the emitted application. Setup also exercised the local Vite server and migrations. No changed UI screen requires new responsive proof. The full local suite was intentionally left to branch Verify as directed.

Nonblocking build warnings concern existing mixed static/dynamic imports and plugin timings. No source change was needed to address the upgrade.

## Publication and custody

The fresh Base scanner was read via gh api, without cloning or writing another repository. Its unmodified official Python CLI performs the scan; scanner-provenance.json records the API archive identity and checksum. Gitleaks 8.30.1 was installed from its API release asset and verified against the published SHA-256 digest. No scanner exclusions or policy edits were added.

The initial scan completed and found 13 findings confined to ignored local setup/build/runtime files, with no committed-tree findings. The exact same commit was then materialized in a clean detached worktree for a fresh full-history scan. This uses the unchanged scanner and no added exclusions; the initial actual report is retained as initial-publication-scan.json. The final clean-tree scan completed PASS with zero findings on commit 3165877f046ca026c108f2b09cccdce845c3219d and tree 425a590005014480c6c1d9bc3c14a295525b065b. It inspected 905 commits, 895 trees, 7,854 blobs, 905 commit messages and 20 tag messages in 353.25108 seconds. The branch was pushed successfully on the first guarded attempt; an independent ls-remote check confirms the exact remote head. Exact-SHA Verify run 43574635673 at https://github.com/just-every/run-spool/actions/runs/43574635673 is completed with conclusion success. The initial immediate discovery returned zero runs; every subsequent discovery/poll followed the required 300-second interval. Its completed/success result qualifies this head for READY. No landing or deployment occurred.

## Defaults and remaining scope

Use the first patched release 8.2.4 to minimize dependency movement. Keep existing owner screens, contract judgments, generated views, and all unrelated dependency pins intact. No new clause claim is made. No PR is required by the repository instructions; guarded fleet landing owns main. No deployment, provider acceptance, or alert-closure claim follows from local checks.

## Terminal result

READY branch=cloud/gr-mt-spool-dep-6 head=3165877f046ca026c108f2b09cccdce845c3219d

No blockers. Exact-SHA Verify completed successfully. PR: none created or required by the shipped project instructions.
