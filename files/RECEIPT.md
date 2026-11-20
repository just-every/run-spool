# Verification receipt

## Toolchain and source checks

- Node 22.20.0 and pnpm 10.12.4.
- `pnpm install --frozen-lockfile` accepted the 0.2.125 pnpm pin.
- `pnpm exec rer refresh-base --ref 965e8d4e105f6f4d281dacb3c099f6a958a886e7 --base <Base checkout>` ended with `refresh-base: complete (exit 0)`.
- `node src/base/contract-docs.mjs write` and `check` completed. Check reported `Contract prose: 0 errors, 0 warnings.` and `Contract documents are current.`.
- Restored `ACCEPTANCE.md` and `docs/CLAIMS.md` from main. Ran `node scripts/edition-authoring/cli.mjs lock` and `pnpm source:check`.
- The local build executed in documented order. Native export, first-party rer check, source lock check, offline Base verification, application build, integration check, catalogue check and typecheck passed. Integration output reported `Integration deployment spec, setup digest and producer workflow match.`.
- The egress deployment module graph preserved the patched production Wasm bytes and excluded the test trust entry.

## Archive and migration receipts

`node tests/old-archive.mjs` passed against the refreshed source and vendor copy.

```
PASS populated published release upgrades preserve existing rows and columns with declared attribution additions: 177 tables, 120 rows before and after
PASS populated 0068 upgrade: 202 tables preserved; five additive migrations applied
PASS pre-metric archive with complete native objects and hashed ledger restores into the metric schema
PASS populated migration order 0110, 0112, 0113, 0111, 0114: existing evidence, key authority and roster proposals survive upgrade and archives on both sides restore
PASS old native archive restores into a fresh migrated target with all product rows and destination ledger intact
PASS old archive refuses an occupied target without changing its project
PASS genuinely mismatched schema and corrupted original archive binding still refuse
PASS current archive independently restores and mandatory bookkeeping exclusions retain person-owned tables
```

Base's separate fixture at the release SHA passed `node --test modules/portability/tests/owner-worker-history.test.mjs`. It accepted matching interleaved core and owner migration history, restored older compatible prefixes, and refused changed owner SQL, missing owner ALTER, reordered history and a missing data-only owner entry with HTTP 409 and zero restored rows.

### CLI export and fresh-state restore

- `npx -y @runeditrun/rer setup --non-interactive` and `npx -y @runeditrun/rer build --non-interactive` passed in the isolated checkout with the supplied owner setting.
- `pnpm exec rer export --output exports/synthetic-adoption.rer` completed successfully. `pnpm exec rer reset --yes` preserved the archive and removed local state.
- `pnpm exec rer import --input exports/synthetic-adoption.rer --yes --persist-to .wrangler/state` returned exit 2 and `Unsupported flag --persist-to for import.` The documented import command without that flag restored into a verified empty checkout and returned `restored: true`.
- `pnpm exec rer export --output exports/synthetic-adoption-restored.rer` completed successfully. Wrangler queries using `--persist-to .wrangler/state` confirmed matching project rows and 108 native ledger entries in the same applied order.
- The restored Wrangler D1 ledger declared applied_at as TIMESTAMP, as read through pragma_table_info.
- The raw fixture omitted its derived short ID. The restore preserved all supplied rows and created the expected short ID, and both manifests excluded owner identity, sessions and project grants. After a second reset, importing and re-exporting the repaired archive preserved all product rows.
- `pnpm test:product` passed the emitted Worker/D1 restore journey, including rejection of an occupied target and independent restoration with retained product rows.

The build and archive checkouts matched staged Git tree `186c3ff2e33930b85d53fef35dcd82ca55259a44`.

## Candidate checks and publication

- Scoped `pnpm exec rer verify` completed with exit 0. The selected Spool suites were product, admission and dev-credentials. Agent-door conformance reported 9,191 of 9,191 points passed. The statement-size check inspected 1,060 view and trigger statements.
- Rebase onto the fetched main was current. One candidate, zero merge commits, fleet author and committer, zero co-author trailers.
- The exact candidate diff passed the pinned Gitleaks check with Base's metadata classifier. The one flag resolved to a verified Base copy checksum. The fleet owns the full landing publication scan.

## First exact-SHA Verify and follow-up

Verify run 44770601628 failed in the runtime shard, job 136407743747, step Run suites. Build and contract-docs passed. The shards and Verify summary jobs propagated the runtime failure.

The archived failed-job log reported an owner-runtime string-equality assertion after the anonymous docs journey passed. The same owner-runtime assertion reproduced locally. The Settings prerequisite journey expected its Base owner-steps URL to match the installed egress copy revision. The Slack and cron guides and an internal reference still used the prior commit. The follow-up changes four URLs and regenerates the source lock. The runtime assertions were kept.

## Follow-up archive receipts

Repeated the CLI and emitted Worker journeys on `b5005b9c11b34c1ea8ea4359d45cdb34062a3f16`. Both checkouts stayed at that commit.

```
START 2026-11-20T16:53:57Z
PASS rer setup (isolated local installation)
PASS rer build
PASS native D1 fixture inspection and insertion via --persist-to .wrangler/state
PASS rer export --output exports/synthetic-adoption.rer
PASS rer reset --yes left the archive and an empty restore state
rer import --persist-to is unsupported (exit 2)
PASS rer import --input exports/synthetic-adoption.rer --yes
PASS rer export --output exports/synthetic-adoption-restored.rer
PASS source and restored synthetic project rows match; 108 native ledger entries match in applied order
PASS original and restored archives carry the same product rows and exclude owner identity, sessions and project grants
END 2026-11-20T16:58:09Z
Spool emitted Worker/D1 acceptance passed: atomic retry, pre-scrub conflict, privacy, minified capture, CSRF, delayed release/regression, archive independent restore, retention.
Real Chromium automatic exception, stored-group browsing/selection and separate Worker waitUntil transport also passed.
```

The follow-up passed scoped rer verify with runtime and origins. Agent-door conformance passed 9,191 of 9,191 points. The exact-candidate diff scan resolved one Base copy checksum and found zero unresolved matches.

Exact follow-up legacy archive test tail

```
PASS populated published release upgrades preserve existing rows and columns with declared attribution additions: 177 tables, 120 rows before and after
PASS populated 0068 upgrade: 202 tables preserved; five additive migrations applied
PASS pre-metric archive with complete native objects and hashed ledger restores into the metric schema
PASS populated migration order 0110, 0112, 0113, 0111, 0114: existing evidence, key authority and roster proposals survive upgrade and archives on both sides restore
PASS old native archive restores into a fresh migrated target with all product rows and destination ledger intact
PASS old archive refuses an occupied target without changing its project
PASS genuinely mismatched schema and corrupted original archive binding still refuse
PASS current archive independently restores and mandatory bookkeeping exclusions retain person-owned tables
```

Run Edit Run fleet · 2026-11-20 UTC
