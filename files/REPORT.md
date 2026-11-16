# Spool 0.7.13 release metadata result

Author: Run Edit Run fleet. Date: 2026-11-16 UTC.
Tag: sd-spool-release-0-7-13-r2. Repository: just-every/run-spool.

## Product custody

- Branch: cloud/sd-spool-release-0-7-13-r2
- Commit: 9580df1b3fd371ee50df97fd8659bdd1d0c6a79d
- Base main: 7fee744e133924477a3d95e69b8a96d61d69f75d
- Previous published release: v0.7.12, published 2026-11-15T12:41:15Z; tag object d9a5fceb1e81a6b8361982e5bb11fc09dfebc481, commit cc086904fd942175d18c60082b10c459c343dc78.
- Product push succeeded on the first attempt through the required cloud-push.py guard. A subsequent Git ref probe confirmed the exact remote head.
- No PR was created: the brief uses fleet guarded landing, and forbids self-submission. No tag or GitHub Release was created or moved. This is a release metadata candidate, not a RELEASED claim.

## Plan and completed work

The complete plan is in PLAN.md. Configured fleet author/committer identity first, refreshed the launcher, installed the bundle-reading Git helper and push guard, cloned only the declared product repository shallow/blobless, and installed the supplied co-author cleanup hooks while preserving repository hooks. Read launcher and seed AGENTS.md plus the inline builder/release rules. Used the pinned pnpm toolchain for dependency installation and checks.

Compared fresh main with the actual v0.7.12 tag: 25 commits across 71 files; no migration files added, modified or removed. The tag/ref probe found no v0.7.13 tag; the complete GitHub Release inventory contained no v0.7.13 Release. Main was fetched again before publication and remained at the same base. The final clean rebase onto origin/main succeeded without replay or conflicts. No published history was rewritten.

Updated package.json, seed.json, RELEASE.json and the new top CHANGELOG.md section to 0.7.13 with previousVersion 0.7.12. Regenerated sources.lock.json last using the documented edition-authoring lock command. The pnpm lock and both exact rer 0.2.118 references remain unchanged. The generated lock changes only the four edited metadata file hashes.

The release notes describe only user-visible changes in v0.7.12..main: deliberate hosted mail-off with guarded owner sign-in; owner team inspection and native project/capture setup; in-memory issued-key handoff from Settings to Capture and sample-capture progress; project-member ingest/agent key authority; contact-bearing alert reads behind configuration authority while deployment route selection remains available; explicit new-project identity retention defaults with existing/restored policies unchanged; readable evidence/archive summaries, current comment revisions, grouping examples and SDK prerequisites.

Preserved the buyer's private backup, stopped-dev export, main/tag upgrade, hosted deploy, retained settings/database/keys/deployment receipt, no-reset and empty-destination import instructions. Updated the migration inventory to the exact empty diff and retained current known limits. Historical changelog sections are byte-for-byte preserved. The public notes and new changelog section match exactly. RELEASE.md does not exist on fresh main; it was left absent under the lease limiting edits to existing release references. No new release document was invented.

## Before and after

| Item | Before | After |
| --- | --- | --- |
| Application/seed/release version | 0.7.12 | 0.7.13 |
| previousVersion | 0.7.11 | 0.7.12 |
| rer package and lock pins | exactly 0.2.118 | exactly 0.2.118 |
| Incremental release migration list | 3 for 0.7.11 → 0.7.12 | 0 for 0.7.12 → 0.7.13 |
| Clause statuses, all 105 | 23 done / 54 partial / 28 missing | 23 done / 54 partial / 28 missing |
| Published clauses | 9 done / 3 partial / 0 missing | unchanged |
| Target and push-further clauses | 14 done / 51 partial / 28 missing | unchanged |
| Tests added/changed/deleted by this round | 0 / 0 / 0 | 0 / 0 / 0 |
| Files changed by candidate | 0 | 5 leased metadata/source-lock files |

Clause status changes: none. No acceptance, status, gap or evidence edits and no clause promotion claims. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md remain untouched. Product code, adoption configuration, homepage, README, docs and identities remain unchanged.

## Validation

