# Spool release0711 red-main runtime triage

Date: 2026-11-13 UTC. Tag: sd-spool-0711-ci-triage-1. Repository: just-every/run-spool. Role: read-only CI triage.

Verify **43519208086 attempt 2 completed successfully** on the exact failed/main SHA **4c14f5433cc7885a486db254549079d36443c37a** after one targeted Ruby-job retry. The unchanged local public-door journey passed. The original failure is **UNREPRODUCED** locally and on the permitted CI retry; its immediate assertion cause is documented below, while the underlying exception remains undetermined.

No product/source/test/contract/release edits or product commits/pushes were made. The local cloud/sd-spool-0711-ci-triage-1 branch remains at that same main SHA and was never published. No PR, tag, release, deployment, queue mutation, readmission, full-workflow rerun, new Verify dispatch or shared repair issue was created. The release lock remains in force; this report is not release authorization or product READY.

## Plan and execution

The full advance plan is in PLAN.md. Executed: refresh fleet authentication and Git helpers; shallow-clone the sole declared repository; read seed AGENTS.md, contract/progress and shipped rules; read current run/attempt and all original jobs before rerunning; read each of the three failed-job archives once; distinguish the sole independent failure; request its one allowed retry; build and run the exact unchanged public-door command with pinned Node/pnpm and Ruby 3.3; inspect published SDK loss-report source; read final exact-SHA status and final job metadata; preserve the selected non-secret reports/receipts and publish only the evidence ref. The disposable product clone is scheduled for deletion after confirmed evidence publication. No automatic continuation is authorized.

## Original failure and downstream classification

Run: https://github.com/just-every/run-spool/actions/runs/43519208086

| Job | Attempt 1 ID | Original result | Attempt 2 ID | Final result |
| --- | --- | --- | --- | --- |
| runtime (ruby) | 132209451995 | failure, independent | 132223606034 | success |
| shards (spool) | 132216969096 | failure, dependent | 132223964322 | success |
| verify | 132217024904 | failure, dependent | 132224000296 | success |

The initial 31 job records all had run_attempt=1: 24 successful, 3 failed, 4 skipped. There had been no earlier retry. Ruby failed at 22:28:05Z in `tests/sdk-runtimes.mjs:41:10`, not in runtime setup/build. Its failed step ran `node tests/sdk-runtimes.mjs "ruby"` with Node 22.20.0 on ubuntu-24.04.

`shards (spool)` does not run an independent test: verify.yml lines 434–457 require BUILD, RUNTIMES and TESTS to be success. The observed failed-step dependency values were BUILD=success, RUNTIMES=failure and TESTS=success. All the individual non-Ruby runtimes and test jobs were successful in initial-jobs.json. The shard failure therefore follows Ruby; it is not another repair or retry candidate. Aggregate `verify` checks SHARDS=success for the full coverage partition and likewise failed downstream. Original failed logs are preserved as ruby-attempt1.log, shard-attempt1.log and aggregate-attempt1.log; runner environment blocks are omitted from the public packet.

## Line 41 cause, supported by evidence

The assertion compares sorted project-outcome entries from Spool's public API to `expectedOutcomes(reference.sent)`, computed from a separate reference-collector execution of the same SDK program. The program runs handled, crash, handled in fresh processes on each side, with only the DSN changed. Every one of the seven expected buckets had the same count in the failed CI actual array:

| Outcome | Reference expectation | Failed CI Spool |
| --- | ---: | ---: |
| accepted | 3 | 3 |
| check_in_unrouted | 2 | 2 |
| client_discarded:error:before_send | 2 | 2 |
| sentry_unsupported_attachment | 7 | 7 |
| sentry_unsupported_other_telemetry | 3 | 3 |
| sentry_unsupported_performance | 4 | 4 |
| session_stored | 1 | 1 |

The strict equality failed solely because the actual array had these four additional buckets, absent from the reference expectation:

