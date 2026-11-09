# strategy-trial-18-sol-fix1: MIG-004 gate repair

Product: just-every/run-spool, branch cloud/strategy-trial-18-sol-fix1, final head 7d9f9d69db0f82c082572220c9a9c8543af06442. No PR was opened. Main and the default branch were not pushed. The initial preservation commit is 130d3cbe3aa4660f1b2b98f8fc4dcfe827f798c7. The final merge retains main aa853b97de89f949da4fa5876ae525e3b1f343aa. Both product pushes used the required cloud guard and succeeded on the first attempt. No published history was rewritten.

The scope is exactly the three Tier A findings from the gate on builder b6793817f29b9f10abf688dd6fe5030711de626b. The full executed plan is in PLAN.md. No other trial branch was fetched or inspected. No new acceptance point, policy, status promotion or unrelated product fix was authored.

The release identity helper now extracts the name from a documented release_stage object and retains the existing string form. Preview and reconciliation expose that stage label. The existing fixture includes object stages for the current web and Android releases and retains a string stage for the older release. The owner CLI dry run previously returned HTTP 422 source_parser_failed for the documented object; the fixed journey imports and reconciles two projects, three releases, two issues and two sampled events with no rejected records, and retains separate session aggregates.

The Bugsnag event converter now reads snake_case exception type and stack coordinate fields, while retaining the existing camelCase forms. The existing public journey checks the web file, line 1, zero-based column 0 and function, and the Android file, line 43, absent column and original native function in both the issue packet and its historical diagnosis. Before repair, the web diagnosis was empty. No source location is synthesized from missing coordinates.

The bounded ProGuard and R8 method grammar now accepts the ordinary initializer spellings <init> and <clinit> as mapped names. The existing deploy and capture journey uploads a mapping containing both members and the original crash method: first upload returns 201, byte-identical upload returns 200, and a captured Android event resolves to MainActivity.kt line 43 and com.synthetic.MainActivity.crash. The unmodified guard assertions still refuse conflicting bytes, a mismatched build, foreign project authority, unauthenticated upload and revoked deploy and ingest grants. Before repair, the upload returned 400.

The first repair commit changed seven files: the three conversion or parser source files, three existing journey or fixture files, and sources.lock.json. The required main integration produced conflicts in shared import, archive, custody and erasure code. Both the Bugsnag and current Rollbar branches of those handlers were retained; main's CONTRACT.md was taken whole before resolving code. Generated views were taken whole from main. The final diff against main contains no CONTRACT.md, ACCEPTANCE.md, docs/CLAIMS.md or workflow edit. The inherited builder implementation is included in the candidate ancestry; the fix round did not rebuild it.

Local results

- All three public-door reproductions failed before their respective repair; the actual outputs are before-stage.log, before-coordinates.log and before-constructor.log.
- node tests/sentry-import.mjs passed on the merged code. It runs the Sentry public import journey and bugsnagMigrationFlow, including bugsnagCutover. The latter checks all three acceptance outcomes, bounded interruption and resume, reconciliation, inert history, separate denominator gaps, authority and origin refusal, archive restore, guarded undo, erasure and replay refusal.
- The final exact-head Bugsnag journey and typecheck are recorded separately in EXACT-HEAD-LOCAL.json and their actual logs.
- pnpm typecheck, the required first-party rer check and pnpm integration:check passed on the merged tree. The actual logs are retained. Builds ran through cloud_run. The environment selected Node v24.19.0 and pnpm 10.12.4 using the supplied toolchain shim; the repository declares Node 22.20.0. CI uses the repository's declared Node runtime.
- Contract generation wrote zero files after main integration; generator check reported 0 prose errors and 0 warnings and current documents. The generated views equal main, and the source lock was regenerated last and its check passed.
- No migration was added or edited in this repair. The inherited native-symbol migration applied successfully in the emitted Worker journeys. No additional migration-ledger operation was required by this repair.
- Zero test registrations were added; zero assertions were removed or narrowed, and no test was skipped or disabled. The existing journey was extended, with no cap increase.
- The existing changed-screen proof produced imported Android and native-cutover images at 1440 and 390. All browser viewport and overflow assertions remain in the journey. Four actual synthetic screenshots are included in this packet. This fix authored no UI source change.

