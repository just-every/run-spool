# gr-mt-spool-ci-8 maintenance report
Author: Run Edit Run fleet, 2026-11-15 UTC.

## Scope and plan
Only just-every/run-spool is a product write target. The fresh full-history, blob-filtered clone is work/maint/gr-mt-spool-ci-8/repo; the branch is cloud/gr-mt-spool-ci-8. PLAN.md records the complete plan. The product base is adc3de69b9ae0ff60e41897f8ff7662fd656d560, tree 6255ffe8faf2cabe910d471aa719ddc218056870. No default branch, other repository, tag, release or PR has been changed.

## Investigation
The four supplied failure families were inspected separately:
- Nightly journeys 41387749236: primary failed job 125092307296, Run pnpm test:commands. Its two later aggregation failures are consequences, not independent causes.
- Verify 41382981130: primary failed job 125077921651, verify (sdk), Run suites. Other primary jobs succeeded.
- Release SDK 41382981033: primary failed job 125077593915, token-check, NPM_TOKEN reaches this repository. The build succeeded.
- Lowercase verify 41344924986: primary failed job 124962798808, verify (owner-ui), Run suites. The three older lowercase verify runs supplied by the brief were treated as history of this family.

Each historical completed failed job was read once using the required gh run view --repo --job --log-failed command. All four invocations exited 0 with empty stdout and stderr. The actual empty files and github-receipt.json are preserved; an empty response is not a passing test or a reproduction of a historical assertion. No blob-download workaround or second log read was attempted.

Current-main exact-SHA run discovery found:
- Verify 43742749592: completed/success at adc3de69b9ae0ff60e41897f8ff7662fd656d560.
- Later Verify 43750723397: completed/failure at that same SHA. SDK job 132924276026 and owner-ui job 132924276073 succeeded. Primary failure: runtime (ruby), job 132924276019, Run ruby SDK journey, step 20. The shards/verify aggregation failures follow it.
- Run site 43750723300: completed/success at that same SHA.
The later red Verify is authoritative for this report; the earlier green run does not make the latest main run green.

The ten-call GitHub budget is exhausted: four job-summary reads, four required historical failed-log invocations, one exact-SHA run discovery, and one current failed-run job-summary read. The Ruby failed log, a fresh SDK release run and a new candidate Verify have not been read or asserted.

Existing fixes on main include:
- 8069a3255289f121700b24c629daa3b16c448e3a replaces NPM_TOKEN release admission with npm trusted publishing, npm 11.6.2, id-token: write, an empty npm user configuration and exact tarball publication. Owner Trusted Publisher registration and a real release remain external qualification, not inferred from the workflow.
- e9297446cc645c4509b1e93881a04bf94f6c3e5a updates preview owner-link assertions for rer 0.2.95.
- 81df212b32e7583358d6b3bd1a1a50aef701d269 updates credential-free deploy dry-run expectations while preserving assertions that no provider call occurs.
No historical log text was available to assert that any one of these commits explains a particular historical SDK/owner assertion.

## Locally reproduced defect and correction
On unchanged main, node tests/commands.mjs failed at slow-readiness: its progress diagnostic had appeared, but GET /health returned 404 instead of the immediately asserted 200. An isolated probe confirmed diagnostic observed, child still alive, health 404, cancellation exit 130, listener stopped and private settings preserved. A second isolated probe waited and observed health changing from 404 to 200 while setup remained alive, followed by the same passing cancellation/shutdown/preservation checks.

tests/commands.mjs now waits at most five minutes for the actual public health response after the diagnostic, with a two-second request timeout and an assertion that setup stays alive. It retains the final HTTP-200 assertion and all existing cancellation, shutdown, settings, owner, browser, archive and deploy assertions. No assertion was deleted, skipped or weakened. This is a race between the progress timer and the managed runtime's listener, not evidence that the application is ready when the timer fires.

