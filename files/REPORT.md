# gr-mt-spool-code-9-c2

Repository: just-every/run-spool
Branch: cloud/gr-mt-spool-code-9-c2
Base: e206a1ca9a631059818333837062a90bd225443d (current origin/main at clone)
Product head: 5e15354d3219caa5e765e54e83b6c23f686af9d4

## Plan and implementation

The full plan is in PLAN.md. Read the launcher and product AGENTS.md, CONTRACT.md, and generated ACCEPTANCE.md. No root TESTING.md exists. No other repository was cloned or modified. Current Base source and the pinned Gitleaks release were read through gh api only. The exact Base source was fetched as an API archive, not a Git clone.

The inbound-filter SDK test edge previously passed `new URL(req.url, originalOrigin)` to fetch. An absolute or network-path request target could replace that origin. This is a real issue in the test fixture, not a false-positive disposition.

The repair validates that the fixture origin is HTTP on 127.0.0.1 and that the project's DSN has that same origin. It constructs the forwarding destination from this fixture origin and the project DSN, including the Sentry key/version query. The request URL is used only to reject foreign origins or an unexpected envelope path, and never supplies the fetch destination. Redirects remain manual. SDK bytes and allowed headers still pass through unchanged. All existing SDK-006 assertions, SDK transports, integrations, and responsive journeys are retained.

Only tests/inbound-filter-flow.mjs and its single sources.lock.json digest entry change. The complete HTTP journey refreshed tracked TEAM-004 screenshot outputs; these generated files were restored from HEAD and source:check was repeated successfully. No release, clause, acceptance text, generated view, package pin, alert disposition, or unrelated fix is included. No new product test was added.

## Validation

- Dependency installation and public rer setup completed; setup built the application and applied all 99 local migrations.
- Typecheck passed on Node 22.20.0.
- Contract documents check passed: 0 errors, 0 warnings, current views.
- Source lock regenerated last with the documented edition-authoring command; source:check passed. Exactly one file digest changed.
- Four isolated probes execute the real edge callback from main and the candidate: absolute foreign URL, network-path foreign URL, credential-bearing foreign URL, and unexpected fixture path. Refusals increased from 0/4 to 4/4; actual foreign-server hits decreased from 2 to 0; unexpected upstream paths decreased from 1 to 0. The old credential-bearing request already failed in fetch with 502. The valid request still returned the upstream 201 and preserved its body and test header. These are local synthetic probes, not a new CodeQL run or an alert dismissal.
- Initial SDK/HTTP journey attempts encountered the absent Playwright-downloaded Chromium binary. They were rerun with /usr/bin/chromium and --no-sandbox through the existing browser helper. Initial logs are retained separately.
- Complete SDK and HTTP journeys passed (exit 0), including SDK-006 real Node SDK coverage at 1440/390 and the inbound-filter public HTTP flow. The SDK and HTTP logs include workerd broken-pipe diagnostics during subfixture restarts; both complete journeys subsequently passed.
- Publication scan: INCOMPLETE, complete=false, rule=scan.deadline-exceeded, exit 2. Diagnostics: slot/process.signal/SIGKILL and report/report.empty. It hit the supported default 300-second total deadline; the result carries no completed history or environment guarantees. The task permits one scan and explicitly requires no product push if it cannot complete. No scan retry, product push, PR, CI query, dispatch, rerun, landing, or deployment was attempted. Four of ten budgeted gh API invocations were used; the blocker is the scan deadline, not API exhaustion. Product custody is local/unpublished, never READY. See publication-scan.json and custody.json. Scanner provenance: Base main 9de808d45b9463eb4e691e7a36d502add3d9f4ef. Its runtime files match the scanner bundled with @runeditrun/rer 0.2.113 byte for byte; seven Base test files are omitted by the npm package. The supported packaged entry point is used so version stamping works without fabricating a Base Git checkout. See scanner-source-comparison.json. Gitleaks 8.30.1 release archive checksum verified against GitHub release metadata; see gitleaks-release.json.

Clause status changes: none. CLAIM: none. SDK-006 remains done. Counts remain 23 done / 54 partial / 28 missing (105 total), before and after.

## Publication limits

The assignment explicitly requires no PR, no Verify polling, no dispatch, and no rerun. Its requested READY handoff follows successful local checks, a complete passing publication scan, one guarded product push, and remote-head verification. Exact-SHA Verify and guarded landing remain the fleet's responsibility. No hosted deployment, CodeQL rerun, or acceptance promotion is claimed.

## Blocker and recovery

The scanner returned exactly `INCOMPLETE` / `scan.deadline-exceeded` (exit 2). Complete local checks do not replace COMPLETE/PASS publication evidence. The branch remains local at 5e15354d3219caa5e765e54e83b6c23f686af9d4. A verified Git bundle outside the product clone preserves the full commit and history; see bundle.json and bundle-verify.log. Retain this container or retrieve that bundle before its retention period ends. The fleet can recover the branch and run its independent publication gate with a sufficient scan timeout; this task does not authorize a second scan or bypass. Evidence transport is report-only and does not publish or accept the product commit.

Bundle: /home/agent/rer-consolidation/work/gr-mt-spool-code-9-c2/product.bundle

SHA-256: 8ebf5d6bc32bd184d9ebc05156a584fdb1f717f01d104d89a9fe29180ba80e8e

Remote-head query succeeded and the named product branch is absent.
