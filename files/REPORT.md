# Spool 0.7.10 metadata merge continuation

Plan: inspect the launcher and repository rules; confirm the immutable source and latest main, release absence and competing release PRs; merge the existing candidate into the named cloud branch from main; preserve main product/tests, contract source, generated views and actual dependency pin; regenerate the source lock last; run affected metadata/source checks and typecheck; inspect every candidate commit including side parents; push once through the cloud guard; observe exact-SHA Verify within the ten-call budget; publish this separate evidence packet; remove the pushed clone after evidence publication. The Mac fleet owns publication scanning and landing.

Main: `3d3a7db595e571f8466bcee683634c83d93656b8`.
Immutable source: `558089ee4fc3b809c515db5f9d322523fad958aa`.
Merged product head: `417ab513b3032370091479fa28f41a5a67b50c53`.
Branch: `cloud/sd-spool-release-0-7-10-merge-1`.

The merge retains source metadata for 0.7.10 and main's portable contract anchor `104ae1c1` and Slack test fix `3d3a7db5`. No conflicts occurred. Only package.json, seed.json, README.md, docs/getting-started.md, CHANGELOG.md, RELEASE.json and regenerated sources.lock.json differ from main. Product, tests, CONTRACT.md, ACCEPTANCE.md, docs/CLAIMS.md and docs/contract/ANCHOR.json match main byte-for-byte. The only post-source changes on main are the portable anchor and Slack test isolation; they add no user-facing release promise, so the existing invitation and ownership notes remain accurate. Actual rer pin stays exactly 0.2.107, with all dependencies unchanged.

The release inventory contains published v0.7.9 and no v0.7.10; remote tag discovery also found no v0.7.10. No open release PR competes with this authorized continuation; existing 0.7.10 cloud refs are the prior source lineage, which remains untouched. There is no PR-only landing requirement in seed AGENTS.md, so no new PR was opened.

All affected local checks passed: frozen dependency install, source lock generation/check, contract-docs check, first-party metadata check, typecheck, whitespace check and metadata integrity assertions. Full local product/browser suites were not run for this metadata-only lease. The supplied toolchain retained Node 24.19.0 with an engine warning; CI uses declared Node 22.20.0 and pnpm 10.12.4. No rer setup, dev or browser process was needed.

All three commits in origin/main..HEAD, including both published source commits, have fleet author/committer identities and no co-author trailers. The new real merge commit has no skip marker. The named product branch was pushed successfully on the first attempt. No published history was rewritten.

Version before/after: 0.7.9 -> 0.7.10. Seven metadata/lock files changed, 42 insertions and 16 deletions. Tests added/removed: 0/0. Full contract counts before/after: done 23/23, partial 54/54, missing 28/28, total 105/105. Clause status changes: none. No DONE claim.

Main has an exact-SHA successful Verify 43460418426, a later failed Verify 43463918357 (Java runtime job 132018638090, step Run java SDK journey; aggregate spool/verify jobs also fail), and successful Run site 43463918250. The one permitted failed-job archive command returned no output, so no Java assertion or transport cause is inferred. This existing runtime issue belongs to the lane; no duplicate product, Slack or CI repair/retry was attempted.

Candidate Verify: 43479806139, initially in progress at exact product SHA. Final observation will be recorded below. No main, tag, release, signing, deployment, landing-record or CI-dispatch/retry write occurred. This is release metadata preparation only; no GitHub Release claim is made. Private release/hosted/provider qualification debts remain in the existing release notes.

Final CI observation at 2026-11-13T18:20:04Z: Verify 43479806139 remains in_progress, conclusion null, head_sha 417ab513b3032370091479fa28f41a5a67b50c53. Discovery and polls were spaced by at least 300 seconds. Eight of ten GitHub calls were used, reserving the remaining two for failure inspection if needed; polling ended with budget short and no completed candidate failure observed. Terminal product custody is PUSHED, not READY. The existing lane must observe exact-head completion and retain its full publication/landing gates.

PUSHED branch=cloud/sd-spool-release-0-7-10-merge-1 head=417ab513b3032370091479fa28f41a5a67b50c53
