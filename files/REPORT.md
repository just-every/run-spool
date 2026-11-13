# Spool 0.7.10 release metadata continuation

Repository: just-every/run-spool
Branch: cloud/sd-spool-release-0-7-10-pc1
Candidate: 558089ee4fc3b809c515db5f9d322523fad958aa
Saved parent: cc0a05ec50d235f457e03dc5f0be0efa6e413b31
Merged main: 2073114e2a52b168413b9609a8f6c1d13038a8aa
PR: none; the fleet owns guarded landing. No PR rule is declared by the seed AGENTS.md.

## Plan and execution

The full plan is in PLAN.md. Restored the exact published candidate and retained it as the first parent. Inspected seed and launcher rules, the provided release rules, actual package/release/changelog metadata, contract progress, current main and the previous failed Verify. Confirmed latest public release v0.7.9 and no v0.7.10 tag at preflight. Current main was green in Verify 43438323253 and Run site 43438323177. Its additional scoped invitation work is already on main and was merged without rewriting published history.

The shallow main boundary initially prevented Git finding the merge base. A bounded deepen of main exposed the real shared ancestor 30cc17837e934cc821948e34a694ca2b5d0ec0c7, after which the ordinary merge succeeded. The only conflict was sources.lock.json: retained main's file and regenerated it from the final merged source last, then passed source:check. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to main. No product/test assertions were edited by this continuation.

Updated the current 0.7.10 changelog and matching RELEASE.json notes to describe members opening their own local invitation directly, retaining only their granted access and losing access on removal. The notes explicitly keep the owner's local access link private. The explanation is supported by merged docs/MEMBERS.md, local-members.server.ts, local-identity.server.mjs and tests/dev-credentials.mjs. Preserved all other current notes and known limits. The release candidate has no new migrations and no breaking changes. Historical release sections remain intact.

## Metadata and counts

Version: 0.7.9 -> 0.7.10 (saved candidate was already 0.7.10).
Actual @runeditrun/rer source pin from package.json: 0.2.107 -> 0.2.107.
Exact candidate metadata paths relative to main: package.json, seed.json, README.md, docs/getting-started.md, CHANGELOG.md, RELEASE.json, sources.lock.json.
There is no package-lock.json in this pnpm repository. pnpm-lock.yaml is unchanged.
This continuation changed CHANGELOG.md and RELEASE.json and regenerated sources.lock.json; remaining release version updates were preserved from the saved parent.

Clause status changes: none. No new acceptance claims.
Generated progress counts before -> after: Core done 23 -> 23, partial 45 -> 45, missing 19 -> 19, total 87 -> 87. Agent surface done 0 -> 0, partial 9 -> 9, missing 9 -> 9, total 18 -> 18. Full target done 23 -> 23, partial 54 -> 54, missing 28 -> 28, total 105 -> 105.
Test registrations added/removed by the release delta: 0/0; the candidate's tests are identical to merged main.

## Validation and custody

Passed pnpm install --frozen-lockfile, pnpm typecheck, documented node scripts/edition-authoring/cli.mjs lock, pnpm source:check, release metadata consistency checks and git diff --check. Typecheck ran with the supplied shim on Node v24.19.0 and pnpm 10.12.4; CI uses declared Node 22.20.0. No full local suite, new tests, build or browser journey was run for this metadata-only lease.

The merge-specific contract generator write/check also passed: zero documents written, zero prose errors or warnings, and generated documents current. Restored both generated views from origin/main whole and regenerated/rechecked the source lock last again; the product checkout remained clean and identical to the pushed SHA. Actual command outputs are retained.

Metadata check confirmed version agreement, matching changelog/RELEASE notes, unchanged rer pin, no post-v0.7.9 migration changes and unchanged contract/generated views. Inspected ALL candidate authors, committers and trailers including merge parents; both commits outside origin/main have the fleet identity and no co-author trailers. Inspected the exact diff for injected values and credential-shaped material. Full-history publication scan is reserved for the Mac lander and was not claimed in cloud.

Pushed exactly once with cloud-push.py on its first attempt. No main/default-branch push, tag, signing, publishing, deployment, workflow dispatch/re-run, force-push or self-submission occurred. Product HEAD is a real merge commit without skip-CI markers; checkout was clean after commit.

## CI observations

Previous saved candidate cc0a05ec50d235f457e03dc5f0be0efa6e413b31: Verify 43435974422 failed. Read failed alerts job 131921692838 once through gh run view --log-failed. tests/alerts/follow-up.mjs:55 expected completed but received uncertain for the resumed Slack follow-up. Aggregate shards (spool) and verify subsequently failed. The assertion and product delivery code are unchanged. No unsupported claim that the metadata caused or fixed that failure is made.

Candidate Verify: https://github.com/just-every/run-spool/actions/runs/43444080823
Initial observation: in_progress on exact SHA 558089ee4fc3b809c515db5f9d322523fad958aa.
At 2026-11-13T14:56:17Z all 31 jobs were completed: verify (alerts) job 131949772858 and verify (sentry-cli) job 131949773241 failed; shards (spool) job 131959295901 and aggregate verify job 131959507234 also failed. This is an exact-candidate red Verify, not a contract-view-generator exception. The last direct run-status read was in_progress at 14:51:14Z; the later completed job read proves the required verify job failed. The candidate is pushed but not READY. The tenth/final GitHub call successfully read the newly failed Sentry CLI job archive once. Its error is `TypeError: fetch failed`, caused by `read ECONNRESET` at tests/sentry-cli/durable.mjs:54 through tests/sentry-cli-compat.mjs:26. The full log is candidate-sentry-cli-failed.log. The current alerts log and aggregate logs cannot also be read within the ten-call budget; the current alerts assertion is not inferred from the prior run. All ten calls and observation boundaries are recorded in github-call-ledger.json. No further GitHub API calls or reruns were made.

## Follow-up custody

This is release metadata preparation, not RELEASED or DONE. The fleet lander still owns the full-history publication scan, exact-SHA required checks, generated-view handling and landing. A later authorized producer owns immutable tag, signing, bundle verification and non-draft GitHub Release publication/readback plus check-gh-release.sh exit 0. Path-seed stranger journeys and pending feature work do not hold this metadata preparation. Existing known product/qualification debts are retained in the changelog; they are not promoted by this round.

Evidence packet publication is separate from product READY/PUSHED custody. Only explicitly selected regular non-secret report and receipt files are published to evidence/sd-spool-release-0-7-10-pc1, with manifest hashes and product provenance. The evidence ref is not a landing signal.

## Blocker

Exact-SHA Verify 43444080823 has red alerts and Sentry CLI checks. Local touched checks passed, but do not waive this standing bar. The brief leases release metadata/version references only and explicitly excludes product and test edits. No test was weakened, skipped or deleted to obtain green CI, and no workflow was rerun or dispatched. Preserve this pushed metadata candidate for a targeted CI repair round with the appropriate scope; it is not authorized to land while its required Verify is red.

Final report prepared at the UTC time in report-final-at.txt. Product commit 558089ee4fc3b809c515db5f9d322523fad958aa is preserved on the named remote branch. No release, tag or acceptance claim was made. The disposable product clone/dependencies will be removed after successful evidence publication and fetch verification; the complete packet remains outside the clone.
