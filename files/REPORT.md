# Settings sections and key identity repair

Repository: just-every/run-spool
Tag: main-spool-settings-split-1-c2
Branch: cloud/main-spool-settings-split-1-c2
Product head: 33c29d204f27d85ac3320b49c206eef99177efb0
Base: 7b8cc6213c14b0e2af650e2d6289dd0ac59871aa
PR: none; the fleet owns branch landing.

## Plan and implementation

The complete original plan is in [PLAN.md](PLAN.md). Fleet setup, full-history clone, repository/source review, baseline execution, controlled public-door diagnosis, squash, scoped fix, typecheck, contract/source-lock checks and the one candidate commit are complete. Candidate journeys, exact-SHA CI and evidence custody below record their actual current results.

The branch contains exactly one commit after main and no merge commit. It carries the net c1 change: seven addressable Settings sections, preserved forms, legacy-fragment selection and existing journey destinations. The only differences from c1 are tests/triage-journey.mjs and the regenerated sources.lock.json. There is no grouping, form, key-ordering or agent-handoff product change. No proof, screenshots or fleet files enter the product branch.

The journey reads the created deploy key's hash from its POST response and selects `.key-row[data-key-hash="${createdHash}"]`. It retains the existing revoke and revoked-state checks, and confirms the ingest credential remains active before the later capture. No test registration, sleep, retry, timeout increase, skipped test or weakened assertion was added.

## Diagnosis and before/after counts

The unmodified 8ef55561973155476e8c9c8d98c1c7b2e80c8b70 full journey passed 1/1 times at 1440 plus its existing 390 smoke (22 check groups, 100 captures); the natural historical flake was not reproduced in that run. A separate report-only probe held only the browser key-list refresh: before, capture was accepted (201); the positional selector chose and revoked the ingest key instead of the new deploy key; after, the deploy key was still active and capture was rejected (401, invalid_ingest_key). This confirms the stale-row mechanism. Equal creation timestamps and sort-order assumptions are unnecessary. The initial invalid event fixture failed before key actions; that log is retained, and the corrected probe preserved its acceptance assertion. DIAGNOSIS.md and baseline-key-race-receipt.json give the boundary of this proof.

Settings sections: 1 -> 7. Original Settings component instances: 28 -> 28, with the same multiset. New test registrations: 0. Baseline full journeys: 1 pass, 0 failures. Candidate full journeys completed: 5; passes: 5; failures: 0. All five consecutive journeys passed on the exact product head.

## Validation

- Setup and candidate build completed through cloud_run. Typecheck passed.
- Contract regeneration and check passed: the final write reported zero changed documents, zero errors and zero warnings. The generated views were restored whole from origin/main, and the source lock was regenerated last and checked. The tracked tree stayed byte-identical to the published commit; see contract-regeneration-receipt.json.
- Settings proof passed for all seven sections at 1440 and 390: 14 screenshots, one selected section at each address, no document overflow, and four legacy Slack/reports-fragment checks. Screens and settings-browser-receipt.json are in this packet. Visual inspection found the named navigation and assigned forms rendered at both widths.
- Each candidate journey uses the existing unmodified command and covers the 1440 assertions plus the existing 390 flow. Separate receipts bind outcomes and manifests to the candidate SHA.
- Local Node was 24.19.0 and pnpm 10.12.4 under the supplied toolchain; CI uses the repository's Node 22.20.0 pin. Existing build warnings did not fail the build.

## Settings screenshots

| Section | Desktop | Phone |
| --- | --- | --- |
| Organization | [1440](screens/settings-organization-1440.jpg) | [390](screens/settings-organization-390.jpg) |
| Projects & keys | [1440](screens/settings-projects-1440.jpg) | [390](screens/settings-projects-390.jpg) |
| Issue processing | [1440](screens/settings-processing-1440.jpg) | [390](screens/settings-processing-390.jpg) |
| Alerts & integrations | [1440](screens/settings-alerts-1440.jpg) | [390](screens/settings-alerts-390.jpg) |
| Privacy & filtering | [1440](screens/settings-privacy-1440.jpg) | [390](screens/settings-privacy-390.jpg) |
| Data & archive | [1440](screens/settings-data-1440.jpg) | [390](screens/settings-data-390.jpg) |
| Audit | [1440](screens/settings-audit-1440.jpg) | [390](screens/settings-audit-390.jpg) |

## Contract and claim

CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to origin/main. No clause status, gap or evidence changed. Full-target counts remain 23 done, 53 partial, 29 missing, 105 total; Core remains 23/45/19 (87), Agent surface 0/8/10 (18). No default ruling was needed.

CLAIM UX-001 PARTIAL points=none tests=tests/triage-journey.mjs#journey
GAP UX-001: Complete target triage/repair and revoked/offline qualification remains outside this Settings cut; existing human screen-reader and VPAT register rows remain unqualified.

## CI and custody

Verify run [43150919066](https://github.com/just-every/run-spool/actions/runs/43150919066) on `33c29d204f27d85ac3320b49c206eef99177efb0`: status **in_progress**, conclusion **pending**. Owner UI: **success**; build: **success**. GitHub calls used: 10/10.

The initial run's sole non-successful product/runtime job was `verify (agent-handoff)` (job 130959927107), cancelled in `Run suites` after 25m15s; `shards (spool)` and `verify` then failed their dependency-success gates. No product test assertion failed in the job metadata. The workflow source confirms those aggregate steps require every dependent job to succeed. This matches the explicitly out-of-scope handoff timeout assigned to sd-spool-agent-handoff-hang-1. All other product/runtime jobs passed, including owner-ui and SDK. The Settings round does not change the handoff job or tests/sentry-http.mjs.

Rerun observation: One failed-jobs rerun accepted at 2026-11-12T04:33:52Z; latest exact-SHA status in_progress, conclusion None. Detailed actual metadata is retained in [ci-summary.json](ci-summary.json) and [ci-jobs.json](ci-jobs.json). The single failed-jobs rerun is still in progress on the exact candidate SHA. The 10-call GitHub budget is exhausted, so custody is PUSHED; successful exact-SHA Verify remains outstanding. Initial owner-ui/build/other product jobs passed, and the known agent-handoff timeout remains outside this cut.

Product push returned PUSH_OK on its first transport attempt, and an independent ls-remote verified the exact branch/head. The wrapper exit-code anomaly is documented in push-receipt.json; no second push was issued.

Product push and evidence publication are separate. Exact push and Verify receipts are retained in this packet. The cloud adaptation reserves Base's full publication scan and guarded landing for the Mac fleet. The diff hygiene check found no credential-shaped added values and does not substitute for that scan. No provider account, hosted release, main push, acceptance promotion or landing is claimed.
