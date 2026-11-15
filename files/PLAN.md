# Spool 0.7.12 metadata candidate plan

Author: Run Edit Run fleet. Recorded: 2026-11-15T09:41:29Z.

1. Refresh the fleet launcher, install credential helper/push guard and commit hooks, and clone only just-every/run-spool.
2. Read the supplied builder/release rules and repository instructions; freshly confirm main, published release, absent next tag/release and no competing release PR/branch.
3. Review the actual v0.7.11..main source, dependency and migration diff; prepare notes describing observable changes and retained limits.
4. Change only package.json, seed.json, RELEASE.json and the new CHANGELOG.md section. Preserve rer 0.2.113, dependency lockfiles, historical notes, latest-published-tag guidance and all product/contract files.
5. Install pinned dependencies without changing lockfiles; run existing first-party metadata checks and typecheck only. Fetch/rebase fresh main before publication; regenerate and check sources.lock.json last.
6. Commit with fleet author/committer and preserved repository hooks; inspect every candidate identity/trailer and push only cloud/sd-spool-release-0-7-12 through the guard.
7. Discover exact-SHA Verify through REST; one watcher, 300-second minimum poll interval and ten-call API budget. Record honest result and product custody separately.
8. Write actual non-secret report/receipts outside the product tree, publish explicitly selected packet files only to evidence/sd-spool-release-0-7-12, then delete the pushed clone/dependencies. Leave landing, full-history publication scan, release production/signing/tag/publication and deployment to the fleet.
