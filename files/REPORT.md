# gr-mt-spool-dep-7 — Spool dependency security maintenance

Repository: just-every/run-spool
Branch: cloud/gr-mt-spool-dep-7
Candidate: f773e85edf527a1e790f763a6da9a91c71aa8f73
Base: e206a1ca9a631059818333837062a90bd225443d

The local maintenance work is complete. Base publication inspection is COMPLETE/PASS with zero findings on the exact candidate and its source tree. The named product branch was pushed successfully through the cloud guard on its first attempt. Exact-SHA Verify completed successfully; this candidate is READY for the guarded fleet landing.

## Plan and implementation

The complete plan is in PLAN.md. I inspected the repository instructions, both manifests and lockfiles, dependency parents, source-provenance tools and Verify workflow; updated only the vulnerable graph; validated installation and the affected runtime/agent flows; recorded the two intentional Base-copy adaptations; and regenerated the source lock last. Publication requires a COMPLETE/PASS scan before the guarded cloud-branch push and exact-SHA CI.

Six product files changed:

- package.json: existing undici override 7.29.1 → 7.30.1.
- pnpm-lock.yaml: undici 7.29.1 → 7.30.1; fast-uri 3.1.8 → 3.1.9; body-parser 2.3.0 → 2.4.0; zod 4.6.3 → 4.6.7. body-parser requires qs ^6.16.1 and pnpm selected qs 6.17.1 for that edge; express's existing qs 6.16.0 edge remains.
- src/modules/mail/package.json: existing undici override 7.29.1 → 7.30.1.
- src/modules/mail/pnpm-lock.yaml: undici 7.29.1 → 7.30.1. pnpm 10.12.4 also normalizes libc metadata on unchanged optional sharp packages; their versions are unchanged.
- base-copies.json: the two changed mail files are explicit seed adaptations with acknowledged local bytes; their recorded original Base bytes/revision are preserved.
- sources.lock.json: regenerated hashes for these five inputs.

No new direct dependencies or overrides were added. All parent packages remain pinned at their previous versions. fast-uri is reached through ajv; body-parser through express; zod through TanStack tooling and the MCP SDK; undici through Miniflare and Sentry CLI (and Miniflare in the standalone mail package).

## Before and after

| Measure | Before | After |
| --- | ---: | ---: |
| Listed alert instances addressed by the lockfiles | 8 vulnerable | 0 vulnerable |
| Vulnerable target package entries across both locks | 5 | 0 |
| Root lock package entries | 491 | 492 |
| Standalone mail lock package entries | 56 | 56 |
| Contract status counts (done / partial / missing) | 23 / 54 / 28 | 23 / 54 / 28 |

The eight-alert count is evaluated against the advisories supplied in the brief, not a live Dependabot closure report or an exhaustive dependency audit. See dependency-inventory.json and dependency-paths*.log for the actual graph.

No contract clause text, Status, Gap or Evidence cell changed. No test registration changed. The generated acceptance and claims views were not committed. No UI changes or deployments were made.

## Validation

Node 22.20.0 and pnpm 10.12.4 were used for local validation. The VM initially exposed Node 24.19.0, so the repository's exact Node pin was installed and put first on PATH for validation.

All required local checks completed successfully:

- pnpm install --frozen-lockfile (root workspace).
- pnpm --dir src/modules/mail install --frozen-lockfile --ignore-workspace.
- npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive, through cloud_run/subreaper: 99 migrations applied and the local owner initialized.
- pnpm typecheck.
- npx -y @runeditrun/rer build, through cloud_run/subreaper.
- pnpm test:agent-handoff: 9 groups, 10 masked captures, complete packet 231566/262144 bytes; official SDK stdio MCP, schema refusal, exact-project scope, credential handling, inert proposals and restore/retention boundaries passed. Its cleanup reported every owned child stopped.
- pnpm test:runtime: health, document and direct API gates, first-owner admission, second-claim refusal, immediate revocation and published prerequisite guides passed.
- pnpm integration:check.
- node src/base/contract-docs.mjs check: current, zero errors/warnings.
- node scripts/edition-authoring/cli.mjs verify-base --offline: pass after recording the two intended mail adaptations.
- node scripts/edition-authoring/cli.mjs lock, then pnpm source:check: pass.
- git diff --check: pass; working tree clean. Candidate author and committer are Run Edit Run fleet <fleet@runeditrun.com>; plain commit message, no trailers.

