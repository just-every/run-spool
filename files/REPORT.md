# strategy-trial-9-sol-fix1 results

Repository: just-every/run-spool
Product branch: cloud/strategy-trial-9-sol-fix1
Product head: 2b557b5cbb860c0cdb4d1ceb617560f2ae35b9ab
Builder head: e3dc1f5c91dbc24fc4922a1999b3b50e829deb32
Integrated main: 05afa963cc320bba8cf0eafbc35f5fb12b32027f
PR: none, as required.
Scope: gate blocking A, MIG-003 acceptance point 1, ordinary Python and Node stack conversion. No additional clause or follow-up work.

## Plan completed

1. Read the launcher, repository instructions, MIG-003, adapter and public CLI and HTTP journey. Inspect the shared Sentry bridge's language, column and frame conventions against the two upstream formats named by the gate.
2. Extend the existing populated 24-item migration fixture and journey with versioned and bare Python language labels, Python frames without columns, and Node columns zero and four. Reproduce the blocking loss against the original adapter.
3. Correct only the Rollbar adapter boundary. Check both the reconciliation table and ordinary issue packet reads, including persisted admission diagnostics.
4. Run the touched migration journey, typecheck and first-party check. Generate and check the contract documents, restore both generated views from main, regenerate the source lock last and check it.
5. Integrate current main without rewriting the published builder ancestry. Retain main's newer judgments and tests. Check all parent clause IDs, candidate authors, committers and trailers. Push only the named product branch through the required cloud guard.
6. Capture exact-SHA local proof, observe the exact-SHA Verify through REST, and publish the explicitly selected public evidence packet independently of the product ref.

## Finding and repair

The gate reported that pyrollbar emits a language such as "python 3.12.8" and traceback frames without a column, while the Node parser already converts V8's one-based column to zero-based Rollbar colno.

The old Rollbar adapter recognized only the exact string "python", and forwarded colno unchanged into a Sentry conversion boundary which subtracts one. That dropped ordinary versioned Python frames and Node column-zero frames, and shifted other Node columns. The reconciliation machinery could still match its own incorrect mapped output.

The fix recognizes the ordinary versioned Python language label, preserving Python's unknown columns as null rather than fabricating a coordinate. It translates valid nonnegative Rollbar columns to the Sentry bridge's one-based input once, so native coordinates preserve the source's zero-based value. Raw source comparison frames and private originals remain untouched. This does not change shared Sentry capture conversion or broaden the importer.

Three directly edited files contain the repair and its regression coverage:
- src/domain/rollbar-import/event.ts
- tests/rollbar-import/fixture.mjs
- tests/rollbar-import.mjs

The source lock was regenerated. The merge also carries existing main work in owner-editor and agent-policy tests and the OPS-001 evidence judgment. That work was retained from main, not newly developed or claimed by this fix.

## Runtime proof

The new public migration journey first ran against the unchanged product adapter at the builder head and exited 1. It failed "ordinary Python tracebacks retain their located frames, newest first" with actual [] instead of the two located Python frames. REPRODUCTION.log contains the complete actual output.

The fixed journey passed before integration, after integration, and on committed head 2b557b5cbb860c0cdb4d1ceb617560f2ae35b9ab. It uses the documented Rollbar CLI caller against the emitted application's real HTTP import door and migrated local D1. It performs dry-run, reviewed apply, interrupted resume across Worker restart and reconciliation, then reads ordinary issue evidence packets.

Observed outcomes checked by the passing journey:
- Both "python 3.12.8" and "python" retain two located frames, newest first: service/checkout.py line 27 and service/orders.py line 10; their columns remain null.
- The versioned Python issue packet declares language python and retains those same coordinates in the event and its admission diagnostics.
- Node column zero stays present and equals zero in reconciliation, the ordinary issue packet and admission diagnostics.
- Node column four remains four in the same doors. The other Node frame also remains at column four.
- The existing first fixture's source column 12 remains native column 12. Its previous assertion expected 11 and was corrected to the documented Rollbar coordinate convention. It was not removed or relaxed.
- Source comparisons retain the original order and coordinates. Native diagnostic order is newest first.
- All existing count, deploy, rule, durable resume, real replacement SDK, inert history, authority, guarded undo, archive restore, erasure and replay assertions remain and pass.
- The journey retains 24 source items and 24 occurrences, 24 native issues and 24 historical events, one native release from two deploys, four retained notification rules and two retained history events.
- No provider requests, mail replay, active imported alert rules or imported grants occur.

