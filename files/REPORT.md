# Spool rer 0.2.125 adoption

Round `sd-spool-rer-pin-125-1` for `just-every/run-spool`. Branch `cloud/sd-spool-rer-pin-125-1`.

No contract clause claimed; this is a rer adoption.

## Plan and implementation

1. Inspect Spool main's rer and Base copy history. Follow the existing exact pnpm pin and lockfile pattern. The immediately prior rer pin arrived in `7d7b276`, and `169e4cb` shows the most recent standalone Base refresh. Spool tracks pnpm's lockfile.
2. Pin the published rer package to 0.2.125. Check out the full immutable Base commit `965e8d4e105f6f4d281dacb3c099f6a958a886e7` in a blobless clone. The annotated release tag peels to that commit. Run `pnpm exec rer refresh-base --ref 965e8d4e105f6f4d281dacb3c099f6a958a886e7 --base <Base checkout>`.
3. Preserve Spool's patched TLS WebAssembly bytes. The original refresh stopped because the authoring tool fed the NUL-prefixed Wasm file to its JavaScript parser. The Worker now imports a Spool-owned static re-export of the same binary. The Base record acknowledges the Worker adaptation and declares the re-export as seed-owned. The released refresher then completed. The emitted egress module graph included the same patched production bytes.
4. Regenerate and check the contract views, restore the checked-in views from main, and regenerate the source lock last. Run the ordered local build checks and exercise export and restore through both rer and the emitted Spool Worker. Inspect the exact candidate before publishing and follow the matching GitHub Verify run.

## Before and after

| Measure | Before | After |
| --- | ---: | ---: |
| rer package | 0.2.118 | 0.2.125 |
| Base copy roots | 105 | 105 |
| Files recorded under those roots | 944 | 955 |
| Contract clauses done | 23 | 23 |
| Contract clauses partial | 54 | 54 |
| Contract clauses missing | 28 | 28 |
| Total clauses | 105 | 105 |

Clause status changes and test registration changes were zero. The refresh delivered zero edition migrations and withheld zero copy files. Spool declares 108 core SQL migration files and no separate owner migration directory.

Prepared for lane sd on 2026-11-20.

The refresh reported existing differences in four Spool-owned agent-door adaptations. Their upstream bytes are identical at the old and new copy pins. The refresher also reported a React version difference and preserved Spool's seed-owned Verify workflows. The dependency change stayed confined to rer.

## Published product

- Adoption commit: `d34f6bf12502f871731fa99e56517a2e3df2a32c`
- Follow-up commit: `b5005b9c11b34c1ea8ea4359d45cdb34062a3f16`
- Main parent: `804a4ad15e6c8e1c52f0069dcf610ba1f5d2342c`
- Branch: `cloud/sd-spool-rer-pin-125-1`
- Both guarded pushes succeeded on the first attempt. Git independently advertised both commits after their respective pushes. The branch has two linear commits.
- The first Verify identified stale operator guide URLs. The follow-up points four references to the immutable egress copy revision and regenerates the source lock. The existing Slack and cron journeys passed locally against the updated guides.

## GitHub Verify

Run [44777788968](https://github.com/just-every/run-spool/actions/runs/44777788968) completed with conclusion success on the published product commit. Checked at 2026-11-20T17:17:01Z.