## Validation
- pnpm install --frozen-lockfile: PASS.
- pnpm run build:app on Node 22.20.0 / pnpm 10.12.4: PASS (build.log).
- pnpm typecheck initially on VM Node 24.19.0: PASS; repeated on the repository-pinned Node 22.20.0: PASS (typecheck-node22.log).
- node tests/sdk-package.mjs on pinned Node and system Chromium: PASS (sdk-package.log). It installed the packed tarball offline in a fresh app, exercised browser/Node/Worker paths, rate caps and exact outcome reconciliation, plus SRC-001's four bundlers/retained maps/restore/erasure/refusal journeys and SRC-004's capacity/public lookup.
- node --check tests/commands.mjs: PASS.
- pnpm typecheck after the test correction on pinned Node: PASS (typecheck-candidate.log).
- git diff --check: PASS.
- node scripts/edition-authoring/cli.mjs lock and pnpm source:check: PASS; the lock changes only the checksum of tests/commands.mjs.
- node tests/commands.mjs with the corrected test bytes: PASS (commands-after.log). The complete public journey passed fresh-clone bootstrap, setup failure/resume and owner preservation, real cancellation/readiness, desktop and phone first-project setup, production preview/restart, validated CLI archives and policy refusals, reset/fresh owner and provider-free deploy dry-runs. The run began on the base SHA with corrected outer test bytes and an isolated base application clone; that test file is byte-identical to the committed candidate, and application code was unchanged.
No full local verify or unrelated full suite was run.

## Counts and judgments
Before and after: 105 clauses, 23 done, 54 partial, 28 missing. Core 23/45/19 of 87; agent surface 0/9/9 of 18. Clause status, requirement, gap, evidence and generated views are unchanged. Test registrations added: 0; removed: 0; existing command journey extended only. No new DONE/PARTIAL claim is made for this maintenance repair.

## Publication and remaining gates
The assignment explicitly requires Base's COMPLETE/PASS zero-finding scan before a public product push and says a missing scanner blocks publication. Neither the launcher, fleet tools nor product tree contains that scanner. No substitute scan is claimed. The fleet may run its publication scan on the Mac, as the cloud adaptation describes, but this report cannot certify it.
The latest main Ruby failure is unresolved and its assertion log is unavailable within the exhausted API budget. Ruby/bundle are absent in this cloud VM; no Ruby result is fabricated.
The local product commit is 5c2cfed43100970207638e6f29cf20141fae1c17. It changes only tests/commands.mjs and the generated source lock. Its fleet author and committer are correct and it has no trailers. No product push was attempted because the required scanner is unavailable. The clone is retained and an incremental bundle outside the clone has been verified; bundle-receipt.json records its prerequisite and SHA-256. The complete corrected command journey passed. receipt.json and result.json record its final outcome. Evidence publication is separate, report-only transport and does not signal product READY, acceptance or landing.

## Final disposition
BLOCKED, with a completed local correction and a retained clean clone. Product branch cloud/gr-mt-spool-ci-8 has local commit 5c2cfed43100970207638e6f29cf20141fae1c17; it has not been pushed. No PR was created. The final commit has no CI-skip marker.
The incremental recovery bundle is /home/agent/rer-consolidation/work/gr-mt-spool-ci-8/product-candidate.bundle, SHA-256 ef3705a95c293d68b663a76bd082cd462536de56e7556fc1c1152c818cb26794, verified against prerequisite adc3de69b9ae0ff60e41897f8ff7662fd656d560.
Remaining work for the fleet: obtain Base COMPLETE/PASS zero findings on this exact tree; recover the bundle/clone before VM retention ends; review the current main Ruby job's failed assertion within a renewed API budget; run candidate Verify on its exact SHA after authorized product publication; and qualify trusted publishing with the owner's npm registration before a real SDK release. Keep the product branch local until the brief's publication bar is met. No release was attempted.
The report packet is published only to refs/heads/evidence/gr-mt-spool-ci-8 through the provided evidence entrypoint. Its exact returned ref/head belongs in the terminal response; this statement itself is not a transfer receipt.
