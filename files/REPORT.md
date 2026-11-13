# Spool portable contract anchor

Tag: `sd-spool-contract-anchor-2`
Repository: `just-every/run-spool`
Branch: `cloud/sd-spool-contract-anchor-2`
Product head: `104ae1c1532c4c9125858a571dbab223993500fd`
Base main: `2073114e2a52b168413b9609a8f6c1d13038a8aa`
Product tree: `8f29bd3fcbc865aa5d3aba4c2ec3f85b847c1800`
PR: none created; the brief requests a branch candidate for fleet landing.

## Change and plan

The complete plan is in `PLAN.md`. This round records the generator's portable contract anchor and its source-lock entry. It changes only `docs/contract/ANCHOR.json` and `sources.lock.json`. It changes no application code, tests, contract text or clause judgments, homepage, generated acceptance or claims view. No main, tag, landing or deployment write was performed.

The brief refers to `scripts/contract-docs.mjs`; current Spool has no file there. Its AGENTS.md, Verify workflow and current source declare `src/base/contract-docs.mjs`. All proofs used that existing path, without adding a compatibility script.

The full-history clone was not shallow. Both `docs/contract/COVERAGE.json` and `docs/contract/ID-MAP.json` bind the original contract to `c829404210aacc3b8c4b4500b2ad1d5c4f9a2890`. The generator checks that `--old` matches both coverage and the contract's claim-source provenance. Its `createAnchor` produces schema 1 with the original Git commit, tree and source blobs, authenticating the complete proof through Git object hashes.

Read-only GitHub API inspection of Lamp showed the same generator format and binding: its anchor commit `0c54dbcd4352babe9163e1600b6b7c3e0c8d760e` equals its COVERAGE original. Lamp's anchor was introduced at `35fc2789f388524634125d814da4c8efc47d0f8a`. The actual reference summaries and commit message are in `lamp-reference.json` and `lamp-anchor-commit.json`. No other repository was cloned or written.

Ran the generator's own command:

```
node src/base/contract-docs.mjs anchor --old c829404210aacc3b8c4b4500b2ad1d5c4f9a2890
```

It recorded the original ref in `docs/contract/ANCHOR.json`, with five authenticated objects and 529,159 bytes. SHA-256: `d44fe3b5f8a7922d6c8951b776beee5b4b42e6e0b85fea600bffa516b6207645`. No hand-authored anchor content was substituted. The anchor was staged, then the source lock was regenerated last with `node scripts/edition-authoring/cli.mjs lock`. The lock diff adds only the new anchor's hash and executable bit.

## Before and after proof

Each scratch copy was exported with `git archive`, initialized independently with `git init`, and given exactly two new fleet-authored commits. Each had no remote, no original commit object and no source-clone history. Fleet commit hooks were installed before their first commit. The second commit is an empty scratch-only commit establishing the requested two-commit history. Neither scratch repository was pushed.

Before, `node src/base/contract-docs.mjs check` exited 1:

```
docs/contract/ANCHOR.json: contract_anchor_missing: original c829404210aacc3b8c4b4500b2ad1d5c4f9a2890 is unavailable; record it with anchor --old <ref> in a checkout with history.
```

After, the same command exited 0:

```
Contract prose: 0 errors, 0 warnings.
Contract documents are current.
```

The after scratch copy was exported from tree `8f29bd3fcbc865aa5d3aba4c2ec3f85b847c1800`; that tree was asserted equal to the pushed commit's tree. `scratch-before.json`, `scratch-after.json` and their complete logs retain the actual commands, outputs, exit codes, independent history counts and absence checks.

## Local checks and findings

| Check | Result |
| --- | --- |
| Full clone contract check before anchor | Pass |
| Full clone contract check after anchor | Pass; 0 prose errors/warnings |
| Source-lock regeneration and check | Pass |
| `pnpm typecheck` | Pass |
| Full clone `pnpm exec rer check --profile first-party` | Pass |
| Two-commit scratch contract check without anchor | Expected failure: `contract_anchor_missing` |
| Two-commit scratch contract check with anchor | Pass |
| Scratch first-party check | Pass |
| Scratch source check | Pass |
| Scratch `verify-base --offline` | Pass |
| Scratch integration check | Fails because unbuilt scratch tree has no `dist` |