- Metadata consistency audit passed: versions, previousVersion, exact rer package/lock pin, untouched lock, empty migration diff, matching notes, preserved historical changelog, allowed file scope and untouched contract views. See metadata-receipt.json.
- pnpm install --frozen-lockfile passed with pnpm 10.12.4. Local Node is 24.19.0; the prescribed toolchain accepts an installed newer Node. Exact Node 22.20.0 is used by branch CI.
- pnpm source:check passed; complete output in source-check.txt.
- node src/base/contract-docs.mjs check passed: 0 errors, 0 warnings, documents current. See contract-check.txt.
- pnpm typecheck passed; see typecheck.txt.
- node scripts/edition-authoring/cli.mjs verify-base --offline passed; see base-copies-check.txt.
- git diff --check passed; see diff-check.txt.
- Every candidate commit's author, committer and full trailers passed the required audit, including all parents. No co-author trailers are present. See identity-receipt.txt and push-receipt.txt.
- An attempted pre-commit rebase refused unstaged metadata without changing anything; after the complete metadata commit, the required clean rebase succeeded. A repeated check command initially omitted the toolchain source and system pnpm 11 refused a dependency reinstall without a TTY. Corrected by sourcing /tmp/rer-cloud-toolchain.sh; all recorded final checks pass with pnpm 10.12.4. No product changes were needed.
- No full local suite or runtime setup/build/browser was needed for metadata-only edits. Branch Verify provides the full workflow gate.

## Exact-SHA CI and remaining custody

Verify run 43841357640: https://github.com/just-every/run-spool/actions/runs/43841357640
Discovery reported in_progress on exact SHA 9580df1b3fd371ee50df97fd8659bdd1d0c6a79d. Final observation is recorded separately in ci-result.json and the final CI result appended below. REST observations use one watcher and at least 300 seconds between calls for this run; no dispatches or retries were requested. GitHub API budget is 10 total calls.

The fleet Mac retains the full publication scan, independent release gates, final generated-view/landing checks and main-only Run site custody. No cloud publication scan or landing is claimed. Evidence publication is report transport only and cannot signal product acceptance, READY or release publication.

## Report packet

Actual reports and receipts reside under /home/agent/rer-consolidation/work/sd-spool-release-0-7-13-r2/packet/. Selected regular files are published only to refs/heads/evidence/sd-spool-release-0-7-13-r2 using cloud_evidence.py; the final message carries its exact EVIDENCE line. The evidence manifest records the product branch/head and hashes every selected report. No credentials, environment dumps, held-out material or symlinks are included. The clean, successfully pushed product clone is removed after evidence transfer and provenance verification, per the brief.

Blockers: none. Source lock, adoption and contract checks pass without the generated-view exception.

## Final CI result

Verify run 43841357640 completed with conclusion success on exact product SHA 9580df1b3fd371ee50df97fd8659bdd1d0c6a79d, observed 2026-11-16T09:57:53.150717+00:00. No workflow rerun or dispatch was requested. Six of the ten allowed GitHub API calls were used: one Release inventory and five exact-SHA workflow observations, including discovery. Every observation interval met the 300-second minimum. No failed job log downloads were needed. See ci-result.json, ci-discovery.json and ci-observations.json.

Final builder result: READY branch=cloud/sd-spool-release-0-7-13-r2 head=9580df1b3fd371ee50df97fd8659bdd1d0c6a79d. This identifies a pushed, green builder candidate; fleet publication scanning, guarded landing and any eventual release remain separate operations.

POST lanes/sd/INBOX.md: sd-spool-release-0-7-13-r2 prepared Spool 0.7.13 (previous 0.7.12) at 9580df1b3fd371ee50df97fd8659bdd1d0c6a79d on cloud/sd-spool-release-0-7-13-r2. Verify 43841357640 success on exact SHA. Five metadata/source-lock files; rer package/lock exactly 0.2.118 unchanged; no new migrations; clause/status changes none, counts unchanged 23 done / 54 partial / 28 missing (105 total). RELEASE.md absent on main and left absent; no PR, tag or Release created. Actual full plan/results and receipts are in the evidence packet. Fleet publication scan and landing remain with the Mac.
