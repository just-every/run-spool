# sd-spool-0711-ci-triage-1 plan

1. Refresh fleet authentication, install the fleet Git helper and clone only just-every/run-spool. Create the named local cloud branch; make no product commits or pushes.
2. Read seed instructions and the shipped brief/rules. Record main and failed SHA identity, current run/attempt/job statuses, and the exact public-door command.
3. Read each original failed job log once. Separate independent failed tests from dependent aggregation before retrying. Rerun each eligible original failed test job once; do not rerun successful jobs or dispatch/full-rerun Verify.
4. Install pinned Node/pnpm dependencies and a Ruby 3.3 runtime where practical. Build the unchanged application as CI does and execute `node tests/sdk-runtimes.mjs ruby` on the exact failed SHA. Record differences from ubuntu-24.04 CI and all actual results without editing source/tests.
5. Await the requested retry using exact-SHA REST status, with one watcher and no more than one run status call per 300 seconds. Stay within ten GitHub invocations, counting each failed-job log invocation once.
6. Explain the observed line-41 mismatch from log and source evidence. Distinguish the immediate assertion cause from an unproved underlying transport cause. Check available handoff context before proposing shared repair ownership; make no speculative change.
7. Save reports/receipts outside the clone, select only non-secret regular files, publish only evidence/sd-spool-0711-ci-triage-1, verify the publication result, and delete the disposable clone. Return dated lane POST lines; no READY/product-publication claim.

Scope: read-only CI triage. Release lock, ordinary queue, source, permanent tests, contract statuses and release metadata remain untouched.
