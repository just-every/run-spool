# gr-mt-spool-dep-11 results

Author: Run Edit Run fleet, 2026-11-17.

Repository: just-every/run-spool.
Product branch: cloud/gr-mt-spool-dep-11.
Product SHA: 1093a64bdf6c3e80a94894cc3c1592481588aa91.
Baseline main: 6263ba70f1d0fce4ea1df7e6bf7b4f0d827489e1.
Disposition: READY for the fleet's guarded landing. No PR is required or created. No blocker remains. Main was never pushed or advanced.

## Change and scope

The direct rustls pin in src/modules/egress-service/tls/Cargo.toml and Cargo.lock changes from 0.23.45 to the minimum patched 0.23.46. Cargo 1.90.0 regenerated the lockfile; rustls is the only changed crate among 39. All other Rust crate versions, package.json and pnpm-lock.yaml remain unchanged.

The upgrade addresses the specified patched-version threshold for GHSA-vp88-798v-h67f, GHSA-w44r-93j7-qv28, GHSA-c8m5-c952-6cm4 and GHSA-h2v8-394m-p7vv. GitHub Dependabot closure was not queried or claimed, and default-branch alerts are not a claim about this unlanded branch.

Both checked-in TLS WASM artifacts were rebuilt with Rust 1.90.0, wasm-bindgen 0.2.114 and LLVM 21.1.8, using two Cargo build jobs. Independent target-directory builds reproduced production WASM and glue, and test WASM, byte for byte. engine.js stayed identical. trust-bundle.json binds both new binaries to the same pinned webpki-roots release, checksum and anchors. The TLS README records rustls 0.23.46 and the new production size while retaining historic OD08 measurements.

The CI-required offline Base copy check initially reported exactly six intentional TLS changes as undeclared drift. Each was declared with the documented adapt-base command, retaining its original Base digest, mode and revision and acknowledging its current local bytes. DIVERGENCE.md records the security update and future-refresh reconciliation. Final offline Base verification has no drift or unrecorded copies. sources.lock.json was regenerated last and checked after the provenance change.

Nine product files changed: DIVERGENCE.md, base-copies.json, sources.lock.json, and the TLS Cargo.toml, Cargo.lock, README.md, egress.wasm, test.wasm and trust-bundle.json. No UI, application flow, test, contract text/status, generated acceptance view, edition identity or workflow changed. The full plan is in PLAN.md and the nonbinary product diff is in product.diff.

## Before and after

| Measure | Before | After |
| --- | --- | --- |
| rustls | 0.23.45 | 0.23.46 |
| Vulnerable rustls resolutions in the specified lockfile | 1 | 0 |
| Locked Rust crates | 39 | 39 |
| Production WASM bytes | 605,169 | 618,505 |
| Test WASM bytes | 610,195 | 623,497 |

Four specified advisories are addressed by the patched dependency. Tests added, removed or weakened: 0. Clause status changes: none; this dependency-maintenance round makes no clause completion claim. No owner ruling or unprovided account input was needed. The default was the minimum patched release, with no unrelated dependency upgrades.

## Validation

All touched local checks passed. Node 22.20.0 and pnpm 10.12.4 were used for candidate application build, typecheck and the affected journey. The initial frozen installation and setup used the supplied toolchain script's newer Node 24.19.0; later candidate checks used the exact Node 22.20.0 pin. Branch CI also uses Node 22.20.0 and pnpm 10.12.4 for its frozen install and full wall.

Commands and actual results are in local-receipt.json. They include:

- pnpm install --frozen-lockfile: passed, with no Node lockfile change.
- cloud_run npx -y @runeditrun/rer setup --owner-email fleet@runeditrun.com --non-interactive: passed, 103 migrations applied and local owner claimed; its temporary app stopped.
- cargo +1.90.0 update --manifest-path src/modules/egress-service/tls/Cargo.toml -p rustls --precise 0.23.46: passed, only rustls changed.
- node src/modules/egress-service/tls/build.mjs, --test, --check, and --test --check: all passed. Production refuses a root-injection export and preserves the allowed generated imports; both binary checks reproduced exactly.
- pnpm typecheck and cloud_run npx -y @runeditrun/rer build: passed.
- cloud_run node tests/alerts-egress.mjs: passed real loopback TLS signed-webhook delivery with original-name SNI, private-address refusal without connecting, redirect refusal and no replay. Its existing Slack edge-double journey also passed concurrent delivery, retry/rate-limit, credential, archive and erasure checks. This is synthetic local evidence, with no real hosted provider qualification or deployment claimed.
- node scripts/edition-authoring/cli.mjs verify-base --offline: passed after the documented adaptation acknowledgements.
- node scripts/edition-authoring/cli.mjs lock and pnpm source:check: passed after the final metadata change.
- node src/base/contract-docs.mjs check: passed, zero errors/warnings and current views.
- pnpm run check -- --profile first-party and git diff --check: passed.

## Publication and CI

The final Base packaged publication scan is COMPLETE/PASS with zero findings on this exact commit and tree b448659de030723501dd5f30a372b45efcc290b3. Full history and the injected environment were checked; 987 commits were inspected in 460.955 seconds. publication-scan.json is the full value-free receipt. product-custody.json binds its SHA-256 to the published candidate.

The first superseded scan was deliberately stopped to include the Base adaptation correction before any public push. An initial complete scan then reported 175 working-tree-only findings in ignored generated setup/build files, including local dev state and Rust intermediates. None was in committed source. Those temporary outputs were removed, and the clean-checkout rerun passed. Both earlier receipts are retained with explicit superseded/local-artifact names; neither is presented as passing proof. No generated private state, key material, environment dump or credential value is selected for evidence.

Every candidate commit author, committer and complete message was inspected before product push. The sole product commit uses Run Edit Run fleet <fleet@runeditrun.com> for both identities and has no trailers. Fleet hooks remained active. The final amendment was unpublished; no published history was rewritten.

The cloud push guard reported PUSH_OK on attempt 1 and Git confirmed the new branch. The outer execution tool reported exit 1, so a separate Git ls-remote independently verified the exact remote SHA. No product retry or rewrite occurred. A prior read-only ref probe authentication error recovered after launcher refresh, shared Git setup reinstallation and the specified 15-second backoff. Credentials were refreshed again during CI waiting; transport-recovery.json records non-secret custody facts.

Exact-SHA Verify run 44140203481 completed/success: https://github.com/just-every/run-spool/actions/runs/44140203481. Discovery plus status polling used six CI API calls, with one watcher and at least 300 seconds between reads. ci-discovery.json, ci-poll-2.json through ci-poll-6.json, ci-watch.json and ci-final.json preserve the actual responses. No failed job or log download was needed.

## Return and preservation

The maintenance result is saved in both the packet's result.json and work/maint/gr-mt-spool-dep-11/result.json. The verified recovery bundle is outside the product clone at work/maint/gr-mt-spool-dep-11/recovery/candidate.bundle, SHA-256 965b72b5993a847a2ff2fcaa1f42b314b2765403e222aa5f54cdab826c947718. Recovery data is not a publication or acceptance signal.

The complete explicitly selected non-secret packet is published only to refs/heads/evidence/gr-mt-spool-dep-11 through the shared evidence entrypoint. Product custody and evidence custody remain separate. The fleet owns landing and any exact-main checks. All task-started servers and browsers have stopped; generated local state was removed. The product clone and node_modules are removed only after evidence publication is verified, as required by the builder cleanup rule; the result, packet and verified recovery bundle remain available.
