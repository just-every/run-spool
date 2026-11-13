# sd-spool-restore-validation-1

Repository: just-every/run-spool. Branch: cloud/sd-spool-restore-validation-1.

## Result and scope

The synthetic ordinary post-erasure restore failure is reproduced and repaired. Staged product validation now validates erasure receipts and removes anonymized audit facts from the validation projection before execution and repair validators require the erased original records. The imported rows themselves remain unchanged. A small allowlist converts fixed erasure/execution/repair/alert validation diagnostics to typed PortabilityError refusals; existing typed errors pass through unchanged, and arbitrary native or JSON messages are never promoted to error codes.

Only src/domain/portability.ts and its sources.lock.json digest change. No UI path, Base copy, authority policy, archive format, contract judgment, generated acceptance view, permanent pin test or provider behavior changes.

## Evidence and limitations

The original stranger archive was deleted. The one-off reproduction uses comparable synthetic records through the emitted Worker's real owner HTTP project creation, intake, reproducer, repair, export, typed erasure, continuation and independent restore doors. Both runs create two projects, two reproducers and two repairs; erasure leaves one of each, one completed erasure receipt and one anonymized reproducer audit row. Before the fix, the valid post-erasure archive returns HTTP 400 Invalid execution archive. After the fix, the same scenario returns HTTP 200 and every retained domain row compares equal. This is the same scenario with new generated fixture identifiers and timestamps, not a replay of the deleted original archive bytes.

Baseline main already exposes Invalid execution archive at the HTTP boundary; the historical archive_operation_failed string was not reproduced on this baseline. The invalid-receipt probe demonstrates diagnostic ordering: before, Invalid execution archive masks it; after, Archive erasure in progress identifies the actual refusal. The fixed-message allowlist makes these deterministic diagnostics typed without trusting arbitrary input messages.

The final one-off replay also proves semantic execution tampering is rejected, the erasure receipt cannot be in progress, part checksum corruption is rejected, all rejected imports leave the destination empty, old pre-erasure archives are refused by both the source and a fresh destination that has imported its post-erasure archive, and a populated target returns 409 target_not_empty:alerts. Credentials, sessions, run tokens, leases, destinations and dispatch queues remain absent from restored archives.

The initial after-run already restored and compared the rows, but its one-off assertion incorrectly expected the nonempty-target code without the existing :alerts suffix. That expectation was corrected to the exact observed 409 target_not_empty:alerts. The failed attempt remains in after-first-attempt-receipt.json. The baseline tamper probe added an unexpected part field and returned part_order; the final probe corrupts the sha256 field and returns part_checksum. Both reproduction scripts are retained so this distinction is explicit. Neither change affects the reproduced valid post-erasure restore scenario.

## Plan and validation

PLAN.md contains the full seven-step plan. The launcher and repository rules, ERR-009, ERASE-001, archive validators and existing erasure fences were read first. Fleet credentials and identity were configured before product clone/network use, hooks remained active, the clone was shallow and filtered, and dependency/setup commands used the required cloud toolchain and subreaper. Direct local commands used Node 24.19.0 and pnpm 10.12.4; rer itself provisioned the repository's Node 22.20.0. The actual model and reasoning effort are not independently exposed by the runtime; the brief requested gpt-6.1-sol/high.

The starting main was 0f9809608a4ba84b23f4f8ece165605fcdd1acba. Updated main ca62aee25af1dbbb665d0040151a1150fcc10946 was fast-forwarded into this still-unpublished product branch, preserving its integration-prerequisite work. The touched validator and contract text were unchanged by that update. There was no rebase, force push, default-branch push, dispatch, rerun, release, deploy, production action or PR bypass.

Completed local checks: public rer setup, baseline and candidate rer builds, before and after one-off public-door reproduction, pnpm typecheck, node scripts/edition-authoring/cli.mjs lock, pnpm source:check and node src/base/contract-docs.mjs check. The documented node src/base/contract-docs.mjs write and check were also run, the two generated views were restored whole from origin/main, and source lock/check were run last again. The resulting product tree still exactly matched the already-pushed HEAD. Source lock was generated after the final source edit. Contract documents are current with zero errors and warnings. Exact command receipts and log hashes are in local-checks-receipt.json.

The existing tests/project-erasure.mjs enclosing journey passed seven groups, all 19 authority/refusal probes, and eight browser captures at 1440/390 using /usr/bin/chromium with --no-sandbox. Its database scan covered 279 tables: 34 canary matches before erasure and zero afterwards. It retained 20 anonymized audit rows and proved HTTP/CLI epoch, child-row and later-journal fences, successful post-erasure CLI import and the documented brand-new-store limit. Browser and temporary checkout cleanup completed. project-erasure-receipt.json, project-erasure.log and screens/ retain the actual evidence. Exact-SHA CI results are recorded below.

## Clause boundaries

ERR-009 remains published/done -> published/done in CONTRACT.md. ERASE-001 remains published/done -> published/done. Contract, generated-view and summary counts are unchanged (23 done, 54 partial, 28 missing before and after); this repair makes no clause promotion, gap edit or DONE claim. The task's incremental evidence is PARTIAL: ERR-009 acceptance 2, 4 and 6's synthetic restore/refusal slices, plus ERASE-001's already-existing public erasure/fence journey. Original stranger bytes, real-account/provider acceptance, all broader clause obligations and the Mac publication/landing gates remain outside this evidence.

## Publication

Product commit: 378f4890b480884275441b4147da12483df9658b. The named branch was pushed successfully on the first guarded attempt, and git ls-remote confirmed that exact remote head. Every candidate author/committer is Run Edit Run fleet <fleet@runeditrun.com>; there is one candidate commit, no side-parent candidate and no trailer. Verify run 43393388729 completed/success on that exact SHA: https://github.com/just-every/run-spool/actions/runs/43393388729. The watcher used five GitHub REST calls with at least 300 seconds between calls, and dispatched or reran nothing. There were no failing CI runs or checks and no generated-view exception was needed. No PR was required by the repository instructions and none was created.

The complete explicitly selected packet is published only to refs/heads/evidence/sd-spool-restore-validation-1 using the task-side report transport. The evidence commit is reported in the terminal EVIDENCE line; it is separate from product READY, independent acceptance and landing. The owned product clone is deleted after evidence publication and remote-ref verification; the terminal final message reports that cleanup. No landing or default-branch push occurred. There are no remaining product blockers. The original archive and actual model/effort observability limitations remain as stated above.
