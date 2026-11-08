# sd-spool-c-f119-rb2 replay report

Repository: just-every/run-spool
Product branch: cloud/sd-spool-c-f119-rb2
Original builder head: e38bd545cee9eb60b6f12abccf72ccdf87532ea3 (verified with git rev-parse HEAD)
Fresh main used for replay: d9ce1390bbf7b98783b9ff7bdad5a6fae973078b

## Plan

1. Initialize fleet identity, refresh the launcher, install the decrypted-bundle Git helper, push guard and repository-preserving commit hook. Use a disposable full-history blob-filtered clone; verify the original candidate head exactly.
2. Replay the original candidate lineage onto fresh main with a merge-preserving rebase. Retain the two original pre-merge commits, replace the original stale merge with a new merge of current main, and explicitly replay the original merge's 15 finalization-test lines. Preserve main's source, newer tests, assertions, all other contract rows, judgments, ID map and API-002 status/gap. Resolve CONTRACT.md before generated output or lock conflicts.
3. Run the documented contract generator write and check, restore both generated views from origin/main, and regenerate/check sources.lock.json last. Independently check the locks in every retained candidate ancestor.
4. Run setup and build through cloud_run, typecheck, and the candidate's full sentry-cli compatibility journey from a disposable .mjs launcher with node --experimental-strip-types. Do not add new tests or change behavior.
5. Check every candidate commit's identity/trailers, then push only cloud/sd-spool-c-f119-rb2 through cloud-push.py without an empty commit, dispatch, rerun or force push. Read exact-SHA Verify through bounded REST polling, at most one call per run per 300 seconds and ten GitHub calls total.
6. Save actual non-secret reports/receipts outside the product checkout; publish explicitly selected files only on evidence/sd-spool-c-f119-rb2. Remove the disposable clone and node_modules after successful preservation/publication.

## Replay resolution

Current main already contains the original field-refusal implementation and populated-state journey. The net patch preserves main's newer FormData request helper and debugFlow ordering, and adds exactly the original candidate's 15 unfinalized-release lines to tests/sentry-cli/field-refusals.mjs. Only the API-002 evidence cell changes in CONTRACT.md. No clause status, acceptance requirement, Gap, hold or release judgment changes.

The two retained candidate ancestors are 3e7391b1fa53aafdc4cb2237e7527696eae7a101 and de9012e63204b3d66be735c670239f209fe51372. Each independently passes node scripts/edition-authoring/cli.mjs check in its own disposable detached worktree (see ancestral-lock-receipt.json). The stale original merge e38bd545cee9eb60b6f12abccf72ccdf87532ea3 is not retained in the final candidate's history.

## Counts before replay

Published: 9 done, 3 partial, 0 missing, 12 total.
Target and push further: 13 done, 49 partial, 31 missing, 93 total.
All: 22 done, 52 partial, 31 missing, 105 total.
API-002: partial. All statuses must remain identical after replay.

## Execution notes

An initial setup attempt overlapped the initial historical checkout and failed its build with a missing SourceMapSetup.tsx. Setup is repeated against the fully resolved tree before probes; no product change was made for that transient failure. Private setup output, owner-entry links, credentials and local installation state are excluded from this packet.

Final validation, provenance and CI receipts will be appended below after execution.

## Local results and product custody

- Full-history clone confirmed non-shallow; the original candidate head was exactly e38bd545cee9eb60b6f12abccf72ccdf87532ea3.
- Setup retry passed (exit 0), explicit rer build passed (exit 0), and pnpm typecheck passed (exit 0). The mandated cloud toolchain selected Node 24.19.0 and pnpm 10.12.4; CI declares Node 22.20.0. No product workaround was introduced.
- The full candidate sentry-cli compatibility journey passed (exit 0) from the disposable file launcher under node --experimental-strip-types. Every original and newer main assertion remained active. Full selected observations are in probe-observations.txt and probe-receipt.json.
- Contract generator write and generated-view check passed (both exit 0). After restoring main's view files, check reports only ACCEPTANCE.md generated content differs (exit 1), as required and anticipated by the assignment. docs/CLAIMS.md is unchanged. The final source lock was regenerated after view restoration and its check passed, including a check of the committed final tree. Both retained pre-merge commits independently pass their own lock checks.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock exit=0; views=node src/base/contract-docs.mjs write && node src/base/contract-docs.mjs check exit=0.

