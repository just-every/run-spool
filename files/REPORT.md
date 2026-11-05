# sd-spool-regeneration-fix-1: no current seed defect reproduced

Repository: just-every/run-spool
Inspected main and terminal checkout SHA: ae15d7004a5ccdc44be7a455454f51a86c026eea
Local branch: cloud/sd-spool-regeneration-fix-1
Disposition: BLOCKED / unreproduced against current declaration; no repair candidate, product commit, product push or PR.

## Plan and execution

1. Set fleet Git identity, read and refresh the provided fleet launcher, install the required bundle-reading Git helper, push guard and co-author hook, and clone only the declared seed with --depth 1 --filter=blob:none.
2. Read current AGENTS.md and inspect the contract generator argument parser, edition-authoring lock/check implementation and tracked source reader before any source edit. Inspect the archive script named by the historical refusal: it does not exist in current main, and no current Lander-Regenerate declaration invokes it.
3. Execute the exact current declarations from the checkout root, capture their complete stdout/stderr and exit codes, and check their generated contract and source lock outputs.
4. Execute the exact command quoted in the recorded refusal separately to identify the remaining mismatch. Re-run current generation and its check, restore both generated views from origin/main, regenerate the source lock LAST and run its check. Preserve all source, history and ledger files and all clause judgments.
5. Since the current declared procedure passes unchanged, follow the brief's no-op prohibition: make no repair commit and do not push a product branch, manufacture a CI candidate, replay the original adoption, release holds or self-submit. Publish only this complete report/receipt packet to the task's evidence ref, then delete the clean disposable clone.

## PROBE: metadata-regeneration input -> actual output

Working directory for all commands: /workspace/sd-spool-regeneration-fix-1.
Toolchain established by the supplied cloud script: Node v24.19.0, pnpm 10.12.4. The script accepts this existing Node as newer than the 22.20.0 repository pin. No application setup, provider work or browser was required.

Current AGENTS.md lines 49-50 declare:

    Lander-Regenerate: node src/base/contract-docs.mjs write
    Lander-Regenerate: node scripts/edition-authoring/cli.mjs lock

Exact ordered declared procedure:

    node src/base/contract-docs.mjs write; node scripts/edition-authoring/cli.mjs lock

Exit 0; contract phase printed `Wrote 0 contract documents.`; lock phase printed the actual complete source lock JSON. Stderr is empty. Because a semicolon alone does not prove the first command's exit, contract generation was also run separately: exit 0, same output, empty stderr. No shell-success masking or fallback was added.

    node src/base/contract-docs.mjs check

Exit 0; `Contract documents are current.`; empty stderr. This runs prose checks and generated content comparison.

    pnpm source:check

Exit 0; the repository lock checker returned `ok: true` and its full current source-lock result; empty stderr.

The command recorded in the 21:18Z refusal is different from the current declaration:

    node src/base/contract-docs.mjs write; node scripts/archive-history.mjs

Exit 1. First phase printed `Wrote 0 contract documents.`; second phase reports `Error: Cannot find module '/workspace/sd-spool-regeneration-fix-1/scripts/archive-history.mjs'`, code MODULE_NOT_FOUND. Complete actual stderr is in 04-recorded-refusal-command.stderr.txt. There is no script to inspect or repair in this main, so creating one or deleting/replacing a purported archival duty would be an invented fix.

## MECHANICAL: views, lock and history/ledger

Initial procedure plus checks left the entire checkout clean. Generated CONTRACT.md, ACCEPTANCE.md, docs/CLAIMS.md, CHANGELOG.md, sources.lock.json, COVERAGE.json and ID-MAP.json hashes were unchanged (probe-initial.json records individual hashes).

Final sequence was generation -> generated check -> `git checkout origin/main -- ACCEPTANCE.md docs/CLAIMS.md` -> `node scripts/edition-authoring/cli.mjs lock` LAST -> `pnpm source:check`. Every step exited 0; complete output/exit receipts are retained. Both generated views match main. No source, archive, ledger, evidence or other tracked file was archived, deleted or edited. Current declarations specify no separate history archive output. Existing tracked history/ledger inventory and hashes are in RECEIPT.json; they remain unchanged. No required history operation was removed by this task.

Before -> after contract counts: Published 9 done / 3 partial / 0 missing / 12 total; target and push further 13 / 44 / 36 / 93; all 22 / 47 / 36 / 105. Acceptance tiers remain Core 22 / 44 / 21 / 87, Agent surface 0 / 3 / 15 / 18, Later 0 / 0 / 0 / 0. Clause status changes: none. Test registration delta: 0. Changed product files: none. No runtime code changed; no permanent test, typecheck, full suite, build, application setup or browser proof was applicable.

## Remaining integration dependency and custody

The precise remaining dependency is reconciliation, by the existing independent fleet/lane owner, between the recorded attempted metadata command (which names a missing archive script) and Spool's current main declarations. Discovery against this SHA must use the actual two declarations; if the integration still requires a history archival phase beyond them, its repository-owned inputs and actual required archive outputs must be supplied or established before a seed repair can be justified. This task cannot identify an implementation defect in unavailable fleet tooling and makes no claim to have fixed that tooling. No fleet code was edited beyond installation of the task-provided entrypoints. The original adoption source 75253e594bb691ac15d2d4172bc25e3844f6883d and its source/chain holds remain untouched; no retry or replay occurred.

Product branch custody: local branch at inspected main; zero candidate commits; no product push. No product push was rejected and no unpublished repair exists to bundle. Product publication scan and exact-SHA candidate Verify: not applicable because there is no candidate. The Mac lander retains responsibility for its COMPLETE full-history scan, regenerated final exact-SHA Verify, guarded landing and exact Run site; this report is neither READY nor acceptance. Task CI run IDs: none. Historical Verify 41833857598 is cited only from the brief and was not rechecked or retried. GitHub REST calls used: 0. PR: none.

The full actual non-secret packet is selected explicitly for report-only evidence publication, under refs/heads/evidence/sd-spool-regeneration-fix-1 only. Evidence publication is separate from product readiness. No secrets, environment dumps, held-out material or symlinks are selected. No application/server/browser process was started; no node_modules directory was created. The clean clone is removed after successful report publication.
