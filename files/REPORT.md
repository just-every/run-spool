# sd-spool-c-f119-fix1

Repository: just-every/run-spool. Product branch: cloud/sd-spool-c-f119-fix1.

## Plan

The complete original six-step plan is retained in PLAN.md: fleet setup and full-history clone; reproduce replay and main; preserve main and repair the candidate fixture; run all three requested probes and source/contract mechanics; audit and guarded push; exact-SHA Verify and separate evidence transfer, followed by successful clone cleanup.

## Reproduction and cause

REPRO sentry-cli denials: head -> FAIL exit=1, `2 !== 1` at tests/sentry-cli/denials.mjs:79; main -> PASS exit=0.

Required and observed replay: 0f03986b7347b4c125218baa203c777cd6e03e7f. Fresh main: 0ac17384fa3edb3d4f782e9f4f8ece1963ffe8ef. Clone used `git clone --filter=blob:none`, without a depth limit; Git reported is-shallow-repository=false. Fresh main was fetched and merged; it was already an ancestor. The two whole-suite reproductions preceded the fix.

The replay adds fieldRefusalFlow before debugFlow. fieldRefusalFlow deliberately stages a deploy-authorized synthetic control chunk, snapshots it for all refusal/nonmutation checks, and originally never consumes it. populatedDenialFlow then adds its own genuine staged source-map bundle. Its first map was already assembled, so the surviving control plus its second map total two. The failure happens before its denied requests run. No denied request creates staging, and no product authorization handler regressed. The code comparison, exact control checksum and full reasoning are retained in DIAGNOSIS.md and repro-head.receipt.json.

## Fix and preserved requirements

Only the leased field-refusal helper gains behavior: save the original staged rows, assert exactly one control chunk is added, retain every existing refusal assertion, then consume only that checksum through deploy-authorized artifactbundle assembly. The deliberately non-ZIP bytes receive HTTP 200/error with [malformed_bundle], and the helper proves original staging, product rows, actors, artifacts and builds are preserved. Both field-refusal invocations remain. Assertion-line inventory increased from 23 to 31, with zero original assertion lines removed or changed; denials.mjs and debug-flow.mjs remain byte-identical to main and the required replay.

Main's newer contract status prose dropped by the rejected replay was restored whole. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md in the final tree are byte-identical to fresh main. The views were taken whole from main after generator write/check; there are no newly authored generated-view edits. All acceptance requirements, clause rows, ID-MAP and unrelated tests are preserved. The net diff against main is the replay's extra field-refusal invocation, the helper cleanup/assertions, and the regenerated source lock.

## Mechanical checks

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; lock-check=pnpm source:check exit=0; views=node src/base/contract-docs.mjs write && node src/base/contract-docs.mjs check exit=0.

Source lock was generated last, after restoring both views from main. mechanical.receipt.json preserves actual command output and exit codes. No touched-clause argument is documented by AGENTS.md. First-party rer check and typecheck both pass. Builds of the replay, main and fixed candidate all exit 0.

## Probes

PROBE API-002: both release-create aliases, release update/finalization and deployment creation with unsupported top-level string, null, false and long-name fields -> HTTP 400, bounded endpoint/field errors, exactly one safe refusal audit fact and unchanged populated product/upload state. Ingest, read-only, revoked, unknown and foreign-project grants still fail before validation. Repository refs and unsupported endpoints return named 501s.

PROBE API-002: fourteen read-only mutation calls (seven doors with bearer-only authority, repeated with owner cookie and Origin) -> HTTP 403 and unchanged releases, deploys, artifacts, receipts and staged chunks; subsequent permitted genuine-map assembly succeeds and consumes its single surviving chunk. Fixed whole sentry-cli suite exits 0, including CLI/plugins, interruptions/retries, archive/restore and erasure. Both new permitted fixture cleanups pass.

The first Sentry HTTP attempt reached its reporting browser step and failed because that legacy test launches Playwright's missing default Chromium binary directly. An external Node preload (browser-launch-adapter.mjs, outside the product repository) forces /usr/bin/chromium and --no-sandbox. No test is changed or skipped. The complete Sentry HTTP rerun passed with exit 0, including its browser, restore, erasure and per-key quota flows. The actual first failure and successful rerun are both retained. The suite refreshed twenty tracked TEAM-004 screenshots; those incidental outputs were restored from HEAD before the final source lock, so none enter the product commit.

Local cloud toolchain follows the supplied script: Node v24.19.0 (the newer installed VM runtime is retained by that script), pnpm 10.12.4. Exact-SHA Verify uses the repository's pinned Node 22.20.0.

## Clause status and counts

API-002 remains partial. No clause judgment or acceptance text changes. Before -> after: 22 done -> 22 done; 52 partial -> 52 partial; 31 missing -> 31 missing; 105 total -> 105 total. The complete identical API-002 rows and totals are retained in clause-status.receipt.json.

## Publication and custody

Product branch: cloud/sd-spool-c-f119-fix1.
Product head: d1dbf1d6aed5ab7c8cec48df036e0571e07a5156.

The final candidate was committed with explicit Run Edit Run fleet author and committer identity, active preserving hooks and no AI co-author trailers. All five candidate commits, including side parents, passed the identity/message audit. One guarded product push succeeded on its first attempt, without [skip ci]. The remote advertised that exact SHA. The worktree is clean. Fresh main was fetched and merged after publication; it was already an ancestor, so no published history was rewritten. Product custody is retained independently in product.receipt.json and remote-product-custody.receipt.json.

Exact-SHA Verify 42483680243 completed with conclusion success on d1dbf1d6aed5ab7c8cec48df036e0571e07a5156. URL: https://github.com/just-every/run-spool/actions/runs/42483680243. The single REST watcher used seven of ten calls, spaced at least 300 seconds apart, including discovery. No generated-view or Electron exemption was needed; no failed workflow assertion or blocked log transport remains. Actual observations and call timestamps are in ci-watch.receipt.json and ci-call-01.json through ci-call-07.json.

No clause status was raised, no PR was created, and no default branch, other repository or provider account was changed. Blockers: none. No landing or independent acceptance claim is made. Evidence publication is a separate report-only transport to evidence/sd-spool-c-f119-fix1; it is not product READY or landing.

The complete packet is retained at /home/agent/rer-consolidation/work/sd-spool-c-f119-fix1/packet. The successful clone and node_modules will be deleted as the final tool action after evidence publication and remote-ref verification succeed. The final message records the actual evidence ref/head and completion of that cleanup.
