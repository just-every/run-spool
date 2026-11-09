# sd-spool-alerts-clock-2

Repository: just-every/run-spool. Product branch: cloud/sd-spool-alerts-clock-2.

## Plan and scope

The complete plan is in PLAN.md. Configure fleet identity/authentication/hooks; clone full history and verify clock-1; make one honest tests-only improvement; replay its deterministic boundary proof and run native alerts once; typecheck and regenerate/check the source lock last; inspect all candidate identities/messages, publish only the named branch, and watch exact-SHA Verify within the ten-call/300-second REST budget; publish this report-only packet separately and remove the product clone at completion.

The fresh clone used `git clone --filter=blob:none https://github.com/just-every/run-spool.git` with no depth. `git rev-parse --is-shallow-repository` returned false. After fetching clock-1, `git rev-parse HEAD` returned exactly `19c2323f302a5e51ab0f2afc13e08e60f0f70745`. Fresh origin/main was `aa853b97de89f949da4fa5876ae525e3b1f343aa`, already an ancestor, so no merge was needed. The new branch starts from the required clock-1 head; its published history is preserved.

## Improvement

`tests/alerts/conditions-journey.mjs` now has a shared `stampInWindow` assertion with inclusive start and exclusive end. The session send helper checks both `started` and `timestamp` on every session payload. The error helper reads the stored receipt and asserts its `received` value before returning its issue. Explicit prior-user and current/prior-scheduled restamps are checked against their respective windows. Failures identify the session/error, field, stamp value and `[start, end)` window, including missing/invalid stamps. A future regression therefore fails at the stamp rather than while reading a missing decision's reason.

All 33 existing explicit assertions are preserved verbatim; the shared guard adds one assertion site (33 -> 34). No test is deleted, skipped or weakened. No product code, CONTRACT.md, generated contract view, timeout or native test entrypoint changed. The only additional tracked change is the regenerated digest for this test in sources.lock.json. No proof/ directory or fleet evidence is in the product tree.

## Deterministic boundary proof

The clock-1 proof script was read from its published report-only evidence at `60a1a23e5c3451eb6f6e525006118e8d66e2c9c6`, then rerun on these candidate bytes, with support for the new guard and boundary/mutation assertions. The actual before/after fixture helpers, candidate issue SQL and production `decision()` run over SQLite. This is deterministic small-script qualification; it does not claim a fake-clock full Worker journey.

The fixture begins at `2026-11-09T17:00:59.800Z`, sends at `17:01:05.800Z`, and evaluates `[17:00:00.000Z, 17:01:00.000Z)`.

- REPRO before clock-1: session timestamp and error receipt cross :00; candidate count 0, no decision, and reading reason raises TypeError.
- Session-timestamp-only control still has no decision: candidate SQL selects error receipts; sessionMeasure selects session started. This distinguishes the causes.
- PROBE with the clock-1 fix and clock-2 guards: timestamp/receipt are `17:00:00.200Z`, candidate count 1, and the decision is affected=3, denominator=10, value=30, fired=true.
- GUARD: start and end-1 pass; start-1, end, NaN and missing stamps fail. Mutating session started, session timestamp or stored error receipt to end produces an assertion naming the stamp/window before any missing-decision TypeError.

The script and complete output are boundary-probe.mjs and boundary-proof.log.

## Mechanical checks

Setup with fleet owner identity and non-interactive mode passed. The emitted application build, typecheck, contract-docs check and first-party repository check passed. The raw setup log is excluded because it can contain private local owner-entry links; setup-receipt.json records the actual command/exit. Build output is sanitized.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; check=pnpm source:check exit=0

The source lock was regenerated last after all test-source edits; only the test digest changed. Diff whitespace validation passed. Local shell Node is 24.19.0, pnpm 10.12.4; the repository pins Node 22.20.0 and rer selects that runtime for its commands. mechanical-receipt.json and the actual check logs retain commands and results.

## Acceptance and custody

Before -> after: Core 23 done / 44 partial / 20 missing (87 total) unchanged; Agent surface 0 done / 8 partial / 10 missing (18 total) unchanged; full target 23 done / 52 partial / 30 missing (105 total) unchanged. Homepage claims remain 3 done / 7 partial / 0 missing (10 total). Clause status changes: none. CLAIM none.

