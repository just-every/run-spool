# Spool rer 0.2.113 adoption continuation

Repository: just-every/run-spool
Branch: cloud/main-spool-rer-0213-1-c1-pc1
Candidate: 51336a9de74ff582b835ed3834d2ce5dc40a9f40
Preserved published starting head: edd624af411a36c72cbdd7f93d07ef5aabd3ca62
Main inspected before the candidate: 3d3a7db595e571f8466bcee683634c83d93656b8

## Plan and result

Preserve the continuation and fix forward. Inspect the prior completed Verify once, reproduce its actual failure, repair the refresh-related cause, run the failed/touched journey and typecheck, regenerate the source lock through the installed rer package, run CI's precise source-check block after frozen installation, push with fleet identity and guard, and require exact-SHA Verify. Publish reports separately from product custody.

One new commit, `51336a9 Align egress owner guides with the refreshed Base source`, updates three owner-procedure links in docs/INTEGRATION-EGRESS.md and docs/ALERT-WEBHOOKS.md, plus the two corresponding generated source-lock digests. The links now follow the installed egress module's Base revision c2efb501cbc148c2aee4d5e1107ebdba81469006. All other prose is retained. No merge commit was needed: fetched current main is already an ancestor. No published history was amended, rebased or rewritten.

The original adoption's stale source lock omitted src/modules/agent-door/policy-event.ts and src/modules/operator-auth/dev/invited.mjs; its toolchain identity was already correct. The saved continuation had fixed those omissions and included main's newer alert-test digest. Its remaining failure was different: the Settings public-door journey compared the owner guide's source link with the refreshed egress module pin. The link still selected 4dd4197007cefd688fd314ffb19eed4d0b3c67dd. The failure reproduced under both Node 24.19.0 and CI's Node 22.20.0. The unchanged runtime journey now passes under Node 22.20.0 with Chromium /usr/bin/chromium and --no-sandbox.

## Validation

- Fresh checkout: pnpm install --frozen-lockfile succeeded, installing @runeditrun/rer 0.2.113. Repeated frozen install with CI's Node 22.20.0 also succeeded.
- pnpm typecheck succeeded.
- pnpm exec rer build succeeded; no full local rer verify or full suite ran.
- node tests/runtime.mjs passed: framework docs, Settings prerequisite guides, runnable receipt-to-binding recipe, DB health, anonymous document and API gates, local owner admission, second-claim refusal, immediate revocation. All existing assertions and tests remain unchanged.
- node node_modules/@runeditrun/rer/edition-authoring/cli.mjs changes showed only the two intended guide edits. The installed package's `lock` command regenerated sources.lock.json last.
- CI's precise `Check source and portable contract` block passed on the committed candidate after frozen install: `pnpm run check -- --profile first-party`; `pnpm source:check`; `node src/base/contract-docs.mjs check`; `node scripts/edition-authoring/cli.mjs verify-base --offline`. See ci-local-receipt.json for actual exit codes.
- git diff --check passed. Working tree is clean. All candidate author and committer identities are Run Edit Run fleet <fleet@runeditrun.com>; no trailers. Guarded product push succeeded on its first attempt.
- CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to origin/main; hashes are in product-receipt.json.
- All 105 Base copy records still reference c2efb501cbc148c2aee4d5e1107ebdba81469006. Declared adaptations remain intact: three workflows; agent-door audit.ts, pages.ts, person-doors.ts, reviews.ts; erasure cascade.mjs, index.d.mts, index.mjs, order.mjs, verification.mjs. DIVERGENCE.md does not exist in this checkout; base-copies.json is the actual declared adaptation record. Product-owned font and auth files remain unchanged.
- Browser screenshots were not required for this link-only maintenance change. The existing runtime journey still performs its own browser assertions at 1440 and takes its existing 1440/390 captures; those captures and private runtime state are excluded from publication.
- Full publication scanning and landing remain the fleet Mac's gates, as specified by the cloud adaptation. No deployment or release was performed, and no PR was created.

## Stranger item 18 command excerpts

Using the installed pinned rer, after successful noninteractive local setup (99 migrations):

`pnpm exec rer export --output exports/spool.rer`

> Exported the local copy to exports/spool.rer (331 KB): 100 tables, 0 rows

`pnpm exec rer deploy --dry-run`

> Would deploy:
>   Worker: spool-production
>   D1 database: spool-production-db (99 declared migrations)
>   Public settings: 3; scheduled triggers: 1
> Full plan: repeat this command with --json.
> deploy: complete (exit 0)

Both use readable product summaries; the dry run explicitly offers the machine format through --json. No provider request was made. The private archive, local owner gate, setup output and runtime configuration are excluded from evidence.

## Counts and clauses

Before and after: 23 done, 54 partial, 28 missing, 105 total (Core 23/45/19; Agent 0/9/9). Clause status changes: none. New claims: none. Tests added/removed/modified: 0/0/0. Stale owner-procedure links: 3 before, 0 after. Original omitted source-lock files: 2 before the saved continuation, 0 now.

## CI and custody

Starting Verify 43468399080 attempt 2 failed in `verify (runtime)` / `Run suites`, job 132046891151. `shards (spool)` and final `verify` failed as dependent aggregates. The failed job's log was read once with the required gh archive command; it is included with the infrastructure environment block excluded.

Candidate Verify: 43480687873, https://github.com/just-every/run-spool/actions/runs/43480687873 . Exact-SHA Verify completed successfully on candidate 51336a9de74ff582b835ed3834d2ce5dc40a9f40; its actual terminal response is in ci-status-8.json, with CI-RESULT.md and ci-receipt.json recording custody. One REST watcher polls at intervals of at least 300 seconds, within the ten-call GitHub budget. Product and evidence pushes are separate. Reports are published only to refs/heads/evidence/main-spool-rer-0213-1-c1-pc1.

No blockers remain: local checks and exact-SHA Verify are green. Eight GitHub calls were used; no workflow reruns were needed. Clone cleanup follows successful evidence transfer and recorded terminal product provenance.
