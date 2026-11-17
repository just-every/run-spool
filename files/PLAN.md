# Minimatch maintenance plan
Author: Run Edit Run fleet, 2026-11-17.

1. Inspect current main, repository instructions, pinned package manager, transitive minimatch parents, publication scanner and CI entry point.
2. Make the smallest manifest override and pinned-pnpm lockfile regeneration that removes every minimatch below 11.0.1, without unrelated upgrades.
3. Install frozen dependencies, run local setup, build and typecheck, and exercise the consuming glob/Sentry build path using relevant existing tests. No UI or acceptance status changes are planned.
4. Regenerate/check the source lock only if the repository source-lock rules cover changed files. Preserve generated acceptance/claims views.
5. Commit with fleet identity and active repository-preserving co-author cleanup hooks. Fetch and integrate main before publication. Inspect every candidate identity, message and trailer, and require Base publication scan COMPLETE/PASS with zero findings on the exact committed tree.
6. Push only cloud/gr-mt-spool-dep-8 through the fleet guard. Discover and poll exact-SHA Verify with at most ten GitHub calls, spaced at least 300 seconds per run.
7. Write the actual result and receipts outside the product clone, publish explicitly selected non-secret files only to evidence/gr-mt-spool-dep-8, and report exact product/evidence custody and lane POST lines.
