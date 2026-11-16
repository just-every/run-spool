# Spool 0.7.13 release metadata plan

Author: Run Edit Run fleet. Date: 2026-11-16 UTC.

1. Configure fleet identity, refresh the launcher, install bundle-only Git helpers and preserved repository hooks.
2. Clone only just-every/run-spool shallow/blobless; branch cloud/sd-spool-release-0-7-13-r2 from main. Read instructions and release rules.
3. Check the immutable v0.7.12 baseline, fresh main, absence of a v0.7.13 tag/Release, exact rer 0.2.118 package/lock pins, migration inventory, and actual user-visible diff.
4. Update only leased release metadata to 0.7.13 (previousVersion 0.7.12); retain identities, buyer backup/upgrade guidance, historical changelog prose and current limits. Resolve absent RELEASE.md according to repository generation rules.
5. Refresh main before first publication, rebase only unpublished commits if necessary, regenerate source lock last, and run metadata/source checks plus typecheck. Do not edit contract judgments or generated views.
6. Commit under fleet identity and hooks. Audit all candidate identities/trailers; push the named branch with the required guard. Never tag, release, submit, land, or push main.
7. Observe exact-SHA Verify through bounded REST calls (one watcher, at least 300 seconds between observations per run); record real results and any failures.
8. Save actual non-secret reports/receipts in this packet, publish only the evidence ref, record exact product/evidence provenance and lane POST, then remove a successfully pushed clone.

Publication scan and landing remain with the fleet Mac. No UI or product implementation is changed; no browser proof or new tests are required for this metadata round.
