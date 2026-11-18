# Spool owner-journey replay

Task sd-spool-design-keys-5 · just-every/run-spool

## Plan

1. Verify the keys-3 and keys-4 references and replay the single nonempty keys-4 commit onto current main.
2. Retain main’s Sentry roster import and Members import controls. Put the key metadata upgrade after the roster migration in the deployment bundle, native archive compatibility list and populated upgrade tests.
3. Make the operator UI test wait for the actual assignment conflict feedback before asserting its contents. Regenerate and check the integration and contract views. Restore the generated contract views from main and regenerate the source lock last.
4. Build the exact linear candidate and run the native upgrade, runtime, owner, alert, archive, erasure and agent handoff journeys. Collect masked browser proof at 1440 and 390.
5. Confirm current main before the guarded push, verify the exact candidate in GitHub Actions and return this packet through the report-only evidence ref.

## Replay

| Item | SHA |
| --- | --- |
| Main at replay | 0343c3c54b7249e4c708a60ca5648794dbc474b7 |
| Keys-3 reference | ba97984c5372e00bd6c28bb05eb37fb8c7f89928 |
| Keys-4 reference | b5b0d25111dcb56a07afc12605ee1e6a935c1b18 |
| Replayed commit | 739be0258a90e46502e11f53221870745553cdd5 |

- The deployment generator lists 0110_sentry_roster_proposals.sql, then 0111_key_names_and_use.sql. The portability reader handles both migrations and preserves main’s backward translation for the roster schema. The archive fixture strips both later additions when modeling a pre-metric archive.
- The Members conflict retains the roster import controls and existing local-link security guidance. A newly created local invitation surfaces its link immediately. The operator UI fixture on current main already targets an alert by role. It now explicitly waits for that alert and reads its text once.
- No contract clause claimed; these are owner-journey design fixes (DIRECT 87).

| Contract tier | Before done / partial / missing | After done / partial / missing |
| --- | --- | --- |
| Core (87) | 23 / 45 / 19 | 23 / 45 / 19 |
| Agent surface (18) | 0 / 9 / 9 | 0 / 9 / 9 |
| Later (0) | 0 / 0 / 0 | 0 / 0 / 0 |
| Full target (105) | 23 / 54 / 28 | 23 / 54 / 28 |

## Local build and repair

- Replay was resolved as one ordinary commit. The initial local SHA was 661cf4c94a9140db2b1acb720e6c587417db81b6. The unpublished amend at 479aabb16f2a9c8ca19eb93d1eec2ba130dff227 changes only the triage test and its source-lock entry.
- Local setup succeeded. The ordered first-party profile, source-lock check, offline Base-copy verification, RER build, integration check, agent catalogue, typecheck and contract document check passed with Node 22.20.0 and pnpm 10.12.4. The contract generator wrote zero changes and reported zero errors and warnings. The source lock was regenerated and checked again for the amend. The integration recipe produced the deployment spec and matched the setup digest and producer workflow.
- This checkout has no validate:release package script. The pinned RER release-input validator passed against committed HEAD. It checked aligned v0.7.14 source manifests. Both migration SQL entries match their files, the declared release migration exists and there are no contract change entries.
- The populated old archive suite passed. Its published baseline preserved 176 tables and 120 populated rows before and after upgrade. It applied both terminal migrations in order, checked the credential defaults and preserved revocation, restored a pre-metric archive with full schema objects and hashed migration history, and refused occupied or mismatched destinations.
- The owner claim and team suite passed, including local invitation retention, link copy and single use, role isolation and archive exclusion. Alerts passed at both widths, including enabling the native email rule only after a passing reviewed test.
- The two original triage attempts restored the downloaded archive successfully, then the loopback worker closed the connection before the immediate verification read. The amend makes the restore and verification requests use separate connections. Product sources and all migration bytes are identical between the two local candidates.
- The first agent-handoff run timed out while waiting for the cold dev listener. The rerun uses a separate local job queue without the default process niceness. The product’s startup test deadlines and checks are unchanged.
- Review receipts and masked screenshots are in this packet. Fixtures use synthetic installations and addresses.

## Candidate results

- GitHub accepted cloud/sd-spool-design-keys-5 at 479aabb16f2a9c8ca19eb93d1eec2ba130dff227 at 05:43:52 UTC on 18 November 2026. Fresh main still matched the original base immediately before the push. Candidate history contains one ordinary commit, zero merges and no trailers.
- The ordered build and checks were repeated from a detached checkout of that exact candidate. All passed.
- The corrected triage suite passed 22 check groups and produced 110 captures across 1440 and 390. It downloaded, restored and compared the actual private archive, including source maps and credential exclusion. The selected key list, new-key, revoke, backup and archive preview captures are included.
- The emitted-worker owner runtime, product runtime, Sentry SDK/loader, and exact-candidate invitation suite passed. Owner runtime verified pinned Slack and cron guidance and the anonymous help paths. Invitation renders the inviter, team and scoped project before the invitee joins. Both joining and the masked invitation link are shown at each width.
- The cloud full agent-handoff rerun again reached the 90-second dev-listener deadline during setup. A supplementary emitted-worker invocation read a valid packet over direct HTTP but failed the CLI positive control through its substitute proxy. GitHub Verify covers the unmodified end-to-end agent-handoff runner.
- The emitted-worker erasure browser check passed on the exact candidate. A real stale-plan 409 refreshed the counts, cleared the typed identifier, disabled deletion, and kept the original project. Both updated preview widths are included. The first full dev-mode erasure attempt timed out before the listener came up. The supplemental browser check covers the changed screen and stale-confirmation behavior.