| Additional outcome | Failed CI count |
| --- | ---: |
| client_discarded:error:network_error | 1 |
| client_discarded:log_byte:network_error | 518 |
| client_discarded:log_item:network_error | 1 |
| client_discarded:monitor:network_error | 1 |

These counts have different units; 518 is log bytes, not 518 events. This is an extra SDK loss-report mismatch, not evidence of a missing one of the three expected error-event counts. It does not prove byte-for-byte event equivalence or eliminate other unobserved failures.

Spool's `clientReportCounts` builds `client_discarded:<category>:<reason>` from an actual client_report payload's discarded_events and quantity. Its intake route accumulates those report counts. The harness expectation uses only reports received during the reference execution. These source paths explain exactly how Spool-side reports absent from the reference produce line 41's extra entries; SOURCE-EVIDENCE.md records the immutable source and line numbers.

Read-only inspection of the published sentry-ruby 7.1.0 gem confirms that `Client#send_event` and `Client#send_envelope` record `network_error` after rescued exceptions; `Transport#record_lost_event` records both count and byte quantities, and pending client reports serialize those entries. `HTTPTransport#send_data` can raise on non-2xx statuses as well as network exceptions. SDK-SOURCE-EVIDENCE.md records the URL, downloaded gem SHA256 and relevant line-numbered excerpts. Therefore the label alone does **not** prove a socket/network infrastructure fault, a particular HTTP response, a worker cold-start issue, or a Base/rer defect. The original failed-step log contains the assertion arrays but no underlying Ruby transport exception/status; the harness captures child stderr but does not surface it at line 41 when the child exit is acceptable. No particular transport exception can be assigned from these receipts.

## One retry, with receipts

At 22:58:33Z the sole request was:

```sh
gh api --method POST repos/just-every/run-spool/actions/jobs/132209451995/rerun --include
```

GitHub accepted it at 22:58:35Z with HTTP/2.0 201 Created and body `{}`. No direct shard/aggregate retry was requested. Ruby attempt 2 executed 22:58:40–22:59:29Z; its dependent shard executed 22:59:31–22:59:34Z and verify 22:59:37–22:59:39Z. The run was completed/success, updated 22:59:40Z, when read at 23:03:34Z. RETRY-RECEIPT.json contains the actual request/response projection and final job receipts.

The final all-attempts endpoint returns 62 records, including retained attempt-1 successes represented again under attempt 2 with their original timestamps. These retained successes must not be described as newly rerun. Only Ruby and the two dependent aggregate jobs have new successful execution timestamps after the request. Latest status per job name: 27 success, 0 failure, 4 skipped, across 31 jobs. The skipped jobs are commands, light, nightly-proof and full-push-proof; no skipped proof is claimed to have run.

GitHub budget: 8 of 10 invocations used: initial status, initial all-attempt jobs, one failed-log archive invocation for each of three failed jobs, one targeted retry POST, one final run status, and one final all-attempt jobs receipt. No failed archive read was retried. Final run-status reading was more than 300 seconds after both the initial reads and the retry request; no status polling loop or parallel watcher ran. The initial jobs read was one-time attempt/job diagnosis, and the final jobs read was one-time completed-run receipt collection, not recurring status polling. GITHUB-CALLS.jsonl records exact commands and UTC times.

## Unchanged local reproduction

Exact failed SHA, exact current main as cloned, and exact local HEAD were identical: 4c14f5433cc7885a486db254549079d36443c37a. There are no two different product revisions to compare. `git status --porcelain` was empty after the run, and `tests/sdk-runtimes.mjs` SHA256 remained 38d12aa4653403a1a4ae880198bc1870fc4d3873b0b287b8c6d9baa8e08abd94.

