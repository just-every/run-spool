# Spool 0.7.15 release metadata

Repository `just-every/run-spool`  
Fleet task `sd-spool-release-0-7-15`  
Prepared by Run Edit Run fleet on 2026-11-19 UTC

## Plan

1. Confirm the fresh main tip and the previous release tag. Check that v0.7.15 has neither a Git tag nor a GitHub Release. Review the tag-to-main tree and history before writing any buyer-facing claims.
2. Advance the existing application and seed versions. Write matching notes in CHANGELOG.md, RELEASE.md and RELEASE.json with upgrade and backup steps, exact migration filenames, and current limits. Retain the prior screenshot only after confirming its tracked blob. Preserve existing dependency pins and all files outside the lease.
3. Compare all old migration blobs against the candidate, verify the declared setup hash, regenerate sources.lock.json last, and run the relevant repository checks on the committed tree.
4. Inspect every candidate commit's identity and message. Push only the named product branch using the fleet guard. Confirm the advertised SHA and recompute project-declared hashes from that commit. Verify the exact candidate through the branch workflow.
5. Publish the report and actual receipts separately, using the fleet evidence entrypoint. Return the exact product and evidence provenance to the seed lane.

## Candidate provenance

- Previous release tag `v0.7.14` is annotated object `9af2173100945141924870851c41c1d50c863325` and points to commit `1853e3b3b59d49853b5ee7678f851d6de8343fbf`.
- Fresh main and candidate parent are `7db1a39f91289cf56850176e25b55e69629eaa0d`. The release range has 40 commits.
- Git advertised no `v0.7.15` tag in the pre-push probe. The GitHub release-by-tag endpoint returned HTTP 404 for `v0.7.15`.
- The candidate is `bb2efcd34837cd6067d02ce176609d3fc636dad2` on `cloud/sd-spool-release-0-7-15`. The guarded push succeeded on attempt one at 06:56:33 UTC. This is a single-parent metadata commit. The lane has custody of landing, the full publication scan, tagging and the GitHub Release. This task opened no PR.

## Release results

- The Sentry capture importer now reports per-collection and per-record outcomes and exact locations for mapped, transformed and omitted fields, with rejection reasons and safe labels. The published scope stays bounded. Roster and ownership remain inert pending an owner decision. Native invitations have distinct records. Earlier supported native archive inventories are preserved.
- Alert import proposes rules for owner approval. Receipts and history report rules that were not imported. Saving a destination review exposes the next action. Unsupported or unresolved rules remain disabled, and rules requiring users or sessions can wait for matching data.
- Local owner setup is preserved across an email change. Sign-in shows the full rer path for a fresh local owner link. Release registration confirms success by the action. Refused issue searches explain the cause and offer to clear the query.
- Portability session files now require valid cookie octets. The release range carries updates to rustls, qs, minimatch, picomatch, Hono and its Node adapter. The Ruby Rack update belongs to the SDK test fixture and is recorded here for audit.
- Live provider delivery and real-account migration remain unqualified. The Sentry organization path allows up to 1,000 parsed records including its manifest, within 2 MiB and separate request limits. The other importers retain their 500-record bound.
- The prior screenshot exists on main and the candidate at `.github/assets/release/spool-issue-page-1600.png`.
- Only CHANGELOG.md, RELEASE.json, RELEASE.md, package.json, seed.json and sources.lock.json changed. The repository has no root package-lock.json and pnpm-lock.yaml carries no root release-version reference. Both the existing rer pin, `0.2.118`, and the declared setup manifest and hash remain as on main. No Base refresh ran.

## Upgrade inventory

Download a private Settings archive or stop local dev and export before updating. Use the same database and deploying checkout, keep private settings, keys and deployment receipt, and restore private archives only into an empty destination. The next deploy applies these five files:

| Core migration | Buyer step |
| --- | --- |
| `migrations/core/0110_sentry_roster_proposals.sql` | Review the imported roster and ownership in Members before issuing native invitations. |
| `migrations/core/0111_key_names_and_use.sql` | Keep existing keys and optionally name them in Settings after deploy. Successful-use timestamps start unknown for older keys. |
| `migrations/core/0112_member_identity.sql` | Keep the same owner and members and use normal identity settings for future changes. |
| `migrations/core/0113_capture_sources.sql` | Send a test event after deploy to check the Capture connection status if needed. |
| `migrations/core/0114_sentry_alert_proposals.sql` | Review imported alert rules and destinations in Business imports before creation. |

The exact tree inventory goes from 103 to 108 core SQL files. All 103 preceding migration blobs and file modes match v0.7.14.

## Contract and local verification

No contract clause claimed; this is release metadata.

| Tier | Before done / partial / missing / total | After done / partial / missing / total |
| --- | --- | --- |
| Core | 23 / 45 / 19 / 87 | 23 / 45 / 19 / 87 |
| Agent surface | 0 / 9 / 9 / 18 | 0 / 9 / 9 / 18 |
| Later | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Full target | 23 / 54 / 28 / 105 | 23 / 54 / 28 / 105 |

Frozen dependency install, typecheck, contract docs check, workflow permissions check, source integrity check, offline Base verification, first-party project check, application build and integration check passed with Node 22.20.0 and pnpm 10.12.4. The integration check requires the build output. It passed after building when an initial attempt reported a missing dist directory. Metadata validation proved matching release notes, historical changelog preservation, the exact migration tree, the retained screenshot and the scoped lock delta. The advertised candidate's declared hash receipt is included in this packet. The source lock gained new digests only for the five edited metadata files.

## Branch Verify

Verify run 44475847586 completed successfully on the exact candidate. The final API check was 2026-11-19T07:22:34Z. https://github.com/just-every/run-spool/actions/runs/44475847586
