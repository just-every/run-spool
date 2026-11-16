# gr-ci-spool-flake-1

Repository: just-every/run-spool. Product branch: cloud/gr-ci-spool-flake-1.
Candidate: b4e6caa9278811f09b1888bcab45a9b0db0b83f9.
Base: adc3de69b9ae0ff60e41897f8ff7662fd656d560. PR: none, as instructed.

## Plan

The complete plan is in PLAN.md: inspect the failed/passing CI attempts and actual lifecycle; reproduce through the real worker; make the smallest runtime-helper change; run focused proof, execution and typecheck; update from main; scan and audit the exact commit; push the named branch; observe exact-SHA Verify; publish report-only evidence separately.

## Diagnosis and demonstrated boundary

Run 43775640016 attempt 1 failed at archive-stage tests/execution-journey.mjs:95, inside followErasure -> executionRuntime.json. The actual request is an owner-authenticated, same-origin POST /api/erasures/<accepted-id>/resume on the restored Miniflare worker at loopback port 15477. It is an explicit bounded erasure continuation, not a passive status poll. Each response advances the durable job until its fenced receipt reports complete. The loop retains its 300-second completion requirement and accepted job identity assertion.

The restored worker is already serving requests and is not restarted at that point. There is an earlier deliberate same-port restart of the original worker at 15476. Both runtimes are awaited through runtime.ready and perform native sign-in before returning. The erasure endpoint handles one bounded step and returns 202 or 200; the scheduled sweep is not invoked concurrently by this stage. There is no concurrent request burst from followErasure: it awaits every continuation.

The helper previously used the global fetch pool without Connection: close. The focused reproduction creates an actual project, previews and starts actual project erasure, and sends the real continuation. A diagnostic-channel callback pauses the Node client for six seconds after undici has selected the continuation socket and before writing its headers. This controls the race in which external workerd closes an idle keep-alive socket while the client has not processed the close. The application and native worker are not mocked, and no socket is forcibly reset. The public-door reproducer is included as focused-reproducer.mjs; it is temporary evidence rather than a permanent repository test.

Before: the selected continuation socket had previously received response bytes; fetch failed after 6004 ms with TypeError: fetch failed, caused by UND_ERR_SOCKET: other side closed. After: under the same six-second pause, the continuation used a fresh socket and returned HTTP 200, phase complete. See FOCUSED-BEFORE.txt and FOCUSED-AFTER.txt.

Qualification: the original CI log includes only the top-level fetch failure and test stack, not the underlying socket cause. Its failed-jobs rerun passed. The unmodified full journey also passed locally once. The controlled reproduction establishes a concrete idle-connection failure mode of this helper and the change removes that mode; it does not recover an absent original CI error cause or prove that every possible ECONNRESET has the same cause. Two exploratory pauses before connection selection (16 seconds with the default pool; 6 seconds with an explicit longer-idle pool) passed and did not reproduce the race. No repeated confirmation loop was used.

## Change

Only tests/execution/runtime.mjs changes: add Connection: close to helper requests and a three-line explanation. The helper now gives each application request an independent connection, covering archive/erasure work and its deliberate same-port restart. Endpoints, worker implementation, erasure progression, polling bounds and all assertions are unchanged. No retries, skips, raised timeouts or product mocks were added. No permanent test was added because the full public-door execution journey already exercises the flow.

## Local results

- Fleet setup, public rer setup, rer build: passed.
- Focused controlled race: before exit 1; after exit 0, receipt complete.
- Unmodified execution journey: one run, passed.
- Candidate execution journey: one run, passed, including restore, historical-authority refusals, erasure fences, resumed erasures, zero-row assertions and browser checks.
- pnpm typecheck and git diff --check: passed.
- Toolchain script selected Node 24.19.0 and pnpm 10.12.4; CI uses Node 22.20.0. Browser runs used system Chromium with --no-sandbox.

Actual compact results and row counts are in LOCAL-CHECKS.txt, baseline-counts.json, candidate-counts.json and RECEIPT.json. The archive contains 11 reproducers, 20 runs and 3 workflows in the measured baseline. Every one of the eight final execution erasure table counts is asserted zero. Exact receipt/attention counts are recorded rather than treated as fixed acceptance totals.

## Contract and claims

Clause changes: none. CLAIM: none. Counts are unchanged: Core done/partial/missing 23/45/19 (87); Agent surface 0/9/9 (18); Full target 23/54/28 (105). CONTRACT.md, ACCEPTANCE.md, docs/CLAIMS.md and source locks are unchanged.

## Publication and custody

Current main was fetched before committing; it remained adc3de69b9ae0ff60e41897f8ff7662fd656d560, so no rebase or merge was necessary. All candidate commits, including side parents, are audited for fleet author/committer identity and empty trailers before product push. The fresh Base scanner was obtained through the GitHub API from runeditrun/base main 418983385dcf713e85c98cf500dd244b1983e77a, without cloning another repository. Gitleaks 8.30.1 is used unchanged. The API archive has no Git metadata; the scanner supports a vendored inventory stamp, populated here with 0.2.118-dev.g41898338 derived from the unchanged global/package.json and archive commit. No scanner code or exclusions changed. Generated build output, local setup state and test artifacts were preserved in private-runtime-state outside the product clone before the scanner reached its working-files phase; only committed source plus excluded dependency directories remain in the publication working tree. No tracked source was removed. The initial scan reached its default 300-second deadline and returned INCOMPLETE; its actual report is PUBLICATION-SCAN-FIRST.json. The unchanged scanner was restarted with its documented --timeout-seconds 1200 option. PUBLICATION-SCAN.json records PASS, complete=true, zero new findings, 17 pre-existing findings, and the exact candidate commit. The completed scan inspected 957 commits, 947 trees, 8,056 blobs and 21 tag messages in 442.217212 seconds. No application/test timeout changed.

Product push and exact-head CI outcomes are recorded in RECEIPT.json, PRODUCT-PUSH.txt and CI-STATUS.json when available. Evidence publication is separate report-only custody and does not signal acceptance, landing or READY. No default branch, PR, inbox or state file is written. The fleet must still perform its independent publication and landing gates.

Product push succeeded on its first guarded attempt. Natural exact-SHA Verify run 43782543825 is in progress at https://github.com/just-every/run-spool/actions/runs/43782543825. No PR, rerun or dispatch.
