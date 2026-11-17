Verify is red on 8f3fe12f0153fe7d91a55e00ed7e5c4853b9ecba.

Run: https://github.com/just-every/run-spool/actions/runs/44083960124
Failing assertion job: verify (alerts), 134042431931.
Assertion: tests/alerts-ui.mjs:47 — “A blocked save names the missing preview action after a reviewed test”; actual false, expected true.
The dependent shards (spool) and verify jobs also fail because that partition is red.

The test, its Alerts UI component and its runtime helper are byte-identical to origin/main; ci-blocker-source-check.json records their hashes. This task's lease has no Alerts UI or Alerts test files. No unrelated UI edit, assertion weakening, workflow rerun or empty CI-trigger commit was made.

One local diagnostic replay of the complete Alerts UI command, with /usr/bin/chromium, exits 0 and passes 1440/390. This does not replace exact-SHA Verify or establish a passing branch run. The immediate assertion failure was not reproduced locally; the lane needs to investigate the existing Alerts review/preview path and obtain successful exact-SHA Verify before landing.

The failed assertion log was read once with:
gh run view 44083960124 --repo just-every/run-spool --job 134042431931 --log-failed
The command succeeded. The published log removes the workflow environment block and masks credential-shaped values/URL queries. No signed blob URL or private gate material is selected.

Product work and the actual Sentry scale proof remain pushed. No CONTRACT.md judgments or generated views changed. The product is BLOCKED on Successful exact-SHA Verify; evidence publication carries no readiness signal.

Signed: Run Edit Run fleet, 17 November 2026 UTC.

The final exact-SHA import jobs succeeded: verify (sdk) 134042431907 (Sentry HTTP/import including schemaPages and fieldAccounting) and verify (execution) 134042432310 (including signed Business import). ci-jobs.json records all 32 terminal job statuses. The only failed assertion job is verify (alerts); shards (spool) and verify inherit that failure.
