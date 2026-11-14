# gr-mt-spool-code-8

Repository: just-every/run-spool
Branch: cloud/gr-mt-spool-code-8
Head: 46d531edf89e69c8d95acd36daa6d131dd807c32

Result: both sinks fixed and product branch pushed; local checks and complete publication scan passed. BLOCKED by exact-SHA Verify failure.

## Plan

1. Configure fleet credentials, identity, hooks and the repository-pinned toolchain; read launcher and repository instructions.
2. Trace request-controlled PATH_INFO through basename/join to both static-file sinks; reproduce a real boundary escape through HTTP.
3. Canonicalize the configured root and requested file, require component-wise root containment before either filesystem sink, and close the file after reading.
4. Add one focused HTTP regression to the existing tunnel CI journey, regenerate the source lock last, and commit only these product changes.
5. Run the touched tunnel journey and typecheck, scan the exact committed tree with Base publication tools, and publish only the named product branch if that scan is complete and passing.
6. Discover and poll exact-SHA Verify within the GitHub budget, save actual receipts and result.json, and publish the selected non-secret packet only to the evidence ref.

## Findings and change

Both alerts (19 and 20, py/path-injection) name the same request-controlled static path. Taking the basename removes directory components but still allows a symlink under the served root to name a file outside it. The HTTP probe reproduced disclosure of a synthetic sibling-directory file through a direct request and raw/encoded traversal variants.

`tests/tunnel/server.py` now resolves the configured root once and resolves each requested basename before use. `os.path.commonpath([root, path]) == root` must hold before `os.path.isfile` or `open` can run. Component-wise containment also rejects sibling names sharing the root's prefix. Reads use a context manager.

`tests/tunnel/static-files.py` exercises the actual listening server. It checks outside-root symlinks, traversal variants, ordinary files and MIME types, nested basename requests, inside-root symlinks, directories, missing files and the special monitoring/memory routes. `tests/tunnel-flow.mjs` invokes this proof in its existing push-CI tunnel shard. `sources.lock.json` was regenerated and checked. No contract wording, status, evidence cells or generated views changed.

## Results

The new regression failed against the original server with three outside-file disclosures and passed after the fix (one test, zero failures). `pnpm test:tunnel` passed the full existing Node/Python/real Next.js journey with the added security regression. It proved delivery, origin and project fences, forwarded fields, rate-limit replies, malformed and wrong-method refusals, redirect refusal, aborted-request survival and bounded decompression memory. The Next.js journey logs its expected TRACE and aborted-upload errors while the subsequent survival assertions pass.

`pnpm run build:app`, `pnpm typecheck`, `pnpm source:check`, Python parsing, Node syntax checking and `git diff --check` passed. Validation used Node 22.20.0, pnpm 10.12.4 and headless system Chromium with --no-sandbox. Browsers and child server processes were closed by their owning journeys. No UI changed, so there is no changed-screen browser proof.

Before/after: addressed alerts 0 -> 2; vulnerable static-file sinks 2 -> 0; reproduced security assertion failures 3 -> 0; focused HTTP regression tests 0 -> 1; touched journey registrations 1 -> 2. These test counts describe the touched flow, not the whole repository. Contract counts are recorded in checks.json and unchanged; SDK-021 stays partial. No full-clause DONE claim is made. CodeQL alert closure itself has not been rerun or dismissed through the repository provider.

## Defaults and limits

Preserve the fixture server's existing basename routing, including nested URLs selecting a root file, and permit symlinks whose resolved target remains inside the configured root. The root is controlled by the journey, and requesters do not have concurrent write access to it; concurrent filesystem replacement by a local writer is outside this fixture's request-input threat model. No other product surface changed.

Only this repository was cloned for product work. Base was read through gh api into an external read-only snapshot to obtain its publication scanner, and Gitleaks 8.30.1 was verified against Base's pinned Linux archive SHA-256. The first isolated scan could not hydrate the local mirror's missing historical blobs; the mirror was then configured to hydrate from the declared repository. Publication and CI custody are recorded below after those gates finish.

## Publication

The complete final scan passed with zero active findings on exact commit `46d531edf89e69c8d95acd36daa6d131dd807c32` and tree `177e16d2f7522e9806dc876e32c7ad5c7bf0d003`. It inspected 905 commits, 895 trees, 7,855 blobs, 905 commit messages and 20 annotated tag messages. It used Gitleaks 8.30.1 and the pinned rer 0.2.113 scanner (implementation digest in publication-scan.json), checked the injected environment values in memory, and took 371.86 seconds.

The earlier staging attempts are recorded separately in publication-attempts.json. After the default five-minute timeout, the supported longer timeout allowed the complete scan to finish. The published rer scanner entry point and history scanner matched the read-only Base snapshot byte for byte, and its package provided correct version metadata without requiring a Base clone.

All candidate author and committer identities were checked across origin/main..HEAD, including side parents, and the sole candidate message has no trailers. The cloud push guard reported PUSH_OK on its first attempt, creating only cloud/gr-mt-spool-code-8. There was no product push rejection or force push. No PR was created; the repository instructions impose no PR landing requirement. Exact-SHA Verify is being observed through one REST watcher at 300-second intervals within the ten-call GitHub budget.

## Terminal CI and custody

Verify run **43566469126** completed with **failure** on exact head `46d531edf89e69c8d95acd36daa6d131dd807c32`:
https://github.com/just-every/run-spool/actions/runs/43566469126

The single watcher discovered the run and made four follow-up calls, each at least 300 seconds apart. Five earlier API calls obtained the read-only Base tree/archive, the Gitleaks release/asset, and the publication scanner's batched repository-reference lookup. The ten-call budget is now exhausted. Failed-job discovery and `gh run view <run> --job <job> --log-failed` were **NOT RUN**, so no failing assertion, job ID, transport error or cause is invented. No CI rerun or dispatch was requested. The available evidence does not establish the contract-generator-only exception, and no READY claim is made.

The blocker is the failed exact-SHA Verify gate, with failure triage left for the fleet. Suggested follow-up: discover the completed run's failed jobs, read each relevant failed job's archive once using the prescribed gh run view command, and classify the failure before changing code or claiming any exception. All local checks of the touched behavior passed, so the failure is not attributed to this fix or to pre-existing code without log evidence.

The maintenance result is `cannot` because this gate remains unresolved; the security fix itself and its regression are committed and remotely preserved. Product custody is BLOCKED, not READY. Evidence publication is report transport only and never changes that custody. No default branch, PR, tag, release or deployment was changed.

The original product clone is retained at `$HOME/rer-consolidation/work/maint/gr-mt-spool-code-8/repo` for follow-up. A complete-history bundle is also retained and verified at `$HOME/rer-consolidation/work/push-rescue/gr-mt-spool-code-8-46d531edf89e.bundle`, SHA-256 `61f1eaff44c76f732ab1f92e6ce351e84874dd4f57a39fdee12eeacd5115208d`. This is recovery data, not READY proof. No product push was rejected; no push-retry HTTP status applies. `result.json`, actual check output, the complete redacted publication report, both alert assessments and all custody receipts are in this packet.

Before/after contract counts remain 22 done, 50 partial and 26 missing. There are no clause status changes or new acceptance claims. SDK-021 remains partial with its existing gaps. CodeQL provider-side alert closure remains unverified; no alert was dismissed.
