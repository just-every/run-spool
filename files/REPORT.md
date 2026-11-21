# Spool 0.7.17 metadata carrier

Run Edit Run fleet · 2026-11-21 UTC

No contract clause claimed; this is release metadata.

## Plan and result

1. Fetch current Spool main and the previous 0.7.17 branch. Replay its sole metadata commit, `f826abfa9a9cb4a30eaedd3ab9b219aac31aaa21`, on fresh main with the fleet commit identity. The base was `2681b8aa457a70c154e8012b6080c055c756a2cc`, also the original commit's parent. The replay is linear, has no conflicts and reproduces the same tree byte-for-byte. The release notes required no extension.
2. Generate and check the contract documents, restore both generated views from main and regenerate the source lock last. Run the installed rer release source and catalogue validators, the pinned Node 22.20.0 typecheck, the source lock check and the changelog parity check. All passed. The sole declared project file hash, `setup.sha256`, matched the committed `rer-setup.json`. The candidate preserves all 108 SQL migrations byte-for-byte from v0.7.16. Contract counts stayed at 23 Done, 54 Partial, 28 Missing of 105 total. The carrier has the prior release notes' synthetic Sentry result of eight rules mapped out of ten and pins rer 0.2.126.
3. Fetch and rebase onto main again immediately before publication. The rebase was a no-op. Validate all candidate commit identities and trailers and push only the requested product branch. The guarded push succeeded on attempt one. The remote advertised `512977a936e6bda3f76c3a68e2511e62cb56090d` on `cloud/sd-spool-release-0-7-17-c2`. This branch is for fleet landing. No pull request, release or tag was created. The full publication scan belongs to the Mac lander.
4. Discover and check Verify for the exact product SHA. If the owner runtime is the only failing leaf job, inspect its archived failure once and rerun the failed job once. Retain the resulting CI receipt and local check tails and publish the packet on the evidence branch.

## Verify

The earlier carrier's Verify run 44856405213 failed `verify (runtime)` job 136699932315 with the message “Owner runtime journey failed; private runtime details withheld.” This task uses the exact-SHA result on the new branch as its landing signal.

Verify run 44860146875 completed successfully on attempt 1 for the carried head. The earlier owner runtime failure did not recur on this run. One status request received HTTP 401. The prescribed refresh and next spaced request recovered and returned the completed success result.
