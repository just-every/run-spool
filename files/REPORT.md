Spool rer 0.2.113 adoption repair

Repository: just-every/run-spool
Branch: cloud/main-spool-rer-0213-1-c1
Product head: edd624af411a36c72cbdd7f93d07ef5aabd3ca62
Base: 3d3a7db (full SHA in PRODUCT-RECEIPT.json)
Original adoption: 7faf53703fcc6d8294f75dd4121a70cf0fcfa337

Plan and implementation

Cloned full history, installed fleet authentication and identity hooks, and applied the original adoption with cherry-pick --no-commit so the finished candidate has exactly one commit and no premature product save. Installed the frozen lockfile, compared the source changes using both the installed and vendored edition-authoring tools, regenerated sources.lock.json through node_modules/@runeditrun/rer/edition-authoring/cli.mjs, and ran the source and portable contract checks plus typecheck. Prepared local state and probed the two documented CLI commands. Fetched main and rebased with autostash while still unpublished (main was unchanged), did a second clean frozen install under Node 22.20.0 and pnpm 10.12.4, restored main's contract files, staged all refreshed files, regenerated the source lock last and repeated the exact workflow checks. Committed once with fleet author/committer and no trailers, audited all candidate commits, and pushed the named cloud branch with the supplied guard. The exact-SHA Verify is the full test wall; it is watched by one REST watcher at 300-second intervals within the ten-call budget. Reports and receipts are published separately on the evidence ref.

Root cause

The original lock omitted src/modules/agent-door/policy-event.ts and src/modules/operator-auth/dev/invited.mjs even though the original commit contains both refreshed files. Installed rer 0.2.113 and the vendored authoring tool reported precisely these two added-file differences and no metadata differences. The original failure reproduced as pnpm source:check exit 1. Regenerating after both files are staged adds their actual hashes and resolves that failure; this is not a package/toolchain identity mismatch.

Scope and counts

The candidate contains the exact original adoption patch against its parent for every non-lock file, with sources.lock.json regenerated. There are 31 changed files, 473 insertions and 206 deletions. Package pin changes 0.2.107 -> 0.2.113, with the frozen pnpm lock matching. All 105 recorded Base copies point to c2efb501cbc148c2aee4d5e1107ebdba81469006. Source-lock file records change 2310 -> 2312. No test, product-copy or UI changes beyond the original refresh; no new tests or browser screenshots.

CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to origin/main. Clause changes: none. Full-target counts stay 23 done, 54 partial, 28 missing, 105 total (Core 23/45/19; Agent 0/9/9). No DONE, acceptance-point or claim lines are made by this round.

DIVERGENCE.md is absent from both current main and the original adoption. Preserved every explicit base-copies.json adaptation: .github/workflows/run-demo.yml, .github/workflows/run-site.yml, .github/workflows/verify.yml; src/modules/agent-door/{audit,pages,person-doors,reviews}.ts; and src/modules/erasure/{cascade.mjs,index.d.mts,index.mjs,order.mjs,verification.mjs}. These files are unchanged against main. Product-owned fonts and delivery policy are also unchanged. Main's newer tests and contract text are retained.

Validation

Both clean pnpm install --frozen-lockfile runs succeeded and installed rer 0.2.113. After the final clean install, the exact workflow source/portable step passed in full:

    pnpm run check -- --profile first-party
    pnpm source:check
    node src/base/contract-docs.mjs check
    node scripts/edition-authoring/cli.mjs verify-base --offline

pnpm typecheck passed. Contract prose has zero errors and zero warnings. The offline Base check proves local bytes against recorded SHA-256 values; it does not reread Base origin. No full local rer verify was run, as instructed. Setup succeeded with 99 migrations and stopped its temporary app. No browser was needed. No remote deployment or provider request was made.

CLI proof

    rer export --output exports/spool.rer
    Exported the local copy to exports/spool.rer (331 KB): 100 tables, 0 rows

    rer deploy --dry-run
    Would deploy:
      Worker: spool-production
      D1 database: spool-production-db (99 declared migrations)
      Secret inputs: 7 required, 1 optional
      Public settings: 3; scheduled triggers: 1

The deployment summary says the local dry run completed, no credentials were needed, no Cloudflare requests were made and nothing changed remotely. Machine output remains available with --json. Private setup logs, local owner entry, state and export archive are excluded from the packet.

An initial exploratory pnpm exec rer changes is unsupported and returned exit 4; the actual documented changes command is node .../edition-authoring/cli.mjs changes, whose complete JSON receipts are included. It made no product edit.

Custody and limits

The candidate was pushed successfully on the first guard attempt. No PR was required by repository rules: Verify accepts branch pushes. No merge commit, force push, main push or earlier-branch change occurred. Full publication scanning and landing remain with the fleet Mac as instructed. Evidence transport does not imply READY or landing. Exact-SHA CI results and terminal custody are recorded below after completion; the full REST receipt is CI-RECEIPT.json.

CI snapshot: Verify 43468399080 remained in progress on the exact product SHA at the ten-minute poll (3 GitHub calls). This interim evidence snapshot does not claim READY.
