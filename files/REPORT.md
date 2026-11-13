# Spool rer 0.2.113 adoption: main-spool-rer-0213-1

Repository: just-every/run-spool
Branch: cloud/main-spool-rer-0213-1
Product head: 7faf53703fcc6d8294f75dd4121a70cf0fcfa337
Parent/main integrated: 104ae1c1532c4c9125858a571dbab223993500fd
Product custody: pushed once through cloud-push.py and exact remote head independently matched. Worktree clean. No PR was required or created; the fleet lander owns landing. No default branch was pushed.

## Plan and result

The full initial plan is PLAN.md. Completed: inspect seed rules and provenance; update the exact rer dependency and lockfile; refresh Base at its immutable release SHA; preserve intentional seed adaptations; set up and exercise the two README lifecycle commands; run relevant local checks; fetch/rebase current main; regenerate and check the source lock last; audit all candidate identities and messages; commit and push the candidate. CI and evidence custody are tracked separately below and in their receipts.

- @runeditrun/rer: 0.2.107 -> 0.2.113, exactly pinned. pnpm-lock.yaml matches.
- Base copy revision: 4dd4197007cefd688fd314ffb19eed4d0b3c67dd -> c2efb501cbc148c2aee4d5e1107ebdba81469006 for all 105 copy records.
- Refresh command: `rer refresh-base --ref c2efb501cbc148c2aee4d5e1107ebdba81469006 --from-api`.
- Added by the Base refresh: src/modules/agent-door/policy-event.ts and src/modules/operator-auth/dev/invited.mjs; no copied file removed.
- Product diff: 31 files, 465 insertions, 206 deletions. Only the dependency, lockfile, refreshed Base copies/record and generated sources.lock.json were committed. No manual product, copy or test edits were added.
- Before/after clause counts: done 23 -> 23, partial 54 -> 54, missing 28 -> 28; total 105 -> 105. No clause status, Gap or Evidence changes and no DONE/acceptance claims. CONTRACT.md, ACCEPTANCE.md, docs/CLAIMS.md and all tests are byte-unchanged.
- New test registrations: 0; removed/modified seed test registrations: 0. Vendored Base conformance source updated only by refresh.

## Source acquisition

Only the declared product repository was cloned. Base was read through authenticated `gh api` with the decrypted fleet bundle. A snapshot archive at the exact immutable release SHA populated a task-local blob cache; all 4,796 tree blobs were checked against the authenticated GitHub tree's Git object identities. The unmodified rer --from-api reader used that cache for immutable blobs while commit, tree and ancestry metadata came from GitHub. This avoided thousands of blob API calls and used nine source API calls. Cache, archive and wrapper stayed outside the product tree.

An initial --base-archive attempt correctly refused because edition-migration ancestry requires history; no files changed. The subsequent --from-api refresh succeeded. A local wrapper recursion was fixed before any nested invocation reached GitHub; those local invocations are not API calls. See source-acquisition-receipt.json and refresh-receipt.json for successful provenance.

DIVERGENCE.md is absent in this seed. Intentional adaptations were taken from base-copies.json and AGENTS.md. All twelve remained byte-for-byte unchanged:

- .github/workflows/run-demo.yml
- .github/workflows/run-site.yml
- .github/workflows/verify.yml
- src/modules/agent-door/audit.ts
- src/modules/agent-door/pages.ts
- src/modules/agent-door/person-doors.ts
- src/modules/agent-door/reviews.ts
- src/modules/erasure/cascade.mjs
- src/modules/erasure/index.d.mts
- src/modules/erasure/index.mjs
- src/modules/erasure/order.mjs
- src/modules/erasure/verification.mjs

Base reported upstream changes in four of these adaptations; the seed versions were explicitly preserved:

- src/modules/agent-door/audit.ts
- src/modules/agent-door/pages.ts
- src/modules/agent-door/person-doors.ts
- src/modules/agent-door/reviews.ts

The seed fonts and product-owned packaging policy were unchanged. The refresh also preserved the seed-owned Verify and nightly workflow templates and reported adoption notices, without changing their workflow bytes.

