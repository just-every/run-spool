Author: Run Edit Run fleet, 2026-11-17

# Portability CLI cookie validation

CodeQL alert 15 (`js/overly-large-range`) is fixed in code. Session-cookie values now use RFC 6265 cookie-octet ranges: commas and backslashes are refused. Cookie-name validation, trimming, file handling, errors and valid-cookie behavior are preserved.

Repository: just-every/run-spool
Branch: cloud/gr-mt-spool-code-2
Final candidate: b475196559aa9f029bba9a17cf12bbd83ed6403f
Initial candidate: f5141684dc88f64ddbbcab6171bbdeaa3f88ca16

Files changed:
- src/modules/portability/cli-options.mjs: replace the permissive value ranges with explicit hexadecimal cookie-octet ranges and cite their standard.
- base-copies.json: declare the intentional local adaptation using the maintained adapt-base command; retain the original Base revision and bytes as the upstream comparison baseline.
- sources.lock.json: regenerate source digests last with the documented lock command.

The full plan is PLAN.md. Actual commands, source identities and outcomes are recorded in local-receipt.json and the accompanying logs and JSON reports. cookie-regression.mjs is the actual reproducible public-door regression; it starts the real CLI status command against a loopback HTTP fixture and closes its server/children and removes temporary files afterward.

Validation on the final source:
- Original CLI regression: expected failure reproducing comma acceptance.
- Candidate CLI regression: pass; all 90 valid cookie octets travel unchanged, and all 38 excluded ASCII octets are refused before an HTTP request.
- Exhaustive exported-reader comparison: only ASCII 44 and ASCII 92 change outcome.
- pnpm typecheck: pass under Node 22.20.0 and pnpm 10.12.4.
- pnpm run check -- --profile first-party: pass.
- Source lock regeneration and pnpm source:check: pass.
- node scripts/edition-authoring/cli.mjs verify-base --offline: pass.
- Contract-docs check: pass; no contract or generated view was changed.

Before/after counts:
- Accepted ASCII cookie-value octets: 92 -> 90; unintended accepted octets: 2 -> 0; all other 126 ASCII decisions preserved.
- Registered product tests: unchanged, zero added. The narrowly scoped regression is retained in this evidence packet.
- Contract counts unchanged: 23 done, 54 partial, 28 missing, 105 total. No clause status, text or acceptance-point changes; no target clause was assigned and no acceptance promotion is claimed.

Initial Verify run 44081476721 failed because the modified Base copy had not yet been declared as an intentional adaptation. Its contract-docs job passed; build's verify-base drift caused downstream jobs to fail or skip. The follow-up commit records the reviewed adaptation through the supported command, preserving the old Base baseline. The entire failing local source/portable-contract step now passes. No test or workflow was weakened, skipped or removed.

Publication: COMPLETE/PASS with zero findings on the final candidate. The initial candidate passed a complete scan with zero findings and was pushed through the cloud guard. The final scan covers 984 commits and tree a7c2fce5049a5ac60b5bc2ba60985eb75f395463. Base scanner source: 4a43a4bd537d4b0f75db05d8249230386984644c; pinned Gitleaks: 8.30.1. Superseded scanner attempts are retained: one 300-second timeout and one extraction/setup failure. Restoring the scanner's unmodified root edition-authoring dependency and supplying the correct logical project just-every/spool resolved the setup issue.

Custody: both candidates are pushed; the named branch now points to the final candidate. A verified final-candidate bundle is retained outside the product clone at preservation/candidate-final.bundle (SHA-256 3c40b49ac67cd2f04de5eabcd274865359d279471033549a2b27130bc9b741eb). Final product publication succeeded. Exact-SHA Verify 44083687947 remained in progress after the final allowed query (three polls at least 300 seconds apart, approximately 15 minutes after discovery): https://github.com/just-every/run-spool/actions/runs/44083687947. No PR was created; no default branch was pushed or landed. Evidence transport is separate from product readiness. No UI, hosted, deployment or provider acceptance is claimed.

Terminal outcome: PUSHED branch=cloud/gr-mt-spool-code-2 head=b475196559aa9f029bba9a17cf12bbd83ed6403f. The explicit ten-call builder API budget is exhausted. Exact-SHA CI remains pending, so this report makes no READY, landing or full-suite success claim. Both product pushes and the final complete publication scan succeeded. No product-code or account blocker is known. The fleet must observe a completed/success Verify on this exact SHA before landing.

The complete failed build assertion log is included as ci-build-failed-public.log, with only the CI runner environment metadata block omitted from public transport. The original unabridged log remains local and is explicitly excluded from evidence selection. Credentials, environment dumps, raw archives/bundles and symlinks are not selected.
