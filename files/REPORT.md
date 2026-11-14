# gr-mt-spool-dep-5: Ruby fixture Rack upgrade

Repository: just-every/run-spool
Branch: cloud/gr-mt-spool-dep-5
Base: b9e7e575097e0dd0fc0662ce1ed507fa0d41f0d8
Candidate: 1c649c2de4f783d31b2733b4c9bdb7843f754e69

## Result

Upgraded the direct Ruby runtime fixture dependency Rack from 3.2.4 to 3.2.6. This covers the supplied affected ranges for all 15 advisories (Dependabot alerts 31–45); this statement compares versions to the brief, and does not claim the service has closed any alerts.

Files changed:
- tests/runtimes/ruby/Gemfile: exact Rack 3.2.6 pin; sentry-ruby stays at 7.1.0.
- tests/runtimes/ruby/Gemfile.lock: new reproducible Bundler resolution using Bundler 2.5.22, for ruby and x86_64-linux platforms. No lockfile existed on main.
- sources.lock.json: regenerated last with the documented source-lock command; only the Gemfile hash and new lockfile entry change.

A separate resolution of main's Gemfile and the candidate's Gemfile proves only Rack changes between them. bigdecimal 4.1.3, concurrent-ruby 1.3.8, logger 1.7.0, and sentry-ruby 7.1.0 are identical in both resolutions. The installed-spec receipt confirms Rack 3.2.6 is used. No JavaScript dependency or pnpm lockfile changed.

## Plan and execution

The full plan is in PLAN.md. Fleet Git identity and the launcher were installed first. A fresh full-history filtered clone was created in the required maintenance work directory, with local identity and fleet commit hooks active. The declared Node 22.20.0 and pnpm 10.12.4 ran final install/setup/build/typecheck. Ruby was absent, and system package installation was unavailable (no sudo and no root apt access), so Ruby 3.3.6 and libyaml 0.2.5 were built outside the product checkout with two compilation workers. Ruby's bundled Bundler is 2.5.22.

The repository setup and build ran through cloud_run. Setup's private output is excluded from the packet. No held provider keys were used. Before committing, the documented source lock and check passed; contract views remained untouched and their generator check passed. origin/main was fetched before the candidate; the post-commit rebase reported that the branch was up to date. There was no published-history rewrite. The only commit has fleet author and committer identity, no trailers, and a plain message. All candidate commits including side parents and their complete messages were inspected before the guarded push. Product push succeeded on its first attempt.

## Local validation

All passed; commands and exit statuses are in local-receipt.json, with their actual output logs in the packet.

- pnpm install --frozen-lockfile, final run with Node 22.20.0 and pnpm 10.12.4.
- npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive.
- npx -y @runeditrun/rer build.
- pnpm typecheck.
- bundle lock --gemfile tests/runtimes/ruby/Gemfile, with baseline/candidate resolution comparison.
- BUNDLE_PATH set outside the clone: bundle install --gemfile tests/runtimes/ruby/Gemfile.
- node scripts/edition-authoring/cli.mjs lock, then pnpm source:check.
- node src/base/contract-docs.mjs check: 0 errors, 0 warnings; documents current.
- git diff --check.
- node tests/sdk-runtimes.mjs ruby, on the committed candidate.

The existing Ruby public-door journey exercised the unmodified Sentry SDK against a reference collector and Spool: handled and unhandled errors, flush/restart grouping, exception chains, complete envelope-item and discard accounting, release identity, refused and unavailable ingestion, and owner issue pages at 1440 and 390. Chromium used /usr/bin/chromium with --no-sandbox; browser contexts and the test Worker were disposed. The screenshots are synthetic test evidence. No tests were added, removed, skipped, or weakened. No full local suite was run.

Ruby telemetry receipt: 3 events, 7 attachments, 3 logs, 2 check-ins, 4 transactions, 2 client reports, 1 sessions item. Public outcomes reconcile exactly, including 3 accepted occurrences and 2 before_send discards.

## Counts and contract scope

- Supplied advisory ranges matching the fixture: 15 before, 0 after.
- Contract full target: 23 done, 54 partial, 28 missing, 105 total before and after.
- Core: 23 done, 45 partial, 19 missing, 87 total before and after.
- Agent surface: 0 done, 9 partial, 9 missing, 18 total before and after.
- Clause status changes: none. No CONTRACT.md acceptance text or judgments changed; no CLAIM line applies to this dependency-only maintenance.
- Test changes: 0 added, 0 removed; one existing Ruby compatibility journey run.

## Publication and custody

Only cloud/gr-mt-spool-dep-5 was pushed for the product. No PR was required by repository instructions or created, and main was never pushed or advanced. The cloud override delegates the unavailable Base publication scanner and final landing gates to the fleet; no local COMPLETE/PASS publication scan is claimed. The exact candidate diff and the non-secret packet were separately screened. Evidence publication is report-only and carries no product acceptance or landing signal.

The local maintenance result is at work/maint/gr-mt-spool-dep-5/result.json and copied into this packet. The actual guarded push receipt is product-push.log. Exact-SHA Verify run 43573999876 completed successfully on candidate 1c649c2de4f783d31b2733b4c9bdb7843f754e69. URL: https://github.com/just-every/run-spool/actions/runs/43573999876. One REST watcher used six calls total (discovery plus five polls), each run read at least 300 seconds apart. The terminal receipt is ci-result.json; every poll and the call ledger are retained. No workflow was dispatched or rerun.

CI status: COMPLETE / SUCCESS on the exact product SHA.
Blockers: none. Fleet publication scanning and guarded landing remain outstanding fleet responsibilities.

READY branch=cloud/gr-mt-spool-dep-5 head=1c649c2de4f783d31b2733b4c9bdb7843f754e69
