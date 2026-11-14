# gr-mt-spool-ci-5 — no change required

Repository: just-every/run-spool
Product branch: cloud/gr-mt-spool-ci-5 (local branch only)
Current main / inspected HEAD: e206a1ca9a631059818333837062a90bd225443d
New product commits: 0. Product branch pushed: no. PR: none.

## Outcome and cause

The maintenance item is already repaired on current main. No code, tests, workflows, contract text, generated acceptance views, source locks or homepage files were changed. The complete affected Command journey passes locally on the current main tree, and exact-SHA main Verify and Run site are both completed/success.

The reported run 40351818419 at cf0e18ab089d73330a8cd38004c8d1ef8f3d53ac failed in job 121673606900, step `pnpm test:commands`. Its archived diagnostic reports stage `desktop-sign-in`, AssertionError, browser closed, children stopped and scratch directory removed. Both prescribed gh log-failed calls returned exit 0 with empty output; the actual log was recovered by reading the archive gh had already downloaded to its local cache, with no extra GitHub request. The report publishes only the failing step excerpt, excluding environment listings.

Repair 551f72382d75eb6af9851c3d26de1d9dabbe8b01, already an ancestor of main, documents the exact stale assertion: `/projects/missing` on an installation with no project returned 303 but the journey expected 404. It now asserts 303 with exact Location `/setup`, preserving 404 for an unknown non-application route. This matches OPERATIONS.md's existing setup policy and changes no product behavior. Subsequent repair 2f72a0145a60cd65f6c8eb1dbc3873fec38d34e0 preserves the product's `/projects` destination in completed preview sessions. Both repairs are retained on current main.

Ten later Command journey runs are completed/success, including 40472490794 on the preview repair and latest listed 41320743088 at a182e6d2c1e7e35371494b60e9b082dc355b1db6. All ten returned SHAs were verified as ancestors of the inspected main. These historical successes are not presented as exact-current-SHA CI evidence; current proof follows separately.

## Plan and execution

The full plan is in PLAN.md. Completed: fleet identity and launcher setup; bundle-only credential helper; full-history declared-repository clone and named branch; launcher and repository instruction review; failure/job/log investigation; historical repair and ancestry review; declared-toolchain setup; only the affected Command journey and typecheck; clean-tree verification; actual report and receipt creation. No source edit or landing candidate was needed. Evidence publication uses only its separate report ref and never changes the product HEAD/index.

## Validation

- `cloud_run npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive`: passed, including application build, 99 migrations and owner setup. Setup's temporary runtime stopped.
- `cloud_run pnpm typecheck`: passed, exit 0; typecheck.log.
- `cloud_run pnpm test:commands`: passed, exit 0; commands.log and commands.exit. Executed with Node 22.20.0 and pnpm 10.12.4 after sourcing the cloud toolchain; headless Chromium used /usr/bin/chromium with the repository's --no-sandbox flag. The full affected public CLI journey retains install, unsafe/legacy setup refusals, failed-build/resume/cancellation, owner preservation, dev, desktop first project, no-JS mobile preview, archive/export/reset/import policy, provider-free deploy dry run and fresh owner checks. The repository journey owns its scratch checkout and child-process cleanup.
- Current main exact-SHA Verify: 43580557779, completed/success, https://github.com/just-every/run-spool/actions/runs/43580557779.
- Current main exact-SHA Run site: 43580557817, completed/success, https://github.com/just-every/run-spool/actions/runs/43580557817.
- Same-SHA prior branch Verify: 43578422344, completed/success. All current CI receipts refer to e206a1ca9a631059818333837062a90bd225443d; see current-main-runs.json.
- Product worktree/index clean; `origin/main..HEAD` is empty. No new identity/trailer candidates, no tests skipped, weakened, added or removed.

## Counts and clauses

Before and after: 23 done, 54 partial, 28 missing, 105 total. Tests added/removed: 0/0. Clause status changes: none. OPS-001's existing judgments remain unchanged. No new full-clause CLAIM is made from maintenance validation.

## Publication, custody and limitations

A no-change result needs no product commit, product push, PR or landing. No READY/PUSHED line is claimed for an unpublished product branch. The Base publication scanner is unavailable here and was not run; result.json sets security=false solely to avoid representing an unperformed scanner as passing. No product tree was published by this task. Only explicitly selected actual report/receipt files are eligible for evidence/gr-mt-spool-ci-5; credentials, environment dumps, private gate material, symlinks and local installation data are excluded.

The exact-SHA CI lookup temporarily returned HTTP 401 Bad credentials. The prescribed launcher bundle was refreshed and reread with Git setup restored after each refresh. Bounded backoff of 15, 45 and 90 seconds recovered on attempt 4. No other credential was sought. Nine GitHub CLI invocations were used out of the ten-call budget, including the single failed-job archive invocation. No additional CI polling, reruns, dispatches, PRs, comments, releases or default-branch pushes were made.

No product blocker remains. Product provenance and the actual no-change result stay at work/maint/gr-mt-spool-ci-5/result.json and in this packet. Evidence transfer outcome is reported by the separate publication command and terminal receipt; it does not assert acceptance or landing.
