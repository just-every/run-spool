# Carry plan

1. Configure fleet identity, decrypted-bundle Git helper and preserved repository hooks; clone full history and read current instructions and contract.
2. Build origin/main 8049c9153f1d987bba6211bc05b8405b06101a6f and run tests/deployment-history.mjs before rebuilding the carried candidate. Preserve its actual outcome and compare the same test on the candidate.
3. Squash the original three-commit change ending at 9fd605e63a7f93fde47f5c91380b79a31d51f41b onto current main. Keep newer usage labels and tests. Preserve CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md exactly. Keep hosted authentication unchanged.
4. Run changed tests/dev-credentials.mjs and tests/triage-journey.mjs (which invokes tests/triage-auth.mjs), typecheck, source lock/check and candidate deployment-history. Extend existing tests only; add no suite registrations. If deployment-history fails only on the candidate, diagnose the changed code and correct its cause before committing once.
5. Capture the changed local invitation preview, Members invitation instructions, removed-member sign-in and explicit-owner sign-in at 1440 and 390. Keep all synthetic proof outside product history; no runtime credentials in screenshots/reports.
6. Fetch main immediately before the one candidate commit/push, rebase only if still unpublished and necessary, regenerate source lock last, inspect all commit identity/trailers and push only cloud/main-spool-local-invite-truth-1-c1 through the fleet guard.
7. Observe exact-SHA Verify through REST at 300-second minimum intervals with a ten-call API budget. Publish complete non-secret reports, receipts and selected screenshots to the separate evidence ref. Relay custody and claims in the final message; never land main from this VM.
