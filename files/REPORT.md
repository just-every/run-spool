# Spool owner setup and capture

## Plan

1. Confirm both prior branch heads and identify the previous merge's product delta against its main parent. Replay that delta as a single ordinary commit on fresh Spool main.
2. Leave migration numbers 0110 and 0111 available for the Sentry roster and keys rounds. Move the member-identity and capture-source SQL files and all runtime migration references to the next reserved-safe numbers.
3. Reproduce the historical repair-recovery archive rejection with the uncorrected fixture. Restore a consistent historical migration prefix and schema-object inventory in the fixture, then exercise current and old archive restoration and populated upgrades.
4. Regenerate the delivery outputs, contract views and source lock in order. Prove the generated contract views against main and leave the release record at its existing version. Run Spool's build checks and browser journeys, keep browser evidence at 1440 px and 390 px, and check every product commit before publishing the linear branch.
5. Record exact-SHA Verify and transfer the report, receipts and screenshots on the dedicated evidence ref. Landing and the fleet publication scan are performed by the fleet.

## Replay and migration inventory

- Previous round 2 head `a99b4001ba8fb87b2f6e033163f7d64be7b2c520`.
- Previous round 3 head `e9e23f11c02328213a272d9a3394316d104638c9`, with replay parent `2c061e5a68a555977ee4665cc76e1af13fe5a28a` and main parent `53b460837d5a58266c39d03a9f923e09e9c29fb7`. Its historical Verify was 44197127158.
- The product delta covers initial installation and project setup, capture status, allowed website entry, the Members invitation workflow, owner identity and organization naming, public docs, and restart and recovery guidance.
- Migration inventory increases from 103 to 105. The added files are `0112_member_identity.sql` and `0113_capture_sources.sql`. SQL payloads are preserved. The deployment spec and archive compatibility logic use the new filenames. The regenerated setup digest and producer workflow match their existing bytes.
- The repair-recovery fixture rejected the historical archive with HTTP 409 `schema_mismatch:migration_history`. The repair removes migration numbers 0109 and later from both recorded histories, keeps the remaining ledger aligned with the migration list and removes the member-identity trigger and capture-source schema objects from the historical inventory. Existing restore comparisons and the foreign-object rejection assertion remain in place.

## Contract

Core remained 23 done, 45 partial and 19 missing (87 total). The full target remained 23 done, 54 partial and 28 missing (105 total). There are zero clause transitions and no release metadata adjustments.

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).

## Local results

- The frozen install, first-party check, native exports, source lock, offline Base copies, application build, integration check, agent surface, workflow permissions, contract documents and typecheck passed. The source release validator found matching version 0.7.14 metadata and all 105 committed migration files matched the generated spec.
- Local setup applied all 105 migrations. The focused historical fixture failed with 409 before the repair and restored successfully after it. The old-archive suite passed, including upgrades from a populated published release and migration 0068, legacy and current archive restoration, destination ledger preservation and invalid archive refusal.
- The browser-origin runtime, owner admission and Worker/D1 product archive checks passed. The local Worker/D1 check passed on retry after a socket disconnect. The full repair-recovery command timed out during local dev startup in both attempts. The focused reproduction and repair proof used the same fixture transform and checkout-owned migration replay.
- The packet contains four screens at each of 1440 px and 390 px, covering initial setup, Capture and the website-address input, Members invitation, and Settings → General. The browser proof used synthetic local data and masked credential fields.

## Product custody

The single commit `6cfacc486d86a89e8188024951d3ba4c22383e4c` has parent `53b460837d5a58266c39d03a9f923e09e9c29fb7`. The push to `cloud/sd-spool-design-setup-4` succeeded on its first attempt, and Git advertised the branch at the same SHA.

## GitHub Verify

Verify run [44205050903](https://github.com/just-every/run-spool/actions/runs/44205050903) completed successfully for exact head `6cfacc486d86a89e8188024951d3ba4c22383e4c`. Success was observed at 2026-11-18T00:32:22Z. A solo local rerun reached the archive phase and its isolated server was stopped once the exact-SHA Verify succeeded. The raw REST observations and local validation results are in the two JSON receipts.
