# Spool one-date-format carry round

Repository: just-every/run-spool
Branch: cloud/main-spool-one-date-format-1-c1
Candidate: 7d7d67ee00fc51ee58d8f5aa2c0e026094c88403
Original candidate: 956ead3445c24e14513f5925d6b45228e5b8c92d
Main at integration: c6dfd817f8763ae44e5a2a473828e892c945685a
PR: none; this seed uses the fleet branch landing path.

## Plan

1. Configure fleet identity, refresh the launcher, install the decrypted-bundle Git helper, push guard and commit-message hook, and read the launcher and repository instructions.
2. Read attempt 2 of Verify 43013521341 once; if it remains red, read each failed suite log once and identify whether the date-format round caused it.
3. Clone with full history and blob filtering. Create the named branch at the original head and merge main, preserving newer source and tests. Do not change the original branch or contract judgments.
4. Make the smallest corrections to existing assertions or response selection, retain all acceptance assertions, regenerate the source lock last, and check source integrity and types.
5. Preserve the first real commit on the named product branch through the required push guard, checking every candidate author, committer and trailer.
6. Build and run only the two touched public journeys. Capture and inspect Issues, issue detail, Reports and Alerts Rules Preview once at 1440 and 390.
7. Observe the exact-SHA branch Verify through REST at least 300 seconds apart, within ten GitHub calls; rerun failed jobs once only if needed.
8. Write actual receipts and reports outside the product clone, inspect the explicitly selected public evidence for secrets, publish it to the separate evidence ref, and remove the successfully pushed clone after evidence transfer.

## Findings and change

Attempt 2 was completed/failure, so this was not treated as a flake. The once-read logs show:
- SDK job 130515840839: reports-flow.mjs asserted a four-event historical table but caught a zero-event response after returning from the issue screen.
- Runtime job 130515840851: suspect-flow.mjs waited for numeric en-GB date text including seconds, which the shared formatter deliberately changed.

The SDK failure was a response-selection race introduced by the new cross-screen test. Navigating back to Reports starts an automatic request for its default current window before the test submits its historical window. The test now waits specifically for a POST with the submitted from/to instants. Its exact total, identities, release-less event and complete-result assertions are unchanged.

The runtime journey now computes the deliberate en-US month-spelled UTC minute output. It still checks the exact regression record, both commits, their recorded deployment window, authority, immutable occurrences, audit, restore and erasure. No product source correction was needed; the formatter's deliberate output is retained.

Both attempts to merge origin/main were already up to date: main is already an ancestor of the original candidate. No conflict, rebase, history rewrite or synthetic merge was necessary. No generated acceptance view, contract clause text, status, Gap or Evidence cell was changed. Source lock was regenerated after the two test edits and passed its documented check.

## Counts and claim

- Two existing test flows amended; zero added, zero removed, zero skipped and zero weakened. No test-cap increase.
- Original Verify's two failed suites now both pass their corresponding local public journeys.
- Clause counts before and after: 23 done, 53 partial, 29 missing, total 105. Status changes: none.
- FIND-003 remains done in the source contract. This round carries only the requested partial evidence claim; it does not rewrite that judgment.

CLAIM FIND-003 PARTIAL points=2 tests=tests/reports-flow.mjs#reportsFlow

## Local results

All completed with exit 0:
- Public rer setup with the fleet owner and non-interactive option.
- pnpm typecheck.
- Documented source-lock generation and pnpm source:check.
- Public rer build.
- node tests/reports-flow.mjs: exact historical totals, persisted tables and widgets, cross-screen timestamp comparison, time-zone totals and daylight-saving buckets.
- node tests/deployment-history.mjs: includes suspectFlow, exact regression timestamps and deployment windows, release history, authority, immutable events, audited judgments, inert restore and erasure.
- Browser proof script: Issues, issue detail, Reports summary/query table, populated saved dashboard and Alerts Rules Preview at 1440 and 390; zero page errors. Full screenshots are explicitly selected in the evidence packet.
- git diff --check.

Browser proof used the emitted application, real public HTTP writes, synthetic local data, ordinary test-only sign-in and system Chromium with --no-sandbox. Browser contexts were fresh; no real profile/session was copied. All browsers and test servers were closed by their own cleanup. The proof script is an external receipt artifact, not a new registered test.

The first real correction commit was pushed successfully on guard attempt 1. Candidate history includes the original owner-authored commit and the new fleet-authored commit. Every candidate author/committer and all trailers were inspected; none has a prohibited identity or Codex/OpenAI co-author line. No evidence was committed to the product branch.

## CI and landing custody

Original Verify 43013521341 attempt 2: failure.
Candidate Verify 43019972372: exact SHA 7d7d67ee00fc51ee58d8f5aa2c0e026094c88403; final result is recorded in receipt.json and candidate-verify.json.

The complete fleet publication scan is unavailable in this cloud, as specified by the task's cloud adaptation. It remains the mandatory Mac landing gate; this report does not assert that it ran. Neither main nor a default branch was pushed. Evidence transfer and READY custody are separate. No deploy or landing was attempted.

Packet hygiene: CI log environment preambles (12 lines total) were omitted from the published failure logs. Failure assertions and their stack traces are retained. No injected credential value occurs in the selected packet. No environment dump, held-out material or symlink is selected.
