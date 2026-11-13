# Spool v0.7.11 release metadata preflight

Observed: 2026-11-13T22:47:06Z
Repository: just-every/run-spool
Requested branch: cloud/sd-spool-release-0-7-11
Checkout/main head: 4c14f5433cc7885a486db254549079d36443c37a
Disposition: BLOCKED before editing because current main has a later failed exact-SHA Verify.

## Plan and execution

1. Configure the fleet identity, run the launcher refresh, install the decrypted-bundle Git helper, preserve repository hooks, and clone the declared repository shallow with blob filtering. Completed. The named branch was created locally from origin/main.
2. Read the inline builder and release rules plus the seed AGENTS.md; inspect main, published releases, release ownership, actual metadata, and changes after v0.7.10 before editing. Completed. The latest non-draft Release is v0.7.10, published 2026-11-13T21:16:22Z. No v0.7.11 Release, tag, or matching product branch was observed. An old draft v0.7.0 exists and was left alone.
3. If current main is green and no peer owns this release, update existing application version references to 0.7.11, write honest user-visible notes from the actual landed changes, preserve the exact rer pin, and regenerate sources.lock.json last. NOT RUN: the brief explicitly says to report a blocker if main is red. No metadata or lock files were edited.
4. Run affected metadata checks and typecheck only, refresh/rebase onto main before the first push, audit all new commit identities/trailers, and push the named product branch with the fleet guard. NOT RUN: no product candidate exists. No dependencies, setup, build, tests, tags, PR, deploy, workflow dispatch, rerun, publication scan, or product push were performed.
5. Preserve the actual report, preflight receipt and relevant non-secret evidence on the separate evidence ref. This packet is the report-only return; its publication never signals product READY, release acceptance, tagging, or landing. Delete the scratch clone after evidence readback.

## Exact-main CI evidence and blocker

All runs below are on 4c14f5433cc7885a486db254549079d36443c37a.

- Earlier Verify 43513594861: completed/success, as stated in the brief. https://github.com/just-every/run-spool/actions/runs/43513594861
- Later Verify 43519208086: completed/failure. https://github.com/just-every/run-spool/actions/runs/43519208086
- Run site 43519208061: completed/success. https://github.com/just-every/run-spool/actions/runs/43519208061
- Root failed job 132209451995, runtime (ruby), step Run ruby SDK journey: `tests/sdk-runtimes.mjs:41` raises `AssertionError [ERR_ASSERTION]: ruby: Spool outcomes reconcile with SDK-sent items`.
- The observed outcome adds client-discarded network_error rows absent from the expected result: error=1, log_byte=518, log_item=1, monitor=1. The log does not establish whether the underlying cause is a transport flake or a product defect. This metadata lease cannot alter runtime code or assertions, and explicitly forbids rerunning CI.
- The failed shards (spool) job 132216969096 and final verify job 132217024904 propagate the failed runtime partition. Build and the contract-source check succeeded; this is not the allowed generated-view-only failure exception.

One completed-job archive read was made, successfully:
`gh run view 43519208086 --repo just-every/run-spool --job 132209451995 --log-failed`

The packet includes the actual assertion output from that archive, excluding its environment preamble. Four GitHub CLI calls were used: releases, exact-main run discovery, failed-run jobs, and this failed-job log. No polling, retries, or workflow mutations were needed.

## Actual metadata and main changes

- package.json version: 0.7.10 -> 0.7.10 (requested 0.7.11 not prepared).
- RELEASE.json version: 0.7.10 -> 0.7.10; previousVersion remains 0.7.9.
- Exact @runeditrun/rer source pin read from package.json: 0.2.113, unchanged. Existing 0.7.10 release prose still mentions 0.2.107; a future 0.7.11 section must use the actual current pin, while preserving historical entries.
- package-lock.json is absent. This repository uses pnpm-lock.yaml. No new lock format was introduced.
- CHANGELOG.md, RELEASE.json, package.json, pnpm-lock.yaml and sources.lock.json are unchanged. Exact modified metadata paths: none.
- Main has two commits after v0.7.10: 169e4cb (rer 0.2.113/Base adoption and repaired guide links) and 4c14f54 (native export path validation with mandatory separators, removing ambiguous repetition). The latter is the actual landed regex alert18 fix requested by the brief; it remains intact. No old template notes were copied and no public release notes were fabricated.
- Product commits: 0. Product pushes: 0. PR: none.

## Counts and follow-up

Full target before/after: 23 done, 54 partial, 28 missing, 105 total. Core before/after: 23 done, 45 partial, 19 missing, 87 total. Agent surface before/after: 0 done, 9 partial, 9 missing, 18 total. These are the existing generated progress counts, unchanged; this metadata task makes no new acceptance claim. Clause status changes: none. Contract/generated views, homepage, source, tests and all newer main assertions remain untouched.

The lane must resolve the main Ruby Verify failure or provide an explicit ruling before this metadata round resumes. Then prepare v0.7.11, regenerate the source lock last, run the scoped checks and exact-candidate Verify, and hand the candidate to the fleet. The release lock requires lane routing; no manual queue records were changed here. Immutable tagging, signing, producer qualification, non-draft GitHub Release publication, screenshot/envelope verification and check-gh-release.sh remain later authorized work. No RELEASED claim is made.

BLOCKED current main 4c14f5433cc7885a486db254549079d36443c37a has failed Verify 43519208086, Ruby job 132209451995; no product candidate was edited or pushed.
