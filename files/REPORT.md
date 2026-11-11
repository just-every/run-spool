# Release labels and readable source-map upload results

Repository: just-every/run-spool
Branch: cloud/main-spool-releases-plain-1

## Plan
1. Set fleet identity, refresh the authorized launcher, install credential/push guards and commit hooks, clone only the declared repository, and read its instructions.
2. Reproduce release registration and source-map upload through the emitted local application and installed packed SDK bin before editing.
3. Label the actual release metadata field (first environment), using plain missing-value wording; preserve reported environment values. Make the CLI print a human summary, retain explicit --json for automation, and keep success/failure exit codes. Show the corresponding example in Releases step 3 and SDK docs.
4. Extend the existing packed SDK capacity journey without adding a registration. Run that touched journey and typecheck. Capture Releases history and step 3 at 1440 and 390; keep all proof outside the product branch.
5. Refresh main without rewriting published history, regenerate the source lock last, check it, review all candidate identities/trailers, push only the named cloud branch through the fleet guard, and inspect exact-SHA Verify with the stated API budget/cadence.
6. Publish actual non-secret report/receipt/screenshot files only through the evidence branch, report claims conservatively, and delete the clone after successful custody transfer.

## Scope and defaults
The value below a registered release is release_metadata.environment, returned as first_environment; registration without a deployment manifest uses the sentinel unknown. The missing label is therefore Environment, not Commit. Preserve source-map processing and API data. CONTRACT.md Status, Gap and Evidence and generated views remain untouched. No DONE claim.

## Changes and results
- Release history now labels first_environment in owner and read-only views: Environment: not reported for absent/sentinel metadata, and Environment: <value> for supplied metadata. No commit metadata is invented.
- The packed SDK bin prints Uploaded 1 source map. / Uploaded N source maps. on successful uploads. --json preserves the old {"uploaded":N} stdout contract. Failure reasons go to stderr and still exit 1; success still exits 0. Source-map processing is unchanged.
- Releases step 3 shows the same readable success example, and SDK/capture docs explain --json and exit codes.
- Extended tests/source-map-capacity.mjs#sourceMapCapacity through the installed package bin: 27-map summary, singular summary, JSON success, cap failures in default/JSON mode, named files and reason, and labeled missing environment. Existing mapping/storage/authority/Axe assertions remain. No registrations added (the existing touched journey remains 1 before / 1 after).
- Public-door reproduction used the emitted local Worker, native owner admission, public release/key APIs and an npm-installed packed SDK. Before: bare unknown and {"uploaded":1} exit 0. After: labeled environment, readable summary exit 0, JSON opt-in exit 0, missing-map failure exit 1 with its reason. before-receipt.json and after-receipt.json contain actual observations.
- Changed history and esbuild step 3 captured at 1440 and 390. No horizontal page overflow. Screenshots are evidence-only, outside the product tree. No source-map deploy key was displayed in those screens.
- pnpm typecheck, rer build, the touched packed SDK capacity journey, source-lock generation/check, git diff --check and contract-docs check passed. No full local Verify was run; exact-SHA branch Verify is the full wall.
- Main refresh/rebase found no upstream drift; source lock generated last. Product identity is fleet author/committer, no co-author trailers. First real commit pushed through cloud-push.py on the first attempt. No default branch was pushed; no PR is required by this repository's landing rules.

## Acceptance boundaries
CLAIM SRC-004 PARTIAL points=6 tests=tests/source-map-capacity.mjs#sourceMapCapacity
CLAIM REL-001 PARTIAL points=none tests=tests/source-map-capacity.mjs#sourceMapCapacity
DEFAULT REL-001: The unlabeled unknown is first environment, so show Environment: not reported; do not relabel it as a missing commit.
GAP REL-001: This copy correction does not qualify the full CI deployment, callback, rollback or SDK enrichment acceptance points.
GAP SRC-004: Capacity above the current implementation, native debug files, retention expiry and remote source fetching remain outside this round.
No CONTRACT.md Status, Gap or Evidence edits; no DONE claim. Generated views are unchanged.

## Publication boundary
The complete Base publication scanner is not shipped to this cloud. The candidate added-line credential-shape review passed; the fleet's independent publication scan remains required before landing. Evidence is report-only custody and does not signal acceptance or landing.

Clause status counts before and after (unchanged): {"done": 23, "missing": 29, "partial": 53}.
Product head: 258c6f228fdf78480536886063912c46a60dc43c

## SDK publication account issue
Release SDK run 43011028861 on the candidate completed with failure. Its build job 130490386915 passed, including the packed-bin smoke. Only token-check job 130490387224 failed: the secret is present, but npm whoami returned E401 / HTTP 401 Unauthorized. The branch push is a dry run; publish was skipped. The owner must repair NPM_TOKEN before publishing a future SDK release. The workflow and credentials were not changed. The actual failed-job archive was read once with the required gh run view command; sdk-receipt.json and the selected diagnostic lines record the result without publishing runner environment listings. This is distinct from the brief's product exact-SHA Verify gate, which remains pending.

## Terminal product result
Exact-SHA Verify 43011028998 completed/success on 258c6f228fdf78480536886063912c46a60dc43c. The candidate has no skip marker, the checkout is clean, and no product blocker remains. Product branch custody is pushed. No PR was created because the lane owns landing and the repository declares no PR-only rule.
Release SDK 43011028861: build passed; token-check failed with npm HTTP 401; owner NPM_TOKEN repair is required before a future SDK publication. This report makes no npm publication, landing or deployment claim.
GitHub budget used: 8 of 10 calls. Four Verify status polls were spaced at least 300 seconds apart after discovery. The completed SDK failed-job archive was read once.
All actual non-secret report/receipt files and the selected screenshots are published only through evidence/main-spool-releases-plain-1. The clone will be deleted after verified evidence transfer.
