# gr-mt-spool-code-9

Repository: just-every/run-spool
Branch: cloud/gr-mt-spool-code-9
Product commit: 16a3c749f7a85262209ea90ee0660964bdd285bb
Product tree: e6330e86dc0c407a2fefe8613f6991d323195ea3
PR: none; this task uses named-branch custody and fleet guarded landing.
Terminal custody: BLOCKED, local committed candidate and verified external bundle retained. Product push was not attempted because no COMPLETE/PASS publication scan exists. CI run IDs: none; no product SHA was pushed. No PR or READY claim.

## Change and security disposition

Repaired the request-forgery sink in tests/inbound-filter-flow.mjs. Its loopback-only SDK recording edge previously resolved an incoming req.url against the fixture DSN origin, allowing an absolute request target to replace that origin. The edge now accepts only POST requests at the fixture envelope path. The outbound URL's origin and path derive exclusively from the trusted fixture DSN, with incoming data confined to its search component. Original SDK bytes, compression, relevant headers and manual redirect handling remain intact.

The existing SDK flow probes four unexpected target forms and checks that another loopback receiver receives zero requests. It retains the real unmodified Node SDK forwarding and all original public-door filter assertions. sources.lock.json is regenerated. Production source and UI are unchanged. This is a code repair at the reported location, not a dismissal or an uninvestigated no-change decision.

The alert API returned HTTP 403 Resource not accessible by integration on all five attempts, with the required refresh/setup and 15/45/90/150-second backoff. We cannot report the alert's current state or claim that CodeQL has closed it. The supplied alert location/rule and actual source trace establish the addressed sink independently.

## Checks

- Dependency install: cloud_run pnpm install --frozen-lockfile — passed.
- Setup: cloud_run npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive — passed. Its private local output is not in this evidence packet.
- Build: cloud_run npx -y @runeditrun/rer build — passed.
- Syntax: node --check tests/inbound-filter-flow.mjs — passed.
- Types: pnpm typecheck — passed.
- Touched journey: RER_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium cloud_run node tests/sentry-sdk.mjs — passed, including SDK-006's unmodified Node transport and filter flow at 1440 and 390. The entire script reported passed:true and exited 0. Actual complete non-secret output is sentry-sdk.log.
- Source lock: node scripts/edition-authoring/cli.mjs lock, then pnpm source:check — passed.
- Contract views: node src/base/contract-docs.mjs check — current, 0 errors, 0 warnings. No contract text or generated view changes were made.
- git diff --check — passed; product worktree clean.
- Fetched origin/main and rebased before publication scanning: branch already up to date. Only one unpublished fleet commit is a candidate; no published history was rewritten.
- Every candidate author/committer and trailer inspected, including side parents: fleet identities only, no trailers.

The supplied toolchain selected Node 24.19.0 from the VM because it exceeds the repository's minimum pin of 22.20.0; pnpm is exactly 10.12.4. The test browser used system Chromium with --no-sandbox, through the repository launch helper, and all test-created servers/browsers stopped on successful exit. No full local rer verify was run.

## Counts and clauses

Contract status table (105 clauses): done 23 -> 23, partial 54 -> 54, missing 28 -> 28. SDK-006 remains done. Clause status changes: none. The enclosing SDK verification script remains one registration; new registrations: zero. Unexpected-target probes in this fixture: 0 -> 4. Product handler/UI changes: zero. Changed files: one test-flow module plus its source lock.

No new whole-clause completion claim or acceptance-point change is made. The full plan, source/destination investigation and adopted default are in PLAN.md.

## Publication and remaining gates

The first Base publication scan used a clean detached worktree at the exact committed candidate and the pinned Gitleaks 8.30.1 binary verified against Base's installer checksum. Its default 300-second deadline expired while inspecting 907 commits: INCOMPLETE, scan.deadline-exceeded, exit 2. Its actual report is publication-scan-300s.json. The second attempt used a bounded 1800-second deadline and finished with exit 2 / INCOMPLETE after inspecting 907 commits, 897 trees and 7,859 blobs. Its report contains scan.identity-invalid at edition.json and hygiene.github-missing at sources.lock.json, with historical findings retained in its preExisting bucket. No owner environment file is available; no owner environment or secret material was copied to the packet.

GitHub API usage before this scan: nine calls, including five denied alert reads and four read-only scanner/tool-source calls. The mandatory scanner used the tenth call for live visibility resolution; the remaining budget is zero. A task-side wrapper refuses further network calls rather than supplying fabricated visibility answers. No Verify result or run ID is claimed.

The candidate is preserved in a verified bundle outside the product clone; bundle-receipt.txt records its absolute path, HEAD and SHA-256. The bundle is recovery data, not a publication or READY result.


### Scanner tooling correction and blocker

The identity finding was caused by the builder initially extracting an incomplete read-only scanner dependency tree. Restoring edition-authoring and authoring from the same Base archive fixes that invocation issue. The corrected Base identity validator now accepts both the exact candidate and origin/main with logical identity just-every/spool and no invalid paths; edition.json and rer-project.json have no product diff. identity-diagnostic.json is the actual offline receipt. The earlier full-scan findings therefore are not evidence of a product metadata regression. No scanner report has been rewritten or promoted to PASS.

A corrected complete full scan requires live GitHub visibility resolution again; Base explicitly forbids a stale or planted visibility cache. The ten-call GitHub budget is exhausted. The task cannot obtain the required COMPLETE/PASS, zero-findings publication result within the remaining authorization, so the named product branch remains local. Default: preserve the product commit and verified bundle for the fleet to run its publication gate and exact-SHA Verify. No main/default branch, PR, comment, tag or release was changed. The separately required evidence publication changes only evidence/gr-mt-spool-code-9, not product custody.

Remaining gates: a corrected complete passing publication scan, product push to cloud/gr-mt-spool-code-9 through the fleet guard, then exact-SHA Verify. No CodeQL alert closure or hosted acceptance is claimed. Actual terminal result.json uses status cannot because publication is blocked, while security=true records that this is a security repair.
