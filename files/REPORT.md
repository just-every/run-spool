# Spool: integration egress prerequisite

Repository: just-every/run-spool
Branch: cloud/main-spool-egress-guide-link-1
Product head: ca62aee25af1dbbb665d0040151a1150fcc10946
Starting main: 0f9809608a4ba84b23f4f8ece165605fcdd1acba
PR: none; this brief returns a pushed branch to the fleet lander.
CI: Verify run 43384211264, retry attempt 2, was still in progress on the exact product head at 2026-11-13T07:46:37.975963+00:00. All ten GitHub calls are used. Product custody is PUSHED, with no green Verify or READY claim. The first attempt failed in an untouched deployment-history probe with ECONNRESET; its failed jobs were rerun once.

## Plan and result

The full plan is PLAN.md. Reproduce both Settings doors on current main, repair the shared prerequisite and its references, extend the existing public-door test, run touched checks and inspect desktop/phone proof, integrate main and regenerate the source lock, then push the fleet branch and observe exact-SHA Verify. Product custody and report transport remain separate.

On starting main, Settings > Issue processing > Cron check-ins and Settings > Alerts & integrations > Slack both reached the anonymous shared integration-egress page. That page had an installation recipe and a placeholder services entry, but no link to Base's required owner procedure and no precise mapping from the private service state to sourceSha and the rest of the grant. The older alert-delivery document also named the owner procedure as an unlinked code path. This reproduces the remaining prerequisite failure; the Settings links themselves already worked.

The shared page now links Base's owner procedure at 4dd4197007cefd688fd314ffb19eed4d0b3c67dd, the egress module revision recorded by Spool in base-copies.json. A read-only GitHub contents request confirmed the exact public document URL; base-link-receipt.json records its returned URL and blob identity, which also matches the vendored owner document byte for byte. Base was not cloned or modified.

The guide identifies the separate service's --state output, .rer/deploy/egress-production.json, and its receipt object. It explains that there is no preassembled grant object in the receipt. The mapping is:

- allowedHosts: parse receipt.config.vars.EGRESS_GRANTS and select EgressRestricted.
- sourceSha: receipt.source.sha, the committed source packaged for the service deployment.
- fingerprint: receipt.fingerprint.
- provider: the same receipt's versionId, deploymentId and etag.

The page contains a copyable placeholder services entry and a runnable extractor that prints only the consumer binding metadata. It does not dump the private state or credentials. The Cron documentation links this shared prerequisite. The older alert guide now links both the shared instructions and the pinned Base procedure, replacing the bare required Markdown reference.

Cron Settings names the owner's Cloudflare deployment access and the buyer's Uptime installation. Slack Settings names the buyer's workspace/app-install permission and the owner's Cloudflare access before the form. The guide labels those account requirements and the separate authorization and safe receiver needed for live qualification.

## Public-door proof

tests/setup-prerequisites.mjs#settingsPrerequisiteGuides extends the existing tests/runtime.mjs journey. It opens the owner's real Settings sections, follows each egress guide into its public anonymous page, checks the docs index and local guide links, rejects a bare required Markdown path, and checks that the navigable Base procedure follows the module's declared source revision.

The journey copies the runnable extractor from the rendered guide, runs it on synthetic private state with independently generated source/fingerprint/provider identities and multiple entrypoints, and checks that the result contains exactly the selected service's binding metadata. An extra synthetic private value must not escape. This checks the recipe's behavior, not a fixed source hash or prose string.

The assertion journey runs at 1440. Before and after screenshots show Cron, Slack and the shared guide at 1440 and 390; the phone images are captures of those same changed states. The final images were visually inspected. Code blocks scroll within the guide on the phone. No new icon-only controls or field borders were introduced.

Passed local checks:

