# gr-mt-spool-code-3: SDK sourcemap sanitization

Author: Run Edit Run fleet. Date: 2026-11-17 UTC.

Result: **no-change**. The reported `js/bad-code-sanitization` finding at `packages/sdk/src/sourcemaps/inject.mjs` was already addressed on current main. This is a verified existing fix, not an uninvestigated dismissal. No product files, tests, contract text, generated views or source locks were changed. No product commit, product push or PR was created.

## Plan and outcome

1. Initialize fleet identity, launcher, bundle-reading Git authentication, cloud push guard and clone-local forwarding commit hooks. Clone only `just-every/run-spool`, with full history and blob filtering, into the maintenance output directory; create `cloud/gr-mt-spool-code-3` from `origin/main`. Completed.
2. Read the shipped builder rules and the repository's AGENTS.md, CLAUDE.md, CONTRACT.md, ACCEPTANCE.md, package pins and injection implementation. No TESTING.md exists. Trace the alert location through Git history and attempt the alert metadata read with bounded credential refresh and backoff. Completed; API permission outcome is in alert-api-receipt.json.
3. Verify the current injector through an ad hoc executable probe and run typecheck, using Node 22.20.0 and pnpm 10.12.4. Completed; all nine probe rows and typecheck passed.
4. Fetch current main, confirm the fix is in its ancestry, retain the unmodified clone and required result.json, and publish explicitly selected non-secret reports to the evidence ref. Completed locally; evidence transport prints its own ref and SHA in the terminal return.

## Product provenance

- Repository: `just-every/run-spool`.
- Local branch: `cloud/gr-mt-spool-code-3`.
- HEAD and freshly fetched `origin/main`: `337a4cacd736ad172f397f318bb766fa5402ed9a`.
- Tree: `192c25ffd5ec71b0a3c79b218332048d249ffa4e`.
- Existing fix: `0a883e4820be7f95c93bc76470ee5af0344c1d4b`, committed 2026-10-15, is an ancestor of current main.
- Product commits created: 0. Product diff: empty. Candidate range `origin/main..HEAD`: empty, including all side parents.
- Product branch was not pushed because there is no new product commit to land. PR: none. New CI run IDs: none; no Verify dispatched and no new candidate green claim.
- Publication scanner: not run. There is no product publication in this no-change result. Reports use only `refs/heads/evidence/gr-mt-spool-code-3`.

## Why no code change is needed

The original October 13 implementation interpolated `JSON.stringify(debugId)` into executable registration code. The October 15 fix explicitly removed that construction, documented the constrained alphabet and quoted the debug ID directly. `inject-history.txt` contains the actual fix diff and subsequent file history. The later October 23 change adds indexed-map normalization and retains that correction.

The interpolated debug ID is generated internally from `createHash('sha256').update(code).update('\0').update(JSON.stringify(map)).digest('hex')`, with fixed hexadecimal UUID version/variant digits and hyphens. No raw source-map string becomes executable registration text. Externally declared IDs are validated; they do not enter the fresh generated registration path. The remaining JSON.stringify(map) feeds hash input, not executable output.

The ad hoc probe compares current flat-map output with the original October 13 implementation and confirms byte-identical code/map/debug ID results for five script forms. This proves the existing fix preserved behavior while removing the construction CodeQL reported. Runtime execution confirms correct registration and application completion; mapping lookup confirms retained coordinates. Indexed normalization and retries work. JavaScript-shaped supplied IDs are refused, and hostile map metadata does not execute.

This does not establish the current remote CodeQL alert state. The injected GitHub integration cannot read code-scanning alert metadata (HTTP 403). No dismissal or other GitHub mutation was attempted.

## Checks and actual receipts

- `pnpm install --frozen-lockfile`: PASS, pnpm 10.12.4. Only declared dependencies were installed. The installer reported @sentry/cli's build script was ignored; the verification performed here does not use that binary.
- `node <packet>/inject-verification.mjs <clone>` under Node 22.20.0: PASS, 9 check rows. `inject-verification.mjs` and `inject-verification.json` contain the actual probe and output. These are report artifacts, not committed product tests.
- `pnpm typecheck` under Node 22.20.0: PASS, exit 0. Actual output: typecheck.log; exits and versions: check-receipt.json.
- `git fetch origin main`, ancestry check, clean-status check and `git log origin/main..HEAD --format="%an <%ae>%n%cn <%ce>%n%(trailers:only,unfold)"`: PASS. Exact range is empty. Full provenance: repository-receipt.json.
- Alert metadata read: five total calls, with 15/45/90/150-second backoff, launcher refresh and bundle re-read between attempts. Actual outcomes: alert-api-receipt.json. No alternate credential was sought. No CI polling calls were needed.

No UI changed, so browser screenshots are inapplicable. No full app build, setup, full local suite, source regeneration or source relock was needed for this verified no-change result. No test registrations were added, deleted, skipped or weakened.

## Before and after

- One assigned alert location examined; one existing fix verified; zero new fixes required.
- Live CodeQL alert open/closed counts: unknown before and after because alert access is denied. This report does not claim a remote alert was closed.
- Contract counts unchanged: 23 done, 54 partial, 28 missing, 105 total. Core: 23 done, 45 partial, 19 missing. Agent surface: 0 done, 9 partial, 9 missing.
- Clause status changes: none. No CLAIM status promotion is requested.
- Product test registration count delta: 0; the nine ad hoc checks do not add registrations.

## Remaining work and defaults

No product blocker remains: the brief expressly permits no-change when current main already contains the fix. Default: retain this no-change result and let a maintainer with code-scanning access verify or dismiss any stale alert 9. Access denial limits remote alert-state confirmation; it does not invalidate the code/history/runtime proof. No READY or PUSHED custody is claimed for an unchanged, unpushed product branch.

The required output is retained at `/home/agent/rer-consolidation/work/maint/gr-mt-spool-code-3/result.json`, and a byte-identical copy is included as result.json in this packet. The unmodified maintenance clone remains at `/home/agent/rer-consolidation/work/maint/gr-mt-spool-code-3/repo` for the worker's return.
