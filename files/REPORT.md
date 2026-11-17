# Rack 3.2.8 maintenance result
Author: Run Edit Run fleet
Date: 2026-11-17
Repository: just-every/run-spool
Branch: cloud/gr-mt-spool-dep-16
Candidate: 337a4cacd736ad172f397f318bb766fa5402ed9a
Base: 7ece18059c1c7924a5b6f9cc816a7af3900136d5

Rack is now pinned and locked to 3.2.8 in the Ruby runtime fixture. The conservative Bundler 2.5.22 update retained bigdecimal 4.1.3, concurrent-ruby 1.3.8, logger 1.7.0, sentry-ruby 7.1.0, and both existing Ruby platforms. No application code or test assertions changed.

Files:
- tests/runtimes/ruby/Gemfile: exact Rack dependency 3.2.6 to 3.2.8.
- tests/runtimes/ruby/Gemfile.lock: Rack resolution and exact dependency updated by Bundler.
- sources.lock.json: regenerated hashes for those two files.

The supplied affected interval is >=3.2.0 and <3.2.8 for all four listed advisories (GHSA-5v64-555j-wjxm, GHSA-p8x9-v4hv-2w4g, GHSA-2j8w-xcrc-x985 and GHSA-wvg4-6p58-3gh3). Vulnerable Rack resolutions changed from 1 to 0; the patch covers all four reported advisories. No Dependabot alert was edited or claimed closed.

Local verification passed:
- pnpm 10.12.4 install --frozen-lockfile.
- cloud_run npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive: 103 local migrations and owner setup. This initial setup used the available Node 24.19.0. All final build, typecheck, source and Ruby journey commands used exact Node 22.20.0.
- Bundler 2.5.22 conservative Rack-only lock regeneration.
- Frozen Ruby install, with two Bundler workers.
- cloud_run npx -y @runeditrun/rer build.
- pnpm typecheck.
- cloud_run node tests/sdk-runtimes.mjs ruby, with isolated Ruby 3.3.8, Bundler 2.5.22, frozen dependencies and system Chromium with --no-sandbox.
- node scripts/edition-authoring/cli.mjs lock, followed by pnpm source:check.
- node src/base/contract-docs.mjs check: 0 errors and 0 warnings; documents current.

The Ruby qualification exercised the existing unmodified sentry-ruby program against the reference collector and Spool, handled/crash/handled process sequence, persisted exception chains, restart grouping, release creation and identity, exact SDK-item reconciliation, two error-category client discards, wrong-key and unreachable-delivery refusals, and issue reads without horizontal overflow at 1440 and 390 pixels. Reference items were 3 events, 7 attachments, 2 check-ins, 3 logs, 4 transactions, 2 client reports and 1 session. Spool retained the existing explicit unsupported-item outcomes. Screenshots are included.

Contract status changes: none. Existing full-target counts remain 23 DONE, 54 PARTIAL and 28 MISSING, total 105. SDK-012 retains its existing judgment and gaps. No acceptance points, generated view files or summary counts were changed. Tests added/removed/weakened: 0/0/0.

Fleet identity and forwarding cleanup hooks are active. Main was fetched; after committing, rebase onto origin/main reported the branch current. The candidate's only commit has fleet author and committer and no trailers. The tree is clean. No PR is required by the repository's maintenance instructions; none was created. Only the named cloud branch is eligible for product publication.

Publication and CI:
The first pinned Base publication scan reached its default 300-second deadline and returned INCOMPLETE (scan.deadline-exceeded), with no completed finding verdict. The scan was restarted on the same exact SHA with a 1,800-second deadline. Final publication and CI custody are recorded in verification-receipt.json and the appended terminal section below.

The full plan is PLAN.md. Actual command output, dependency graph, product patch, scan reports and browser screenshots are included in the evidence packet. No credentials, environment dump, private held-out materials or owner browser state are selected. This report does not claim deployment, landing or broader SDK acceptance.

Publication scan preparation: the completed second attempt covered 982 commits and reported 13 findings in ignored, task-generated setup/build/test files, plus destination.invalid because the initial invocation omitted the project ID and supplied a bare repository slug where the validator requires a URL. No changed committed source file was a finding. Those ignored local artifacts were removed after preserving the non-secret test outputs and screenshots, and the scanner was restarted with the exact project ID and repository URL. The final verdict is pending in the receipt. The prior reports are preserved; no finding was waived or scanner policy changed.

Publication verdict: COMPLETE/PASS, zero findings, exact commit 337a4cacd736ad172f397f318bb766fa5402ed9a and tree 192c25ffd5ec71b0a3c79b218332048d249ffa4e. Pinned Base scanner/rer 0.2.118, implementation SHA-256 c5f2d788f2f08764cd018e049b507c26f5ac01f651e2e8696398d89a5a886ffb, covered 982 commits, 972 trees, 8,209 blobs, 982 commit messages and 23 tag messages in 417.4941 seconds. The named product branch pushed through the fleet guard on its first attempt. Verify run 44056761412 was discovered in progress on that same exact SHA.

Terminal product result: READY candidate, pushed cloud/gr-mt-spool-dep-16 at 337a4cacd736ad172f397f318bb766fa5402ed9a. Verify run 44056761412 completed/success on that exact SHA: https://github.com/just-every/run-spool/actions/runs/44056761412. Four polls followed discovery, each at least 300 seconds apart. Six manual GitHub API calls were made in total (one Base tree discovery, one workflow-run discovery and four run polls); the pinned scanner separately resolved repository references in two completed scans. No failed CI logs were needed. No PR was created. No blockers remain, and no landing or deployment was performed. Vulnerable Rack resolutions: 1 before, 0 after. Clause counts remain 23 DONE / 54 PARTIAL / 28 MISSING (105 total), with no status changes.

Result files: work/maint/gr-mt-spool-dep-16/result.json and packet/result.json. The product Git bundle outside the checkout is verified and recorded in recovery-receipt.json. Evidence publication is a separate report-only ref and does not itself signal product acceptance or landing. The checkout and its dependencies will be removed after evidence transfer, as required by the shipped builder cleanup rule; the packet, result and verified recovery bundle are retained.
