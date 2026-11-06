# sd-spool-c-f333

Scope: qualify OPS-001 acceptance 8 through the existing emitted application and public HTTP doors, and correct its contract citation. Product behavior and acceptance sentences remain unchanged. OPS-001 remains partial; unsafe answer-path proof and the held setup-resume command journey are outside this round. Actual owner-account deployment and provider acceptance remain external qualification.

Plan:
1. Read the launcher rules, repository instructions, OPS-001, source handler, and complete editor journey with its helpers; map the four selected outcomes to current assertions.
2. Strengthen the existing journey with confidential refusal responses, a demonstrably live project read credential, a native-owner positive control, and current-session revocation. Keep every existing browser, private-cache and CSP assertion.
3. Run the touched journey and typecheck, the first-party check, contract generation and its check; restore generated views, regenerate the source lock last and check it.
4. Synchronize main while retaining its newer judgments and every Status row; commit with fleet identity and hooks, inspect every candidate author, committer and trailer, then push only the named cloud branch.
5. Discover exact-SHA Verify through REST within the call budget, report its observed result honestly, and publish the complete non-secret packet separately on the evidence ref. Guarded landing, complete publication scanning and Run site remain fleet gates.

Baseline and final receipts are recorded alongside this report. No DONE promotion is planned because the supplied scope expressly holds the remaining command qualification.

Result: OPS-001 remains PARTIAL to PARTIAL. Acceptance 8 is qualified and its evidence citation is corrected. Counts remain 22 DONE, 48 PARTIAL, 35 MISSING across all 105 Status rows. Parent and candidate each retain 259 table lines. Only CONTRACT.md, tests/owner-editor.mjs and the generated source lock changed. Application source, acceptance sentences, setup commands, homepage copy, branding and workflows are unchanged. No PR is required: Verify accepts pushes on the named branch.

Product provenance: branch cloud/sd-spool-c-f333, commit dcbabcff5dc12df33cd4c0601ff0332a7bdd9588, parent and synchronized main 1045eb74227c9cba54a7e5d6acb120b3daab6d99. Fetch succeeded, and the unpublished candidate rebase reported up to date. The first real commit was pushed through the required guard on its first attempt; no published history was rewritten. All candidate author and committer identities were checked, with no trailers. The remote branch was independently observed at the full candidate SHA. Main was not changed.

Scoped proof register, frozen for this round:

| Item | Public door and observed result | Exact candidate proof |
| --- | --- | --- |
| R1: anonymous editor refusal | GET /api/editor/config without a credential returns 403, with no config or expiry | tests/owner-editor.mjs OWNER EDITOR, lines 39 to 47 |
| R2: live project read credential has no editor authority | Mint a project agent grant through owner HTTP; project issues GET returns 200, editor GET returns 403, and the project read still returns 200 afterward. Adding an owner cookie to the explicit bearer request still returns 403; neither refusal exposes config or expiry. | Same journey, lines 57 to 66 |
| R3: native owner remains supported | Native owner GET returns 200 with the configured management origin and installation, no-store and private caching, Cookie variance and a current expiry bounded to 30 seconds. A second owner GET still succeeds after the refusals. | Same journey, lines 48 to 56 and 67 to 73 |
| R4: current-session revocation removes editor authority | Native signout returns 204; the next native navigation removes the open widget without a reload. The same revoked cookie then receives editor HTTP 403 without config or expiry. | Same journey, lines 79 to 114, retained at 1440 and 390 |

PROBE OPS-001 acceptance-8-anonymous: GET /api/editor/config without credentials -> HTTP 403, config absent, expiry absent.
PROBE OPS-001 acceptance-8-project-grant: project issues GET with a newly minted read grant -> HTTP 200; editor GET with that same live grant -> HTTP 403, config absent, expiry absent; repeated project read -> HTTP 200.
PROBE OPS-001 acceptance-8-owner: editor GET with native owner cookie -> HTTP 200, configured origin and installation, private no-store response and bounded current expiry; owner GET after refusals -> HTTP 200.
PROBE OPS-001 acceptance-8-revocation: POST /auth/signout with the current session -> HTTP 204; native navigation -> editor removed; editor GET with the same revoked cookie -> HTTP 403, config absent, expiry absent.
PROBE OPS-001 acceptance-6: none, expressly omitted by the planner-selected scope.
PROBE OPS-001 held-setup-resume: none, the held command journey remains unchanged.

The external management service alone uses the existing network-edge fake. Native auth, project grants, dispatcher, editor handler, emitted Worker, D1 and all migrations execute normally. The existing independent owner check is in src/editor/config.server.ts; valid project agent credentials are refused earlier in src/server.ts. The new proof respects both current denial paths and changes no product behavior. Native owner, private-cache and CSP assertions, unconfigured and partial configuration behavior, interactive iframe, navigation, preview, undo, focus preservation, logout removal, and management frame-ancestors refusal are retained. The existing browser assertions still execute at both widths, as this brief explicitly requires. The two actual screenshots were inspected; the management panel fits the viewport and native text remains legible. No product screen or control changed.

Validation:

