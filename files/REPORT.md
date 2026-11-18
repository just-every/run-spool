# Spool Sentry import receipt

No contract clause claimed; this is Sentry import receipt honesty.

## Plan and implementation

1. Confirm the previous branch at `6d55202781d060e57defb4dc9e492b1a86a0bc2c` and start the named cloud branch from fresh Spool main.
2. Replay the receipt commit linearly. Verify the Sentry mapper on main, preserve its roster and ownership proposal behavior, and report the number of distinct source alert definitions received without a native alert rule.
3. Regenerate the contract views, check them, restore them from main, and regenerate and check the source lock last. Exercise owner review, reconciliation, history, native rules, and the built Business imports screen, then check types.
4. Refresh main, check the one-commit history and fleet identity, push the product branch, and confirm Verify against the exact published SHA. Publish this report and its proof via the evidence ref.

The receipt derives its count from deduplicated plan entries in the Sentry source journal. The current mapper records issue rules, metric alerts, detectors, and workflows as unsupported collections with no native effects. The existing roster path continues to produce pending import proposals. The documentation describes private journal retention and the receipt count. The replay drops the previous sentence about manual preview reasons, which are outside the import receipt's proof.

The only replay conflict was the source lock. Main's lock was restored and regenerated. The contract generator reported zero changed views and the check reported zero errors and warnings. Main's generated views and contract statuses were preserved.

## Contract counts

| Tier | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Core | 23 | 45 | 19 | 87 |
| Agent surface | 0 | 9 | 9 | 18 |
| Later | 0 | 0 | 0 | 0 |
| Full target | 23 | 54 | 28 | 105 |

These counts apply before and after the replay. No clause changed status.

## Local verification

- The cloud setup, standalone RER build and complete `pnpm test:sentry` suite passed. The suite ran Sentry HTTP, Sentry import and Business import tests.
- The exact product tree passed typecheck on Node 22.20.0 with pnpm 10.12.4, the first-party check, the contract generator check, `pnpm source:check`, integration configuration validation, workflow validation and offline Base provenance verification.
- `node tests/sentry-import.mjs` passed on Node 22.20.0, including the receipt and Sentry roster/ownership regression. The test compared the no-write plan, reconciled receipt and owner history, then queried the imported project's native rules. It also exercised resumable apply, reimport and undo.
- `node tests/business-import.mjs` passed on Node 22.20.0. The signed catch-up fixture reconciled 497 baseline and 499 catch-up source records.
- The built Business imports history showed the same receipt in Chromium at 1440 px and 390 px. The text and viewport assertion ran at 1440 px.

| Synthetic fixture | Source rows | Distinct rows | Distinct alert definitions not imported | Native alert rules before | Native alert rules after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 26 | 25 | 2 | 0 | 0 |
| Scaled | 530 | 529 | 2 | 0 | 0 |

The quoted receipt in each fixture was “Rules are not carried over yet: 2 rule(s) not imported”. The evidence contains the test-generated import receipt, detailed field accounting and both viewport screenshots. The owner and source data in this packet come from local synthetic fixtures.

## Product provenance

- Repository `just-every/run-spool`
- Main immediately before publication `5bc2e3fcc00c285cf9fdf1aebf16de53c452c03c`
- Product branch `cloud/sd-spool-import-rules-3`
- Product head `62a723194eb55e13211db0b8fc589778f8cbce74`
- Fleet author and committer `Run Edit Run fleet <fleet@runeditrun.com>`
- One ordinary commit and zero merges or trailers. The branch was pushed once and the remote ref was confirmed at the exact head.
- Published at 2026-11-18 02:52:44 UTC.
- The repository pull request lookup returned no PR for the branch.

## GitHub Verify

GitHub Verify run 44226427761 completed successfully for the exact published product head. Checked on 2026-11-18 at 03:13:29 UTC. [Verify run](https://github.com/just-every/run-spool/actions/runs/44226427761)

The product handoff is READY. The fleet performs its own publication scan and landing.
