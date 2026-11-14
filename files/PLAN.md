# Rack fixture maintenance plan

1. Read fleet and repository instructions and inspect the direct dependency and Ruby runtime journey.
2. Pin only Rack from 3.2.4 to 3.2.6; generate the Bundler lockfile without unrelated dependency upgrades.
3. Install with pnpm 10.12.4 and the declared Node 22.20.0; prepare local Ruby tooling outside the product checkout.
4. Run setup, build, typecheck, and the existing Ruby-only SDK compatibility journey. Add no pin tests and preserve all assertions.
5. Refresh sources.lock.json last and check source integrity. Preserve contract judgments and generated views.
6. Commit with fleet identity and active hooks; inspect every unpublished author, committer, message, and trailer; publish only cloud/gr-mt-spool-dep-5 using the guard. The fleet performs its publication scan before landing under the cloud override.
7. Require an exact-SHA Verify via REST within the ten-call budget, create result.json and actual receipts, and publish selected non-secret packet files to evidence/gr-mt-spool-dep-5.
