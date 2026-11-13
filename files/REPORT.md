# sd-spool-slack-flake-1 plan and results

Repository: just-every/run-spool
Branch: cloud/sd-spool-slack-flake-1
Baseline: 2073114e2a52b168413b9609a8f6c1d13038a8aa
Scope: tests/alerts/follow-up.mjs slackFollowUp; smallest helper plumbing only if necessary.
Claim: none. No clause Status, Gap or Evidence changes.

## Plan

1. Clone current main shallowly with blob filtering, configure fleet identity and preserving commit hooks, and inspect the native runtime and Verify alerts command.
2. Install pinned dependencies and Node 22.20.0, then run bounded setup/build in the dedicated cloud VM. Use system Chromium with --no-sandbox through the existing browser helper.
3. Before editing source, repeat the failing job command from the clean main checkout, recording actual exit statuses and assertion locations. If necessary add documented CPU contention to expose the 100 ms race.
4. Give normal completion and rate-limit phases a several-second Slack timeout. Reopen with a short timeout only after capturing the deliberate lost-response source, when edge.behavior is never. Restore the normal timeout on restart. Keep the existing 10000 ms overlap timeout, all assertions and product code.
5. Run the same bounded job command at least five consecutive times after the fix. Run typecheck and touched alert readers. Check the diff and publication identity/trailers, commit once without skip-ci, and push only the named cloud branch using the fleet push guard.
6. Discover and poll exact-SHA Verify via REST within the ten-call budget, at most one call per 300 seconds per run. Preserve the report, actual test receipts and logs outside the product tree and publish explicitly selected non-secret files through evidence/sd-spool-slack-flake-1.
7. Return product SHA, CI IDs and results, counts, evidence ref and the lane POST line. Do not land, write main/tags, or claim product acceptance.

## Environment and adaptations

The cloud adaptation replaces heavy-slot with direct bounded commands and ci-wait with gh REST. The VM is the remote runner; no Mac slot or load polling applies. Node is explicitly pinned to the CI version. Browser tests use /usr/bin/chromium via RER_CHROMIUM_EXECUTABLE_PATH. There is no UI implementation change. No provider accounts are used; Slack remains the existing recorded edge double.

## Results

The complete local results and product provenance are recorded below. Exact-SHA Verify passed; see the final CI receipt below.

### Baseline observation

The first complete alerts shard passed without added CPU contention (371.519 s).
The second complete command failed under targeted CPU contention after 367.792 s:
`tests/alerts/follow-up.mjs:61:180`, actual `uncertain`, expected `queued`, in the rate-limit phase. This is the same 100 ms Slack deadline defect, observed at a rate-limit deferral rather than the reported first-completion assertion at line 55. It is not claimed as a reproduction at line 55.

The external load harness waits for the existing `[ALERT-002] reviewed Slack test, exactly-once new/regression` console marker, pins the test's JavaScript host to CPU 0 and starts 40 CPU-bound Python processes on that CPU. A helper attempted to keep Worker/compiler child threads on the VM's original CPUs, but this kernel does not expose its `/proc/.../children` input. It therefore had no effect; the effective load also affected newly spawned Worker children. Both helpers operate only on test processes started by this task; no source or assertion is changed. Actual load intervals and full outputs are retained in the packet. The first corrected command used the same load arrangement as a bounded stress pulse. Remaining corrected repetitions use ordinary VM load. See the final baseline totals and load-harness limitation below.

### Fix and assertion preservation

Normal `open()` now uses 5000 ms. After the deliberate lost source is captured with that normal timeout, the test selects `edge.behavior='never'`, closes the runtime, and reopens the same durable state with 100 ms only for the unanswered send. The next existing restart restores the normal timeout. The overlap step remains exactly 10000 ms. No helper or product behavior changed.

The third baseline command failed under the same contention after 412.675 s at `slackFollowUp` line 43 via `testAndReview`: actual `failing`, expected `passing`. Final baseline totals: 1 pass / 2 failures. Full outputs are retained; neither failure is presented as the originally reported line-55 assertion.

All 75 `assert.*` calls in `slackFollowUp` are syntax-identical before and after; both normalized AST hashes are `c7b5808950845ebdc5423507b6aff426dcce45fb485d75495e75657ae45287cb`. No retries or global timeout changes were added.

Typecheck, first-party checks and generated contract-document checks passed. The initial source integrity check reported the intentional edited test hash. The documented `changes` command names only `tests/alerts/follow-up.mjs`; the mandatory source lock will be regenerated after the repeated tests and after restoring their generated screenshots. This is generated integrity metadata, with no acceptance/status change.

### Load-harness limitation and corrected-run protocol

