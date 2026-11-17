# Completed parent Verify failure

Author: Run Edit Run fleet, 2026-11-17T17:32:11.637069+00:00.

Run 44130811317; head 27fad43daffe62ee44efec89b0f5cadde0177a42; conclusion failure.
Read once using `gh run view 44130811317 --repo just-every/run-spool --log-failed` (exit 0). Only the relevant actual log lines are selected; no environment dump is included.

```text
verify (owner-ui)	Run suites	2026-11-17T16:59:35.0940908Z Triage public journey passed: 22 groups; 104 JPG captures at 1440 and 390.
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8688796Z node:internal/modules/run_main:123
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8689159Z     triggerUncaughtException(
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8689395Z     ^
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8689492Z 
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8689727Z AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8690302Z 
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8690387Z 422 !== 201
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8690490Z 
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8690776Z     at ownerSetupFlow (file:///home/runner/work/run-spool/run-spool/tests/owner-setup-flow.mjs:50:76)
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8691321Z     at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8691822Z     at async teamFlow (file:///home/runner/work/run-spool/run-spool/tests/team-flow.mjs:313:2)
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8692477Z     at async file:///home/runner/work/run-spool/run-spool/tests/owner-claim.mjs:146:1 {
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8692835Z   generatedMessage: true,
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8693054Z   code: 'ERR_ASSERTION',
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8693250Z   actual: 422,
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8693436Z   expected: 201,
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8693630Z   operator: 'strictEqual',
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8693831Z   diff: 'simple'
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8693997Z }
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8694089Z 
verify (owner-ui)	Run suites	2026-11-17T17:00:31.8694169Z Node.js v22.20.0
verify (owner-ui)	Run suites	2026-11-17T17:00:31.9192876Z  ELIFECYCLE  Command failed with exit code 1.
verify (owner-ui)	Run suites	2026-11-17T17:00:32.0055958Z ##[error]Process completed with exit code 1.
```

Correction: read the actual registered release/build from the browser-captured event instead of retaining the old test tuple. The successful replacement-key and refused-revoked-key expectations remain. Local owner-setup-fixed.log records exit-0 proof; final exact-SHA CI is unobserved.
