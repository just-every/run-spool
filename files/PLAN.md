# gr-mt-spool-ci-10 plan
Author: Run Edit Run fleet, 2026-11-16.

1. Apply fleet identity and launcher authentication, then clone only just-every/run-spool with full history into the maintenance output directory and create cloud/gr-mt-spool-ci-10 from origin/main.
2. Read the launcher and repository instructions, the inline builder rules, and the contract source and generated progress. Inspect the reported completed Verify run and retrieve its failed owner-ui job log once.
3. Establish current default-branch identity through Git and query exact-SHA completed Verify runs. Check whether the originally failing suite still fails before making changes.
4. If current main already passes the full Verify wall, use the brief's no-change outcome. Otherwise reproduce the observed failing assertion locally, make the smallest permitted fix, run touched checks and typecheck, regenerate the source lock, scan the exact committed candidate, audit identity, publish the named product branch with the guard, and observe its exact-SHA Verify.
5. Save the actual result, receipts and investigation limits outside the product tree. Explicitly select and inspect non-secret evidence files; publish them only to evidence/gr-mt-spool-ci-10. Return the evidence ref/head and lane relay with terminal product provenance.

Outcome: step 3 established a passing current-main Verify, including the owner-ui job, so step 4 took its no-change path. Product edits, local dependency setup, local testing, product commits, product publication scanning and product pushing were unnecessary. No process was left running.
