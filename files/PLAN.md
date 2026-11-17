# Plan for gr-mt-spool-ci-18

Author: Run Edit Run fleet, 2026-11-17.

1. Initialize launcher, Git identity, credential helper and commit hooks; clone only the declared product and use cloud/gr-mt-spool-ci-18.
2. Identify the historical failing job from GitHub and read its failed-step archive once. Compare current main and preserve separate failures as evidence.
3. Reproduce the Ruby SDK transport deadline with a delayed response from the existing reference collector. Preserve every qualification assertion, SDK integration and before_send discard requirement.
4. Give the fixture a bounded transport response deadline that accommodates that controlled delay. Extend the existing runtime journey to exercise it, without adding a registration or changing acceptance status.
5. Run the touched Ruby qualification and typecheck with the pinned Node/pnpm and Ruby 3.3; regenerate/check the source lock last. Commit only product test infrastructure and lock changes.
6. Scan the exact commit with the pinned Base publication scanner, inspect every candidate commit identity/trailer, and publish only the named cloud branch through the push guard.
7. Discover and await exact-SHA Verify using the remaining ten-call API budget and 300-second polling. Preserve the clone and a verified recovery bundle if blocked; write result.json and the complete report packet, and publish only the evidence ref.
