# gr-mt-spool-dep-10: undici maintenance result

Author: Run Edit Run fleet. Date: 2026-11-15 UTC.

Outcome: **no-change**. The current remote default branch of just-every/run-spool already contains the requested undici upgrade. This is an already-fixed finding, not a false-positive claim about the historical alert. No product changes, new product commits, product push, PR, merge, deployment or READY/PUSHED claim are needed.

## Full plan and execution

1. Set the required fleet identity, refresh the designated fleet launcher, install the decrypted-bundle Git helper and guarded publication tools, and read launcher/repository instructions and the inline RULES.md.
2. Clone only just-every/run-spool, with full history and blob filtering, into the specified maintenance work directory; set clone-local identity, install the fleet commit hooks, and create cloud/gr-mt-spool-dep-10 from origin/main.
3. Read both manifests and lockfiles, the existing fix's history, source/contract instructions and Verify workflow. Independently investigate all dependency paths using a read-only security-fix investigator.
4. Before editing, determine whether this stale maintenance brief is already fulfilled. It is: the prior fix is an ancestor of current remote main. Therefore make no speculative dependency update and preserve the committed product tree.
5. Run reproducible read-only checks on the exact committed manifests/lockfiles, enumerate incoming undici edges and importer paths, verify the advertised default branch and SHA, and record the existing exact-SHA CI runs with one REST discovery call.
6. Write the required no-change result.json and complete non-secret report/receipts outside the product clone; explicitly select and publish these files only to evidence/gr-mt-spool-dep-10. No new product candidate requires landing.

## Terminal product provenance

- Local branch: cloud/gr-mt-spool-dep-10 (local only; no product branch push).
- HEAD and origin/main: `adc3de69b9ae0ff60e41897f8ff7662fd656d560`.
- A fresh `git ls-remote --symref origin HEAD refs/heads/main` advertises main as default and the same SHA.
- Existing fix: `f773e85edf527a1e790f763a6da9a91c71aa8f73`, Patch vulnerable transitive dependencies in both pnpm lockfiles, 2026-11-14.
- `git merge-base --is-ancestor f773e85edf527a1e790f763a6da9a91c71aa8f73 HEAD`: PASS.
- `git status --porcelain`: empty. `git rev-list --count origin/main..HEAD`: 0.
- New/changed product files: none. New tests/registrations: 0. Clause status changes: none. Existing full-target counts remain 23 done, 54 partial, 28 missing (105 total).

## Security and compatibility evidence

The supplied advisory range is >=7.0.0 and <7.30.1 for GHSA-4w7w-5xrc-9h26, GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm and GHSA-9fm3-97px-rjf6. Both package.json override tables and both lockfile override tables already select 7.30.1. Each lock has exactly one undici package and snapshot, both 7.30.1. Every incoming undici dependency edge resolves to that version; none resolves into the supplied vulnerable range.

Root paths, all starting at devDependencies:

- @sentry/cli -> undici.
- miniflare -> undici.
- wrangler -> miniflare -> undici.
- @cloudflare/vite-plugin -> miniflare -> undici.
- @cloudflare/vite-plugin -> wrangler -> miniflare -> undici.

Mail package path: miniflare -> undici (devDependencies).

The exposure is in the transitive tooling HTTP/WebSocket client paths. The reported failure classes involve cross-origin redirects, preservation of Agent TLS options, TLS renegotiation, and WebSocket PONG buffering. The narrow complete existing remediation is the shared pnpm override in each independently installable dependency graph. No application authentication, ingest, mail, owner, archive or network policy is changed by this task.

Undici's locked Node requirement is >=20.18.1; repository Node 22.20.0 satisfies it. Root pnpm is pinned to 10.12.4. The required cloud toolchain was sourced and selected pnpm 10.12.4; the provided setup keeps a newer installed Node, here 24.19.0. No dependency install or runtime execution used that newer Node.

## Before/after counts

