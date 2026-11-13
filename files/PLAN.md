# Spool rer 0.2.113 adoption plan

1. Inspect the seed agent rules, recorded Base source and declared local divergences. Record the baseline pin, source revision and test counts.
2. Pin @runeditrun/rer exactly to 0.2.113 and update pnpm-lock.yaml. Refresh Base from full release SHA c2efb501cbc148c2aee4d5e1107ebdba81469006 through the documented API door; retain intentional seed overrides.
3. Run non-interactive local setup with fleet owner identity. Exercise the README export and deploy dry-run commands once; capture only non-secret output. Run tests for refreshed behavior plus typecheck, source and packaging checks without full local verify.
4. Fetch main and integrate its latest state before the first candidate publication. Regenerate sources.lock.json last, check it, install the fleet commit hooks after setup, and commit only the dependency/Base/source-lock change.
5. Audit all candidate commit identities/messages, push only cloud/main-spool-rer-0213-1 via the fleet guard, and check exact-SHA Verify through the bounded REST watcher. Preserve existing contract judgments; no clause promotions.
6. Write the actual report and receipts outside the product checkout. Publish explicitly selected public-safe evidence to evidence/main-spool-rer-0213-1, relay the lane POST, and remove the clone after successful custody transfer.