- Required rer setup and rer build.
- node tests/runtime.mjs, including the extended Settings prerequisite journey.
- The same Settings guide helper through an emitted Worker after placing Slack's prerequisites above its form.
- pnpm typecheck.
- Required main fetch and rebase; main was unchanged, so there was no source or contract conflict.
- Source lock generation, pnpm source:check and contract-docs check.
- git diff --check and the complete unpublished candidate identity/trailer audit.

Actual command receipts and output are local-checks.json, runtime-check.txt, guide-check.txt, typecheck.txt, contract-check.txt and commit-audit.txt. Product push receipt is product-push.txt. The product checkout was clean after committing and pushing.

## Counts and clause boundaries

| Measure | Before | After |
| --- | --- | --- |
| Settings egress entry points | 2 | 2 |
| Those paths reaching the pinned Base owner procedure | 0 | 2 |
| Shared guide's precise receipt source mapping | absent | present |
| Existing runtime assert-script registration | 1 | 1 |
| New test registrations | 0 | 0 |
| Clause status changes | 0 | 0 |

Contract judgment totals are unchanged: 13 done, 47 partial and 26 missing before and after.

No test was removed, skipped or weakened. The existing runtime test was extended; the seed-wide count was not recomputed and no cap raise was requested. test-registration-receipt.json records the bounded registration comparison.

SDK-024 remains PARTIAL. ALERT-002 remains PARTIAL. No complete acceptance point is newly claimed by this documentation prerequisite slice. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md were not edited. The source lock contains only the six touched product/document/test file digests.

CLAIM SDK-024 PARTIAL points=none tests=tests/setup-prerequisites.mjs#settingsPrerequisiteGuides
CLAIM ALERT-002 PARTIAL points=none tests=tests/setup-prerequisites.mjs#settingsPrerequisiteGuides
GAP SDK-024: Live Uptime forwarding and real receiver qualification remain outside this round.
GAP ALERT-002: Real Slack delivery, recipient receipt, the other provider adapters and chat actions remain outside this round.

## Publication and remaining owner work

The product was pushed with the cloud push guard at its first real commit, with no skip-CI marker. Its sole candidate commit has fleet author and committer identity and no co-author trailers. No published history was rewritten and no default branch was pushed.

The cloud adaptation delegates the full publication scan and landing to the fleet. This task does not claim deployment, live egress qualification, Slack delivery, Uptime receipt or DONE. Owner credentials, an authorized live qualification and a safe external target remain owner work. They are not blockers to this documentation change.

Only the explicitly selected non-secret report, actual receipts and scoped screenshots are published to evidence/main-spool-egress-guide-link-1. Evidence transport does not signal product readiness or landing. The final terminal result names the exact Verify run and product custody independently.

## CI retry

The first Verify attempt failed in verify (runtime), job 131749343308, step Run suites: tests/deployment-history.mjs called suspectFlow at tests/suspect-flow.mjs:73 and fetch failed with read ECONNRESET. The runtime shard chains deployment-history before pnpm test:runtime, so the touched Settings journey had not run. These files and that probe are unchanged. The failure log was read once using the specified gh run view job command. The actual failing block, without the runner environment, is ci-failed-job.txt. ci-jobs.json records the job and step results.

The brief-authorized single failed-jobs rerun was requested successfully on the same exact SHA. The tenth and final GitHub call observed retry attempt 2 still in progress on the same full SHA after ten minutes. The task ends PUSHED under the brief’s API-budget rule. The fleet must observe the final Verify result before landing; no green result is assumed.

## Terminal custody

PUSHED branch=cloud/main-spool-egress-guide-link-1 head=ca62aee25af1dbbb665d0040151a1150fcc10946

Pending gate: exact-SHA Verify run 43384211264, retry attempt 2, in progress at the last allowed observation. The first-attempt failure was verify (runtime) / Run suites / tests/suspect-flow.mjs:73 (ECONNRESET). There is no unresolved product/documentation ruling in this round. Live provider account work remains outside its scope. Evidence publication is independent of this pending gate.