Repository guidance permits fleet branch landing and does not require a PR for this change. No PR or landing is claimed. Fleet publication scanning and landing remain independent Mac gates. Evidence publication only transfers reports and does not signal READY, acceptance or landing.

Native alerts: `cloud_run timeout --kill-after=10s 10m node tests/alerts-native.mjs` ran once directly in this dedicated VM and exited 0: 3 tests, 3 pass, 0 fail, 0 skipped. The real native scheduled spike waits across its measured minute; its timeout is unchanged. See alerts-native.log.

Product commit: `6c400dfa509151626a81c81aae87a12589492206` (`test(alerts): assert fixture stamps stay inside evaluated windows`). One new substantive commit, no skip-ci marker. Both candidate commits relative to main, including all side parents, have fleet authors/committers and no trailers; full messages were inspected. The cloud push guard published the named branch on attempt 1; product working tree was clean. No default branch was pushed.

## Resumed custody review

A resumed environment retained the already published product candidate and complete local receipts. A second fresh full-history partial clone independently confirmed remote cloud/sd-spool-alerts-clock-2 equals `6c400dfa509151626a81c81aae87a12589492206`, origin/main remains `aa853b97de89f949da4fa5876ae525e3b1f343aa`, and clock-1 resolves to the required SHA. No extra product commit or push was made. The original 33 assertions, unchanged contract/view/native-test hashes, and saved proof-script/output hashes were verified against the candidate.

The fifth REST read found Verify 42691915701 attempt 1 completed/cancelled on the exact product SHA. This is not green and no READY is inferred. Its job results and any bounded recovery follow in the actual CI receipts.

## Final exact-SHA CI result and blocker

Verify run `42691915701` on exact SHA `6c400dfa509151626a81c81aae87a12589492206` finished **completed/cancelled**, attempt 1: https://github.com/just-every/run-spool/actions/runs/42691915701. The one REST watcher used 6 of ten calls, all at least 300 seconds apart, including discovery and the job-list inspection. Actual responses and call times are in ci-run.json, ci-jobs-attempt-1.json and ci-calls.json; ci-receipt.json records the terminal custody.

`verify (alerts)` job **129414199533 passed**. `verify (project-erasure)` job **129414199568 passed**, so the allowed sole project-erasure 409 flake rerun does not apply. Every other executed runtime/test job passed except `verify (sdk)` **129414199420**, whose Run suites step was cancelled after 1517 seconds (20:21:02Z to 20:46:19Z), at the workflow's existing 25-minute cap. Its dependent `shards (spool)` **129428292617** and aggregate `verify` **129428341882** failed; full-push-proof was skipped. No suite assertion failure is present in the returned metadata; the aggregate shell failures follow from the cancelled dependency. No timeout was changed, no unrelated SDK file was edited and no additional product push or job rerun was made.

This is a real CI blocker outside the test lease, not the generated-contract-view exemption. **Not READY.** The lane can investigate the SDK cancellation and authorize a retry or fix under the appropriate lease. Product custody remains pushed at the exact SHA above; no acceptance or landing claim is made. No PR was required or created.

Before/after clause counts remain Core 23 done / 44 partial / 20 missing; Agent surface 0 done / 8 partial / 10 missing; full target 23 done / 52 partial / 30 missing. Clause status changes none; CLAIM none. Existing explicit assertion sites 33 -> 34, with all 33 preserved. Native alerts 3/3 passed once; deterministic boundary/mutation proof, typecheck, source lock regeneration/check and first-party check all passed.

The complete explicitly selected report/receipt packet is published only to evidence/sd-spool-alerts-clock-2. Both product clones and their node_modules are removed after successful transfer; actual packet files remain under the fleet work directory.

PUSHED branch=cloud/sd-spool-alerts-clock-2 head=6c400dfa509151626a81c81aae87a12589492206

BLOCKED repo=just-every/run-spool branch=cloud/sd-spool-alerts-clock-2 head=6c400dfa509151626a81c81aae87a12589492206 blocker=Verify-42691915701-sdk-job-129414199420-cancelled-at-25-minute-cap
