# gr-mt-spool-ci-4 — no change required

Repository: just-every/run-spool
Local branch: cloud/gr-mt-spool-ci-4
Current main and local HEAD: b9e7e575097e0dd0fc0662ce1ed507fa0d41f0d8
Result: no-change. No new product commit, product push, PR, tag, release, contract change or generated-file change.

## Plan and results

1. Configure fleet identities; refresh the supplied launcher; install decrypted-bundle Git authentication and preservation helpers; read launcher/repository rules and the inline builder rules. Completed.
2. Clone the declared repository with full history, create the named cloud branch from main, and install the fleet commit hook and supplied toolchain. Completed. No other repository was cloned or written.
3. Inspect the supplied failed run before making any change. Run 39866351660 completed with build success, token-check failure at “NPM_TOKEN reaches this repository”, and publish skipped. The historical source runs npm whoami when NPM_TOKEN is nonempty. The required one-time failed-job log command exited 0 but returned zero bytes; its exact npm error is not available. No log download was retried and no credential was sought.
4. Inspect current main and the intervening fix. Existing commit 8069a3255289f121700b24c629daa3b16c448e3a (“Publish the SDK to npm by trusted publishing, with no token”) replaces token-check with OIDC availability/setup reporting and changes actual tagged publishing to OIDC with id-token: write, npm 11.6.2 and an empty user config. It retains exact tarball checksums, smoke tests, version/changelog/main ancestry and green Verify release gates. This commit is already an ancestor of current main.
5. Verify later actual outcomes and current-source equivalence. Main Release SDK runs 43082652411 and 43394717532 completed/success. In run 43394717532, trusted-publishing-check and every build/reproducibility/smoke step passed; publish was intentionally skipped because this was a main push dry run. The workflow file and entire packages/sdk tree are byte-identical between that run's e9540f7ae83a5334d11dcaeda44c66df3b5ad94c and current HEAD. A final fetch confirmed HEAD equals origin/main.
6. Execute the exact current reporting shell step locally and the repository workflow checker. Both pass. The local host has no GitHub Actions OIDC URL; the report correctly says no and warns. This is local diagnostic execution, not a claim of actual OIDC token issuance or npm publication.
7. Record result.json and the complete non-secret packet and publish only the separate evidence ref. No further product work is necessary; the brief explicitly permits no-change after verifying an existing main fix.

## Validation

- PASS: bash execution of the current trusted-publishing-check reporting step; exit 0. Script, output and generated summary are in this packet.
- PASS: node scripts/verify-ci.mjs --check-workflows; “Workflow permissions and shared artifact names are valid.”
- PASS: existing fix and successful main Release SDK head are ancestors of current HEAD.
- PASS: git diff of the release workflow and packages/sdk against the successful release run is empty.
- PASS: current product worktree/index have no changes and origin/main..HEAD has no candidate product commits.
- Exact current-head main Verify: 43536837897, completed/success, https://github.com/just-every/run-spool/actions/runs/43536837897.
- Exact current-head Run site: 43536837721, completed/success, https://github.com/just-every/run-spool/actions/runs/43536837721.
- Release SDK main success: 43394717532 at e9540f7ae83a5334d11dcaeda44c66df3b5ad94c, https://github.com/just-every/run-spool/actions/runs/43394717532.
- Earlier Release SDK main success after the fix: 43082652411 at 92eb639bc15245736eef500b8b839839ec939e2b.
- Original historical failure: 39866351660 at ee878572a5a515a5a5ff403cb004309c07f6574e; failed job 120129396518. No exact historical npm error was retrieved.
- GitHub command invocations: 5; no polling, workflow dispatches, retries, comments or PR writes.

## Before and after

This task changes zero product files and creates zero product commits. Clauses and test registrations are unchanged. The reported historical Release SDK run had 1 failed, 1 successful and 1 skipped job; the verified later main run has 0 failed, 2 successful and 1 skipped job, under the existing repair. These counts describe those two runs, not a new fix made by this task. No clause status is promoted.

Contract summary counts and clause rows are untouched. No Lander-Regenerate or source lock changes are needed. No dependency/setup/build/typecheck/full suite was run because there are no source changes. No publication scan was needed for a new product tree because no product publication is performed. Evidence transport is separate and does not signal READY, product acceptance or landing.

## Limits, defaults and custody

The historical failed-log command returned no output; this report names the failed job and step from actual API metadata and does not invent its error text. Actual tagged npm publication and the owner's npm Trusted Publisher configuration were not exercised, modified or asserted. They are outside this main-push maintenance issue. Default: keep the existing main fix with no new product commit. No blocker remains for this already-resolved maintenance report.

Local clone remains at /home/agent/rer-consolidation/work/maint/gr-mt-spool-ci-4/repo; result.json is also saved in its parent per the brief. No custom server or browser was started. The packet contains only explicitly selected actual report/receipt/source-inspection files and no environment dump, secret, held-out gate material or symlink. The evidence ref is refs/heads/evidence/gr-mt-spool-ci-4. Do not land an evidence commit or treat its SHA as a product SHA.
