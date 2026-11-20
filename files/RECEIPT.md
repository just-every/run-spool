# Spool 0.7.16 candidate receipt

Recorded by Run Edit Run fleet at 2026-11-20T05:46:31Z (UTC).

- Repository `just-every/run-spool`
- Advertised product branch `cloud/sd-spool-release-0-7-16` at `7a75de63c8615e4162759c6c7a0db8f728f9a007`
- Candidate parent and fetched main `8157a49c55c94207abf64b23c4521617043ebe3f`
- Previous release `v0.7.15` at commit `bb2efcd34837cd6067d02ce176609d3fc636dad2`
- Candidate is one commit with fleet author and committer and no trailers.
- Tracked paths in candidate `CHANGELOG.md`, `RELEASE.json`, `RELEASE.md`, `package.json`, `seed.json`, `sources.lock.json`.
- The prior release and pushed candidate both have 108 core SQL migrations. All tracked migration paths, modes and blobs are identical. The inventory lists the SHA-256 of every committed blob.
- The Markdown release note, JSON public release notes and new changelog section have identical prose. The earlier changelog sections are byte-identical to main.
- The lockfile and exact rer 0.2.118 pin are unchanged. The screenshot reference resolves to the existing product PNG on main.
- CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to the candidate parent.

## Declared file hashes on the pushed commit

| Key | Path | Declared SHA-256 | Actual SHA-256 |
| --- | --- | --- | --- |
| `setup.sha256` | `rer-setup.json` | `f6edca8868764a1a476d8635c06d7b40e4fcbe293c6dc5d1c9ae40de969ea256` | `f6edca8868764a1a476d8635c06d7b40e4fcbe293c6dc5d1c9ae40de969ea256` |

## Clause counts before and after

| Tier | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Core | 23 | 45 | 19 | 87 |
| Agent surface | 0 | 9 | 9 | 18 |
| Later | 0 | 0 | 0 | 0 |
| Full target | 23 | 54 | 28 | 105 |

## Local checks

| Check | Result |
| --- | --- |
| pnpm install --frozen-lockfile | Passed |
| Release metadata consistency and scope | Passed |
| node scripts/edition-authoring/cli.mjs lock | Regenerated last |
| pnpm source:check | Passed |
| node scripts/edition-authoring/cli.mjs verify-base --offline | Passed |
| node src/base/contract-docs.mjs check | Passed with zero prose errors or warnings |
| pnpm typecheck | Passed on the pinned Node 22.20.0 |
| git diff --check | Passed |
| pnpm run check -- --profile first-party | Passed on Node 22.20.0 |
| pnpm run build:app | Passed on Node 22.20.0 |
| pnpm integration:check | Passed after build on Node 22.20.0 |

## GitHub checks

Verify run 44683034030 was completed with conclusion success at 2026-11-20T06:09:45Z. Its recorded head matched the pushed product commit. [Verify run](https://github.com/just-every/run-spool/actions/runs/44683034030)