## Lifecycle proof on the candidate tree

`rer export --output exports/spool.rer` exited 0, once:

> Exported the local copy to exports/spool.rer (331 KB): 100 tables, 0 rows

`rer deploy --dry-run` exited 0, once:

> Your application is built
> Would deploy:
> Worker: spool-production
> D1 database: spool-production-db (99 declared migrations)
> Secret inputs: 7 required, 1 optional
> Public settings: 3; scheduled triggers: 1
> Full plan: repeat this command with --json.

Both print readable summaries instead of a raw result object. The machine format remains available with --json. The dry run reported no Cloudflare request and no remote changes. Complete non-secret command output and actual exit receipts are included in export.log, deploy-dry-run.log and lifecycle-receipt.json. The private export archive and local setup secrets are excluded from evidence.

## Local verification

All final checks passed:

- `npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive` (temporary local app stopped on completion; private setup output excluded).
- `pnpm install --frozen-lockfile` for the declared workspace. The first agent-door attempt exposed the missing workspace SDK after root-only dependency installation; this setup fixed it without a product edit.
- `node tests/agent-door.mjs` under Node 22.20.0 with /usr/bin/chromium and --no-sandbox.
- `node tests/old-archive.mjs`: populated release upgrades preserve 176 tables/120 rows; the 0068 upgrade preserves 201 tables; fresh restore, refusal and round-trip checks pass.
- `node tests/dev-credentials.mjs`: local scoped grants, owner gate, invitation acceptance/removal and hosted/identity-fence refusals pass.
- `pnpm typecheck`, including an exact Node 22.20.0 run after workspace install.
- `pnpm run check -- --profile first-party`.
- `node scripts/edition-authoring/cli.mjs verify-base --offline`.
- `node src/base/contract-docs.mjs check`: current, no generated view changes required.
- `pnpm integration:check`.
- After fresh main integration, `node scripts/edition-authoring/cli.mjs lock` ran last; `pnpm source:check` passed.
- `git diff --check`, allowed-path scope, full candidate commit author/committer/message audit, and changed-product-file checks for injected/local private values and credential-shaped data passed.

No full local rer verify was run. No test was added, deleted, skipped or weakened. Existing browser journeys produced their own ignored test artifacts; no screen redesign or separate screenshot proof was requested. No release was cut or provider deployment attempted. The fleet Mac runs the full publication scan at landing, as specified by the cloud brief.

## Main integration and commit

`git fetch origin main` followed by `git rebase origin/main` found main unchanged at 104ae1c1532c4c9125858a571dbab223993500fd. Uncommitted work was stashed/restored under the required fleet identity, and the source lock was regenerated afterward. There were no conflicts. The only product commit is 7faf53703fcc6d8294f75dd4121a70cf0fcfa337, with fleet author and committer and no trailers or skip-CI marker. All twelve seed adaptations remain unchanged.

## CI and terminal custody

Exact-SHA Verify run 43455376010 completed with **failure**:
https://github.com/just-every/run-spool/actions/runs/43455376010

Its head_sha is 7faf53703fcc6d8294f75dd4121a70cf0fcfa337, matching the pushed product head. Ten of ten GitHub calls are used: nine source-acquisition calls and the exact-SHA run discovery. No further job metadata/log archive request or rerun was made after budget exhaustion. The failed job and step are therefore unknown, and the cause is not claimed to be unrelated or to qualify for the generated-view exception. The equivalent local workflow-permissions precheck also passed. This head is pushed but **not READY**; terminal status is **BLOCKED** on the failed exact-SHA Verify pending lane diagnosis.

Product custody and evidence custody remain separate. No branch was rebased or force-pushed after publication, and no main branch update, release or deployment was attempted.

## Blockers and follow-up

The required exact-SHA Verify is red; its failed job/step could not be diagnosed within the remaining GitHub budget. All local touched checks pass. The lane must inspect run 43455376010 and repair a touched failure or rerun failed unrelated jobs under the brief before treating this head as READY. No policy default or unprovided clause ruling was needed. No clause promotion is claimed. The fleet must also run its publication/landing gates.
