# Plan and investigation — gr-mt-spool-ci-14

Run Edit Run fleet, 2026-11-17.

1. Configure the fleet identity and decrypted-bundle Git helper, refresh the authorized launcher, clone only just-every/run-spool with full commit history, and create cloud/gr-mt-spool-ci-14 from origin/main.
2. Read repository instructions and the supplied fleet rules. Inspect the completed reported Nightly run and its failing job once; recover the already downloaded gh archive if the old gh CLI renders no step lines.
3. Compare the reported failure with current main and the intervening history. Determine whether a source change is still required before editing anything. Inspect later Nightly results to distinguish recurrence from another stage's failure.
4. Install repository dependencies with its pnpm pin and run Node 22.20.0. Run only the command journey that contains the failed step and the typecheck, through the supplied cloud subreaper. Use /usr/bin/chromium with --no-sandbox via the existing browser helper.
5. If the reported defect is already fixed, return a justified no-change result with exact Git and CI provenance. Otherwise make the smallest fix, relock sources last, run touched checks, scan the committed tree before any product publication, push only the named branch with the guard, and inspect exact-SHA Verify within the ten-call API budget.
6. Keep the actual report, receipt and safe log excerpts outside the product checkout. Publish the selected packet only to evidence/gr-mt-spool-ci-14 using cloud_evidence.py; provide the exact evidence head and lane relay lines in the final response.

## Established facts

- Investigated current main: 1853e3b3b59d49853b5ee7678f851d6de8343fbf.
- Original Nightly 42561208392 at 9271cae322c0e9b9512b45e8340c62bca60d7eed failed pnpm test:commands (job 128977857073) in mobile-preview, after Preview readiness and HTTP health checks passed.
- gh run view --job --log-failed exited 0 with no rendered lines. Its downloaded archive under /tmp/gh-cli-cache did contain the command-job log; nightly-failed-job.log is the relevant complete failing-step excerpt from that archive. No second download was requested.
- Existing main commit e9297446cc645c4509b1e93881a04bf94f6c3e5a fixes precisely that stale assertion in tests/preview-session.mjs. rer 0.2.95+ emits a native one-time owner link in openUrl/ownerOpenUrl. The old test asserted openUrl was undefined. The replacement asserts the native link's origin/path/fragment shape, no dev identity, and keeps unauthenticated 401, absent dev entry/outbox, and genuine owner-session authorization checks.
- Nightly 43153888732 on 56e2029c36482c291eb846d3c33c935302d98250 passed on 2026-11-12; its actual command job 130969269750 completed/success. This is downstream of the existing fix, not a skipped command journey.
- A later Nightly, 43803437294 on adc3de69b9ae0ff60e41897f8ff7662fd656d560, failed slow-readiness (job 133088740043). It did not reach mobile-preview. This distinct baseline failure is reported separately, not represented as a green latest Nightly.
- Exact current-main Verify runs 44022478247, 44018323170 and 44008607802 completed/success at the investigated full SHA. Run site 44018323004 also completed/success at that SHA. These are existing main results, not candidate-branch proof and not proof that the latest Nightly passed.
- Typecheck passed locally under Node 22.20.0 / pnpm 10.12.4.
- Exact current-main all-tier Verify 44022478247 also ran commands / commands job 133834985512 and completed/success. The entire local command journey passed (exit 0), as did typecheck and source-lock validation; actual logs and final receipt are in the packet.

## Scope and counts

No product edits or new acceptance claims are proposed for the already fixed original report. Product files changed: 0 before / 0 after. New or deleted test registrations: 0 / 0. Clause status changes: 0. No CONTRACT.md or generated-view edits. No new product commits, no PR, and no product push unless a still-relevant defect requires one. Evidence publication is separate from product custody.
