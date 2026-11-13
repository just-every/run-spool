# gr-mt-spool-code-7 maintenance report

Repository: just-every/run-spool
Product branch: cloud/gr-mt-spool-code-7
Candidate: 493cca6e81f8ae86e6c85ba05f52c674453eb342

## Fix and behavior

CodeQL alert #18 identifies ambiguous repetition in scripts/delivery/base/native-export.mjs. The original repeated segment allowed its separator to be absent, so a long segment followed by an invalid character could be partitioned exponentially even inside the existing 256-character path bound. Each repeated segment now requires its slash; the final segment has its own character run. Separators cannot be consumed by the character class, so segment boundaries are unambiguous. Valid root, nested, trailing-slash, punctuation and maximum-length paths retain their behavior. Existing length, dot-segment, same-origin character and native binding restrictions remain in place.

Changed product files:

- scripts/delivery/base/native-export.mjs: remove ambiguous repetition.
- tests/native-export.mjs: exercise validateCandidateSpec in a bounded child using six accepted paths and nineteen rejected inputs, including a 256-character invalid near-match and a long multi-segment near-match.
- scripts/installer/verify.mjs: run this focused behavioral assertion script in existing Verify coverage.
- base-copies.json: record the intentional local adaptation through the repository's adapt-base command, retaining the original Base comparison identity.
- sources.lock.json: regenerate last with the documented lock command.

## Validation

Setup completed using cloud_run npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive. The meaningful final local checks used Node 22.20.0 and pnpm 10.12.4. No UI changed, so browser proof is inapplicable. No full local suite was run.

Passing local checks:

- cloud_run node tests/native-export.mjs
- cloud_run pnpm typecheck
- node scripts/edition-authoring/cli.mjs adapt-base scripts/delivery/base/native-export.mjs
- node scripts/edition-authoring/cli.mjs verify-base --offline: ok, no drift or unrecorded copies
- node scripts/edition-authoring/cli.mjs lock
- pnpm source:check: ok
- git diff --check

The same candidate-spec test against the original implementation in an isolated scratch directory failed as expected: its child exceeded the five-second timeout and was terminated. The fixed implementation passed. This is a regression demonstration, not a claim that a CodeQL server analysis has closed the alert.

Focused behavioral assertion scripts: 0 before, 1 after, with 25 table inputs covering one path-validation behavior. Existing registrations were neither deleted nor weakened. Contract counts remain 23 DONE, 54 PARTIAL, 28 MISSING, total 105. There are no clause text or status changes and no generated-view edits.

The only candidate commit has fleet author and committer identity and no trailers. Main was fetched and the unpublished branch rebased; it was already up to date. No default branch or PR was changed.

## Plan followed

1. Initialize fleet identity, refresh the launcher, install credential and commit hooks, and clone only the declared repository on its named cloud branch.
2. Inspect the validator and preserve accepted path behavior while removing ambiguous repetition.
3. Add focused behavioral regression coverage, run the touched checks and typecheck, record the Base adaptation, and regenerate the source lock last.
4. Commit with fleet identity, inspect every candidate identity and trailer, and require a complete passing Base publication scan before a product push.
5. Use the guarded named-branch push only after the publication gate passes; inspect exact-SHA Verify and CodeQL when publication and the GitHub request budget permit.
6. Retain complete reports and receipts outside the product tree, preserve a verified bundle, and publish explicitly selected evidence separately from product custody.

## Publication and custody

Base publication scan: COMPLETE/PASS, zero findings, on exact commit 493cca6e81f8ae86e6c85ba05f52c674453eb342 and tree d9d88b57a9805f2f262218fb5ed88879c2aaf548. The pinned @runeditrun/rer 0.2.107 scanner inspected 902 commit contexts and completed in 374.79 seconds. Its first 300-second attempt timed out; the successful supported extended-deadline attempt is retained with the first-attempt refusal. Gitleaks 8.30.1 was installed from its official release asset and its SHA-256 was verified against release metadata. All GitHub authentication used only the refreshed launcher bundle.

Product push and exact-SHA CI results are recorded below before evidence publication.

Product branch publication succeeded on the first guarded attempt. No PR was opened; the declared cloud branch is the fleet landing candidate. Exact-SHA Verify is pending its REST observation. The verified bundle receipt is included as independent recovery data; it is not a landing or readiness signal.

REST discovery found exact-SHA Verify run 43507787717 at https://github.com/just-every/run-spool/actions/runs/43507787717. It was in progress at the first observation; the watcher waits at least 300 seconds before the next request for that run. No CodeQL workflow run was advertised for this branch at discovery. Server-side alert closure must be reported separately from local proof and Verify.

The first CI watcher was interrupted by an environment handoff. It was confirmed defunct before a single replacement watcher resumed from the saved observation time. There were no overlapping REST watchers, no duplicate discovery, and the next status call came more than 300 seconds after the prior observation. Verify remained in progress after that request and the following permitted request.

Final result: Verify run 43507787717 completed with success on exact SHA 493cca6e81f8ae86e6c85ba05f52c674453eb342. Product branch custody is READY. There are no blocking findings. No PR was created, no main/default branch was pushed, and no contract clause changed.

The GitHub budget finished at 10 calls: three read-only Base source lookups, two official Gitleaks release lookups/downloads, one scanner visibility query, and four exact-SHA CI discovery/status calls. Every observation of the run was separated by at least 300 seconds. Server-side CodeQL alert #18 closure was not queried or claimed: only Verify appeared in branch discovery. Default follow-up is to confirm alert closure on the next CodeQL analysis after fleet landing.

Full recovery custody is in bundle-receipt.log. The pushed product checkout and dependencies will be removed after report transfer is verified, as required by the fleet clone-cleanup rule; the verified bundle and external result/report files remain. Evidence publication carries report files only and does not grant product acceptance or landing.
