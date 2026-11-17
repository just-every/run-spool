# Nightly command-journey investigation

Run Edit Run fleet, 2026-11-17. Tag: gr-mt-spool-ci-14. Repository: just-every/run-spool.

## Outcome

The originally reported failure is already fixed on current main. The existing repair is e9297446cc645c4509b1e93881a04bf94f6c3e5a, “Expect the native owner link in the preview ready event”. No new product change, commit, branch push or PR is needed. The local cloud/gr-mt-spool-ci-14 branch points to main's 1853e3b3b59d49853b5ee7678f851d6de8343fbf; this is investigation custody, not a newly published landing candidate.

## Failure and cause

Nightly journeys run 42561208392 at 9271cae322c0e9b9512b45e8340c62bca60d7eed failed its pnpm test:commands step in job 128977857073. The safe failure report identifies mobile-preview. Preview had emitted readiness and passed its /health check; this was an assertion failure, not a startup failure.

The historical tests/preview-session.mjs asserted ready[0].openUrl was undefined. The already adopted rer 0.2.95+ intentionally supplies openUrl and ownerOpenUrl for the native one-time owner entry. That made the old assertion stale. Existing commit e929744 replaces it with assertions for the native link's origin, /__dev/key path, rer-dev fragment, next=/ and absence of a dev identity. The helper still requires unauthenticated API access to fail, the dev-sign-in endpoint and outbox to be absent, and the ordinary owner session to authorize the API and browser. This corrects the expected CLI behavior while preserving security checks.

The archived failed-step excerpt is nightly-failed-job.log. gh 2.46.0 returned success but rendered zero lines for --job --log-failed; the already downloaded /tmp/gh-cli-cache archive contained the log. The archive was inspected locally without a second GitHub download or an alternate HTTP client.

## Verification already present on main

- Nightly 43153888732, 2026-11-12, at 56e2029c36482c291eb846d3c33c935302d98250: completed/success. Its command job 130969269750 actually ran and passed.
- Exact current-main Verify 44022478247 at 1853e3b3b59d49853b5ee7678f851d6de8343fbf: completed/success. Its commands / commands job 133834985512 actually ran and passed; the build, contract documents, all runtime jobs, all application shards and final verify passed too. This proves the command journey on current main, rather than relying only on an older green head or a push-tier run that omitted commands.
- Other exact current-main Verify runs: 44018323170 and 44008607802, both completed/success. Run site 44018323004 also completed/success on the same SHA.
- Most recent scheduled Nightly 43803437294, 2026-11-16, at adc3de69b9ae0ff60e41897f8ff7662fd656d560 failed separately in slow-readiness. Its job 133088740043 had not reached mobile-preview. This is recorded in later-nightly-failure.log and is not claimed green. The later current-main all-tier Verify command job above passed; the lane can use that evidence when triaging the older slow-readiness report.

## Local validation

- Dependency installation: pnpm 10.12.4 install --frozen-lockfile, exit 0.
- Tests use Node 22.20.0, explicitly selected after sourcing the required cloud toolchain. The VM's Node 24.19.0 remains the supplied script's default because its automatic fallback installs only when the VM version is older than the pin.
- cloud_run pnpm typecheck: exit 0, tsc --noEmit.
- cloud_run env RER_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm test:commands: PASS, exit 0. The whole journey completed, including both production-preview sessions, ordinary owner authorization, archive restore, fresh-owner restart and credential-free deploy dry runs. The existing launchBrowser helper supplies --no-sandbox and a real HOME. No local full verify or unrelated test suite was run.

- node scripts/edition-authoring/cli.mjs check: PASS, exit 0, ok=true; source-check-summary.json retains its public summary.
- node --check tests/preview-session.mjs: PASS, exit 0.
- The command runner and its cloud subreaper exited. The browser and managed servers were stopped by the journey, its isolated checkout was removed, and the product checkout remains clean.

## Counts, clauses and publication

Product changed files: 0 before / 0 after. New product commits: 0. Test registrations added/deleted: 0/0. Acceptance/status changes: 0; CONTRACT.md and its generated views remain byte-for-byte unchanged. Original failed command-job count: 1 in the supplied Nightly, 0 in the successful November 12 Nightly and the exact current-main all-tier Verify. No acceptance claim is promoted by this maintenance investigation.

The complete plan is PLAN.md. Evidence publication uses only the report-only evidence/gr-mt-spool-ci-14 ref and does not signal product READY or landing. No product publication scan is required for this no-change result because there is no new product tree to publish. No source lock regeneration is needed without source edits. No tests were skipped, weakened or deleted.

The product clone is retained as the brief's requested local output at /home/agent/rer-consolidation/work/maint/gr-mt-spool-ci-14/repo. No new product head is pending publication. No inbox or state files were read or written. There are no owner decisions or provider-account dependencies needed to resolve the original failure.

## API accounting

Nine GitHub CLI/API invocations used: original run metadata, original jobs, original failed-job log archive, current-SHA run discovery, recent Nightly list, later failed-run jobs, later failed-job log archive, successful November 12 Nightly jobs, and current-main all-tier Verify jobs. Each failed job's archive was requested once. No CI polling loop or blocked blob retry was used. Git remains the ref transport; no additional repository was cloned.

## Returned artifacts

result.json is the exact maintenance result, also saved at /home/agent/rer-consolidation/work/maint/gr-mt-spool-ci-14/result.json. receipt.json records the observed local exit codes, exact product and CI identities, zero product delta and cleanup. local-commands.log and local-typecheck.log retain the actual safe command output. No blocker remains for the original report. The newer scheduled slow-readiness failure is retained as separate evidence; the current-main full Verify command job and local journey both passed.
