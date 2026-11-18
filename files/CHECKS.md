# Spool alert import verification

## Build

The candidate checkout completed these steps in order using Node 22.20.0 and pnpm 10.12.4.

- Frozen dependency install
- First-party source check
- Source lock verification
- Offline Base source verification
- Public `rer build`
- Workflow application build
- Integration check
- Typecheck
- Contract document check

## Journeys

- `pnpm test:alerts` passed. The unchanged conditions journey covered identity and session refusals, stale previews, and transition deduplication.
- `pnpm test:alerts-ui` passed. It exercised the existing blocked-save assertion after a destination test was reviewed, together with persistence, delivery state and keyboard navigation.
- `node tests/old-archive.mjs` passed, including populated upgrade, known late-0111 ordering, pre- and post-0114 archive restore, mismatched schema refusal and checksum refusal.
- `node tests/sentry-import/alert-rules.mjs` passed through the public door. The synthetic counts and browser proof are in the accompanying receipt and images.
- `node tests/sentry-import.mjs` passed the public import, field accounting, guarded undo, archive restore, roster and alert journeys.

## Product provenance

- Product ref `refs/heads/cloud/sd-spool-import-alerts-3`
- Candidate `cd2666344d56eadc1876c711fb114d9fb5bcc81b`
- Main and fork point `b24f4426c3900816e10e066d0bf95d06e10901a6`
- Prior alert round `9d389f449317e4c449e4b8624b992c59239186cc`
- Guarded product push completed at 22:06:37 UTC on 18 November 2026.
- Verify run [44408323852](https://github.com/just-every/run-spool/actions/runs/44408323852) advertised the exact candidate SHA at discovery.

## Follow-up local checks

- The triage browser journey passed all 22 groups. Its assignment-conflict check waits for the rendered alert before reading its recovery action.
- The standalone signed Business import journey passed after rerunning with its own time allowance.
- The local repair-recovery retry reached the reset and setup phase before its hard deadline. The populated upgrade and archive acceptance checks completed in the dedicated old-archive journey.
- The standalone project-erasure retry reached its second development-server stop before its hard deadline. The alert-import and Business-import journeys completed their project-erasure checks.
- The 390-pixel proof uses a taller viewport to show the final refused rule in the same capture.

## Actions observation

At 22:27:15 UTC on 18 November 2026, Verify run 44408323852 was still in progress on the exact product commit. This packet records the completed builder checks. The linked Actions run carries its own terminal result.
