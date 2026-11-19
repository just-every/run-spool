# Spool S7 — empty Sentry frame filename

Prepared by Codex on 2026-11-19 UTC.

## Plan and scope

1. Reproduce the loss on shallow, blobless main using the emitted Worker, migrated local D1 and a valid project DSN. Send a synthetic event with the browser SDK 11.14.0 frame shape and compare its envelope response, issue list and project outcomes.
2. Resolve a Sentry stack frame's path language from its frame platform, event platform and SDK name in that order. Keep missing locations in rich stack evidence so the issue page can show the original function and coordinates and grouping can continue to use them. Keep present malformed paths subject to the shared strict validator. Leave the bounded source-map diagnostics for located frames.
3. Run the same public input on the candidate, extend the existing intake journey for issue visibility and grouping, and run the seed build steps, Sentry checks and contract and source-lock checks. Push the single product commit from the latest main, check its exact Verify run, and attach this packet separately.

## Reproduction and correction

Main base: bb2efcd34837cd6067d02ce176609d3fc636dad2. The synthetic envelope was sent through the live Sentry-compatible HTTP handler. The response was HTTP 200 with a typed event refusal. The owner read no issues and the project counted one invalid item, zero accepted errors. The captured receipt is in baseline.log. An independent replay on the same main tree showed Invalid item = 1 in the Capture receipts page at 1440 pixels. That receipt is in baseline-browser.log.

The sanitizer now leaves empty text paths absent in stored rich frames. The owner issue page uses its existing unlocated label and the mapped-frame API reports missing_position. The coordinates and function survive. Related Exceptions keeps the correct stack and existing grouping uses the function when the path is missing. Empty and omitted paths group together for the same function, and separate functions produce separate issues. A present malformed path remains a counted refusal. The focused public journey also checks frame and event platform precedence and SDK fallback. Existing Python frames keep their Python handling.

| Same synthetic envelope | HTTP | Accepted | Invalid item | Issues |
| --- | ---: | ---: | ---: | ---: |
| Main | 200 | 0 | 1 | 0 |
| Candidate | 200 | 1 | 0 | 1 |

The existing Sentry HTTP journey carries one additional scenario and has zero new top-level test registrations. SDK-007 acceptance 3 is partially demonstrated through error intake and the retained stack in its issue. The constructed envelope exercises conversion. The remaining clause includes the full default-SDK and telemetry-item reconciliation matrix, including device attachments and category-specific limits. No clause judgment moved. The generated contract views retained full-target counts 23 done, 54 partial, 28 missing, 105 total. Core remains 23 done, 45 partial, 19 missing, 87 total. Agent surface remains 0 done, 9 partial, 9 missing, 18 total.

The lease contains the Sentry frame sanitizer and converter, shared path helper, intake assertions and source lock. The build regenerated the tracked browser capture output locally. The repository's pre-build source check and final source check used the tracked main copy of that generated output. The branch carries the Sentry server change and the lock for the committed source.

The exact candidate appeared on the remote as 533ad0256f36b06811106a35756354239baccbf3 under cloud/sd-spool-s7-empty-frame-1. The same-envelope receipt and screenshots from that checkout are in candidate.log, s7-issue-1440.png and s7-issue-390.png. The existing integration asserts the issue view at 1440 pixels.

CLAIM SDK-007 PARTIAL points=3 tests=tests/sentry-invalid-event-flow.mjs#sentryUnknownFrameFlow — a Sentry browser SDK event whose frame has an empty filename is accepted and shown with the path unknown

GAP SDK-007: Complete the runtime and intake-item matrix, including traces, profiles, replay, logs, metrics, crash and security endpoints, and category backpressure.

## Verification

The ordered local checks completed through the focused intake test: native export, first-party check, source lock and offline Base pin verification, rer build, application build, integration check, agent surface check, typecheck and the S7 intake regression. The existing Sentry HTTP journey also reached its success marker and finished the trailing rate-limit checks.

The broader local test sessions had transient failures. The combined Sentry command reached the roster-import restore and the loopback read reset. The isolated candidate roster test passed on retry. The separate Business import run also encountered a loopback reset. Running the local SDK and Business suites together caused a fixed-port collision in the check-in upgrade control. The exact product commit passed GitHub Verify, run 44557345381. CI discovery and status receipts are in ci-discovery.json and ci-polls.jsonl.

The local Sentry CLI compatibility suite also exited successfully.
