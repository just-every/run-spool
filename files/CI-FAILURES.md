# Exact-head Verify diagnostics

Head: 7d9f9d69db0f82c082572220c9a9c8543af06442
Run: 42648796379, push Verify, completed failure.

The build job succeeded, including the source lock, contract generator, build, integration and typecheck steps. The Bugsnag migration journey completed inside the SDK job before that job's later multilingual assertion failed. No green overall Verify is claimed.

- Job 129269853607, verify (alerts), command `pnpm test:alerts && pnpm test:alerts-ui`: tests/alerts/conditions-journey.mjs:43, TypeError: Cannot read properties of undefined (reading 'reason'). The complete same shard passed locally on the failed head. The same native alerts test passed on untouched main aa853b97de89f949da4fa5876ae525e3b1f343aa. This failure was not reproduced and no alert code was edited.
- Job 129269853778, verify (repair-recovery), command `pnpm test:repair-recovery`: archiveProof, POST /api/restore: HTTP 400 other. The exact command reproduced this failure on the failed head. It passes after the historical fixture inventory correction and also passes on main.
- Job 129269854071, verify (sdk), command `pnpm test:sentry && pnpm test:sentry:sdk && pnpm test:sdk && pnpm test:languages`: tests/multilingual.mjs:119, POST /api/restore: HTTP 409 schema_mismatch:legacy_evidence, instead of expected HTTP 400 for the forged historical behavior inventory. The same multilingual test passes on untouched main. Exact-shard local attempts first encountered the missing Playwright headless launcher and then a local port collision caused by overlapping checks. The system Chromium launcher was bound at the expected Playwright path; a serial candidate multilingual run reproduced the same CI assertion. The historical fixture correction then passed the complete multilingual journey. No product code was edited on the unsuccessful infrastructure reproductions.

Jobs 129280173912 (shards (spool)) and 129280237424 (verify) failed as aggregate consequences. Their selected-coverage guards were not changed. Each substantive failed job's archive was read once with the instructed gh run view command. The ten-call GitHub budget is exhausted; no workflow dispatch or rerun was requested.

Final fixture-only commit ce4226c2903be0f01a11ef1f471974f2e6563661 is pushed. Its exact-SHA Verify is unobserved because all ten API calls were used. Both repaired restore journeys pass locally; no READY or green final Verify is claimed.