Commands: `pnpm install --frozen-lockfile` (exit 0); `cloud_run pnpm run build:app` (exit 0); then `cloud_run node tests/sdk-runtimes.mjs ruby` (exit 0, 23:01:07–23:01:42Z). This is the same original public-door script; it was neither copied nor edited nor weakened. It runs a migrated emitted Worker and the real unmodified sentry-ruby 7.1.0/Rack 3.2.4 fixture against reference and Spool DSNs. Its complete later assertions and existing 1440/390 screen reads finished successfully.

Matched: Node 22.20.0, pnpm 10.12.4, frozen repository dependencies, SDK 7.1.0/Rack 3.2.4, Ruby 3.3 family, and RER_SERVERS_DISK_FLOOR_GIB=4. Local differences: Debian GNU/Linux 13 x86_64 rather than ubuntu-24.04; locally built Ruby 3.3.10/Bundler 2.5.22 rather than ruby/setup-ruby's resolved 3.3 patch/build (the exact CI patch was not established by failed-step logs); `/usr/bin/chromium` with `--no-sandbox`; local build rather than downloaded CI build artifact; cloud proxy configuration rather than the GitHub runner network. These are recorded differences, not assigned causes. No `rer setup`, dev server, production access or deployment was required: the journey starts and cleans up its own isolated Worker. cloud_run reaped the owned test/browser descendants; no active owned server remained after completion.

The local sent-item counts were event=3, log=3, attachment=7, check_in=2, transaction=4, client_report=2 and sessions=1. Its seven project-outcome buckets exactly matched the expected rows above and contained none of the four extra network_error buckets. LOCAL-RECEIPT.json and local-ruby.log contain the actual local exit/time/runtime and result JSON. BUILD-RECEIPT.json records prerequisite command results. **UNREPRODUCED** is the outcome; a passing retry does not establish a permanent repair.

## Counts, scope and recommendation

Generated acceptance counts before → after are unchanged: Core 23 done / 45 partial / 19 missing (87); Agent surface 0 / 9 / 9 (18); full target 23 / 54 / 28 (105). Clause status changes: none. New, deleted, skipped or weakened permanent tests: none. Product version stays 0.7.10; rer pin stays 0.2.113. No 0.7.11 candidate/tag/publication was created. PRODUCT-PROVENANCE.json records clean product state and counts.

The shipped context and available seed HANDOVER/source history were inspected. No current gr/fv inbox or repair handoff was provided in this cloud task, and INBOX.md/STATE.md were not read. No new shared repair ownership or Base/rer issue is asserted or duplicated: there is no reproducible shared defect on which to base the requested smallest repair lease. The fv POST is a CI diagnostic advisory, not a repair lease. If this recurs, the narrow next investigation is the original Ruby SDK transport exception/HTTP outcome and associated synthetic worker diagnostic for the failing execution before deciding whether the cause is SDK, Spool or infrastructure; do not add a per-seed fallback/retry or weaken reconciliation.

Recommendation to sd: record the original red as an unreproduced Ruby loss-report mismatch, with both aggregate failures downstream, and use the now-green exact-SHA attempt-2 receipt for the lane's separate release assessment. Keep the release lock and normal landing/release gates in force until the owning lane decides. No blocker remains for this read-only triage; the underlying exception remains unknown. Evidence publication is separate from product acceptance, READY and landing.

## Packet and transport

The selected packet includes this report, PLAN.md, the original/final API job receipts, projected initial/retry/local/build/product receipts, original failed-step logs with runner environment blocks omitted, the complete local result log, line-numbered product and SDK source evidence, the GitHub invocation ledger and packet hygiene receipt. No credentials, injected values, environment dumps, symlinks, held-out gate data or private browser/session artifacts are selected. This cloud cannot run the Mac publication gate and makes no publication-scan or landing claim. The report-only helper audits fleet author/committer identities and absent/allowed trailers immediately before its evidence push. The final message supplies the resulting exact EVIDENCE ref/head; the helper manifest binds each selected file's bytes and hashes to the unchanged product provenance. Product branch publication is intentionally absent.