Supplemental main check

node tests/rollbar-import.mjs passed its public import, reconciliation, restart, authority and capture checks, then timed out at tests/rollbar-import/screens.mjs:16 waiting for the exact text “1 matching events”. The view renders the grammatical singular “1 matching event”. The same command, built and run on untouched main aa853b97de89f949da4fa5876ae525e3b1f343aa on the same runner and Chromium, fails at the same assertion. The actual outputs are rollbar-merged.log and rollbar-main.log. This is a pre-existing main test failure, outside the gate's three findings. No assertion or product wording was changed to hide it. It is reported separately from the passing MIG-004 touched journey and exact-SHA Verify; it is not claimed green.

Before and after

Blocking findings: 3 reproduced before repair, 0 remaining in the passing MIG-004 public journey. Target status rows: 86 before and after. Main's counts remain 13 done, 45 partial, 28 missing. Main's MIG-003 done judgment and SDK-004 evidence are preserved. The original builder had marked MIG-004 done; main's newer missing judgment is retained whole, so the repair authors no clause status change. Relative to current main: MIG-004 missing -> missing, with a test-backed DONE claim for the independent gate and lander. No plan row on the Mac was edited; the reported plan update is MIG-004 acceptance 1 and 2's three blocking findings repaired. Acceptance 3's existing denominator behavior remains proven.

CLAIM MIG-004 DONE points=1,2,3 tests=tests/bugsnag-import.mjs#bugsnagMigrationFlow; tests/bugsnag-cutover.mjs#bugsnagCutover

PROBE MIG-004 1: owner CLI documented stage objects and snake_case web and Android exceptions -> no rejected rows, native graph reconciles, stage and release identity agree, nonempty exported diagnosis coordinates survive.
PROBE MIG-004 2: project deploy grant uploads an ordinary R8 mapping containing <init> and <clinit>, then public ingest captures Android and web events -> 201 upload, 200 idempotent replay, original MainActivity.kt line 43 and mapped web source; unsafe authority and identity attempts remain refused.
PROBE MIG-004 3: owner CLI missing and zero historical session denominators -> explicit historical_sessions_unavailable, crashFreeRate null, no fabricated health sessions or aggregates.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and check exit=0; views=node src/base/contract-docs.mjs write and check exit=0; ledger=no migration authored or edited in this repair.

DONE riders and self-check

1. All three named acceptance outcomes are reached by the existing public journeys; exact-SHA Verify status is in CI-RECEIPT.json, without inferring green from another head.
2. Populated native graph, observed frames and actual symbol upload are asserted, with existing dangerous authority, replay, undo and erasure paths intact.
3. tests/sentry-import.mjs invokes the Bugsnag journey in the existing SDK push shard; no workflow edit or hidden new invocation was added by this repair.
4. Final exact-head local proof and unchanged relevant code bind the retained results; actual command receipts name the full SHA.
5. No inheritance obligation was changed.
6. Main's status, Gap, Evidence and generated judgments were retained; generator and lock checks pass. A future gate and lander owns any promotion.
7. No acceptance text or original obligation was changed.
8. Owner-only imports, project deploy and ingest scopes, foreign and revoked grant refusals and origin guards remain covered.
9. Synthetic export and local capture evidence only. A real buyer project, device and provider boundary remain field register R-5; no real account result or unsupported Apple or NDK symbol qualification is claimed.
10. No new policy default was adopted and no ruling was requested.
11. Landing, full-history publication scan, exact-main Verify and main-only Run site remain fleet Mac responsibilities. This cloud did not land, deploy or claim those receipts.

The final working tree was clean after the candidate commit. All candidate authors, committers and trailers, including side parents, were inspected before both pushes. New commits use the fleet identity with no co-author trailer. The complete Mac publication scan cannot run in this cloud and is not claimed COMPLETE. Product custody and evidence publication are separate. Actual final CI observations and the evidence transport identity accompany this report; a saved packet alone is not READY or acceptance.

CI observation: Verify push run 42648796379 on 7d9f9d69db0f82c082572220c9a9c8543af06442 is in_progress, conclusion None. Receipt: https://github.com/just-every/run-spool/actions/runs/42648796379. This observation does not claim successful Verify or landing.
