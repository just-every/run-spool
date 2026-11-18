# Spool Hono security maintenance

Run Edit Run fleet, 2026-11-18

## Plan and changes

1. Confirm the vulnerable versions on main and identify the Node adapter's parent.
2. Update the direct dependency and regenerate the workspace lockfile with pnpm 10.12.4. The MCP SDK's existing range accepts the patched adapter. The final manifest contains the Hono bump and retains the original overrides.
3. Regenerate the edition source lock, verify dependency resolution, run the build and existing route journeys, and smoke-test the SDK-resolved adapter.
4. Scan the committed candidate against public main and check the fleet commit identity before publishing. Verify the pushed SHA.

Updated Hono from 4.13.7 to 4.13.16 and the transitive Node adapter from 2.1.4 to 2.1.6 for the listed security advisories. The lockfile resolves one version of Hono across Spool and MCP SDK 1.32.1. The dependency diff contains these two package upgrades. The change touches `package.json`, `pnpm-lock.yaml` and the two corresponding digests in `sources.lock.json`.

The pinned versions satisfy GHSA-46wx-v44x-9hh2, GHSA-4h7h-rv7c-7m2v, GHSA-4m76-xfj5-7975, GHSA-h7mg-cq63-vhpq, GHSA-3gg2-335m-rxc6, GHSA-qv5m-9pm6-hqp3 and GHSA-jpvv-r467-5p4w. The count of affected advisory IDs in the brief goes from 7 to 0 and the corresponding manifest and lockfile alerts from 12 to 0 by version range. Dependabot closure is independent of the branch.

## Verification

Node 22.20.0 and pnpm 10.12.4. The initial publication scan exceeded its 300-second deadline. The retry completed on the same commit with a 1,200-second deadline and scanned 1,014 commits. The result was PASS, with zero findings in scope.

- `pnpm install --frozen-lockfile` — passed
- `cloud_run npx -y @runeditrun/rer setup --owner-email <fleet identity> --non-interactive` — passed
- `cloud_run npx -y @runeditrun/rer build` — passed
- `pnpm typecheck` — passed
- `cloud_run pnpm test:runtime` — passed
- `cloud_run node tests/sentry-http.mjs` — passed
- `cloud_run node --input-type=module (SDK-resolved adapter HTTP smoke)` — passed
- `node src/base/contract-docs.mjs check` — passed
- `node scripts/edition-authoring/cli.mjs lock` — passed
- `pnpm source:check` — passed
- `git diff --check` — passed
- `Base publish-check with an exact SHA and the public main ancestry` — PASS

The application journey covers owner admission, route authorization, direct API authorization and session revocation. The Sentry HTTP journey exercises capture and owner-facing routes. The adapter smoke uses the package resolved from the MCP SDK and verifies 200 JSON and 404 responses over loopback. The Sentry journey rewrote retained fixture screenshots during its run. Those generated files were restored to the committed versions.

## Custody and clause counts

Base `b24f4426c3900816e10e066d0bf95d06e10901a6`. Candidate `cloud/gr-mt-spool-dep-15` at `ba5f3188ee9a09bff13fa3e1a8b6e1351b1a0c7d`. Product branch was pushed. Verify run 44406841835 reported completed with conclusion success for `ba5f3188ee9a09bff13fa3e1a8b6e1351b1a0c7d`. https://github.com/just-every/run-spool/actions/runs/44406841835

Clause status changes are zero. Core remains 23 done, 45 partial and 19 missing. Agent surface remains 0 done, 9 partial and 9 missing. Full target remains 23 done, 54 partial and 28 missing, 105 total. Test registration changes were zero.
