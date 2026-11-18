# Spool Issues owner journey replay

Task: sd-spool-design-issues-4. Repository: just-every/run-spool. Product branch: cloud/sd-spool-design-issues-4.

## Plan and execution

1. Confirm the round-one proof ref and round-three source ref. Replay 388c978d, 5f4dfd83, 21a434c3 and 24037685, in that order, on fresh Spool main as ordinary commits. Carry forward current main’s Worker connection handling in the product runtime test while replaying the restore request’s independent fresh connection. Regenerate the source lock from the combined tree. Check that the range from origin/main contains no merges.
2. Re-run the tunnel job’s SDK path and read the historical failed job at its exact SHA. Isolate the first filter setup failure in a browser against the emitted Worker. Keep the persisted-policy and unmodified SDK intake assertions.
3. Qualify the candidate with the owner Issues, Capture and operator journeys, the Sentry CLI comparison, contract generators and build checks. Preserve the changed screen proof from the synthetic owner journey at 1440 and 390. Validate release source metadata through rer without producing release artifacts.
4. Refresh the main ref immediately before publication. Audit every candidate commit’s identity and trailers, confirm linear history, publish the product branch once and watch Verify at its exact SHA. Publish this report and its receipts using the evidence ref.

## Tunnel diagnosis

Historical Verify 44201588936 at fdcbe49c5f65a04faf69ce08ceddb72568bc41af failed job 134457416878. The archived log locates the failure at the first persisted-policy check in sdkInboundFilterFlow (historical lines 115 and 127). That check waits for the enabled allowlist with two values and one configured legacy-browser rule. The preceding TRACE and aborted-request lines came from intentional requests in the tunnel test, which registered its pass before the SDK test started.

The replayed suppression-policy read fence sits in the issue’s OperatorPanel. The settings screen uses its own InboundFilters component, useSettingDoc save pump and revisioned inbound-filter API. The historical SDK fixture checked the allowed-domains toggle before entering the values. A browser control reproduced HTTP 400 and the server’s reason, “Configure allowed domains before enabling the filter.” An overlapping rejected save can stop the pump before it sends the following draft. The same control confirmed two HTTP 200 receipts when the disabled allowlist was saved first and then enabled. The old full SDK attempt locally passed the inbound-filter portion before its overall time cap, consistent with a timing-dependent failure.

The test fills and blurs the allowlist, then waits for the exact values on the server while the filter is disabled. It enables the filter afterward and retains the final persisted-policy check and every subsequent intake and receipt assertion.

## Contract counts

| Scope | Before | After |
| --- | --- | --- |
| Core | 23 done, 45 partial, 19 missing (87) | 23 done, 45 partial, 19 missing (87) |
| Agent surface | 0 done, 9 partial, 9 missing (18) | 0 done, 9 partial, 9 missing (18) |
| Full target | 23 done, 54 partial, 28 missing (105) | 23 done, 54 partial, 28 missing (105) |

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).

## Sentry CLI comparison

The previous round’s raw harness receipts recorded two passes and one socket failure on main f44efc8 and two passes and one socket failure on the unprotected replay 388c978. Both failures came from owner inventory reads around archive and refusal steps. This is the comparison that motivated the bounded GET recovery already in the four replayed commits. The recovery first tries the original request. It handles only UND_ERR_SOCKET and ECONNRESET from an owner GET, checks public /health before retry, and makes at most two retries. The real TCP fixture confirms recovery, unchanged 403 handling, bounded persistent errors and a single POST attempt. The restore fixture separately verifies fresh write connections, the original body and status, and a single dropped POST attempt. [Historical comparison receipts](https://github.com/just-every/run-spool/blob/ebf3feba978c26978014c7e3e3cb820d1afda662/files/comparison-receipts.jsonl)

On this run the full released Sentry CLI journey passed once on fresh main and once on the final candidate. Each also had three earlier attempts that hit their hard deadline. No attempt produced a Sentry socket assertion failure. The shortest limits were 240–480 seconds, and the candidate’s 900-second trial reached the second populated policy/refusal sequence before the deadline. The recorded completed comparison includes the local test exit and the full suite’s success marker.

## Local qualification and product custody

Main was d85f48247ecc0d9ec475fbc5e825ec46753e5b7d at the final fetch and was already the candidate’s base. The range has five normal commits, including the four ordered reapplications, and zero merges. The combined restore test keeps main’s Connection: close handling and the replayed fresh dispatcher for archive writes. All five authors and committers are Run Edit Run fleet, with no trailers. The one product push was confirmed by a remote ref read at 1e0772865a2bb961ce0dd10d3fa7d41c52f19666.

The owner triage run passed 22 groups and generated 110 journey captures. The focused browser receipt contains 18 masked PNGs across nine changed states, one at 1440 and one at 390 in each state. The focused functional assertions run at 1440. The same emitted Worker’s full product runtime passed independent restore, browser exception, Worker transport and retention checks. The public tunnel suite, packed SDK checks, and multilingual suite passed. Earlier parallel owner UI, product, and full Sentry SDK runs exceeded their local time caps. The inbound-filter section of the first full candidate SDK run completed before that deadline. The next full Sentry SDK run passed with browser and Node SDK 11.6.0. The receipt records recovered process exit codes after the cloud command connection reattached.

The frozen install, first-party check, source lock check, offline Base copy verification, application build, integration and type checks passed in workflow order. The public rer build and integration and agent-surface generators also passed. Contract write and check matched main. The generated views were restored and the source lock was regenerated last. The stock rer release source inspection confirmed a clean committed source tree, matching version 0.7.14 and an empty contract change record.

## Project erasure control

The first local project-erasure attempt stopped in the isolated rer setup with cliErrorCode=command_failed, before making an erasure request. The clean local retry reached dev readiness and a later dev restart, then exceeded its 850-second cap. No HTTP 409-versus-202 discrepancy was recorded. The hosted project-erasure job completed successfully on the exact candidate. [Project erasure job](https://github.com/just-every/run-spool/actions/runs/44211950946/job/134492842565)

## Exact-SHA Verify

GitHub Verify 44211950946 showed completed/success at 2026-11-18T01:23:06Z on 1e0772865a2bb961ce0dd10d3fa7d41c52f19666. The tunnel, Sentry CLI, owner UI, runtime and project-erasure jobs each completed successfully on that SHA. [Verify run](https://github.com/just-every/run-spool/actions/runs/44211950946)
