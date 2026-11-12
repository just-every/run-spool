# Spool readable references

Repository: just-every/run-spool
Branch: cloud/main-spool-readable-ids-1
Candidate: 537706bc5836fbae9982cac5b587031e2858f18b
Baseline main: 26d13d4f574298851f25778818c1af0b9b2a2386
PR: none; fleet branch landing applies.

## Results

Reproduced all four reported problem screens through the actual emitted Worker, native owner sign-in, real capture and browser navigation before editing product code. Six visible defects were observed: event picker identifiers, preview identifiers, JSON correction history, report event identifiers, deployment actor aliases and resumption identifiers. The baseline probe at 1440 recorded six findings. The same focused probe on the candidate records zero at 1440 and zero at 390; the baseline was not separately rerun at 390. Actual before/after observations are in REPRODUCTION.json and AFTER-1440.json / AFTER-390.json. Candidate screenshots cover all six surfaces at both widths.

- Grouping: shared issue/event/actor presentation resolves current issue short IDs and titles, received time in the configured project timezone with seconds, release and a bounded message. Links keep exact event/occurrence identities. New split issues receive their short ID when applied; the preview names their intended title. History shows each move, counts, recorded person and timestamps. Copy details is the only raw-record display action and reports clipboard success/failure. Split, merge, original records and guarded undo remain intact. Picker rows keep checkbox, reference and record link together on phones.
- Reports: received-time links open the exact occurrence and display its actual issue short ID and title. Both live query tables and saved tables use the same projection. Additional reference metadata is explicitly requested by the UI. Default API and CSV/JSON export schemas are unchanged.
- Deployments: the UI resolves permanent aliases to Owner, the member display name, a named service deploy key or Deploy key for ordinary keys, and the deployment-deadline service. The same resolution is used for the run and outcome steps. Unavailable/erased actors use an explicit generic label. Permanent stored aliases and ordinary API/archive formats remain unchanged.
- Digests and snoozes: the resumption reference names its project maintenance, rule or issue and the actual start/expiry period in project time. Its readable detail keeps capture/backlog semantics. Work stays within the resumption reference and related snooze label; sibling delivery-history work is untouched.

## Validation

The four existing grouping/triage, reports, deployment-history and digest browser journeys were extended, with behavioral assertions at 1440. Existing 390 proof/smoke remains, and focused candidate browser screenshots cover both widths. No registration, runner command or test-budget entry was added: test registration delta 0 -> 0. The existing triage journey still reports 22 groups. Typecheck and source-lock checks are required and recorded in the actual receipts. See TEST_RECEIPT.json for exact candidate commands' exit codes and BROWSER_RECEIPT.json for the responsive probe.

A supplemental actor probe exercises actual member invitation and confirmation, member-authorized deployment and a named service's deploy-key callbacks using the existing hosted-mail network-edge fixture. Initial supplemental attempts exposed fixture setup issues (local mail suppression, then secure-cookie import fields); they did not establish product failures. Its final result is recorded separately in ACTOR_RECEIPT.json. This is synthetic fixture proof, not a real provider receipt.

All four first-pass extended journeys passed. One concurrent final launch produced no journey output because setup shells rewrote the shared reaper script simultaneously; that silent invocation was rejected as evidence. Final checks were launched from one initialized shell, with an explicit per-command exit-code receipt.

## Plan and custody

PLAN.md contains the full plan. The first implementation commit 2350acef4704657935f7404cbaeef47c33724e9f was pushed immediately as a skip-CI save. The next commit resolves actual report issue references and precise grouping presentation; the candidate separates correction copy and undo actions. Updated main was fetched and merged (already up to date), preserving published history. No rebase/force push, main push, PR write or other-repository clone occurred. Source lock was regenerated last and checked. Product commits contain only product/test/source-lock changes; proof remains in this packet and the report-only evidence ref.

CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are unchanged: 0 Status, Gap or Evidence changes and no DONE claim. New split issue numbers are assigned only on apply; unavailable/erased reference fallbacks are explicit. No unprovided ruling was needed. The full Base publication scan remains with the fleet Mac under the cloud adaptation; DIFF_HYGIENE.json records the exact candidate tree and a narrow introduced-credential-pattern check, not a substitute scan.

## Clause claims

CLAIM GROUP-001 PARTIAL points=none tests=tests/operator-ui.mjs#operatorUi
CLAIM FIND-003 PARTIAL points=1,2,3 tests=tests/reports-flow.mjs#reportsFlow; tests/reports-flow.mjs#reportWorkbench
CLAIM REL-001 PARTIAL points=1,2,3,4,5,6 tests=tests/deployment-history.mjs#REL-001 deployment history journey; tests/release-order-flow.mjs#releaseOrderFlow
CLAIM ALERT-003 PARTIAL points=none tests=tests/alerts-ui.mjs#ALERT-003 destination tests, delivery states, timezone digests and snoozing never hide loss

GROUP-001 and ALERT-003 claims concern readable UI flows and do not requalify every broader clause point. No provider, deployment, complete-clause or landing acceptance is inferred.

## Exact-SHA CI

Candidate pushed successfully. Exact-SHA Verify run 43181663936 completed with success on the full candidate SHA: https://github.com/just-every/run-spool/actions/runs/43181663936 . CI_RECEIPT.json records the exact-SHA observations; GITHUB_CALLS.json records the bounded API use. Evidence publication is separate from product READY/PUSHED custody.

Final result: all five touched-check exits are zero, source lock and contract-document checks pass, and exact-SHA Verify is completed/success. Five GitHub REST calls were used, at five-minute intervals. No failures required diagnosis or rerun. Blockers: none. The evidence ref contains the complete explicitly selected packet and is separate from product landing authority.
