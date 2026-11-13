# Spool rer 0.2.113 adoption: main-spool-rer-0213-1-c2

Repository: just-every/run-spool
Product branch: cloud/main-spool-rer-0213-1-c2
Product head: 169e4cbcf1b93522506f97c71bf39e364bed2303
Base: 417ab513b3032370091479fa28f41a5a67b50c53
PR: none required by this repository's instructions; branch left for fleet landing.

## Plan and execution

1. Initialized fleet identity, launcher credentials, decrypted-bundle Git helper, cloud push guard, pinned pnpm toolchain and commit hooks. Read the inline builder rules, launcher AGENTS.md, seed AGENTS.md and contract documents.
2. Cloned the declared repository with full history and blob filtering. Started the named branch at origin/main. Applied both specified commits without committing, so their net change became one fresh commit. The first pick conflicted only in sources.lock.json; took main's lock pending regeneration.
3. Preserved main's newer release metadata and all tests. Restored CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md from origin/main. Their final hashes and equality checks are in LOCAL-RECEIPT.json.
4. Ran a fresh frozen-lockfile dependency install. Confirmed installed rer 0.2.113. Inspected authoring changes and every recorded adaptation. DIVERGENCE.md is absent from this repository, including tracked and hidden files; used base-copies.json and AGENTS.md's ownership rules. All 12 recorded adapted files stayed byte-identical to main, including the three seed workflows, four agent-door files and five erasure files. Product fonts, native application source and retained policy remain intact.
5. Ran local setup with the fleet owner, then the two requested installed-rer commands once each. Setup and export ran locally; deploy was a dry run without provider calls. No live deployment or acceptance claim follows.
6. Stashed only tracked changes temporarily, fetched main, rebased the empty candidate branch onto current origin/main, restored the staged changes and contract documents, then regenerated sources.lock.json through the installed 0.2.113 package. Ran CI's exact source/portable-contract block and typecheck successfully.
7. Verified the scope is exactly the prior combined diff's 33 paths. All refreshed files except package.json and the regenerated lock exactly match 51336a9d; package.json retains main's 0.7.10 release metadata. Audited identities, messages, one-parent ancestry and credential-shaped added content. Created exactly one fleet-authored commit and immediately pushed it with the cloud guard. There are no merge commits, skip-CI markers, AI co-author trailers or report files in the product commit.
8. Discovered exact-SHA Verify through REST and used one watcher at 300-second minimum intervals. Verify run 43502698751 completed successfully on the exact product SHA; the actual CI status is recorded in CI-RESULT.md and ci-receipt.json. Full local rer verify was deliberately not run.
9. Kept the actual non-secret packet outside the product repository and published it through the separate evidence transport. No credentials, environment dumps, private archives, private setup output or held-out gates are in the selected packet. Fleet landing and its complete publication scan remain the fleet's responsibility.

## Results and counts

- @runeditrun/rer: exactly 0.2.107 -> exactly 0.2.113, with matching pnpm lockfile.
- Recorded Base revision: 4dd4197007cefd688fd314ffb19eed4d0b3c67dd -> c2efb501cbc148c2aee4d5e1107ebdba81469006.
- Base copy records: 105 -> 105; all recorded adaptations retained.
- Candidate commits above main: 0 -> 1, with one parent and no merge.
- Product diff: 33 files, 478 insertions, 211 deletions.
- Tests added/removed/changed: 0 / 0 / 0.
- Contract counts unchanged: 23 done, 54 partial, 28 missing, total 105.
- Clause status changes: none. No CLAIM or DONE assertion is made.
- Contract and both generated views are byte-identical to origin/main.
- Both guide documents now link to the recorded Base revision's egress owner steps.
- Local frozen install, first-party check, source lock check, contract-doc check, offline Base verification and typecheck: passed.
- GitHub repository check: gh api repos/runeditrun/base --jq '{full_name,private}' succeeded (HTTP 200), returned full_name runeditrun/base and private false. This is the only repository in added lines and resolves directly without a renamed repository identity.
- No product or account blocker was encountered. Exact-SHA Verify completed successfully; no failure logs or reruns were needed.

## Readable CLI output

Command: pnpm exec rer export --output exports/spool.rer

Excerpt: Exported the local copy to exports/spool.rer (331 KB): 100 tables, 0 rows
Next action: To restore into an empty installation: rer import --input exports/spool.rer --yes

Command: pnpm exec rer deploy --dry-run

Excerpt:
Would deploy:
  Worker: spool-production
  D1 database: spool-production-db (99 declared migrations)
  Secret inputs: 7 required, 1 optional
  Public settings: 3; scheduled triggers: 1

The command also states that no Cloudflare requests were made and provides --json for the full machine-readable plan. See export.log and deploy-dry-run.log for complete actual outputs.

## Custody

Product push: succeeded on the first attempt; actual sanitized transport receipt is product-push.log.
Identity: Run Edit Run fleet <fleet@runeditrun.com> for both author and committer, no trailers.
Verify: run 43502698751, https://github.com/just-every/run-spool/actions/runs/43502698751, exact product SHA above.
Evidence: separate report-only branch evidence/main-spool-rer-0213-1-c2; terminal message records its exact evidence head.
Landing and release: not performed here. The fleet lands the candidate and lane sd owns the next release.
