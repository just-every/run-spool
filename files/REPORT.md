# Spool rer 0.2.126 adoption

Fleet task sd-spool-rer-pin-126-1. Prepared from 2026-11-20 to 2026-11-21 UTC.

No contract clause claimed; this is a rer adoption.

## Plan

1. Read the Spool README and repository instructions, identify the preceding rer adoption and compare its dependency, Base copy and source-lock changes.
2. Install exactly rer 0.2.126 with pnpm and prove a frozen install. Refresh against the full-history Base checkout at commit 3637852064bf6ddadd15418518964d99d615cc46. Preserve the refreshed bytes and review the tool's seed-owned adaptation notices.
3. Run the ordered build checks, typecheck, archive and owner tests, and local rer verification. Exercise a populated native CLI export and restore into empty state and the built Worker's archive behavior. Check the documented local dev and preview readiness paths with headless Chromium.
4. Check and restore the generated contract views, regenerate and check the source lock, and review the single candidate commit. Rebase onto fresh main and push the named branch with the fleet guard. Check Verify on the exact SHA. Publish the reports on the separate evidence branch.

## Scope and source

- Spool pin 0.2.125 → 0.2.126. The previous adoption is 49b7e65. The manifest and pnpm lock carry the exact new version. Spool has no root npm lockfile.
- Base copy record 965e8d4e105f6f4d281dacb3c099f6a958a886e7 → 3637852064bf6ddadd15418518964d99d615cc46. The refresh updated six portability files and their source provenance. The refresh reported seed-owned workflow and Agent Door adaptations and a React version difference. The existing Spool React pin passed the build and runtime checks. Offline Base verification passed. The new Base revision required aligning four existing egress owner-step links across three Spool guides.
- Spool declares and tracks 108 core migration files. Its installation exercises the native owner claim and additive owner migration. Cross-ledger owner SQL coverage uses a synthetic fixture wired to Spool's vendored archive engine and the installed Worker's evidence and history modules.

## Contract status

| Tier | Done before → after | Partial before → after | Missing before → after | Total before → after |
| --- | ---: | ---: | ---: | ---: |
| Core | 23 → 23 | 45 → 45 | 19 → 19 | 87 → 87 |
| Agent surface | 0 → 0 | 9 → 9 | 9 → 9 | 18 → 18 |
| Later | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| Full target | 23 → 23 | 54 → 54 | 28 → 28 | 105 → 105 |

The generator wrote zero views and reported zero prose errors and warnings. Neither generated view nor the contract is in the candidate diff. The source lock was regenerated and checked after the view generation.

## Archive invocation

The installed `rer import --help` exposes the documented local-target import and confirms that `--persist-to` is a Wrangler flag. Spool's local transfer adapter passes `--persist-to .wrangler/state` when applying D1 migrations. The checkout's own state directory gives the CLI a fresh destination. Export archives, owner-entry links and all private runtime data are excluded from this packet.

The Mac lander owns the full publication scan. A redacted Gitleaks check found zero leaks in the one-commit candidate range.

## Product custody

- Branch cloud/sd-spool-rer-pin-126-1 advertised 8f6f09a0a134ddea003074d11330c8c2b695a2f9 after the initial successful guarded push on 2026-11-21 at 00:15:06 UTC.
- Candidate parent e0e941da9d90e809f803647fc96d301e40cd9b9e was current main at push. The initial candidate range had one linear commit, zero merge commits and zero trailers. The fleet author and committer passed the publication identity check.
- CLI export and fresh restore, both local owner entry journeys, the built Worker archive checks and the synthetic cross-ledger tests passed. Command results and the recovered browser setup issue are in CHECKS.md.

## Exact-SHA Verify repair

Verify 44842554668 on the initial candidate failed in the runtime shard's Run suites step. Build and contract-docs passed. The failed job log reported an owner runtime assertion error. A local replay reproduced that assertion at tests/setup-prerequisites.mjs:53. Spool's guide linked to the previous egress module revision, while the refreshed Base copy record named 3637852064bf6ddadd15418518964d99d615cc46.

The follow-up aligns the existing guide links with that recorded revision and regenerates the source lock. The full runtime journey passed locally through the same assertion. The existing push remains in history and the corrective commit is its direct child.

The named branch advertised 2681b8aa457a70c154e8012b6080c055c756a2cc after the guarded follow-up push at 2026-11-21T00:51:25Z. Its range contains two linear commits, zero merges and zero trailers. Candidate Gitleaks and the fleet identity and trailer audit passed across both commits.

## Terminal Verify

Latest exact-SHA Verify 44846563479 observed at 2026-11-21T01:14:49Z reported completed / success. The candidate is 2681b8aa457a70c154e8012b6080c055c756a2cc. The first Verify failure and subsequent observations are in VERIFY.json.

[Latest Verify](https://github.com/just-every/run-spool/actions/runs/44846563479)
