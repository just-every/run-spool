# Spool 0.7.9 release metadata preparation

Task: sd-spool-release-0-7-9
Repository: just-every/run-spool
Branch: cloud/sd-spool-release-0-7-9
Candidate: d3aee03b5066430bf280b7fa17775d43ed27fb2f
Parent: e9540f7ae83a5334d11dcaeda44c66df3b5ad94c
PR: not created; the declared repository uses guarded fleet landing for this candidate.

## Plan and scope

The full plan is in PLAN.md. The cloud assignment's branch overrides the historical 0.7.8 branch in the embedded brief. This round prepares metadata only. It creates no tag, signing envelope, GitHub Release, SDK publication, deployment, contract judgment or new product behavior. No RELEASED claim is made. Guarded landing, the full-history publication scan, producer/tag and authorized signing/publication remain with the fleet.

Refreshed the fleet launcher, installed its decrypted-bundle Git credential helper, required fleet identity and commit-message cleanup hooks, and cloned only the declared repository with --depth 1 --filter=blob:none. Read launcher AGENTS.md, seed AGENTS.md, CONTRACT.md and ACCEPTANCE.md, and the inline RULES.md and release rules. Installed the checkout's dependencies with pnpm install --frozen-lockfile. No tests were added or run locally for the version update.

## Preflight and main drift

The initial main was ca62aee25af1dbbb665d0040151a1150fcc10946, with successful exact-SHA Verify 43391416578 and Run site 43391416517. The v0.7.8 annotated tag resolves to 47ecaeeec8c442aa4648ad3b7f4fc1d7e1f115e2. Git ref inspection and GitHub Release readback found no v0.7.9 tag or Release and no competing v0.7.9 release branch. Existing older release branches were preserved.

Before the first candidate commit/push, fetch and rebase advanced the checkout to e9540f7ae83a5334d11dcaeda44c66df3b5ad94c. This exact SHA already had successful Verify 43391895713 and Run site 43394717718. It also had a later main-push Verify in progress at observation; the successful exact-SHA run is cited independently. The rebase preserved the new Capture README instructions. No published history was rewritten.

The actual three commits since v0.7.8 are:

- 0f9809608a4ba84b23f4f8ece165605fcdd1acba: plain release/build labels and truthful locally suppressed mail labels.
- ca62aee25af1dbbb665d0040151a1150fcc10946: actionable integration egress prerequisites and deployment-receipt binding guide for Slack and cron forwarding.
- e9540f7ae83a5334d11dcaeda44c66df3b5ad94c: browser capture without npm, explicit application Node/npm requirements, sample-evidence wording and accurate published-versus-checkout source-map limits.

## Product changes

- package.json and seed.json: 0.7.8 to 0.7.9.
- RELEASE.json: version 0.7.9, predecessor 0.7.8, no new migrations, no breaking change, no contract or extension-point changes. Updated backup/upgrade instructions and public notes.
- CHANGELOG.md: a new 0.7.9 section dated 2026-11-13, derived from the three actual commits. All historical sections remain byte-for-byte intact. The section body exactly matches RELEASE.json publicReleaseNotes and release-notes.md.
- README.md and docs/getting-started.md: existing release-version references only. Peer instructions and assertions remain intact.
- sources.lock.json: regenerated last with node scripts/edition-authoring/cli.mjs lock. Only the six edited metadata/document hashes changed.

There is no package-lock.json in this pnpm repository, so none was introduced. pnpm-lock.yaml is unchanged. The published rer pin is unchanged at 0.2.107. Existing known limits, the app-versus-SDK publication boundary and screenshot reference are retained. No release-history records were added.

## Checks and counts

Local touched checks passed: metadata consistency and previous-note preservation, pnpm typecheck, pnpm source:check, node src/base/contract-docs.mjs check, and git diff --check. The contract document check reported zero errors and zero warnings. Candidate diff inspection found no credential-shaped values; this is not the full publication scan.

The required toolchain setup chose installed Node 24.19.0 with pnpm 10.12.4, while the repository declares Node 22.20.0. It reported the engine mismatch; typecheck passed. Exact-SHA CI uses the repository's declared toolchain. The immutable checks-receipt.json records commands, output hashes and results.

Seven changed files, 46 insertions and 19 deletions. Application version 0.7.8 -> 0.7.9. New migrations 0 -> 0. Tests added/removed: 0/0; the whole tests tree has the identical object ID 049c078adcd77a7fd42d3d95ebf07b7837f01c38 before and after. Product source, CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are unchanged relative to the parent.

Acceptance counts before and after: Core 23 done / 45 partial / 19 missing (87); Agent surface 0 / 9 / 9 (18); Full target 23 / 54 / 28 (105). No clause status changes, CLAIM lines or default rulings are applicable to a metadata-only assignment.

## Publication custody

The first real commit was pushed immediately after local touched checks passed. The push used cloud-push.py and succeeded on its first attempt. Before pushing, git log origin/main..HEAD inspected all candidate author/committer identities and trailers, including side parents. Both identities are Run Edit Run fleet <fleet@runeditrun.com>; no co-author trailers remain. The product working tree was clean after pushing. No main/default-branch push, force push or tag operation occurred.

Verify for the exact candidate is run 43395322960: https://github.com/just-every/run-spool/actions/runs/43395322960. The final observed status is recorded separately in ci-final-receipt.json when completed. CI discovery and polling use gh api with credentials reloaded privately from the fleet bundle, one watcher and at least 300 seconds between observations. No SHA is redispatched or rerun.

Complete relevant reports, receipts and public local-check logs are selected explicitly for the report-only evidence ref evidence/sd-spool-release-0-7-9. No credential files, environment dumps, symlinks or private gate material are selected. Evidence transport does not imply product acceptance, landing or release. The product checkout and its dependencies will be deleted after successful evidence publication and product preservation.

No known implementation blocker remains. Final CI and evidence custody are reported in the terminal receipt.

Evidence snapshot: Verify remained in progress on the exact candidate at the third permitted poll. This snapshot records pushed custody only; it makes no READY claim. CI polling continues before the final report.