PROBE MIG-003 1: public CLI dry-run, apply, reconcile and native issue packet reads with versioned Python, bare Python and Node columns 0 and 4 -> populated Python frames with null columns and unchanged Node columns; all assertions passed.
PROBE MIG-003 2: existing bounded public apply, Worker restart and resume -> same durable job and cursor, completed without replay duplication.
PROBE MIG-003 3: existing real Node SDK capture and outbound-edge capture -> fresh diagnostic context accepted and no imported-history outbound work.

The existing browser proof ran using /usr/bin/chromium with --no-sandbox. It captured the imported issue and import history once at 1440 and 390 on the exact committed candidate. The issue proof and a separate public-door probe include eight actual PNG files. The original mobile history capture was blank; the probe recaptured populated history after font and paint readiness and added the changed Python and Node column-zero issue screens at both widths. PROBE.mjs is the actual external runner, and PROBE.json contains the observed source and native coordinates bound to the exact SHA. No product code or test registration changed for this evidence capture.

## Checks and mechanical result

All commands ran directly in this dedicated VM, with the supplied toolchain shell and cloud_run for the required long commands. No full local Verify or unrelated suite was run.

- Setup with the explicit fleet owner and non-interactive mode: exit 0.
- npx -y @runeditrun/rer build: exit 0.
- node tests/rollbar-import.mjs: exit 0, including an exact committed-SHA run.
- pnpm typecheck: exit 0.
- npx -y @runeditrun/rer check --profile first-party: exit 0.
- node src/base/contract-docs.mjs write, then check: both exit 0, with zero contract prose errors or warnings.
- Generated ACCEPTANCE.md and docs/CLAIMS.md restored whole from origin/main. Their candidate bytes equal main. The candidate deliberately does not include generated-view updates.
- node scripts/edition-authoring/cli.mjs lock, then check: both exit 0; check also passed on the committed candidate.
- Migration ledger: not applicable; no migration added or changed.
- git diff --check: passed.
- All 105 parent Status rows retained from both merge parents, with 259 pipe-prefixed table lines before and after.
- All nine candidate commits, including side parents, passed the author, committer and trailer policy. The new merge commit uses the fleet identity and no co-author trailer.
- No new test registrations: one existing public migration journey before and after; the cases are data inside that journey. No existing user-flow assertion was deleted, skipped or put behind a new condition.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock and check exit=0; views=node src/base/contract-docs.mjs write and check exit=0, then both views restored to main; ledger=none exit=0.

Local Node was v24.19.0 and pnpm 10.12.4, as selected by the supplied toolchain shim. The repository requests Node 22.20.0 and CI retains that pin. The package engine warning did not fail local checks.

The full-history publication scan and guarded landing remain the fleet Mac's responsibility under the cloud adaptation. This cloud does not claim a COMPLETE publication scan, a main landing, production deployment or a real Rollbar buyer receipt.

## Counts and clause custody

MIG-003: builder done -> candidate done; blocking A's acceptance point 1 repaired. This fix made no new Status, Gap or Evidence judgment and changed no acceptance sentence.

Builder before and candidate after: 23 done, 51 partial, 31 missing, 105 total. Main currently has 22 done, 51 partial, 32 missing; the one-clause difference is the inherited builder MIG-003 claim awaiting the independent gate. There is no new count increment from this fix.

No plan rows outside MIG-003 changed. Main's newer OPS-001 judgment was preserved during integration. The builder's previously published commits remain intact; current main was merged instead of rewriting published ancestry.

