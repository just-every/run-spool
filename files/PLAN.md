# Maintenance plan: gr-mt-spool-dep-12

Author: Run Edit Run fleet, 2026-11-17.

1. Configure fleet Git identity, decrypted-bundle authentication and clone-local commit hooks; clone only just-every/run-spool with full history on cloud/gr-mt-spool-dep-12.
2. Read repository instructions and identify every qs resolution and its parent. Record the vulnerable comma-stringification behaviour before upgrading.
3. Regenerate pnpm-lock.yaml with pnpm 10.12.4, updating only qs to a patched version compatible with its parent. Use Node 22.20.0. Preserve application code, acceptance judgments and generated views.
4. Run frozen install, local setup, build, typecheck and a focused qs behaviour probe. Regenerate sources.lock.json last and check it. Run only related existing tests, never the full local Verify suite.
5. Commit with the fleet identity and plain message; inspect all candidate identities/messages. Refresh main before the candidate and preserve any newer contract judgments.
6. Run Base publication scanning on the exact committed tree. Publish only the named cloud branch when the scan is COMPLETE/PASS and touched checks pass; do not bypass a missing scanner.
7. Discover and poll exact-SHA Verify within the ten-call GitHub budget and five-minute polling interval. Report the actual result, with READY only for a qualifying green result.
8. Save result.json and complete non-secret reports/receipts outside the product repository; publish selected files only to evidence/gr-mt-spool-dep-12 and return its exact receipt. Retain unpushed work and a verified bundle if blocked.