PROBE API-002 assigned field refusals: authenticated POST organization release, POST project release, PUT existing release, PUT unfinalized release and POST deployment, with unsupported string/null/false/overlong-name fields -> HTTP 400, bounded endpoint/field diagnostics, one safe D-1 refusal fact, and unchanged populated state. Wrong-scope, read-only and revoked grants are refused before field validation. Repository refs and unknown endpoints -> named HTTP 501. Refused finalization preserves dateReleased=null; supported finalization and retry -> HTTP 200, retaining the first successful timestamp 2026-01-02T00:00:00.000Z.

Product head: 905bedda75a74441b779fb7685672c3a7efee2ae.
Product branch: cloud/sd-spool-c-f119-rb2.
Parents: de9012e63204b3d66be735c670239f209fe51372 and d9ce1390bbf7b98783b9ff7bdad5a6fae973078b.
The original stale e38bd545cee9eb60b6f12abccf72ccdf87532ea3 merge is not an ancestor of the result. This fresh merge replaces it.

The product branch was pushed once, without [skip ci] on its final commit, through cloud-push.py. Attempt 1 succeeded. git ls-remote independently confirms the remote product SHA and that main remains d9ce1390bbf7b98783b9ff7bdad5a6fae973078b. No default branch was written, no force push or published-history rewrite occurred, and no PR was required or created.

Identity and trailer inspection covers all three origin/main..HEAD commits, including side parents: all authors and committers are Run Edit Run fleet <fleet@runeditrun.com>, with no trailers. All generated-view blobs equal main. The product checkout is clean. The net patch is limited to CONTRACT.md's API-002 evidence cell, the candidate's 15 test lines, and two source-lock file hashes.

Counts after replay equal before: Published 9 done / 3 partial / 0 missing / 12 total; Target and push further 13 done / 49 partial / 31 missing / 93 total; All 22 done / 52 partial / 31 missing / 105 total. API-002 remains partial. No clause judgment change, hold release, new behavior, new test beyond the candidate, provider acceptance or landing is claimed.

Initial exact-SHA REST discovery reports Verify 42475233161 and Release SDK 42475233143 both completed/failure on 905bedda75a74441b779fb7685672c3a7efee2ae. The failure cause is pending the permitted diagnostic read; no READY claim is made from this status.

The first-party package check also passed (cloud_run timeout 240 pnpm run check -- --profile first-party, exit 0).

## Final exact-SHA CI disposition

Verify run 42475233161: completed/failure on 905bedda75a74441b779fb7685672c3a7efee2ae. Plan succeeded. Build job 128715012060 passes the first-party package check and source check ("ok": true); it then fails only node src/base/contract-docs.mjs check with "ACCEPTANCE.md: generated content differs; run contract-docs write." Contract prose reports 0 errors and 0 warnings. This is exactly the generated-view-only exception in the brief. Jobs 128715113221 (shards/spool) and 128715138347 (verify) fail because that build did not pass; runtime and suite jobs are consequently skipped. Each failed job's log was read once with gh run view --job --log-failed. No dispatch, rerun or empty commit was used. This report does not claim the remote suites ran or passed.

READY eligibility is based on the explicit generated-view-only exception, together with the fresh passing local candidate probes. The Mac lander must regenerate views and rerun Verify on its landing candidate; no landing or independent acceptance is claimed here.

Release SDK run 42475233143: completed/failure on the same exact SHA. Its build, second-checkout tarball reproducibility and smoke tests all passed in job 128714966266. Token-check job 128714966393 failed npm whoami with E401 / HTTP 401 Unauthorized. The configured repository npm credential needs owner maintenance; no alternate credential was sought and no SDK publication was attempted (publish skipped). This unrelated SDK credential failure is reported separately from the required Verify generated-view exception.

GitHub budget used: seven CLI invocations (one exact-SHA run discovery, one jobs request per completed run, one log-failed read per each of the four failed jobs). Status/job reads respect the five-minute per-run interval; completed-failure log diagnosis is performed once per failed job as instructed. No repeated polling or log retry was used. All raw workflow logs remain outside the public packet; diagnostics exclude runner environment listings and credentials.

Final product custody: pushed and independently verified at 905bedda75a74441b779fb7685672c3a7efee2ae. Required product blockers: none under the brief's generated-view exception. External maintenance item: repository npm token returns E401 in the SDK dry run. Evidence custody is separate from READY and is published only to evidence/sd-spool-c-f119-rb2. No product/default branch contains fleet report files.

Cleanup: node_modules, the disposable probe launcher and detached ancestor worktrees were removed after completed subreaper commands. The remaining disposable clone is removed after successful evidence publication. Full actual reports and receipts remain in this packet outside the clone.
