# strategy-trial-18-sol-fix1: MIG-004 gate repair

Product: just-every/run-spool. Branch: cloud/strategy-trial-18-sol-fix1. Final pushed head: ce4226c2903be0f01a11ef1f471974f2e6563661. No PR was opened. Main was never pushed or fast-forwarded. The candidate retains main aa853b97de89f949da4fa5876ae525e3b1f343aa; that ref remained unchanged at the final merge check. Initial preservation commit: 130d3cbe3aa4660f1b2b98f8fc4dcfe827f798c7. Main integration commit: 7d9f9d69db0f82c082572220c9a9c8543af06442. Final fixture repair: ce4226c2903be0f01a11ef1f471974f2e6563661. Each product push used the cloud guard, succeeded on its first attempt, and was preceded by inspection of all candidate identities and trailers, including side parents. No published history was rewritten.

Handoff: PUSHED. Exact-SHA Verify for the final head is unobserved because the ten-call GitHub budget was exhausted diagnosing the previous head. No green Verify or READY claim is made. FINAL-CI-STATUS.json records this boundary. The fleet must observe the final head's Verify and perform its publication and landing gates.

Scope and completed plan

The assignment's three Tier A findings against builder b6793817f29b9f10abf688dd6fe5030711de626b are repaired. No other trial branch was fetched, read or compared. The full plan is PLAN.md. The executed work was: reproduce the three failures through public doors; repair stage and exception conversion and standard R8 initializer parsing; extend the existing migration journey; preserve the result in the named branch; integrate current main while retaining its contract judgments; run touched checks; diagnose the failed exact-SHA workflow; correct two historical fixture inventories without changing their assertions; push the final candidate and publish this report separately. There is no additional product feature or new acceptance obligation.

1. The documented release_stage object now contributes its name to the release identity and preview and reconciliation labels. Existing string stages remain accepted. The fixture includes object stages for web and Android and a string stage for the older release. Before repair, owner CLI dry run returned HTTP 422 source_parser_failed. After repair, two projects, three releases, two issues and two sampled events reconcile with zero rejected records, preserving separately reviewed release session aggregates.
2. The event converter reads documented snake_case exception type and stack coordinates while retaining camelCase compatibility. The public issue packet and historical diagnosis expose the web file, line 1, column 0 and submit function, and the Android file, line 43, absent column and original native function. Before repair, the diagnosis frames were empty. No missing coordinate is synthesized.
3. The bounded ProGuard and R8 grammar accepts mapped <init> and <clinit> names. The existing project deploy journey uploads a mapping containing both plus the crash method: first upload returns 201, identical upload returns 200, and actual capture resolves to MainActivity.kt line 43 and com.synthetic.MainActivity.crash. Before repair, upload returned 400. Existing conflicting-byte, wrong-build, foreign-project, unauthenticated and revoked-grant refusals remain intact.

The application repairs are in src/domain/bugsnag-import/event.ts, src/domain/bugsnag-import/report.ts and src/domain/native-symbols/proguard.ts. The existing tests/bugsnag-import.mjs bugsnagMigrationFlow and tests/bugsnag-cutover.mjs bugsnagCutover exercise them through owner import, project deploy and public ingest routes. The fixture is tests/fixtures/bugsnag/organization.mjs. No new test registration was added and no assertion was removed, narrowed or skipped.

Main integration

Conflicts in shared import, archive, custody and erasure handlers were resolved by retaining both the Bugsnag path and main's Rollbar path. CONTRACT.md was resolved first and taken whole from main. Generated ACCEPTANCE.md and docs/CLAIMS.md were taken whole from main. The final diff against main contains no contract judgment, generated-view or workflow edit. Every parent Status row was retained; all three commits retained the parent's table row count. The source lock was regenerated last.

CI diagnosis and mechanical fixture repair

Exact-head push Verify 42648796379 on 7d9f9d69db0f82c082572220c9a9c8543af06442 completed failure. Its build, source lock, contract, integration and typecheck steps succeeded. The Bugsnag migration journey completed inside the SDK job before a later multilingual assertion failed. Three substantive failed jobs were read once each with the required gh run view archive command; none encountered a blocked log transport.

- 129269853607, verify (alerts): conditions-journey.mjs:43, Cannot read properties of undefined (reading 'reason'). The same complete alerts shard passed locally on the failed head; the same native alerts test also passed on untouched main. No alert code or assertion was changed. This is reported as a non-reproduced CI failure.
- 129269854071, verify (sdk): tests/multilingual.mjs:119 expected HTTP 400 for a forged historical behavior inventory, but received HTTP 409 schema_mismatch:legacy_evidence. The exact shard was attempted twice locally, first hitting a missing Playwright launcher and then a port collision from overlapping checks. After correcting the environment and serializing the checks, the same failing multilingual test reproduced the CI assertion on the failed head. It passes on main. These unsuccessful reproduction attempts are retained, not described as passing.
- 129269853778, verify (repair-recovery): archiveProof received POST /api/restore: HTTP 400 other. The exact command pnpm test:repair-recovery reproduced the same failure on the failed head. The same complete command passes on main.

Jobs 129280173912 and 129280237424 failed as aggregate consequences. The coverage guards were not changed. VERIFY-REPRODUCED.json contains the real nonzero exits, commands, heads, jobs, tests and quoted failures. CI-FAILURES.md and the sanitized failed-step logs retain the diagnostics. Workflow environment headers were excluded from those logs; full local originals were not selected for evidence publication.

