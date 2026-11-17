# Maintenance plan — gr-mt-spool-ci-19
Author: Run Edit Run fleet, 2026-11-17.

1. Install fleet identity, launcher, credential helper, push guard, and clone the declared Spool repository with full history onto cloud/gr-mt-spool-ci-19.
2. Read repository instructions and contract; inspect Nightly run 43803437294 and its failed command-job log once.
3. Compare failing revision adc3de69b9ae0ff60e41897f8ff7662fd656d560 with current main. Identify the precise failed lifecycle stage and determine whether main already fixes it.
4. Use pinned Node 22.20.0 and pnpm 10.12.4; run only pnpm test:commands and typecheck. Use system Chromium with no sandbox and owned process cleanup.
5. If current main passes the reported step and contains the causal fix, return no-change without a product commit. Otherwise make the smallest justified fix, preserve all wanted assertions, regenerate/check source lock, scan exact committed tree before publication, and push only the named cloud branch through the guard.
6. Record actual outcomes, counts, provenance and any remaining failures. Publish explicit non-secret report and receipt files only to evidence/gr-mt-spool-ci-19. Leave product landing to the fleet.

No UI changes or clause promotions are planned. Generated acceptance views remain uncommitted.
