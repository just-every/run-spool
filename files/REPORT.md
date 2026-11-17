# Spool 0.7.14 release metadata

Author: Run Edit Run fleet. Date: 2026-11-17 UTC.

Repository: just-every/run-spool
Branch: cloud/sd-spool-release-0-7-14
Product head: 1853e3b3b59d49853b5ee7678f851d6de8343fbf
Parent/main read: 8d26df622ca844d93cfa9d13afeb601b3765e68d
Previous release: v0.7.13 at e35ebeca36a855cdbe7c0685b7c5324170d17a2a.

## Outcome

Prepared and pushed one linear metadata commit. Version 0.7.13 → 0.7.14; previousVersion 0.7.13. Core migration inventory 102 → 103 SQL files. The only added migration since v0.7.13 is migrations/core/0109_feedback_review.sql; all previous SQL bytes remain unchanged. No clause status, gap, evidence, acceptance point, generated view, product behavior, SDK version or identity changed. No tests added, removed, skipped or weakened. Rer remains exactly 0.2.118. No Base refresh ran.

The actual v0.7.13..main diff contains 15 commits. It confirms owner-confirmed retained end-user erasure, attributable tag/text and identity/facet clearing, value-free receipts and audits, archive fencing, consented private feedback review and explicit replies. Mail-off feedback controls explain the off state and send nothing. The preview and receipt disclose that consented feedback contact is not identity-matched; owner withdrawal removes the report's private details. The existing documented scale result is 150,000-event identity erasure in 24.681905 client seconds (7.185 receipt seconds) on prior candidate c5570fd9cdd52208ce39acbb41a46e19d666f043, with all 150,000 events retained. Its documented archive run restored and archived 160,000 events/identities and refused 160,001 without mutation. Release notes describe these measured outcomes without claiming a new run or completion of SDK-027/GOV-003.

## Product files

- package.json and seed.json: top-level release versions only.
- RELEASE.json: version, previousVersion, exact new migration and current notes/instructions.
- CHANGELOG.md: new user-visible section; old sections preserved byte for byte.
- RELEASE.md: absent in main; created the explicitly requested current-release notes, matching the other two copies.
- sources.lock.json: generated last with node scripts/edition-authoring/cli.mjs lock; only the five metadata file entries changed.

Buyer instructions preserve private backup before upgrade, git pull --ff-only/rer dev on main, the immutable-tag route only once the tag exists, and rer deploy from the original checkout for hosted installs. They state explicitly that the new migration applies on the next deploy, preserve database/settings/keys/deployment receipt, prohibit reset and restrict archive import to an empty destination. Known limits and mail-off credential cleanup/sign-in guidance remain visible.

## Validation and custody

- v0.7.14 tag absent by Git ref probe; no matching Release in the ten most recent Release entries (v0.7.13 is latest published). No tag or Release created or moved.
- cloud_run npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive: passed, 103 migrations. Private setup output and access links are excluded from this public packet.
- pnpm typecheck: passed.
- pnpm run check -- --profile first-party: passed.
- Metadata consistency review: passed; identical release notes, exact migration inventory, preserved historic changelog, unchanged dependency identities and rer pin.
- node scripts/edition-authoring/cli.mjs lock then pnpm source:check: passed.
- git diff --cached --check, scope/lock review and secret-shaped value review: passed.
- Fetched fresh main and rebased before committing; main had not advanced. Fleet clone-local hooks remained active. Every candidate author, committer, trailer and full message was inspected; one fleet-authored commit, no trailers or side parents.
- Guarded push: succeeded on first attempt, only cloud/sd-spool-release-0-7-14. No main/default push, self-submit, tag, Release or PR creation. Git's printed pull/new URL is an offer to open a PR, not an existing PR receipt.
- Full publication scan remains for the fleet Mac as explicitly specified by the cloud adaptation. No COMPLETE cloud scan or landing is claimed. The touched-value review is recorded separately.
- No browser or scale run was repeated for this metadata-only change; prior measured product outcomes are sourced from docs/OWNER-ERASURE.md and actual diff. Local runtime: Node 24.19.0 and pinned pnpm 10.12.4; pnpm emits the existing Node 22.20.0 engine warning. Exact-SHA CI uses the repository's Node 22.20.0 pin.

Exact-SHA Verify 44008607802 completed successfully on 1853e3b3b59d49853b5ee7678f851d6de8343fbf, observed at 2026-11-17T03:38:34.686915+00:00: https://github.com/just-every/run-spool/actions/runs/44008607802 . No generator exception applied. One watcher made one discovery and five status polls, spaced at least 300 seconds apart. No workflow was rerun or dispatched. Eight of ten GitHub API calls used (Release list, read-only Base scanner path discovery, exact-head run discovery and five status polls); the installed pinned rer already includes Base's scanner, so no other repository clone was needed.

## Counts and clause judgments

Versions: 0.7.13 → 0.7.14.
Migrations: 102 → 103, additive 0109_feedback_review.sql.
Product metadata files: 5; generated source-lock file: 1; commits: 1.
Test additions/deletions: 0/0. Contract and view changes: 0. Clause status changes: none. This round makes no CLAIM.

## Plan

The full authorized plan is in PLAN.md. Its steps were: read instructions; inspect release availability and actual diff; prepare matching metadata and buyer steps; preserve scope and pins; validate metadata/types and regenerate lock last on fresh main; inspect commit identities and push only the named branch; wait for exact-SHA Verify and transfer the explicitly selected public report packet. Product READY custody and evidence transport are separate. The fleet performs publication/landing and any later authorized tag/Release work.

## Blockers

None for metadata candidate custody. Exact-SHA Verify is green. Full publication and guarded landing remain with the fleet Mac, per the cloud adaptation. No product push rejection or lost work. Product branch and SHA were rechecked remotely. The product clone and its node_modules will be deleted after successful evidence publication and read-back; packet files remain outside the clone.

## Terminal product disposition

READY branch=cloud/sd-spool-release-0-7-14 head=1853e3b3b59d49853b5ee7678f851d6de8343fbf

No PR was created. This is metadata preparation, not a tag, GitHub Release, deployment or landing receipt. Evidence transport is published separately to evidence/sd-spool-release-0-7-14.
