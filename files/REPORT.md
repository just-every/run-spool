# Spool v0.7.8 metadata candidate

Candidate: cloud/sd-spool-release-0-7-8 at 422a43dd5d3a89848165a1ee7dcab9172820676c, based on main 3f87233fb50563262d694a13a9b7152f1aa76b51. Product push succeeded on the first attempt. Exact-head Verify 43217917813: completed / success, observed at 2026-11-12T12:46:36.959272+00:00. Terminal custody: READY.

## Plan and scope

The full execution plan is in PLAN.md. Establish fleet Git identity, bundle-backed credential helper and preserved hooks; shallow filtered clone only the declared repository; inspect current main, latest release and peer activity; derive honest notes from actual changes since the v0.7.7 tag; validate metadata and types, regenerate and check source lock last; fetch/rebase before first push; audit all new commit identities/messages/trailers; push only the named branch; await exact-head Verify with one budgeted REST watcher; publish this report-only packet separately; remove the successful scratch clone and dependencies.

Read the injected builder and release rules, launcher AGENTS.md, and seed AGENTS.md, CONTRACT.md and ACCEPTANCE.md. The cloud runtime skill supplied environment and package/network handling. No additional acceptance ruling was needed.

## Preconditions and changes

The clone initially observed main 3f87233fb50563262d694a13a9b7152f1aa76b51, newer than the brief's ae07f7a4. Successful exact-SHA Verify 43213436372 and Run site 43216560001 were recorded in main-ci.json. Other main workflow attempts were still in progress during that read; the successful evidence uses the same full SHA. v0.7.8 was absent from advertised tags and release branches, and from the listed GitHub Releases. No open release peer appeared in the open PR list. The existing latest non-draft release was Spool 0.7.7.

Compared actual tag v0.7.7 (26d13d4f574298851f25778818c1af0b9b2a2386) with main. Four commits add seven Settings sections, local invitation-link custody and honest mail boundaries, regenerate deployment integration, and correct empty native issue/capture-loss reporting. The changelog describes those user-facing effects, carries the existing known limits and adds the local ownership-verification boundary. It contains no contract IDs or internal verification promises.

Changed product paths: package.json, seed.json, CHANGELOG.md, RELEASE.json, README.md, docs/getting-started.md and sources.lock.json. The seed and getting-started files were existing version references and are within the lease. This is a pnpm repository with no package-lock.json; no new npm lock was fabricated. pnpm-lock.yaml and the exact @runeditrun/rer pin remain unchanged. The release record lists existing migration migrations/core/0105_local_invitation_links.sql, added on main after v0.7.7; this candidate adds no migration or product source.

Version 0.7.7 → 0.7.8; previousVersion 0.7.6 → 0.7.7. rer 0.2.107 → 0.2.107. Source-lock file entries 2295 → 2295; exactly six metadata entries changed. Core clauses remain 23 done / 45 partial / 19 missing (87); Agent surface 0 / 9 / 9 (18); all clauses 23 done / 54 partial / 28 missing (105). Tests added/deleted/modified: 0 / 0 / 0. Clause status changes: none. Contract, Gap, Evidence and generated view bytes were preserved.

## Checks and publication custody

- Frozen pnpm dependency install succeeded; the fleet hook was reinstalled afterward.
- cloud_run pnpm run check -- --profile first-party: exit 0.
- cloud_run pnpm typecheck: exit 0.
- node scripts/edition-authoring/cli.mjs lock: regenerated last after all metadata edits.
- node scripts/edition-authoring/cli.mjs check and pnpm source:check: exit 0.
- node src/base/contract-docs.mjs check: exit 0 with no view edits.
- Metadata consistency checks: pass (metadata-consistency.json). Notes equal the new changelog section; prior changelog content is intact; migration list equals actual additions since tag; package differs only by version; dependency pin and pnpm lock are unchanged; only leased paths differ.
- git diff --check: pass. Fetch/rebase before first push found the candidate up to date with origin/main. Clean committed tree.
- Every candidate commit, including side parents, audited using origin/main..HEAD: one commit, fleet author and committer, no trailers/co-author lines, no skip marker. cloud-push.py succeeded on its first attempt.

The required toolchain script selected local Node 24.19.0 and pnpm 10.12.4; the source declares Node 22.20.0, which remains the CI runtime. The local checks emitted an engine warning and passed. No local product tests, full local suite, setup/build/server, browser proof, tag, release, signing or publication scan was run. The guarded Mac lander retains full-history publication scanning, landing and final release custody. A metadata candidate is not a released product; later publication must obey the injected release rules and readback check. No PR was created; seed instructions do not require a PR for this candidate.

## Verification and evidence return

The watcher records exact-head CI discovery and readbacks in candidate-ci-*.json and verify-receipt.json. GitHub calls are recorded in github-calls.jsonl, with a ten-call ceiling and at least 300 seconds between observations of this candidate's run. Evidence goes only to refs/heads/evidence/sd-spool-release-0-7-8 and does not signal product landing or acceptance.

## Execution note

An initial auxiliary consistency check assumed a test-budget.json file existed; this repository has none. The check stopped on that assumption and was corrected to validate actual tracked files. The final consistency receipt passed on the committed SHA before push. No product correction was needed.

## Terminal result

READY branch=cloud/sd-spool-release-0-7-8 head=422a43dd5d3a89848165a1ee7dcab9172820676c

Verify run 43217917813: https://github.com/just-every/run-spool/actions/runs/43217917813 — completed / success on the exact full candidate SHA. REST calls used: 8 of 10. No workflow was dispatched or rerun.

The exact candidate Verify completed successfully. No product blocker remains for this metadata candidate. Guarded publication scanning, landing and later release publication remain with the fleet.

All seven changed metadata paths and their diff are in product-diff-stat.txt and product.patch. The final source lock contains only the six corresponding changed metadata entries, with its file set unchanged. No clause status change or acceptance claim is made. Evidence transport is a separate report-only ref and does not land product code. The successful scratch clone and dependencies will be deleted after evidence publication and remote readback; the complete packet stays outside the clone.
