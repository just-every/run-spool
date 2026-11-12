# Bounded CI triage plan

Task: sd-spool-release-0-7-8-ci-triage-1. Repository: just-every/run-spool.

1. Read the supplied rules, launcher and repository instructions; configure fleet identity and credential helper. Keep the product checkout unchanged on its task branch from main.
2. Read exact-head Verify 43229401150 and all job attempts. Save the run metadata and failed-step log once. Identify the first actual failure, distinguishing it from earlier nonfatal messages and downstream aggregate failures.
3. Only if no earlier retry exists, POST once to the failed job's rerun endpoint. Do not rerun the whole workflow or dispatch a new Verify. Use REST status reads separated by at least 300 seconds and stay within ten GitHub command/API operations under the brief's counting convention.
4. If the same test fails again, identify an existing way to run that specific test on current main on the same runner. Do not run a baseline or full suite. If that facility is inaccessible, record the precise limitation and request a local fleet follow-up; source equality is not runtime proof of a main failure.
5. Classify only what the evidence supports. Preserve account/key holds and clause judgments. Write actual non-secret report/receipt files, publish explicit packet files only to evidence/sd-spool-release-0-7-8-ci-triage-1, then delete the clean disposable clone after verifying evidence transfer. Send sd and, when relevant, fv POST lines in the final response. Do not readmit a red candidate.

No source, workflow, test, contract, release, landing record or product commit is authorized in this triage.
