# SDK-004 linear candidate

Author: Run Edit Run fleet. Date: 2026-11-16 UTC.

Product: just-every/run-spool, branch cloud/sd-spool-sdk004-4, head 3308d2c15143af65c448e8d8494fb052adbf459e. Base: current main e29a9f44ad44315d65b4e12d7f2e69b739f67233. Previous candidate: 0f6c5523e3b4974544a3f73883f9182295bee364. No PR created or required by the shipped Spool AGENTS.md. Only the named product branch was pushed, once, with the fleet guard. No main push, force push, merge, release, submission or Base refresh occurred.

## Result and counts

The complete 21-file SDK-004 feedback patch is reapplied in one ordinary commit from fresh main. Above current main, the old candidate has eight commits including two merges; this candidate has one commit and zero merges. Feedback flow counts stay three to three, and the erasure preview flow stays one to one relative to the previous candidate. No prior assertion was deleted, skipped or weakened. The unchanged CONTRACT.md judgment table stays 23 done, 48 partial and 21 missing. SDK-004 stays partial; no clause Status, Gap or Evidence cell was edited. ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to main.

## Full plan and implementation

1. Refreshed the fleet launcher, installed the decrypted-bundle Git helper and guarded push entrypoint, set the required fleet identity, and installed clone-local co-author cleanup hooks that preserve repository hooks.
2. Made the requested depth-1 blobless Spool clone and deepened by 100 to obtain fresh main, the old candidate and their merge base a037966cccf2f232e8c098d62607ba36cca7f777. Created the new branch from main and applied the net base-to-previous-candidate patch using Git's three-way patch application. The only conflict was generated sources.lock.json; restored main's copy, then regenerated it with node scripts/edition-authoring/cli.mjs lock after all source changes. No source conflict required a new judgment.
3. Compared every original changed file against the previous candidate and compared every whole-tree difference against newer main. Nineteen of the 21 original files are byte-identical to the previous candidate, including all feedback domain files, UI, tests, migration, authorization, portability and migration registration. The two remaining files are the combined erasure source and regenerated lock. Confirmed clean tracked tree, one ordinary commit and zero merges, inspected every candidate identity and message, then pushed using cloud-push.py.
4. Ran the exact focused feedback chain and current main's erasure preview against the built emitted app, plus typecheck, source lock check and contract check. Recorded feedback review at 1440 and 390 using /usr/bin/chromium and --no-sandbox. Ran the changed archive upgrade assertions and the touched browser SDK/repair archive consumers as additional focused checks. Detailed actual results and any pending checks appear in local-checks.json and the final CI receipt.
5. Discovered the exact-SHA Verify by REST, observing the ten-call budget and at least 300 seconds between calls for this run. No rerun or workflow dispatch. Product custody and report publication are recorded independently.
6. Saved this plan, actual receipts, tree comparison, diffs and selected synthetic screenshots in the packet. Explicitly selected non-secret ordinary files for the report-only evidence branch. The successful clone is removed only after transport verification; no credentials, environment dumps, private gate material or generated views enter product/evidence files.

## Every difference from the previous candidate

The exact comparison is newer-main.diff; machine-checked proof is tree-equivalence.json.

- docs/OWNER-ERASURE.md and docs/USER-IDENTITY.md exactly match newer main's corrected selective erasure, captured-text and retained-copy documentation.
- src/domain/identities/erasure-search.ts, erasure-text.ts, routes.ts and search.ts exactly match newer main's retained private identity lookup, raw/hash queries, captured-copy redaction and grouping safeguards.
- src/ui/workbench/EndUserErasurePreview.tsx exactly matches main's owner identity query/captured-text preview.
- tests/end-user-erasure-preview.mjs and tests/end-user-erasure-volume.mjs exactly match main's newer assertions. No new edits to these tests.
- src/domain/erasure/end-user.ts is byte-for-byte main plus the previous candidate's feedback-exception line. It keeps main's captured-text counts, issue/alert cleanup, search behavior and erasure statements, while saying truthfully that consented feedback contact/screenshots/replies remain until owner withdrawal.
- sources.lock.json was regenerated from those combined bytes. Its differences from the previous lock describe only the newer main files above and the combined erasure source.

The old merge had four manually resolved paths: docs/FEEDBACK.md and tests/feedback-flow.mjs now match that head byte for byte; src/domain/erasure/end-user.ts retains main's newer behavior plus exactly that head's feedback wording; sources.lock.json is regenerated and checked. All other old SDK-004 paths also match byte for byte.

## Validation and limits

Setup, build, typecheck, source:check, contract document check, feedbackFlow (which invokes privateFeedbackFlow and feedbackMailFlow), endUserErasurePreviewFlow and old-archive completed successfully on the committed candidate tree. Feedback proves consented contact and safe PNG custody, private member fences, review, mail-off states, network-edge accepted/rejected/uncertain/unconfigured delivery states, retry idempotency, restore and withdrawal. Erasure preview proves main's newer search/captured-text behavior remains intact, feedback stays an explicit exception for identity removal, exact attached reports cascade on event deletion, and restored archives retain the fence.

The first feedback invocation omitted the system browser override and stopped because the Playwright cache was absent. The corrected invocation with /usr/bin/chromium passed; no product fix was made. Local toolchain is Node v24.19.0 and pnpm 10.12.4 under the supplied toolchain script; branch Verify uses the repository's Node 22.20.0 pin. The additional Sentry SDK consumer completed successfully. The supplemental repair-recovery journey reached its archive reset/restore phase but exceeded the chosen local 600-second hard timeout (exit 124), with no assertion failure reported. It is not claimed as a local pass; branch Verify runs that consumer under its existing 25-minute shard budget. The cloud subreaper returned after all descendants stopped. No full local rer verify was run. Full publication scanning and landing remain with the Mac fleet as required by the cloud preamble. Synthetic fixtures only; no live provider account or hosted acceptance is claimed.

## Final CI and product custody

Verify run [43980547356](https://github.com/just-every/run-spool/actions/runs/43980547356) completed successfully on the exact candidate SHA 3308d2c15143af65c448e8d8494fb052adbf459e. Five GitHub calls were used: one exact-SHA discovery and four status polls, all at least 300 seconds apart. No rerun, dispatch or failed-log request. The normal full branch Verify is successful, including the existing archive recovery consumer; the supplemental local 600-second timeout remains recorded as incomplete local evidence. See ci-receipt.json and the raw status receipts.

Product publication succeeded on attempt one, and a separate Git ref probe advertised the exact SHA. No blockers remain for this candidate. The fleet owns publication scanning, final admission and landing. Evidence publication is a report transport only and never grants product acceptance. The clone is removed after the selected evidence files and remote advertisement have been verified.

CLAIM SDK-004 PARTIAL points=2,3,4 tests=tests/feedback-flow.mjs#feedbackFlow; tests/feedback-flow.mjs#privateFeedbackFlow; tests/feedback-flow.mjs#feedbackMailFlow
DEFAULT SDK-004: explicit consent, authorized team review, manual sending and audited actions.
GAP SDK-004: end-user widget/localization, unmodified attachment intake and selective-erasure integration remain incomplete.
