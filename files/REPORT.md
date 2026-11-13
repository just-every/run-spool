# Spool v0.7.10 release metadata candidate

Recorded 2026-11-13T13:44:24Z. Repository: just-every/run-spool. Role: builder. Branch: cloud/sd-spool-release-0-7-10. Candidate: cc0a05ec50d235f457e03dc5f0be0efa6e413b31. No PR created; seed AGENTS.md declares no PR landing requirement for this metadata round.

## Plan and scope

The complete execution plan is in PLAN.md. Refresh fleet authentication, use a fresh shallow filtered clone, establish green main and release ownership, compare v0.7.9 to main, update only current release metadata/references, validate metadata and types, regenerate source lock last, refresh/rebase unpublished work, inspect identities, push the named branch once, watch its exact-SHA Verify within the shared API budget, publish this packet on the separate evidence ref, then delete the clone.

## Starting evidence and ownership

Main remained 30cc17837e934cc821948e34a694ca2b5d0ec0c7 through the final fetch and rebase. Exact-main Verify 43431620313 and Run site 43431620024 were completed/success. Latest public Release is Spool 0.7.9, https://github.com/just-every/run-spool/releases/tag/v0.7.9, published 2026-11-13T12:35:45Z. Its tag resolves to 8049c9153f1d987bba6211bc05b8405b06101a6f. There is one later source commit, 30cc178, “Clarify local ownership transfer and pending invitation recovery.” No v0.7.10 tag, matching release branch or open release PR was observed initially. A Release-list read also found no draft or published v0.7.10. The source receipts are latest-release.json, main-ci.json, open-prs.json and target-release-check.json.

## Product metadata result

Application version: 0.7.9 → 0.7.10; previousVersion: 0.7.8 → 0.7.9. Actual source pin read from package.json: @runeditrun/rer = 0.2.107, unchanged. No borrowed runtime pin or bundle location.

Changed paths, exactly:

- package.json: application version only.
- seed.json: existing application version only; IDs and capabilities preserved.
- CHANGELOG.md: new 0.7.10 section dated with date -u; all earlier sections preserved byte-for-byte.
- RELEASE.json: version, previousVersion, update guidance and public notes matching the new changelog section exactly.
- README.md: existing release-version references only.
- docs/getting-started.md: existing release-version references only.
- sources.lock.json: regenerated last with the documented lock command, then checked.

There is no package-lock.json in this pnpm repository; none was introduced. pnpm-lock.yaml and the SDK/package versions are unchanged. Diff: 7 files, 41 insertions and 16 deletions. No product source, tests, homepage, contract source/status/evidence or generated view was edited. The notes describe local-access confirmation guidance for ownership transfer and the remove/reinvite recovery steps for pending invitations with no saved link. They do not claim a new verification mechanism, real-provider delivery or new feature acceptance.

## Validation and publication custody

- pnpm install --frozen-lockfile: exit 0, existing pnpm 10.12.4 lock honored.
- pnpm run check -- --profile first-party: exit 0; metadata-check.log.
- pnpm typecheck: exit 0; typecheck.log.
- Metadata consistency review: package/seed/release version agreement, matching release/changelog notes, prior changelog preserved and no changes outside the metadata lease; metadata-receipt.json.
- node scripts/edition-authoring/cli.mjs lock followed by pnpm source:check: both exit 0; source-lock-receipt.json. Lock tracks 2306 files.
- git diff --check: exit 0.
- The pinned rer release inspectSource validator accepted the clean committed candidate, matching package.json, seed.json and RELEASE.json; release-source-check.json. This only inspected source and created no tag or artifact.
- Fresh git fetch origin main and identity-prefixed git rebase origin/main: branch already current. No history was rewritten after push.
- All candidate commits, including possible side parents, inspected with the required origin/main..HEAD log. Sole candidate author and committer are Run Edit Run fleet <fleet@runeditrun.com>; no trailers; candidate-messages.txt, commit-identities.txt and prepush-receipt.json. Fleet commit hooks remained active and preserved repository hooks.
- Product push succeeded on first guard attempt, once, to cloud/sd-spool-release-0-7-10; product-push.log and product-receipt.json. Main, default branches and tags were not pushed. No self-submit, signing, producer, Release publication, CI dispatch/rerun or deployment was performed.
- Local validation used the toolchain script's selected Node v24.19.0 and pnpm 10.12.4. It printed the existing Node 22.20.0 engine warning; typecheck passed. Branch CI declares Node 22.20.0.
- Full-history publication scanning and guarded landing belong to the fleet's existing lander and were not claimed here.

## Counts and clause changes

Before and after: Core 23 done / 45 partial / 19 missing (87 total); Agent surface 0 done / 9 partial / 9 missing (18 total); Full target 23 done / 54 partial / 28 missing (105 total). No clause status changes, no target clause claims and no new acceptance judgments. Test registrations added: 0; removed: 0. No tests were deleted, skipped or weakened, and no new tests or full local suite were run for this version-only round.

## Follow-up debts and boundaries

The existing known limits remain in the new release notes: no local email verification; browser restore size/refusal limits; six-answer owner policy plus checkout-only agent CLI; existing owner-erasure matching caveat; setup redirect for an unknown first-project URL; separate hosted archive qualification and restore lease; bounded imports and unqualified real-account migration/live mail. The local transfer wording now distinguishes a gated local owner session from other sessions. This round does not judge or resolve those debts.

The candidate is metadata preparation. The authorized producer, immutable tag, signing, GitHub Release publication/readback and check-gh-release.sh exit 0 remain later fleet work. No RELEASED claim is made. The metadata notes contain no internal clause IDs. A pending feature/installer/demo/stranger gate is not a blocker for this path-seed metadata round.

## Additional custody receipts

remote-product-ref.txt independently reads back the product branch at the recorded candidate SHA. release-delta.txt records the actual sole source commit since v0.7.9. dependency-cleanup-receipt.json records removal of the root and agent workspace dependency directories after local validation. The clean product clone is retained only for the evidence transport and is scheduled for deletion after that succeeds.

## Final exact-SHA CI observation and handoff

Receipt sealed 2026-11-13T13:58:57Z. Verify run 43435974422: https://github.com/just-every/run-spool/actions/runs/43435974422. Its head_sha is exactly cc0a05ec50d235f457e03dc5f0be0efa6e413b31; observed at 2026-11-13T13:58:21Z, status in_progress, conclusion pending. The one watcher used 8 GitHub calls in total, including four initial release/main/ownership reads. Candidate discovery and follow-up polls are recorded in github-call-ledger.json and branch-ci-*.json; every follow-up was at least 300 seconds after the previous response. No other watcher, CI dispatch or rerun was used.

Verify is still running after the final scheduled observation. The watcher stopped at eight of ten calls, preserving two calls for a failed-job query/log if a failure had completed. Candidate custody is PUSHED, not a green-CI claim. No real blocker has been observed; pending CI is the outstanding step. The fleet can continue observing the exact run and apply the existing landing gates.

PUSHED branch=cloud/sd-spool-release-0-7-10 head=cc0a05ec50d235f457e03dc5f0be0efa6e413b31
