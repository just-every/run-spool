# gr-mt-spool-ci-20 maintenance report

Author: Run Edit Run fleet, 2026-11-17.

Repository: just-every/run-spool. Product branch: cloud/gr-mt-spool-ci-20.
Candidate: 78a5a167bd88e2a9766846f94437eebb67cab9f8.
Starting main: 337a4cacd736ad172f397f318bb766fa5402ed9a (the reported failure was on 7ece18059c1c7924a5b6f9cc816a7af3900136d5; the subsequent main change only upgrades the Ruby Rack fixture).

## Failure and fix

Completed Verify 44045714537 failed in job 133911463949, verify (runtime), step Run suites. The demo capture and REL-002 suspect flow passed. The deployment journey then failed at tests/deployment-history.mjs:71:646, the native scheduled HTTP request after restoring an archive. Node 22.20.0 reported TypeError: fetch failed, caused by UND_ERR_SOCKET / other side closed. The originating socket had already carried the archive restore request. The two downstream aggregate jobs failed because this shard failed.

The deployment journey reused idle local workerd keep-alive sockets across long browser and archive operations. Its sibling retention and audit journeys and tests/worker.mjs already use Connection: close to prevent that local transport race. The candidate applies the same policy to deployment HTTP requests and restored-worker reads/writes, routes cron triggers through the existing close-connection scheduled helper, and consumes each scheduled response before continuing. It does not replay requests or mask fetch errors. All product state, authorization, idempotency, restore-inertness, timeout-notice and erasure assertions remain.

Product files changed: tests/deployment-history.mjs; sources.lock.json (only the journey's digest changes). No application, homepage, owner screen, workflow, dependency, acceptance text or clause judgment was changed.

## Counts and clauses

Affected journey assertion call sites: 49 before, 49 after; same assertion method counts. The affected standalone deployment journey count is 1 before / 1 after. No test was added, skipped, deleted or weakened. Full-target clause counts remain 23 done / 54 partial / 28 missing / 105 total. Core remains 23 / 45 / 19 / 87; agent surface remains 0 / 9 / 9 / 18. No clause status changes or new acceptance claims are requested. REL-001 and REL-002 remain at their existing judgments.

## Plan and local results

The complete plan is PLAN.md. The local-receipt.json records commands, output digests, candidate identity and counts.

- Fleet launcher, decrypted-bundle Git helper and clone-local forwarding commit hooks installed; only the declared product repository was cloned, with complete history.
- Node 22.20.0 installed to match CI; pnpm 10.12.4 used. Headless browser uses /usr/bin/chromium with --no-sandbox.
- pnpm install --frozen-lockfile: exit 0.
- npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive, through cloud_run: exit 0. Private setup output is not published.
- npx -y @runeditrun/rer build, through cloud_run: exit 0.
- Unmodified node tests/deployment-history.mjs: exit 0 locally once. The closed-socket failure was intermittent and is established by the completed CI archive; it was not independently triggered in that local run. This is not a false-positive or no-change claim.
- Candidate node tests/deployment-history.mjs: exit 0. REL-001 and REL-002 completed, including the restored scheduled trigger, inert history, callback refusal and erasure. The existing journey captured its synthetic desktop and phone screens.
- pnpm typecheck: exit 0.
- node scripts/edition-authoring/cli.mjs lock, then pnpm source:check: exit 0. Lock regenerated last; only tests/deployment-history.mjs changed its file digest.
- node src/base/contract-docs.mjs check: exit 0; zero errors and warnings. Generated views remain untouched.
- git diff --check: exit 0. Pre-publication fetch found no new main commits. Rebase onto origin/main was a no-op. The candidate is one plain fleet-authored, fleet-committed commit without trailers or skip markers.

## GitHub inspection and transport limitations

The failed-job metadata is main-failed-jobs.json. The single allowed gh run view 44045714537 --repo just-every/run-spool --job 133911463949 --log-failed invocation returned exit 0 and no text under gh 2.46.0. Its cached run-log ZIP was complete, so the relevant failure section was read locally without another GitHub request and retained as main-runtime-failure.log. Environment sections and unrelated job output are excluded from the packet.

One optional server-output artifact download failed. Command: gh api repos/just-every/run-spool/actions/artifacts/14312140130/zip. gh followed the redirect and the blob service returned Forbidden; the numeric HTTP status was not printed. The sanitized diagnostic, with signed query removed, is main-runtime-artifact-error.txt. No retry was made. This does not block the fix: the completed job log identifies the failed operation and native socket cause.

## Publication and CI

The first exact-commit publication scan reached its default 300-second deadline while checking a repository with 2,618 reachable commits; it returned INCOMPLETE, retained as publication-scan-initial.json. The same pinned scanner completed with its supported 1,200-second deadline: 983 selected/public-base commits, 973 trees and 8,211 blobs, in 446.68 seconds. Its findings were an incorrect invocation argument (the repository parameter requires a full URL) and working-only setup/build artifacts, not committed product content. That receipt is publication-scan-working-tree.json. A corrected scan now targets a clean exact materialization of every committed blob and mode, sharing the full Git history, with the repository URL. A clean git diff against HEAD proves the materialization matches the candidate. No setup state, credentials, build output or test artifacts were materialized; no rule was waived or scanner code changed. No public push is allowed until it returns complete PASS with zero findings. The corrected clean-tree scan returned complete PASS with zero findings for candidate commit 78a5a167bd88e2a9766846f94437eebb67cab9f8 / tree 3863941bc12f3b5738c622bee5d03f93fd7e2d56, with historyScanned and environmentChecked true, in 424.39 seconds. The terminal wrapper returned 1 despite that structured PASS; the exact source, completion, empty findings and guarantees were independently asserted before publication. No scanner finding was waived. The guarded product push succeeded on its first attempt, and git ls-remote confirmed the exact candidate at refs/heads/cloud/gr-mt-spool-ci-20. Exact-SHA Verify 44076996424 is in progress: https://github.com/just-every/run-spool/actions/runs/44076996424 . The local packet and pending CI receipt were saved first to the evidence ref, preserving reports while CI runs. The final conclusion will be recorded here and in ci-receipt.json before the final evidence update. Cached baseline job logs show repair-recovery and agent-handoff took 21 and 20 minutes after build; the remaining reads are reserved for that completion window. A verified recovery bundle is retained outside the product clone; bundle-receipt.json records its path, SHA-256 and product head. It is recovery data, not proof of a push or READY. The fleet owns guarded landing and main validation; this task never pushes or fast-forwards main. No PR is required by the repository instructions.
