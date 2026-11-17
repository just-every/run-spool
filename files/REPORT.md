# gr-mt-spool-dep-4 maintenance report

Author: Run Edit Run fleet, 2026-11-17.

Repository: just-every/run-spool
Product branch: cloud/gr-mt-spool-dep-4
Base: 6263ba70f1d0fce4ea1df7e6bf7b4f0d827489e1
Candidate: 3a154292e69253edb1d3b786a75fcd1c39047bc7

## Change and scope

Upgraded the sole ip-address resolution in pnpm-lock.yaml from 10.7.3 to 10.7.6, beyond the advisory's first patched release 10.7.4. The dependency chain is @errors/agent -> @modelcontextprotocol/sdk 1.32.1 -> express-rate-limit 8.7.1 -> ip-address. The existing parent range ^10.2.0 accepts the fix. No manifest bump or override was necessary. Regenerated sources.lock.json last; its only change is pnpm-lock.yaml's digest. The product commit contains exactly those two files, five insertions and five deletions.

Before/after: affected resolved versions 1 -> 0; distinct ip-address versions 1 -> 1; unrelated upgraded packages 0; added/deleted permanent tests 0/0; changed contract clauses 0. No clause status, gap, evidence, acceptance point, generated view, homepage or owner-screen change is claimed.

## Plan and actual local results

The full plan is in PLAN.md. Completed its dependency investigation, bounded update, frozen install, setup, build, targeted behavior proof, typecheck, source regeneration/check, clean-diff review, fleet hook installation and complete candidate identity/trailer inspection. The initial root-only pnpm update attempts made no changes; the recursive workspace command updated the agent's transitive dependency without unrelated upgrades.

Used Node 22.20.0 and pnpm 10.12.4. All following commands exited 0:

- pnpm --recursive update ip-address --depth Infinity --lockfile-only
- pnpm install --frozen-lockfile --network-concurrency=2 --child-concurrency=2
- cloud_run npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive
- cloud_run npx -y @runeditrun/rer build
- pnpm typecheck
- cloud_run node <packet>/dependency-smoke.mjs
- node scripts/edition-authoring/cli.mjs lock
- pnpm source:check
- git diff --check

The one-off dependency proof exercises the installed dependency through its actual MCP SDK/rate-limiter resolution. Normal IPv6 parsing and zone identifiers work, IPv4 keys remain unchanged, and IPv6 subnet aggregation works. A malformed zone containing two million percent characters followed by a newline is refused in 69 ms under a five-second child-process deadline. An SDK Express app with the installed rate limiter admits two requests from the same IPv6 subnet, refuses the third with 429 and Retry-After, and admits an independent IPv6 subnet and IPv4 address. Observed statuses: 200,200,429,200,200. The HTTP server is closed in finally. The proof remains evidence, without adding a permanent literal/version test to the product.

No UI changed, so browser screenshots are inapplicable. No full local Verify was run; exact-SHA branch Verify remains the full CI wall. The normal build emitted its existing ineffective-dynamic-import warning and completed successfully.

Setup's private log and generated local owner state are retained outside the report packet and publication checkout. No credential values, environment dumps, private setup links or held-out material are selected for evidence. Setup and build children have exited; no application server remains running. All product tracked files are unchanged after the commit.

## Publication and custody

Fresh Base scanner source was acquired read-only using gh api for the exact Base main 513669ac81ac15506740ca9d2089a1c753e03455, independently probed using git ls-remote. No other repository was cloned. Installed Gitleaks 8.30.1 using Base's installer and its committed archive SHA-256 verification. No scanner exclusions or policy edits were added.

An initial scanner attempt was intentionally interrupted after an attempted move of generated runtime state failed across filesystems. The move was corrected using a cross-filesystem move; generated private setup state and build artifacts were retained outside the checkout, and the full scanner was restarted. The interrupted report is retained and earns no passing claim.

Final publication scan, product push, exact-SHA CI and evidence transfer outcomes are recorded below when available. Evidence publication is report transport only and never means product readiness or landing.

The first completed scan returned COMPLETE/FAIL with destination.invalid on edition.json and hygiene.github-missing on the regenerated sources.lock.json. Investigation found that the read-only scanner extraction omitted Base's edition-authoring dependency, so its identity validator could not import the maintained recipe implementation. Extracted that unchanged dependency from the already acquired exact-SHA archive. The validator then exited 0 and produced the same canonical recipe hash recorded by the source lock. No product identity, scanner policy, exclusions or review records were changed. The original failing report and receipt are retained; the full scan is rerunning against the unchanged candidate with the restored source dependency.