CLAIM MIG-003 DONE points=1,2,3 tests=tests/rollbar-import.mjs#Rollbar migration journey
DEFAULT MIG-003: No new policy default adopted.
GAP MIG-003: No remaining gap within blocking A; real buyer field proof R-4 and guarded landing remain unclaimed.

## DONE rider disposition

1. Public journey reaches counts, stacks, deploys and rules; durable interrupted resume; replacement capture and inert history. Exact-SHA local pass, with branch Verify status reported separately below.
2. Populated source and native control data are checked. Wrong fingerprints, unsafe authority, edited undo, erased source and archive replay refusals remain covered without mutation.
3. verification.json already invokes this journey in push Verify; no workflow or registration change was made by the fix. Actual exact-SHA CI outcome is reported below without claiming skipped CI tests ran.
4. The touched journey ran on the committed candidate. Other local gates ran on byte-identical staged source, bound by hashes in RECEIPT.json.
5. No inherited clause duty or citation changed.
6. Generator write and check passed; main generated views were restored as required. The old provenance and expected restored-view freshness difference are not a new status judgment.
7. No acceptance sentence changed, and no parent clause row was dropped.
8. Existing owner and project grant refusals, foreign Origin refusal, current-session revocation and guarded undo assertions passed.
9. Evidence is synthetic API-format and local-installation evidence. Real buyer, hosted account and production cutover are not claimed.
10. No custody, consent, spending or authority policy was introduced.
11. Guarded landing, main equality, publication scan and any main Run site remain pending the fleet. No main push, fast-forward, PR or deployment was attempted.

## Product publication and CI

The product push succeeded on the first guard attempt, preserving all finished work at the named branch and full SHA. PUSH.log is the actual non-secret custody receipt.

Exact-SHA push Verify: run 42421548709
URL: https://github.com/just-every/run-spool/actions/runs/42421548709
The first REST discovery observed in_progress at the candidate's exact head. Further observed status is appended below, with its actual response and any failed-job output included in this packet.

There are no account, key or ruling dependencies for this fix. Generated-view freshness alone is the documented expected exception. Evidence publication is separate from product readiness and never signals acceptance or landing.


### Final exact-SHA CI observation

Run 42421548709 completed with conclusion failure on head 2b557b5cbb860c0cdb4d1ceb617560f2ae35b9ab. This is precisely the documented generated-view exception, not a green workflow claim.

The failed build job 128550893581 passed first-party and source-lock commands, then failed the contract document check with:
    ACCEPTANCE.md: generated content differs; run contract-docs write.
    docs/CLAIMS.md: generated content differs; run contract-docs write.
    Contract prose: 0 errors, 0 warnings.
    Process completed with exit code 1.

The build did not proceed to application build or CI typecheck. Runtime and test partitions were skipped because their build prerequisite failed. The failed coverage summary job 128551016482 and final verify job 128551035891 only propagated those prerequisite results; their complete failed command output is included, with environment header blocks omitted from public evidence.

Each failed job's archive was read exactly once with:
- gh run view 42421548709 --repo just-every/run-spool --job 128550893581 --log-failed
- gh run view 42421548709 --repo just-every/run-spool --job 128551016482 --log-failed
- gh run view 42421548709 --repo just-every/run-spool --job 128551035891 --log-failed

All three archive reads succeeded. There were six GitHub invocations total: discovery, one status poll after 300 seconds, one completed-jobs read and the three failed-job reads. No dispatch, rerun or repair push was made. The restored generated views remain equal to main, as required. The independent gate and fleet lander rerun their gates after the lander generates the views.

The first discovery response's URL sanitizer damaged its serialized JSON after the leading run metadata. Its actual sanitized output is retained as CI-discovery-sanitized.txt; the exact run ID, SHA and initial in_progress state were present in the unchanged prefix. Later status and job responses were sanitized structurally and are valid JSON. This diagnostic handling did not change the product or its CI state.

Blocking findings fixed: A only. No remaining product blocker within the assigned scope. Product READY uses the explicitly permitted generated-view exception; publication scanning, independent gate acceptance and landing remain external fleet gates.