- The required local setup and public build completed successfully. Setup is infrastructure preparation here, not qualification of the omitted setup-resume journey.
- The complete touched owner-editor journey passed before committing and again on the exact pushed commit. editor-journey-receipt.json binds the successful run to the candidate and relevant source and test hashes. editor-journey.log is the actual successful terminal summary. Both browser screenshots are included.
- Typecheck and the first-party check passed on the same relevant source and test bytes. No full local verification or unrelated suite was run. No test registration was added, removed or skipped, and no prior assertion was weakened or moved behind a new condition.
- Contract generation wrote one document; its check reported zero prose errors, zero warnings and current documents. Both generated views were then restored from main and neither is committed. The resulting committed candidate deliberately fails only the local generated-view freshness check for ACCEPTANCE.md. The real receipt is included. This is the required cloud handoff state, not a repaired or hidden check.
- The documented lock command regenerated only the CONTRACT.md and owner-editor hashes. Its integrity check passed after the final rebase and generated-view restore. No migration was edited.
- One early uncommitted test draft assumed cache headers on the dispatcher's existing project-grant denial. Running it exposed that incorrect assumption. The draft was aligned with the observed existing transport boundary; all baseline cache assertions remain intact. There was no product fix, existing assertion removal or CI repair round.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then node scripts/edition-authoring/cli.mjs check exit=0; views=node src/base/contract-docs.mjs write then check exit=0, generated views restored afterward; ledger=none exit=0.

DONE-RIDERS review, without claiming DONE:

1. PARTIAL for the full clause: acceptance 8 passes the scoped journey; acceptance 6 remains unqualified in the recorded Gap and the setup-resume continuation is held by the brief.
2. PASS for this scope: usable native owner and live project-read positive controls accompany actual unsafe editor refusals; refusal bodies expose neither configuration nor expiry.
3. PENDING: the exact-SHA push Verify run is recorded separately. The touched journey runs in the existing owner-ui shard through pnpm test:admission, without flags or workflow edits.
4. PASS: the successful local journey receipt names the exact candidate SHA and relevant hashes; subsequent report edits are outside the product checkout.
5. UNCHANGED: OPS-001 retains its existing Base duties and acceptance requirements; this evidence correction adds no inherited duty.
6. PARTIAL and mechanically qualified: the citation is corrected and the unsafe-path Gap remains. Generator write and check pass; candidate views are deliberately restored for lander regeneration. No new DONE judgment or provenance claim is made.
7. PASS: no acceptance sentence, CT rider, ruling, ID or coverage mapping changed.
8. PASS for editor authority: owner access works; an explicit project credential, that credential combined with an owner cookie, anonymous access and a revoked native session are refused through HTTP. Existing browser revocation checks remain intact.
9. HELD honestly: actual owner-account deployment and provider acceptance are not claimed. No account, device or provider proof was invented.
10. NOT APPLICABLE: no policy default or authority behavior changed.
11. PENDING guarded landing: main equality, complete full-history publication scan with zero findings, final Verify and Run site are fleet gates. This cloud has not landed or scanned the product.

Pre-handoff self-check: the selected behavior has real public-door assertions that fail on an incorrect status or exposed config; native owner and live grant controls distinguish blanket denial. Existing assertions remain intact. No credential, erasure, capture or replay implementation changed. The current-session revocation path is exercised. No UI implementation changed. The source lock is fresh; no new email-shaped string was introduced into product files. Publication scanning and landing are unestablished here and explicitly retained as lander gates. No mutation run or DONE qualification is claimed.

Plan row return: qualify OPS-001 acceptance 8 only and remove that obsolete missing-evidence statement from its Gap. Acceptance 6 unsafe-answer-path proof, the held setup-resume command, actual owner-account deployment, provider qualification, all existing account, device and CT holds, queue scopes and release prerequisites remain unchanged. Other acceptance points retain their prior evidence. No other campaign target was taken because this brief explicitly limits the round to the selected editor evidence.

Main CI observation: the synchronized main SHA has successful branch Verify 42127604034 and Run site 42130609627. Its later duplicate main-push Verify 42130609799 failed in runtime ruby (job 127606490207, SDK-sent outcome reconciliation) and owner-ui (job 127606490375, focus expected but inactive). Both completed job archives were read once through gh run view, successfully; these existing failures were not changed, reproduced or relabeled as proven flakes. No rerun or workflow dispatch was requested. The actual CI observations and sanitized failure summaries are included.

All packet files are explicitly selected regular non-secret files. Product custody and evidence publication are separate. The publication scan, generated views at landing, guarded landing and Run site are not certified by publishing this packet.

The failed duplicate main Verify was inspected again after the allowed polling interval and is run_attempt 1, so no failed-job rerun has been exhausted. Its actual run receipt is included. This round neither consumes a rerun nor infers a product fix from it.

Final candidate CI: push Verify 42138302169 completed with conclusion failure on exact commit dcbabcff5dc12df33cd4c0601ff0332a7bdd9588. Build job 127632008604 passed the first-party and source-lock commands, then failed solely at `node src/base/contract-docs.mjs check`: “ACCEPTANCE.md: generated content differs; run contract-docs write.” The contract reader reported zero prose errors and zero warnings. Dependent suites were skipped, and the aggregate spool and verify gates failed as a consequence. The completed failed-job archive was read exactly once with exit 0. No application assertion failed in this candidate CI. Under the explicit generated-view exception this is an eligible handoff; the lander must regenerate the view and rerun exact-SHA Verify before landing. The actual candidate job list, sanitized failure log and receipt are included. The local exact-SHA editor journey passed independently; this report does not call the skipped CI journey green.

Terminal product custody: PUSH_OK for cloud/sd-spool-c-f333 at dcbabcff5dc12df33cd4c0601ff0332a7bdd9588. No product blocker is declared for the selected acceptance-8 qualification. No DONE promotion, publication scan, main landing or candidate Run site success is claimed. The first-party, typecheck, local touched journey and integrity gates passed. Evidence publication remains separate from this custody.

GitHub budget: nine workflow discovery, status or failed-job archive calls in this round; one watcher, no repeat archive reads, no reruns and no dispatches. Candidate status polling respected the 300-second interval.
