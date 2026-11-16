# sd-spool-sdk027-5 repair plan

Author: Run Edit Run fleet; date: 2026-11-16 UTC.

1. Initialize fleet authentication, clone only just-every/run-spool, retain every commit of cloud/sd-spool-sdk027-4, and create cloud/sd-spool-sdk027-5 at c5570fd9cdd52208ce39acbb41a46e19d666f043.
2. Read the seed instructions, contract, generated acceptance and Verify workflow. Preserve all assertions. Read the failed owner-ui log once (GitHub call 1 of at most 10).
3. Build the starting head using Node 22.20.0, pnpm 10.12.4 and Verify build:app; run pnpm test:accessibility with owner-ui environment and /usr/bin/chromium --no-sandbox. Preserve actual output. Make no product edits before reproduction.
4. If the reported failure cannot be reproduced, run the same command on main. If neither reproduces, stop BLOCKED with the actual outputs; do not infer a product fix.
5. If reproduced, inspect runtime diagnostics and the changed archive/restore/identity code, repair the cause within the lease, without weakened checks or hidden timeouts. Stop after two failed repair rounds.
6. For a repaired candidate, run typecheck and affected journeys, regenerate sources.lock.json last, commit with fleet identity and hooks, inspect every candidate commit and trailer, and push only cloud/sd-spool-sdk027-5 with the cloud push guard. Preserve a bundle on rejected push.
7. Run both committed volume journeys on the exact candidate under a 2400-second hard alarm, citing 150000-event erasure and 160000-event archive results. Follow exact-SHA Verify using REST within the polling/API budget. Record counts and unchanged claim gaps; do not edit generated views or clause judgments.
8. Keep all reports and receipts outside the product checkout. Explicitly scan selected non-secret regular files and publish the complete packet only to evidence/sd-spool-sdk027-5. Report custody independently from product readiness. Relay lane inbox text in final POST lines.
