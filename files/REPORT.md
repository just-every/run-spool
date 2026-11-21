# Spool 0.7.17 release metadata

Run Edit Run fleet · 2026-11-21 UTC

## Source and plan

- Compare immutable tag `v0.7.16` (`804a4ad15e6c8e1c52f0069dcf610ba1f5d2342c`) with fresh `main` (`2681b8aa457a70c154e8012b6080c055c756a2cc`). Git reported six intervening commits. The tag probe found no `v0.7.17` ref, and the Release-by-tag endpoint returned HTTP 404 for that version.
- Read the actual Sentry mapping, portability, sign-in and egress documentation diffs. Use that evidence for one buyer-facing notes section shared by `CHANGELOG.md`, `RELEASE.md` and `RELEASE.json.publicReleaseNotes`. Retain the backup, update, hosted deployment, and empty-destination restore instructions and the existing screenshot link.
- Bump package, seed and release metadata to 0.7.17 with 0.7.16 as the previous version. Confirm the committed rer pin, compare migration blobs, regenerate the source lock last, and run the local metadata, contract and source checks plus typecheck.
- Push the single release commit to the named branch and wait for exact-SHA Verify. Check project-declared hashes from the remote-advertised product commit and transfer the report packet separately.

## Product candidate

- Repository `just-every/run-spool`
- Branch `cloud/sd-spool-release-0-7-17`
- Commit `f826abfa9a9cb4a30eaedd3ab9b219aac31aaa21`
- Parent `2681b8aa457a70c154e8012b6080c055c756a2cc`
- Product branch advertised the exact SHA after the guarded push at 2026-11-21T02:31:53Z. The PR lookup returned an empty list.
- Six changed files: `package.json`, `seed.json`, `RELEASE.json`, `RELEASE.md`, `CHANGELOG.md` and `sources.lock.json`. The existing pnpm lock has no root release version. The checkout has no tracked npm lock or VPAT declaration. The pinned rer validator requires neither a VPAT edit nor previous-version snapshots, and the immutable tag contains neither 0.7.16 snapshot path. Legacy release-history entries remain in place.
- Source dependency pin `@runeditrun/rer` changed between the previous tag and main from 0.2.118 through 0.2.125 to 0.2.126. The release commit carries the main pin verbatim. No Base refresh was run.
- The shipped screenshot is `.github/assets/release/spool-issue-page-1600.png`.

## Release notes basis

Native alert imports recognise numeric severity and reappeared issues, compare metric trigger recipients by meaning, preserve the crash-free interpretation and thresholds of Sentry's crash-rate alias, accept slash and wildcard query terms, recognise issue-owner recipients, and retain imported team labels. The representative synthetic export has eight native mappings out of ten. The crash-free rule waits for matching data. The two disabled rules are “Synthetic issue owners” because issue-owner recipients require native ownership rules, and “Synthetic unsupported condition” because `EventAttributeCondition` is unsupported. The public notes name both limitations. Live provider delivery and real-account migration remain unqualified.

The pinned rer adoption brings archive restore handling for supported migration histories and short-lived grants for explicit local persona links. Spool's egress and webhook guides now point to the operator steps at its bundled service revision.

## Inventory and clauses

| Inventory | v0.7.16 | Candidate |
| --- | ---: | ---: |
| Core migration SQL files | 108 | 108 |
| Full-target done | 23 | 23 |
| Full-target partial | 54 | 54 |
| Full-target missing | 28 | 28 |
| Full-target total | 105 | 105 |

Added migration paths: none. The complete recursive Git tree listings under `migrations/` matched byte for byte, including path, mode and blob ID for all 108 files. `RELEASE.json.migrations` is empty.

MIG-001 remains partial and the seed-fault S9 limitations remain open. No contract clause claimed; this is release metadata.

The packet includes the local check tails and the GitHub Verify receipt. The fleet runs the publication scan at landing. The branch is the metadata candidate for the release producer.

## GitHub Verify receipt

Run 44856405213 returned `completed/failure` for commit `f826abfa9a9cb4a30eaedd3ab9b219aac31aaa21` at 2026-11-21T02:52:20Z. [Verify run](https://github.com/just-every/run-spool/actions/runs/44856405213)

The `verify (runtime)` job (`136699932315`) failed in `pnpm test:runtime` with “Owner runtime journey failed; private runtime details withheld.” The SDK-020 documentation probe passed immediately before the reported failure. The log provided no underlying error code or source frame. `shards (spool)` (`136704806988`) and the aggregate `verify` job (`136704830434`) failed on that upstream result. `contract-docs` (`136699621561`) and `build` (`136699621612`) succeeded.

The local application build and the same owner runtime journey passed on the pushed commit with Node 22.20.0 and system Chromium. The release diff contains no changes to the runtime journey, application source, workflow, or dependency lock. The CI failure did not reproduce locally and its root cause remains undetermined. The pushed release metadata is blocked on successful exact-SHA Verify.
