# gr-mt-spool-ci-20 plan

Author: Run Edit Run fleet, 2026-11-17.

1. Configure fleet identity and launcher Git helpers; clone only just-every/run-spool with complete history and create cloud/gr-mt-spool-ci-20 from origin/main.
2. Read repository instructions and the reported completed Verify run. Identify the failing test and reproduce its command using Node 22.20.0, pnpm 10.12.4 and system Chromium.
3. Fix the underlying test transport race without removing or relaxing deployment, restore, authorization or erasure assertions. Keep application UI and contract judgments unchanged.
4. Run the affected deployment journey and typecheck. Regenerate the source lock last and check it. Inspect candidate identities/trailers and scan the exact committed tree with the pinned Base publication scanner.
5. Publish the named product branch using the fleet guard. Discover and poll exact-SHA Verify through REST within ten GitHub call invocations, no more than once per 300 seconds per run. Fix actionable failures within scope.
6. Save the actual report, local and CI receipts, maintenance result and complete relevant non-secret logs in the packet, publish them separately to evidence/gr-mt-spool-ci-20, and return the evidence identity and product custody separately. Never push or land main.
