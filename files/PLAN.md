# Plan and investigation

1. Configure the required fleet identity, refresh the launcher, install bundle-only Git authentication and publication hooks, clone only just-every/run-spool, and create cloud/gr-mt-spool-code-9 from origin/main.
2. Read repository instructions and acceptance source. Trace the reported request source, destination construction, listener binding and test caller before choosing a fix or false-positive disposition.
3. Keep the repair at the reported sink: allow only POSTs to the fixture envelope path; derive upstream origin/path from the trusted fixture DSN; preserve request query parameters only in URL.search, plus original bytes, compression and relevant headers; retain manual redirect handling.
4. Extend the existing SDK flow with loopback probes for absolute, protocol-relative, backslash and unexpected request targets, and assert that the foreign receiver is untouched. Add no new test registration and weaken no existing assertion.
5. Regenerate the source lock last and check it. Commit with fleet identity and no trailers, then run the touched SDK journey and typecheck. Use the supplied cloud toolchain, process subreaper and system headless Chromium.
6. Fetch/reconcile main without rewriting published history, inspect all candidate identities/trailers, scan the exact committed tree with Base publication tooling, and publish only the named product branch when its required gates permit. Discover/poll exact-SHA Verify through REST within the shared API budget when available.
7. Preserve terminal provenance and actual non-secret reports/receipts in the packet, publish it only to evidence/gr-mt-spool-code-9, and relay lane messages in the final answer. Preserve finished unpushed work in a verified external bundle if a blocker remains.

# Findings

- The alert location is in tests/inbound-filter-flow.mjs inside sdkInboundFilterFlow's send fixture. tests/sentry-sdk.mjs is its caller. This fixture is not a production request handler.
- The HTTP server binds to 127.0.0.1 on an ephemeral port. Its normal client is a child process using the installed, unmodified @sentry/node SDK.
- The DSN comes from the test application's project-creation API. Before the change, the server passed req.url into new URL(req.url, original.protocol + '//' + original.host), then used that URL in fetch. An absolute or network-path target can override the base host. Local-only test scope reduces exposure but does not make that forwarding expression destination-safe.
- The change rejects non-POST and unexpected raw targets before parsing or forwarding. It creates the upstream from the fixture's trusted origin and fixed envelope path, and assigns only the query component from the request. URL.search cannot change origin/path. Existing redirect:'manual' prevents an upstream redirect from becoming another outbound hop.
- The GitHub integration returns HTTP 403 Resource not accessible by integration for the alert endpoint after all five bounded attempts, with bundle refresh and Git setup before retries. Alert state and CodeQL dismissal/closure cannot be claimed.

# Scope and counts

- Product changes: tests/inbound-filter-flow.mjs and regenerated sources.lock.json.
- Production handlers/UI changes: 0 before -> 0 after.
- Changed source files: 1; lock files: 1.
- Existing enclosing SDK verification-script registration: 1 -> 1; added registrations: 0.
- Unexpected-target probe cases in this fixture: 0 -> 4; required foreign receiver hits: 0.
- Contract status-table counts: done 23 -> 23, partial 54 -> 54, missing 28 -> 28 (105 total).
- SDK-006 status: done -> done. No Status, Gap, Evidence, acceptance text or generated view changes. No new whole-clause completion claim.
- Default: use the documented test-fixture DSN as the sole upstream authority; refuse every other target. No new owner ruling is needed.
