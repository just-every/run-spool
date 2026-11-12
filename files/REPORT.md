# main-spool-settings-split-1-c1

Repository: just-every/run-spool
Branch: cloud/main-spool-settings-split-1-c1
Head: 8ef55561973155476e8c9c8d98c1c7b2e80c8b70
Base: 7b8cc6213c14b0e2af650e2d6289dd0ac59871aa
Original Settings head: a6ba9c9eb819120a3a4a40968e5220a72bd6de93

## Result

Squashed the original Settings round onto current origin/main as exactly one commit with no merge commit. The 23 changed files are the original round's files. All application and test content matches the original round; sources.lock.json was regenerated last and checks successfully. No SDK flake fix, unrelated feature or clause judgment was included.

Settings has seven fragment-addressable sections: Organization, Projects & keys, Issue processing, Alerts & integrations, Privacy & filtering, Data & archive, and Audit. The 23 original top-level setting/action blocks are preserved verbatim inside their new sections. Legacy control fragments discover their containing section. Existing navigation tests retain their assertions; 18 helper files change only section fragments, Slack's existing flow adds two section clicks, and the existing triage journey gains Settings assertions without a new registration.

## Counts and contract

- Settings pages/sections: one undivided view → seven addressable sections.
- Original setting/action blocks: 23 → 23; none missing.
- Additional test registrations: 0; no test-budget.json override or cap increase.
- Declared clause summary before and after: 23 done, 53 partial, 29 missing; total 105.
- UX-001 remains PARTIAL. Clause status changes: none.
- CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to origin/main. Hashes and comparisons are in product-receipt.json.

CLAIM UX-001 PARTIAL points=none tests=tests/triage-journey.mjs#journey
GAP UX-001: Existing broader team/mobile coverage, human screen-reader and VPAT gaps remain; this round does not claim completion.

## Plan and validation

The complete plan is PLAN.md. Fleet identity and credential helper were installed before repository work; the cleanup commit hook remains active. Dependency setup and build succeeded through cloud_run. Typecheck, source lock check and contract generator check passed. The existing triage journey passed (22 behavior groups; all existing archive, recovery and owner flows retained), including desktop Settings behavior and the existing phone smoke. The existing Slack Settings flow passed at 1440 and 390, including connect/test/review/rotate/revoke through native UI with its recorded network edge.

The actual external harnesses are included as settings-proof.mjs and settings-slack-harness.mjs; their import paths identify this task checkout and can be adjusted when reproduced elsewhere. Browser proof covers each of the seven Settings sections once at 1440 and 390 (14 screenshots). Every recorded document width equals its viewport width, and all seven navigation links fit within it. Original block inventory, browser measurements and actual logs are included. The first screenshot attempt collided with the triage journey's restore-worker port; changing only the external harness to unused port 16483 resolved it. No product change was needed.

The cloud cannot run the fleet publication scan. The fleet must perform it before landing. The source branch was not changed. No PR is required by this repository's AGENTS.md; only the named product branch will be pushed. Landing, main Verify and deployment remain fleet-owned gates.

## Custody and exact-SHA CI

Product push succeeded on the first attempt, to cloud/main-spool-settings-split-1-c1 at 8ef55561973155476e8c9c8d98c1c7b2e80c8b70. Git ls-remote confirmed that exact remote head. No PR was created. No commits were added after the push.

Exact-SHA Verify: https://github.com/just-every/run-spool/actions/runs/43139064627

The first attempt completed with failure. Its build, SDK and most other jobs succeeded. Root failures were:

- verify (owner-ui), job 130921765752, Run suites: tests/triage-journey.mjs:223 received rejected instead of accepted for the built-in Capture test exception. The local complete triage journey passed. This assertion was not changed by the replay; the CI failure is not being classified as the original SDK flake or dismissed as unrelated.
- verify (runtime), job 130921765780, Run suites: tests/product-runtime.mjs:77:12 reported UND_ERR_SOCKET (other side closed) for POST /api/ingest/budget, request ordinal 346. That file is unchanged by this round. Audit-history Settings checks had passed earlier in that job.
- verify (agent-handoff), job 130921765813, was cancelled. The two dependent summary jobs failed.

The completed-run failed log was fetched once through gh run view for owner-ui. The runtime step was read from that same downloaded workflow archive, without another provider request or direct blob download. Runner environment sections are omitted from the public failed logs. Actual job metadata, sanitized logs and receipts are included.

The failed-job rerun was accepted once through the REST rerun-failed-jobs endpoint. That was the tenth and last allowed GitHub call. Its conclusion has not been observed. Current custody is PUSHED, not READY: the rerun's successful exact-SHA Verify remains outstanding. No green result is claimed from another head. ci-receipt.json records the last completed first-attempt observation; ci-rerun-receipt.json records the accepted rerun; terminal-receipt.json records pending rerun custody.

## Evidence and handoff

The complete relevant non-secret packet will be published only to evidence/main-spool-settings-split-1-c1, using the separate report-only entrypoint. The fleet retrieves its exact evidence ref/head and verifies the manifest and file hashes. Evidence publication does not signal product acceptance or landing. The cloud publication scan remains unavailable; the fleet's scan and landing checks remain required. The successfully pushed clone is removed after evidence publication and verification; the actual packet stays outside it.
