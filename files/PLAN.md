# Spool v0.7.11 metadata plan

Recorded 2026-11-13T23:29:16Z.

1. Initialize fleet identity, credential helper and hooks; clone the declared repository shallow and create the named cloud branch from main.
2. Confirm main is green on its exact SHA, latest public Release is v0.7.10, and no v0.7.11 tag, Release or competing release branch is present.
3. Inspect all landed changes since v0.7.10. Preserve both landed commits, including native export path validation fix gr-mt-spool-code-7 (alert18), without changing product code.
4. Bump existing application release references to v0.7.11, write honest notes and update instructions using the actual unchanged rer pin 0.2.113. Preserve historical changelog sections and known limits. Do not create package-lock.json where none exists.
5. Fetch/rebase onto fresh main before first publication. Run affected metadata/first-party checks and typecheck only. Regenerate sources.lock.json last and check it. Do not change product, tests, contract, generated views, or homepages.
6. Commit under fleet identity with hooks active, audit every candidate identity and trailer, and push the named product branch with cloud-push.py. Observe exact-SHA Verify through REST at least 300 seconds apart within the ten-call budget.
7. Save actual report and receipts outside the product checkout, publish explicitly selected public evidence on the evidence ref, and delete the scratch checkout and dependencies after successful publication. The fleet owns landing, publication scan, tags, signing, release publication and deployment.