| Measure | Before existing fix (historical parent) | Current main before this task | After this task |
| --- | ---: | ---: | ---: |
| Lockfiles with vulnerable undici | 2 | 0 | 0 |
| Vulnerable package entries across both lockfiles | 2 | 0 | 0 |
| Patched undici package entries across both lockfiles | 0 | 2 | 2 |
| New product commits in this task | n/a | 0 | 0 |

Historical parent versions are 7.29.1 in both lockfiles. Current versions are 7.30.1 in both. The eight reported alerts are mapped to the two patched graphs by the supplied brief; provider alert closure state was not queried or changed.

## Commands and results

- Fleet Git identity, launcher refresh, decrypted-bundle credential setup and clone-local hooks: PASS; no credential values retained.
- `git clone --filter=blob:none https://github.com/just-every/run-spool.git <maintenance-work>/repo`: PASS, full history.
- `git switch -c cloud/gr-mt-spool-dep-10 origin/main`: PASS.
- `git show f773e85edf527a1e790f763a6da9a91c71aa8f73 -- package.json src/modules/mail/package.json`: confirms both overrides changed from 7.29.1 to 7.30.1.
- `python3 dependency-check.py <clone> <packet>`: PASS. Uses Git's committed blobs, YAML parsing, manifest/lock agreement, unique patched package/snapshot checks, all incoming edges and importer-to-snapshot traversal; writes dependency-receipt.json with exact blob IDs and SHA-256 hashes.
- `git ls-remote --symref origin HEAD refs/heads/main`: PASS, current default SHA matches HEAD.
- `git merge-base --is-ancestor <existing-fix> HEAD`: PASS.
- `git log origin/main..HEAD --format="%an <%ae>%n%cn <%ce>%n%(trailers:only,unfold)"`: empty; no product candidate commits.
- `gh api 'repos/just-every/run-spool/actions/runs?head_sha=adc3de69b9ae0ff60e41897f8ff7662fd656d560&per_page=100'`: PASS, one GitHub API call; exact response subset saved in ci-receipt.json.

No committed source changed, so frozen install, lockfile regeneration, rer setup/build, typecheck, runtime exploit reproductions, browser journeys and module tests were not rerun. This is proof of already-patched committed resolution, not fresh runtime or exploit qualification. Legitimate behavior is preserved by leaving the product byte-for-byte unchanged. The missing src/modules/mail/tests directory means its advertised test:workerd script was not treated as runnable evidence. No new test, pin test or product verification script was committed.

## Existing exact-SHA CI (not new candidate custody)

- Verify run **43742749592**: completed/success on `adc3de69b9ae0ff60e41897f8ff7662fd656d560`, branch cloud/main-spool-stranger32-trips-1-c1. https://github.com/just-every/run-spool/actions/runs/43742749592
- Later main Verify run **43750723397**: completed/failure on the same SHA. https://github.com/just-every/run-spool/actions/runs/43750723397
- Main Run site **43750723300**: completed/success on the same SHA. https://github.com/just-every/run-spool/actions/runs/43750723300
- Run demo **43750723421**: completed/skipped. Push on main **43750722053**: completed/success.

The failed main Verify is reported honestly and not diagnosed or repaired by this no-change dependency task. It is pre-existing CI status, not a new candidate failure. No workflow was dispatched, retried or rerun, and no READY claim is made. There is no task-local product blocker: the requested resolution fix is already landed. Default: close this maintenance item as already fixed; let the owning lane handle existing main Verify separately.

## Publication and return

All reports, receipts and this one-off inspection source are outside the product tree. Selected packet files are REPORT.md, result.json, dependency-receipt.json, dependency-check.py and ci-receipt.json. They contain repository provenance and non-secret analysis only. The evidence protocol uses a report-only tree under refs/heads/evidence/gr-mt-spool-dep-10; its manifest records the unchanged product head and file hashes. Evidence publication neither publishes a product candidate nor signals READY, acceptance, or landing. No Base publication scan was run on a new product tree because no new product tree is being published.

Required maintenance result: work/maint/gr-mt-spool-dep-10/result.json, with status no-change and the full SHA above. A byte-identical copy is in the packet. Packet: work/gr-mt-spool-dep-10/packet/.

Signed: Run Edit Run fleet, 2026-11-15 UTC.
