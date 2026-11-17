# Rack maintenance plan
Author: Run Edit Run fleet
Date: 2026-11-17
Repository: just-every/run-spool
Branch: cloud/gr-mt-spool-dep-16

1. Initialize the fleet launcher, credential helper, push guard, clone-local identity and forwarding commit hooks. Read the shipped rules and repository instructions. Preserve the product clone and work.
2. Confirm the Ruby runtime dependency graph and package-manager pin. Change only Rack's exact Gemfile pin from 3.2.6 to 3.2.8 and regenerate Gemfile.lock with Bundler 2.5.22 using a conservative Rack-only update.
3. Use pnpm 10.12.4 and Node 22.20.0. Install with the frozen Node lockfile and run the required noninteractive rer setup. Prepare isolated Ruby 3.3 and the exact Bundler version, without changing the system installation.
4. Verify a frozen Ruby install, the existing Ruby SDK qualification journey through the reference collector and Spool, build, typecheck, and the source lock. Keep the existing tests and contract judgments unchanged. Regenerate sources.lock.json last and check it.
5. Fetch current main and integrate it before the first publication. Commit with the fleet author/committer and active cleanup hooks. Inspect every candidate commit and trailer. Run the pinned Base publication scanner on the exact committed tree against the remote main public base; require COMPLETE/PASS and zero findings before a product push.
6. Push only the named cloud branch through cloud-push.py. Discover and poll exact-SHA Verify using REST with at most ten manual GitHub calls and at least 300 seconds between calls for a run. Fix relevant failures when feasible. No PR is required by the repository.
7. Write the actual result.json, report, and verification receipts outside the product repository. Publish explicitly selected non-secret evidence files to evidence/gr-mt-spool-dep-16 through cloud_evidence.py. Report exact product and evidence SHAs, CI runs, dependency and clause counts, remaining blockers, and lane relay lines.

Scope: Gemfile, Gemfile.lock, and the derived source lock only. No application UI, acceptance/status edits, generated views, unrelated upgrades, new tests, main pushes, or landing.