Both reproduced restore failures came from synthetic historical-archive constructors that still carried native_symbols and its new trigger while declaring a schema from before that table. tests/fixtures/archive-before-native-symbols.mjs now removes those later declarations and obtains the earlier artifact-capacity trigger from the actual retained 0067 migration. tests/multilingual/archive.mjs and tests/repair-recovery/archive.mjs call it before signing their old-format inventories. The product restore guards and every original refusal, row-preservation and restore assertion are unchanged. The full multilingual journey and full repair-recovery journey now pass. The latter includes the public CLI export and restore checks. There was one code repair round; both touched restore journeys passed after it.

Final local evidence

- On final head ce4226c2903be0f01a11ef1f471974f2e6563661, node tests/bugsnag-import.mjs, pnpm typecheck, contract-docs check and edition source check all passed. EXACT-HEAD-REPAIRED.json records actual commands, timestamps and Node v22.20.0.
- The repaired multilingual and repair-recovery journeys passed on the identical source and test bytes committed in the final head. FINAL-RECEIPT.json records the fixture file hashes and actual log hashes. Both same tests pass on untouched main on this runner.
- The required first-party rer check passed. Integration configuration and application code are unchanged from the passing merged integration check. Builds and long-lived checks used cloud_run. Chromium was /usr/bin/chromium; the missing default headless launcher was bound to that system binary for legacy direct Playwright callers.
- The contract generator wrote zero documents after integration and its check passed with zero prose errors and warnings. Source lock regeneration and check passed after the final fixture edits, and the exact final-head freshness checks pass. No migration was authored or edited in this fix round; the inherited native-symbol migration applied successfully in the Worker journeys.
- Four actual final-head synthetic screenshots cover imported Android evidence and native symbol cutover at 1440 and 390. The existing viewport and overflow assertions remain. No UI source was authored by this repair.
- The final product checkout was clean after the final proof. New commits use the fleet author and committer with no co-author trailers. No test was deleted, disabled or moved behind a condition. Registrations added: zero.

A supplemental Rollbar migration journey reached its browser assertion expecting “1 matching events”, while the shared view renders “1 matching event”. The same full command fails at that exact assertion on untouched main. Its actual outputs remain in rollbar-merged.log and rollbar-main.log. This pre-existing text assertion is outside the gate's findings and was not changed or claimed passing.

Counts and clause custody

Blocking findings: 3 reproduced before repair -> 0 remaining in the final passing MIG-004 journey. Status rows: 86 -> 86. Current main counts are unchanged: 13 done, 45 partial, 28 missing. Main's MIG-003 done judgment and SDK-004 evidence are retained. The original builder had marked MIG-004 done; current main's newer missing judgment was retained whole. Relative to current main, MIG-004 remains missing -> missing; no builder status promotion was authored. The reported plan update is MIG-004 acceptance 1 and 2's three blocking findings repaired, with acceptance 3's denominator behavior still proven. No Mac plan file was edited.

CLAIM MIG-004 PARTIAL points=1,2,3 tests=tests/bugsnag-import.mjs#bugsnagMigrationFlow; tests/bugsnag-cutover.mjs#bugsnagCutover
GAP MIG-004: Final exact-SHA Verify is unobserved after the task GitHub budget was exhausted; the independent gate and lander own acceptance and status promotion.

PROBE MIG-004 1: owner CLI documented stage objects and snake_case web and Android exceptions -> zero rejected rows, reconciled graph, matching stage and release identities, and nonempty exported diagnosis coordinates.
PROBE MIG-004 2: project deploy uploads ordinary R8 initializer members, then public capture -> 201 upload, 200 identical replay, original MainActivity.kt line 43 and mapped web source, with unsafe authority and identity attempts refused.
PROBE MIG-004 3: owner CLI missing and zero historical session denominators -> explicit historical_sessions_unavailable, crashFreeRate null and no fabricated health sessions or aggregates.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and check exit=0; views=node src/base/contract-docs.mjs write and check exit=0; ledger=no migration authored or edited by this repair.

DONE-rider disposition

1 and 2: all three outcomes are reached and asserted through populated public-door journeys; final Verify is unobserved. 3: the Bugsnag journey remains invoked by tests/sentry-import.mjs in the existing SDK push shard; final workflow completion is unestablished. 4: final-head MIG proof and unchanged-byte binding for the fixture checks are recorded. 5: no inheritance change. 6: main judgments retained and generators pass. 7: no acceptance change. 8: owner, project, foreign, revoked, origin, replay, undo and erasure guards remain covered. 9: only synthetic export and local capture proof; real buyer and device qualification remain field register R-5, with no Apple or NDK decoder claim. 10: no policy default or ruling was needed. 11: landing, publication scan, exact-main Verify and main-only Run site remain the fleet Mac's gates. No COMPLETE publication scan, landing or deployment is claimed.

Evidence custody

Evidence is separate from product custody. The initial evidence save 5fd56a1a12df8cb6dab4ce13df76cc4a7f8d4a61 fetched back successfully with manifest and file hashes verified; EVIDENCE-SAVE-ROUNDTRIP.json records that save, not a final landing claim. The final report, plan, all relevant actual non-secret receipts and selected screenshots are published only to evidence/strategy-trial-18-sol-fix1. The terminal EVIDENCE line identifies the exact final transport head. The packet remains outside the scratch clone at /home/agent/rer-consolidation/work/strategy-trial-18-sol-fix1/packet.