The final full scan completed in 411.12 seconds: COMPLETE/PASS, zero findings, exact candidate 3a154292e69253edb1d3b786a75fcd1c39047bc7. Fleet identity/trailer checks passed again before publication. cloud-push.py published only cloud/gr-mt-spool-dep-4 successfully on its first attempt. No default branch push, force push, PR, comment, tag or release was performed. The exact-SHA Verify watcher is now observing the pushed head through REST, with five-minute spacing.

Remote Git ref verification independently confirmed the published branch at the candidate SHA. Verify push run 44122879533 was discovered on that exact SHA and remained in progress at the five-minute REST observation. No PR is required by this repository's instructions, so none was opened. The scoped count is vulnerable ip-address resolutions (1 -> 0), not the separate repository-wide Dependabot alert count, which was not queried or claimed resolved.

Additional investigation: pnpm view ip-address version returned 10.7.6; pnpm view express-rate-limit@8.7.1 dependencies --json confirmed ip-address ^10.2.0. Root-only pnpm update ip-address --depth Infinity --lockfile-only and pnpm update ip-address@10.7.4 --depth Infinity --lockfile-only exited 0 without changing the workspace lock; the recursive workspace command then made the scoped change. pnpm why ip-address --lockfile-only was refused because why does not support that option; pnpm why --recursive ip-address succeeded and showed the installed dependency chain. A search of all non-vendored lockfiles found only the patched root resolution. These investigative command errors were corrected and are not passing test claims.

## Final result: BLOCKED by exact-SHA Verify

Verify run 44122879533 completed/failure on 3a154292e69253edb1d3b786a75fcd1c39047bc7. URL: https://github.com/just-every/run-spool/actions/runs/44122879533. Six REST observations, including discovery, were separated by at least 300 seconds. One completed-run jobs lookup and one failed-job log-archive read followed. Including the one Base archive request, this task made nine explicit gh invocations; scanner-managed GraphQL visibility queries were separate and not instrumented. No blocked download was retried.

The actionable failing job is verify (tunnel), job 134179490118, Run suites. The tunnel test itself reported passing. The following pnpm test:sentry:sdk failed in checkInFlow at tests/checkin-flow.mjs:78, after the real SDK program: delta(check_in_routed) was 3, expected 4. The preceding wire-order assertion had passed. shards (spool) and verify failed their aggregate gates after the test shard failed. Job conclusion counts: {"failure": 3, "skipped": 4, "success": 25}. The contract-docs job passed, so the generated-view exception does not apply.

Read the failed assertion archive once using gh run view 44122879533 --repo just-every/run-spool --job 134179490118 --log-failed; exit 0. The complete sanitized failed-step log is in ci-failed-tunnel.log. The test, its invoking journey and the check-in implementation were verified byte-unchanged from origin/main. ip-address is resolved only through the agent package's MCP SDK/rate-limiter chain. No causal link between this check-in failure and the dependency update has been established; neither a pre-existing CI failure nor a flake is claimed as proven. Changing unrelated check-in behavior or relaxing its assertion is outside this dependency brief. No test was changed, deleted, skipped or weakened, and no workflow was re-run.

The dependency fix remains published at cloud/gr-mt-spool-dep-4, head 3a154292e69253edb1d3b786a75fcd1c39047bc7, and the exact committed tree retains COMPLETE/PASS publication results. It is not READY for landing because its required exact-SHA Verify is red. There are no clause status changes. Default: retain the scoped fix and ask the lane to triage the unchanged check-in assertion before attempting landing. result.json records status cannot, the actual SHA, the blocker and the passed local checks.

Recovery bundle: /home/agent/rer-consolidation/work/gr-mt-spool-dep-4/recovery/gr-mt-spool-dep-4.bundle; SHA-256 2178898dd39a7690f37c9993acae0d397c2f4176cfda5c24aba264792efd5e75; git bundle verify passed. Product push succeeded on the first attempt; this bundle is additional recovery data, not READY or evidence of a rejected push. The bundle is not selected for public evidence.

Publish the complete explicitly selected report packet only through evidence/gr-mt-spool-dep-4. Report transport remains separate from product custody and landing. The source clone and node_modules are to be removed after evidence transfer, as required by the builder cleanup rule, with this verified bundle, result.json, report and receipts retained outside it. Private setup state/logs are excluded from the packet and will be removed.