The two existing journeys were run with /usr/bin/chromium and --no-sandbox through their existing browser launch helpers, with subreapers around the commands. The repository's own heavy-job queue serialized them. No full local Verify was run. The detailed command, exit and elapsed-time receipts are in validation-receipts.json and the individual check receipts/logs. Local type/build tests were established before a metadata-only amendment; application sources and lockfile contents remained identical.

The first offline provenance check correctly refused the unacknowledged mail edits. The supported adapt-base commands fixed that record, and its final check passed. An earlier publication scan was interrupted after this provenance requirement changed the candidate; publication-scan-superseded.json records that superseded inspection honestly. A completed scan on this candidate returned only destination.invalid because its --repository argument was supplied as a slug rather than the required GitHub URL. The corrected destination validator and full corrected scan passed with the same candidate and explicit URL. The earlier full report remains in publication-scan-invalid-invocation.json. The final scan targets this report's candidate and its source tree, with published history fetched from GitHub main and tags as its public baseline.

## Custody and remaining gates

The external recovery bundle is /home/agent/rer-consolidation/work/gr-mt-spool-dep-7/recovery/gr-mt-spool-dep-7.bundle. It was verified by git bundle verify, contains the named cloud branch, and requires base e206a1ca9a631059818333837062a90bd225443d. SHA-256: 4e0b8b99f4c39354923c9bbc0aa76159bb071562a84aa2196cf7d7f79da5ff27. The bundle is recovery data, not proof of a push or READY.

Product push: succeeded on the first attempt; see product-push.log.
Publication scan: COMPLETE/PASS, zero findings, exact commit f773e85edf527a1e790f763a6da9a91c71aa8f73 and tree e6209744aff376065e8871f7517acf647dea4be5. It inspected 907 commits reachable from the selected candidate and the remote-published main/tag baseline; full local references numbered 2,470. Seventeen already-public findings were classified against that fetched public baseline and did not enter the finding set.
Exact-SHA Verify: run 43624307112 (https://github.com/just-every/run-spool/actions/runs/43624307112), status completed, conclusion success, exact SHA f773e85edf527a1e790f763a6da9a91c71aa8f73. Latest REST observation: 2026-11-14T18:22:00.101272+00:00.
PR: none; the brief routes this maintenance candidate through the named cloud branch and guarded fleet landing.

Default: preserve existing parent pins and update compatible transitive resolutions; retain the existing undici override model in both manifests. No owner ruling is needed. The Mac fleet owns landing and any main/deployment gates.

The GitHub push response reports 46 vulnerabilities on the unchanged default branch (14 high, 24 moderate, 8 low). This maintenance round addresses only the eight listed alert instances by patched candidate resolutions; other alerts were not investigated, and live alert closure awaits landing and GitHub reassessment.

## Terminal result

READY branch=cloud/gr-mt-spool-dep-7 head=f773e85edf527a1e790f763a6da9a91c71aa8f73

No blockers. The fleet owns publication admission, landing and main/deployment checks.

GitHub usage: 9 explicit API commands plus one mandatory launcher authentication probe, within the ten-command budget. One watcher respected the 300-second interval, including discovery. See github-budget.json and ci-state.json.

The non-secret packet is selected explicitly for report-only publication to refs/heads/evidence/gr-mt-spool-dep-7. Product custody is independent of that report transfer; the final terminal EVIDENCE line identifies its exact published report head. No report or receipt file entered the product branch.
