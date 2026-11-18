# Spool owner journeys and late migration 0111

Repository `just-every/run-spool` · branch `cloud/sd-spool-design-keys-6`  
Initial replay base `154b4b0e8665d1103ba06b8688a6f5388bc37f8c`  
Published parent `d698e40afe0905754b3e54671320f5cfe3658204`  
Published product HEAD `b24f4426c3900816e10e066d0bf95d06e10901a6`  
Replay source `e23792d50ef9dc1f9c01285a504b3f0d33f5a995`

## Plan

1. Replay the pinned owner-journey changes into one ordinary commit on current main. Preserve the landed setup and capture behavior and regenerate the deployment spec from the migration directory.
2. Confirm that a populated installation with migrations 0110, 0112 and 0113 applies only the pending 0111 and preserves the existing project and capture grant. Export both sides of the change and restore independently into current databases.
3. Synchronize derived files, check the contract views against their source and regenerate the source lock last. Run the ordered build checks and the touched runtime and browser journeys on the candidate.
4. Check current main, inspect candidate authorship and publish the named branch. Record the exact-SHA Verify result and transport the report packet on its evidence ref.

## Implementation and migration order

- Settings lets owners name keys, see recorded use and confirm revocation. A newly issued key is displayed once. Invitations show scope before joining and display a local pending link to the owner. The Alerts shortcut tests and enables an email rule. Backups use a dated filename, and erasure shows the project inventory and checks preview freshness.
- The replay combines those changes with main’s Settings entry for Members, installation name, personal identity settings and capture source status. The earlier archive adapter recognizes the exact pre-0111 credential trigger and preserves the installed setup identity trigger where it existed. The translation verifies a complete historical schema, the exact destination migration history with only 0111 omitted, and the full destination schema. The first cross-version restore caught the original contiguous-history check.
- Local rer 0.2.118 enumerates SQL files and queries the applied names in `d1_migrations`, then runs Wrangler. Wrangler’s `getUnappliedMigrationNames` checks each filename against those names. Rer’s deploy-kit `unapplied` also subtracts the applied name set from the build plan, with a history validator that permits gaps and checks bytes for applied files. The local D1 receipt records the resulting application order of 0110, 0112, 0113, 0111 and the preserved synthetic project and key grant.
- Fresh install and migration-ledger generation retain numeric file order. The deployment spec includes 0110 Sentry roster proposals, 0111 key names and use, 0112 member identity and 0113 capture sources.
- Alerts waits for the preview guidance to replace the review guidance after the refresh. The replayed operator UI conflict test waits for its rendered alert. The surrounding owner journey opens fresh HTTP connections after a workerd connection reset during a long browser run.
- The branch for the prior round currently advertises `479aabb16f2a9c8ca19eb93d1eec2ba130dff227`. The replay uses the brief’s pinned `e23792d50ef9dc1f9c01285a504b3f0d33f5a995`, which the repository still retains.

## Contract counts

| Tier | Done before → after | Partial before → after | Missing before → after | Total |
| --- | ---: | ---: | ---: | ---: |
| Core | 23 → 23 | 45 → 45 | 19 → 19 | 87 |
| Agent surface | 0 → 0 | 9 → 9 | 9 → 9 | 18 |
| Later | 0 → 0 | 0 → 0 | 0 → 0 | 0 |
| Full target | 23 → 23 | 54 → 54 | 28 → 28 | 105 |

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).

The last pre-push fetch found a dependency update on main. The replay was rebased onto it, the pinned install and build checks were repeated, and only the named product branch was published. The product diff contains one commit. The release check used the pinned rer release source inspector to validate the committed seed, package and release metadata.

## Results and receipts

- The stopped local setup-era D1 ledger gained 0111 after 0112 and 0113. The project and active capture grant stayed in place and received blank name and unknown last-use defaults. See `d1-upgrade-receipt.txt`.
- The emitted Worker on the published SHA exported both sides of the same migration gap and restored them into separate fresh plain-D1 destinations. The independent historical archive suite also passed with hashed migration ledgers.
- Full owner runtime, setup, triage and accessibility passed locally on the published SHA, along with the focused loader, invitation, email alert and completed erasure journeys. The retained browser packet covers keys, invitations, email alerts, archive and erasure at 1440 and 390.
- The full agent-handoff and project-erasure harnesses hit local rer dev readiness timeouts. The touched agent-selector checks passed and the isolated erasure journey completed. See `verification-receipt.md`.
- The final ordered build receipt records the published SHA. The exact-SHA CI receipt records the observations available when this packet was published. [Verify 44285578885](https://github.com/just-every/run-spool/actions/runs/44285578885)
