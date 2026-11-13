# Plan: sd-spool-contract-anchor-2

1. Follow launcher and repository instructions; install fleet Git authentication and commit hooks; clone full main history and create the named cloud branch.
2. Read Spool's generator and immutable provenance maps. Inspect Lamp's committed anchor through GitHub API only and compare its format and original-ref binding.
3. Capture the existing full-clone contract check. Export the source tree to an isolated repository with exactly two new commits and no remotes. Capture the missing-anchor failure there.
4. Use Spool's own `anchor --old <original SHA>` command to create only `docs/contract/ANCHOR.json`. Do not change contract judgments, generated views, tests or application code.
5. Stage the anchor, regenerate `sources.lock.json` last with the documented command, and run its check. Run the contract check in the full clone and typecheck with pinned pnpm dependencies.
6. Repeat the isolated two-commit proof from the final product tree; show the original SHA is absent and the contract check passes. Run only cheap subsequent declared verification steps and report existing failures without fixing them.
7. Fetch current main, rebase only if required before the first publication, inspect all candidate commit identities and trailers, and push the named branch through the cloud push guard. Keep the final candidate free of CI-skip markers.
8. Discover and poll exact-SHA Verify with the required REST calls, within the ten-call API budget and no more than one call per 300 seconds per run. Preserve actual non-secret reports and receipts in this packet; publish only the explicitly selected evidence files to the separate evidence ref.
9. Remove successful disposable checkouts after evidence publication, retain actual packet and custody information, and return the required POST and terminal READY/PUSHED/BLOCKED lines. No landing or main write.