The cheap scratch checks follow the commands declared by `rer-project.json`'s verify operation. The rer executable came from the product checkout's installed dependency directory through PATH; no Git history, remote or original commit was supplied to the scratch repository. The contract checker itself needs no dependency installation. The later integration check failed with `ENOENT` at `scratch-after/dist`; the exact command and output are in `scratch-integration-check.log`. The scratch source tree was intentionally not built, so this is a reported verification prerequisite, not a product regression or a fix in this round. No full local verify, build, browser suite or setup was run for this documentation-only change.

Toolchain: the prescribed cloud script selected pnpm 10.12.4 and retained the VM's Node 24.19.0, newer than the repository's declared Node 22.20.0. pnpm reported the expected engine warning. Dependency installation used `pnpm install --frozen-lockfile`, exited 0 and preserved all tracked dependency files. Fleet hooks were reinstalled after dependency setup.

## Counts and clause judgments

| Measure | Before | After |
| --- | ---: | ---: |
| Recorded anchor files | 0 | 1 |
| Scratch contract-docs exit code | 1 | 0 |
| Done clauses | 23 | 23 |
| Partial clauses | 54 | 54 |
| Missing clauses | 28 | 28 |
| Total clauses | 105 | 105 |

Tests added, removed or edited: 0. CONTRACT.md bytes are unchanged. Clause status changes: none. CLAIM: none. No new acceptance claim is made.

## Publication and custody

Fetched origin/main before the candidate commit; main stayed at the base above. The unpublished candidate was checked with `git rebase origin/main`, which reported it already up to date. All candidate commits, including any side parents, were inspected using the required `git log origin/main..HEAD` identity/trailer format; there is exactly one candidate commit, fleet author and committer, with no co-author trailers. Hooks stayed enabled. The candidate has no CI-skip marker.

The cloud push guard published the branch successfully on attempt 1. `product-push.log` retains the actual sanitized transport receipt. All non-secret reports and receipts remain outside the product tree. The separate report-only evidence ref is not a product acceptance or landing signal.

The full Base publication scan remains the Mac lander's gate, as stated by the cloud adaptation; it is not claimed complete here. No main history or previously published history was rewritten. Successful disposable checkouts are removed only after CI and evidence publication. If the run has an unresolved blocker, finished product work and its provenance remain preserved.

Exact-SHA Verify results, API call count, evidence return and terminal custody are recorded in RECEIPT.json and appended below when known.

## Final exact-SHA result

Verify run `43439471009`: **completed / success** on `104ae1c1532c4c9125858a571dbab223993500fd`.

URL: https://github.com/just-every/run-spool/actions/runs/43439471009

The final observation was recorded at 2026-11-13T14:25:40 UTC. Eight of the ten allowed GitHub calls were used: three read-only Lamp reference calls, the initial exact-SHA discovery, its delayed rediscovery and three run observations. A single watcher enforced at least 300 seconds between discovery/observations for this run. No workflow rerun or dispatch was requested and no failure logs were needed. No generated-view exception is used; Verify actually succeeded.

Product custody: READY on the pushed branch and full SHA above. Blockers: none. The scratch integration finding remains a missing-build prerequisite, explicitly outside this anchor-only round. The full publication scan and landing remain independent fleet gates. Evidence is published only to `refs/heads/evidence/sd-spool-contract-anchor-2`, using the manifest-bound report-only transport. Successful product and scratch checkouts are removed after that transfer; the actual packet remains under the task work directory.

POST lanes/sd/INBOX.md: sd-spool-contract-anchor-2 recorded docs/contract/ANCHOR.json for original c829404210aacc3b8c4b4500b2ad1d5c4f9a2890 and its source lock only; no clause/status changes; counts unchanged at 23 done, 54 partial, 28 missing (105); two-commit contract check fails before and passes after; typecheck and exact-SHA Verify 43439471009 passed at 104ae1c1532c4c9125858a571dbab223993500fd. Scratch integration: missing dist before build, reported without changes. Ready for fleet gates; no landing performed.

READY branch=cloud/sd-spool-contract-anchor-2 head=104ae1c1532c4c9125858a571dbab223993500fd