The first corrected command was stressed from 14:41:29.753506Z through 14:54:16.987097Z on 2026-11-13, with 40 CPU-bound processes on CPU 0 and the egress host pinned there. The unavailable process-children file meant Worker children also inherited that affinity, just as in the two failing baseline stress runs. This explains the long elapsed time; it is not claimed as host-only jitter. The complete full-command 20-minute bound and all test assertions were unchanged.

After the sustained pulse, the task interrupted only its load-monitor helper, which terminated and reaped its 40 load processes. It restored the test host and its descendants using PID/PPID metadata; no test or app process was stopped. The ineffective affinity helper was stopped. The actual load stop is in `after-load-stop-receipt.json`; the monitor's intentional exit 130 is not a test exit. The corrected Slack function then emitted all six success probes. The browser portion and the remaining four complete commands run under ordinary VM load. Final pass/fail totals are taken only from the complete command receipt.

## Completed local results

The exact bounded command in every before/after run was:

```sh
timeout --kill-after=10s 20m bash -e -o pipefail -c "pnpm test:alerts && pnpm test:alerts-ui"
```

It ran through `cloud_run` in the dedicated VM using Node 22.20.0 and pnpm 10.12.4, with `RER_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. The existing browser helper supplies `--no-sandbox`.

| Phase | Run | Added load | Exit | Seconds | Actual log |
| --- | ---: | --- | ---: | ---: | --- |
| before | 1 | none | 0 | 371.519 | before-1.log |
| before | 2 | 40 processes, CPU 0 | 1 | 367.792 | before-2.log |
| before | 3 | 40 processes, CPU 0 | 1 | 412.675 | before-3.log |
| after | 1 | sustained bounded pulse | 0 | 1153.674 | after-1.log |
| after | 2 | none | 0 | 386.733 | after-2.log |
| after | 3 | none | 0 | 362.987 | after-3.log |
| after | 4 | none | 0 | 358.27 | after-4.log |
| after | 5 | none | 0 | 358.037 | after-5.log |

Baseline: **1 passed / 2 failed**. Corrected: **5 consecutive passes / 0 failures**, including the full command with the sustained stress pulse. These are independent full-command executions for verification, with no retry logic added to any test.

Typecheck passed. Final source integrity, first-party checks, contract-document check, offline Base-copy verification, integration consistency and whitespace checks all passed. The earlier stale-lock result was resolved by the documented generator. Its sole generated change is the SHA-256 of `tests/alerts/follow-up.mjs` in `sources.lock.json`; the generated screenshots were restored before locking. The final diff is 2 files, 4 insertions and 3 deletions. All 75 assertions remain syntax-identical. `CONTRACT.md`, `ACCEPTANCE.md` and `docs/CLAIMS.md` are unchanged.

## Product custody

Repository: just-every/run-spool
Branch: cloud/sd-spool-slack-flake-1
Head: 07fd7437b0e2fba5b100c3d3a571a5a0ce6a2ca2
Base: 2073114e2a52b168413b9609a8f6c1d13038a8aa
Commit: test: isolate short Slack follow-up timeout to lost responses

One product commit was pushed once, without `[skip ci]`, using the required fleet push guard. It succeeded on the first attempt. Every candidate author, committer and message was inspected; both identities are Run Edit Run fleet <fleet@runeditrun.com> and there are no trailers. The committed test blob equals the source used in all five corrected runs. The product checkout was clean after commit. No PR was required or created; no main, tag or landing write was performed.

Clause changes: **none**. CLAIM: **none**. Before/after contract counts remain Core 23 done / 45 partial / 19 missing (87), Agent surface 0 / 9 / 9 (18), full target 23 / 54 / 28 (105). No product or hosted acceptance follows from these local recorded-edge tests. The fleet retains its independent publication scan and landing gates.

## CI and report return

Exact-SHA Verify was watched through REST with one watcher and a ten-call ledger. Discovery and successive status reads are at least 301 seconds apart. Final CI status is recorded below and in `verify-receipt.json`. Product custody is independent of report transport. The packet is prepared for the separate `refs/heads/evidence/sd-spool-slack-flake-1` report-only ref; the terminal EVIDENCE line identifies its actual published head.

### Final exact-SHA CI receipt

Observed at 2026-11-13T15:44:23Z.
Verify run **43452009602**: **completed / success**.
Head: 07fd7437b0e2fba5b100c3d3a571a5a0ce6a2ca2.
URL: https://github.com/just-every/run-spool/actions/runs/43452009602
GitHub calls used: **5 / 10**. No failed-job log archive was needed.
The workflow passed on the product commit, without the generated-view exception.

Blockers: **none**. Product outcome: **READY** for the fleet's independent publication scan and landing gates. The cloud did not land it. Report publication is separate from that product outcome.
