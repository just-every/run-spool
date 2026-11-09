# sd-spool-alerts-clock-1

Repository: just-every/run-spool. Branch: cloud/sd-spool-alerts-clock-1.
Base: aa853b97de89f949da4fa5876ae525e3b1f343aa (fresh full-history filtered clone, not shallow).

## Plan

1. Configure fleet Git identity, refresh the launcher, install bundle-only Git authentication and publication hooks, and clone only the declared write repository from fresh main.
2. Read repository rules and alert fixture helpers. Keep the change within tests/alerts/conditions-journey.mjs and the generated sources.lock.json. Preserve all assertions, registration, timeouts, product code, contract judgments and generated contract views.
3. Pin the ten session update timestamps to start+200. Pin accepted error receipts in the leased helper to start+200 using the same D1 receipt-update technique already used by the fixture's earlier/later-window cases and baseline journey.
4. Run one deterministic before/after boundary probe with a start at :59.800 and a send six seconds later. Execute the actual fixture helpers, scheduler candidate SQL and production decision function against in-memory SQLite. Include a session-timestamp-only control; do not use repeated full journeys as flake evidence.
5. Run setup/build through cloud_run, then tests/alerts-native.mjs once normally under a hard timeout, and typecheck. Regenerate the source lock last and run its check.
6. Inspect every candidate commit's identity/trailers and diff, commit under the fleet identity with publication hooks enabled, push only the named cloud branch, and watch exact-SHA Verify through bounded REST calls.
7. Save actual non-secret reports and receipts in the packet, publish that explicit packet only to evidence/sd-spool-alerts-clock-1, and remove the product clone and node_modules after successful custody transfer. Retain finished unpushed work if blocked.

## Finding and scope

The requested session timestamp change alone cannot fix the current main's missing decision. `src/domain/alerts/measure.ts` selects sessions by `started`, which was already fixed at start+100; `timestamp` is the update timestamp. `src/domain/alerts/spikes.ts` discovers candidate issues by `events.received` in [start,end). The error helper stamps that implicitly through database wall time, so crossing :00 leaves no candidate issue. Its accepted receipt must also be moved inside the fixed fixture window. No product code change is needed.

The patch adds one receipt update in the existing error helper and changes the one session timestamp expression. Existing explicit previous-window and future scheduled-window receipt updates still override that default. Every assertion, timeout, test and registration is preserved. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are unchanged. CLAIM none.

## Deterministic proof

See boundary-probe.mjs and boundary-proof.log. This is the brief's permitted small-script fallback, not a claim that a fake-clock full Worker journey ran. The test clock begins at 2026-11-09T17:00:59.800Z and ingestion occurs at 17:01:05.800Z for the fixed [17:00,17:01) window. The script executes actual source helpers extracted from origin/main and the working tree, the actual scheduler candidate query, and the actual bundled decision implementation over SQLite. The original candidate set is empty and the original find(...).reason expression throws TypeError. The session-timestamp-only control also has no candidate. With the patch, the candidate exists and the decision has affected=3, denominator=10, value=30 and fired=true.

REPRO alerts: events stamped new Date() across :00 -> no decision (TypeError)
PROBE alerts: events stamped inside the window across :00 -> decision present

## Acceptance counts

Before and after are identical: Core 23 done / 44 partial / 20 missing (87); Agent surface 0 done / 8 partial / 10 missing (18); total 23 done / 52 partial / 30 missing (105). Claims 10: 3 done / 7 partial / 0 missing. No clause status changes, no CLAIM, no landing claim.

## Validation and custody

Setup: exit 0. Completed results and exact product/CI provenance follow.

Local completed checks: setup exit 0; build exit 0; deterministic probe exit 0; typecheck exit 0; contract-docs check exit 0; git diff --check exit 0. Local Node 24.19.0 and pnpm 10.12.4 under the supplied cloud toolchain; Verify pins Node 22.20.0.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; check=pnpm source:check exit=0

The generated lock changes only the SHA-256 entry for tests/alerts/conditions-journey.mjs. The product diff has two files, three inserted lines and two deleted lines. Hash receipts confirm unchanged contract, generated views and tests/alerts-native.mjs.

Normal native alerts: `cloud_run timeout 600 node tests/alerts-native.mjs` executed exactly once, exit 0; 3 tests passed, 0 failed, 0 skipped, 0 cancelled; duration 236265.883261 ms. See alerts-native.log.

Product commit and pushed head: `19c2323f302a5e51ab0f2afc13e08e60f0f70745`. Branch: `cloud/sd-spool-alerts-clock-1`. Commit: `test(alerts): pin fixture receipts inside the fixed minute window`. Both author and committer are Run Edit Run fleet <fleet@runeditrun.com>, with no trailers. All candidate commits, including side parents, were inspected before the sole successful push. Working tree is clean. No PR was created; the repo rules name no PR requirement for this fleet branch, and the fleet lands after independent scans. No main push or landing occurred.

Verify run 42665112042 was discovered by exact head SHA and named branch. URL: https://github.com/just-every/run-spool/actions/runs/42665112042 . The single watcher spaces status reads by at least 301 seconds and records them in ci-calls.json. Completed-run diagnostics are recorded separately in the same call receipt.

First-party publication preflight: `cloud_run timeout 180 pnpm run check -- --profile first-party`, exit 0. Fleet publication scanning and landing remain independent Mac gates; this cloud has made no landing claim.


## Final CI result and blocker

Exact-SHA Verify run 42665112042 completed with conclusion **failure** on `19c2323f302a5e51ab0f2afc13e08e60f0f70745`. The build and **verify (alerts)** job 129327317268 succeeded. All substantive jobs succeeded except **verify (project-erasure)** job 129327317282; the two dependent aggregates `shards (spool)` and `verify` also failed, and their proof markers were skipped.

The single permitted failed-job archive read succeeded:
`gh run view 42665112042 --repo just-every/run-spool --job 129327317282 --log-failed` (exit 0).

Its actual assertion is `the erase returns an accepted job`, **409 !== 202**, at `tests/project-erasure/ui.mjs:30`, invoked from `tests/project-erasure.mjs:63`. The failed log is retained in project-erasure-failed.log; job and CI receipts are in ci-jobs.json and ci-receipt.json. Nine GitHub calls were used: seven status reads, one completed-run jobs read and one archive-log invocation. The two aggregate failures follow the failed suite and have no separate product assertion to diagnose.

This failure is outside the authorized alerts-only lease. No project-erasure code/test, product source, contract, timeout or assertion was changed to turn it green. The requested alerts fix is pushed and its own CI shard passed, but **READY is blocked** by this exact-SHA project-erasure assertion. This is not a generated-view exception. The fleet must resolve that failure under its own lease and obtain the required exact-SHA green workflows before landing. No landing claim is made.

## Evidence return and cleanup

The explicitly selected non-secret packet is published only to `refs/heads/evidence/sd-spool-alerts-clock-1`, separately from the product branch. Setup/build raw logs and private local state are excluded; actual command exits are in mechanical-receipt.json. Evidence publication does not confer READY or landing. After successful report transfer, the product clone, its node_modules and temporary compiled proof bundle will be removed as requested; the packet remains outside the clone. Product custody remains the pushed branch and full SHA above.
