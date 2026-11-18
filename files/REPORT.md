# Spool local setup and restart proof

## Plan and implementation

1. Verify the previous setup round at `6cfacc486d86a89e8188024951d3ba4c22383e4c` and replay it in a single linear candidate on the latest Spool main. Preserve main’s Sentry roster import and updated test-error flow in the overlapping files.
2. Reproduce the old repair-recovery fixture through the built application’s archive endpoints. Select migrations by numeric prefix in both manifest lists. Remove the member-identity trigger and capture-sources objects from the historical schema inventory. Keep the original restore and foreign-object assertions.
3. Run the previous installer guard against the real setup form to reproduce the restart refusal. Record the stable operator ID and matching configured email from a valid local setup, then use that record when the same active owner changes email. Refuse a different owner or a different configured identity. Keep the record under `.rer/local`, which the existing local reset removes. Prove both email-change paths and a real owner handoff through Spool and the public CLI.
4. Validate deployment-spec generation, the setup digest, the producer workflow, the contract and its generated views, and regenerate the source lock after other generation. Run the Verify build steps and the touched archive, product and browser journeys. Capture Setup, Members, General settings and Capture at widths 1440 and 390.
5. Check fresh main and migration numbering immediately before publication. Audit the candidate ancestry, identities and trailers. Push the product branch once, poll its exact-SHA Verify, and publish the report packet on the evidence ref.

## Contract status

| Scope | Done before → after | Partial before → after | Missing before → after |
| --- | ---: | ---: | ---: |
| Core | 23 → 23 | 45 → 45 | 19 → 19 |
| Agent surface | 0 → 0 | 9 → 9 | 9 → 9 |
| Full target | 23 → 23 | 54 → 54 | 28 → 28 |

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).

## Initial candidate

- Repository `just-every/run-spool`, branch `cloud/sd-spool-design-setup-5`.
- Product head `ee79c6ace1917b05ceb82176aa0d21f6b9198ecd` and tested tree `322bb485658f43c6fa638ee5830a2810041a00d1`.
- Main at final fetch `449eb3810718c0e1fc26194d221a27dbbae193eb`. The candidate has one commit rooted directly at that SHA. The fleet author and committer audit found zero trailers.
- Core migrations increased from 104 to 106. This round used `0112_member_identity.sql` and `0113_capture_sources.sql`. Sentry roster retains `0110`. The keys round retains its reservation for `0111`. Prior migration SQL and hashes were verified against main.
- The deployment spec was generated before the source lock. The setup digest and producer workflow passed the integration check. The seed's release-source validation checked the clean commit and the existing `0.7.14` metadata.

## Local results

- The old installer guard accepted all four setup writes (200, 200, 201 and 201) and then refused the restart with exit 1. The fixed guard accepted both same-owner restarts with exit 0. Each restart preserved the native operator ID, organization and project. The test then invited and promoted a different native operator and reproduced the guard refusal with exit 1. The complete public CLI receipts are in `restart-baseline.json` and `restart-fixed.json`.
- The former archive fixture returned HTTP 409 `schema_mismatch:migration_history` through the emitted Worker. The number-based fixture returned HTTP 200 and preserved the restored project. The complete repair-recovery journey passed six groups, including prior-release histories, the foreign-object refusal, current restore and independent CLI export/import. See `archive-fixture.json` and `repair-recovery.json`.
- Populated schema upgrades passed with 176 published-release tables and 118 rows preserved, and with 201 tables from the 0068 fixture preserved. Old and current archive restores, occupied-destination refusal, and integrity and schema refusals passed.
- The first-party source check, Base copy verification, public CLI build, integration, typecheck, native export, product and origin suites passed. The Chromium accessibility journey passed 22 groups. The initial attempt to reproduce the archive failure in the full journey hit the local readiness deadline. The focused public HTTP probe reproduced the exact failure, and the full corrected journey passed with the original assertions and time limits. See `local-checks.json`.
- Ten screenshots show Setup, the ready project, Members, General and Capture at 1440 and 390. The data are synthetic and key-bearing fields are masked. Their exact filenames are in `restart-fixed.json`.
- The guarded push succeeded on its first attempt and the remote product SHA was confirmed with Git.

## First exact-SHA Verify

Verify run `44236961693` failed on product head `ee79c6ace1917b05ceb82176aa0d21f6b9198ecd`. The SDK job `134575898610` reached the Sentry roster browser journey and timed out waiting for **Imported roster and ownership** in Members. The shard and workflow summaries propagated that failure. The exact run's repair-recovery job `134575898566` succeeded. The REST and failed-log receipts are included.

## Settings entry correction and final candidate

The published first commit made General the Settings default. The existing Sentry roster journey opens the unfragmented Settings URL, so its Members region was hidden. The follow-up restores Members as that URL's entry and keeps General available for the installation-name field. The built Chromium probe confirmed both paths and captured the entry at 1440 and 390. The original roster journey passed through proposal preview, invitation and removal, archive restore, portable audit and project erasure. The SDK assertion was fixed on the existing branch with a new commit.

The final remote product head is `05fbedf52e4b11d329031cf689efd35ada66a9ef` and its tree is `393bebe714886426e7f669a3e2ad84cc7d5a7630`. Its two commits are linear and retain the first published parent. Main advanced to `0343c3c54b7249e4c708a60ca5648794dbc474b7` after the first publication. The final pre-push check confirmed the same 104 main migrations and no collision with `0112` or `0113`. The second push succeeded on its first attempt. Both commits passed the fleet author and committer audit. See `followup-checks.json`, `migration-reservations.json` and `release-source.json`.

The restart and browser probe was repeated on the final published SHA. Both same-owner starts returned 0, and the different-owner start returned 1. The final screenshots and receipt replaced the first execution’s screenshots and receipt. The separate README command journey also passed on the initial SHA.

The full local Sentry import suite reproduced the initial roster timeout and passed after the Settings correction. The initial Sentry HTTP suite passed.

## Final exact-SHA Verify

Verify run `44241422139` completed successfully for `05fbedf52e4b11d329031cf689efd35ada66a9ef`. The successful exact-SHA REST observation was `2026-11-18T05:24:40Z`. [Verify run](https://github.com/just-every/run-spool/actions/runs/44241422139)
