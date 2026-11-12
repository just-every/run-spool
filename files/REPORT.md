# Spool plain release and delivery labels: publication-clean replay

Repository: just-every/run-spool
Branch: cloud/main-spool-plain-delivery-labels-1-r1-c2
Product head: d92a108f47dcb3b59d2b8b085e4720ed1077830c
Base: aff1c97b9c3b3dbba92472102265f0171fdb3bf3
Prior round: cloud/main-spool-plain-delivery-labels-1-r1-c1

## Plan and execution

The full initial plan is PLAN.md. Refreshed the fleet launcher, installed bundle-reading Git authentication, push guard and co-author cleanup hooks, and cloned full history. Started the named branch at current origin/main and applied the prior round with a squash. Only sources.lock.json conflicted; restored main's lock before regenerating it. The product diff is the prior round's net change plus the corrected deployment fixture and regenerated lock. It is exactly one real commit, with no merge and no skip-CI marker.

Preserved every line of main's tests/release-identity-flow.mjs in order and added the prior round's checks. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md remain byte-identical to origin/main. Fetched main before commit; it remained aff1c97b9c3b3dbba92472102265f0171fdb3bf3, which is this candidate's sole parent. No published history was rewritten.

## Product results

- SDK captures without release or dist show No release and No build supplied in filters, occurrence facts, observed deployments, release history, deployment history and map setup. Stored identities, grouping and release rules are unchanged.
- Delivery log renders the Slack condition as a boolean, eliminating the stray unlabelled zero. The existing attempt count retains its attempt/attempts label.
- Digest and resumption history uses the same mail-development outcome mapping as Delivery log: suppressed locally and No email sent. It no longer describes a locally suppressed attempt as accepted or delivered.
- The deployment fixture now uses https://github.com/just-every/run-spool. The API accepted it while retaining the absent-dist build identity and assertions. The entire staged diff was searched for github.com/ and bare owner/name strings: this is its only repository URL; relative module paths were not repository references. A GitHub API receipt confirms private=false and visibility=public.

## Checks and proof

All local touched checks passed: rer setup, rer build, TypeScript, the existing releaseIdentityFlow in an isolated Worker/auth/policy harness, the complete tests/alerts-ui.mjs journey and its existing helpers, first-party rer check, contract-document check, regenerated source lock check, and Git whitespace check. Actual command results and source hashes are in local-checks.json; full non-secret journey output is in release-identity-results.txt and alerts-ui-results.txt. The external runner adds no repository test registration.

The existing journeys assert the changed behavior at 1440. They capture the changed screens at 1440 and 390. browser-receipt.json manifests the 16 selected screenshots in screens/. Visual inspection confirmed clear release/build absence and local suppression wording, including mobile digest and resumption history. Screenshot and report files are excluded from the product branch; tracked screenshots overwritten by the journey were restored before the source lock was generated.

Local toolchain: Node 24.19.0, pnpm 10.12.4, system Chromium /usr/bin/chromium with --no-sandbox. The supplied toolchain script retained the VM's newer Node; exact-SHA CI uses the repository's Node 22.20.0 pin. Build emitted existing Vite configuration/dynamic-import warnings; local commands exited 0.

## Counts and claims

Before and after: Published 9 done / 3 partial / 0 missing (12); Target and push further 14 done / 51 partial / 28 missing (93); All 23 done / 54 partial / 28 missing (105). New test registrations: 0. No release-identity assertion removed, skipped or loosened. Product delta: 13 files, 83 insertions, 31 deletions. Product commits: 1; merge commits: 0. SDK-009 remains partial; ALERT-003 remains partial. No clause status, Gap or Evidence changed.

CLAIM SDK-009 PARTIAL points=3 tests=tests/release-identity-flow.mjs#releaseIdentityFlow
CLAIM ALERT-003 PARTIAL points=none tests=tests/alerts-ui.mjs#destination tests, delivery states, timezone digests and snoozing

GAP SDK-009: This round qualifies the requested wording slice, not all runtime release qualification or the complete clause.
GAP ALERT-003: Local suppression and fixture delivery UI do not establish real production provider sends or new bounce/complaint receipts.

## Custody and remaining gates

push-receipt.json records the successful guarded product push on attempt 1, after checking all candidate author/committer/trailer lines. Fleet identity is used for both author and committer; no trailers remain. No PR is required by this repository's branch landing rules, and none was created. Verify run 43231049521 is tracked only on the exact product SHA; ci-discovery.json and ci-receipt.json contain actual observations. The fleet Mac owns the full publication scan, guarded landing and resulting main checks. No deployment or landing was performed in the cloud.

Evidence is published separately to refs/heads/evidence/main-spool-plain-delivery-labels-1-r1-c2. It carries reports and receipts only, and signals no product acceptance or landing.

## Final exact-SHA result

Verify run [43231049521](https://github.com/just-every/run-spool/actions/runs/43231049521) completed successfully on d92a108f47dcb3b59d2b8b085e4720ed1077830c. The REST watcher used one discovery and three status reads at least 300 seconds apart. Including the public repository lookup, GitHub calls used: 5/10. No failed-job log read or workflow rerun was needed.

All requested product work is pushed and its exact-SHA Verify is green. No builder blocker remains. SDK-009 and ALERT-003 stay partial, with unchanged source judgments and generated counts. The fleet still owns publication scanning and landing. The clone is scheduled for removal after successful report-only publication; the complete packet remains outside it.
