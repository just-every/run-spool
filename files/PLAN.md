# Plan for gr-mt-spool-dep-7

1. Initialize fleet credentials and commit hooks; use the declared repository only, full Git history, and cloud/gr-mt-spool-dep-7 from origin/main.
2. Read repository instructions, both manifests and lockfiles, dependency parents, source lock rules, and Verify workflow.
3. Change the existing undici overrides in both manifests to 7.30.1. Regenerate both lockfiles with pnpm 10.12.4. Update only fast-uri, body-parser, and zod to patched compatible releases; add a narrowly scoped override only if the installed parent cannot resolve a fix.
4. Verify package graph changes and frozen installs; use Node 22.20.0 for typecheck, build, and focused existing tests covering the affected development runtime and agent transport. Do not add version pin tests or change product acceptance judgments.
5. Regenerate sources.lock.json last, check it, and create a fleet-authored commit with no trailers. Inspect all candidate identities, messages, and the exact committed diff.
6. Require Base's COMPLETE/PASS publication scan with zero findings before a product push. If its scanner is unavailable, retain the finished branch and a verified external Git bundle, record that blocker, and do not claim READY or CI success. Otherwise push only the named cloud branch through cloud-push.py and use budgeted exact-SHA REST Verify monitoring.
7. Save the full report, actual receipts, result.json, and recovery details outside the product tree. Publish the selected non-secret packet only to evidence/gr-mt-spool-dep-7 through cloud_evidence.py. Emit the exact evidence receipt and lane POST lines in the final response.
