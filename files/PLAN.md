# Rack maintenance plan

Author: Run Edit Run fleet. Date: 2026-11-17.

Repository: just-every/run-spool. Product branch: cloud/gr-mt-spool-dep-14.

1. Initialize the authorized launcher, decrypted-bundle Git helper, fleet identity and forwarding commit hooks. Use a full-history blobless product clone; read repository instructions and the provided fleet rules.
2. Confirm whether Rack is direct or transitive, record its current manifest and lock resolution, and identify the existing Ruby runtime journey and pinned Bundler.
3. Change only Rack to 3.2.8 and regenerate the Ruby lockfile using Bundler 2.5.22, preserving all other gem versions and platform entries. No acceptance text, judgments or generated views need changes.
4. Install with the pinned package managers, run the Ruby runtime journey against the real built Spool Worker, run typecheck, and build. Use the existing Chromium path and close test-owned processes through the harness/subreaper.
5. Fetch main and reconcile any drift without rewriting published history. Generate source metadata only if required by the dependency change; confirm the source lock and generated contract checks.
6. Commit with fleet author and committer, inspect every candidate identity and trailer, and require Base's fresh publication scan to return COMPLETE/PASS with zero findings on the exact committed tree before pushing.
7. Push only cloud/gr-mt-spool-dep-14 using the fleet guard. Discover and poll exact-SHA Verify through REST within the ten-call budget and at most once per 300 seconds per run. Record all checks truthfully.
8. Save result.json, complete report and actual receipts outside the product checkout. Publish only explicitly selected non-secret packet files to evidence/gr-mt-spool-dep-14 using cloud_evidence.py. Report product and evidence custody separately, with the required lane POST and terminal READY/PUSHED/BLOCKED line.
