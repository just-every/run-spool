# sd-spool-c-f334 — OPS-001 editor authority qualification

Repository: just-every/run-spool. Product branch: cloud/sd-spool-c-f334.
Requested basis: dcbabcff5dc12df33cd4c0601ff0332a7bdd9588 from cloud/sd-spool-c-f333.

## Plan

1. Read the target requirement, all eight acceptance points, its Status Gap, the pinned editor journey and native configuration handler, and the shipped campaign and rider references.
2. Keep acceptance 6 unsafe-answer-path qualification and the held setup-resume command journey outside this round. Preserve every other clause, acceptance text and existing assertion. Change no application behavior.
3. Extend the existing OWNER EDITOR public journey to seed a real issue through native intake and prove a working project grant reads it before and after editor refusal. Retain anonymous refusal, mixed-cookie refusal, native owner access, private cache, short expiry, CSP, browser history and revocation assertions at both widths. Preserve the existing owner configuration private-cache assertions and prove current-session revocation preserves another native owner session.
4. Correct only the OPS-001 evidence citation. Keep OPS-001 PARTIAL and preserve its unsafe-answer-path Gap. Run the touched journey, typecheck and first-party check; generate and check contract views locally, restore the views from main, and regenerate and check the source lock last.
5. Synchronize main before the candidate push, preserve all parent Status rows and inspect every candidate author, committer and trailer. Publish only the named product branch through the push guard. Obtain exact-SHA workflow provenance using the REST door within the call budget. Publish the non-secret report and actual receipts on the separate evidence ref, then remove the successfully published clone.

## Initial mapping and limits

The pinned base already asserts anonymous and project-grant refusals, native-owner access, mixed authorization refusal and browser revocation. Its project read control was an empty list and checked only HTTP 200. This round makes that control populated and checks the captured issue identity, title and count, with unchanged project projection after refusals.

Acceptance 1 to 5 and 7 retain their previous command, claim and dev-credential evidence; they are not requalified here. Acceptance 6 remains unproved. The exact held setup-resume command line remains unchanged. Actual owner-account deployment and provider qualification remain separate gates; no held account or device proof is claimed. No policy decision or acceptance text changes.

OPS-001 remains PARTIAL. Full-clause DONE and a ct judgment are not claimed. The plan row changed is the OPS-001 acceptance-8 editor qualification only. All campaign holds, other queue scopes and start-after-sd-spool-rel8 remain unchanged.

## Local fixture corrections

The first extended run refused the new synthetic capture with HTTP 422 because native intake requires a registered release and build. The fixture now registers them through the public owner release door. A second run caught the fixture assertion expecting HTTP 200 for creating that release; the route correctly returns HTTP 201. Both actual failed logs are retained. These were corrections to newly added fixture setup, not product defects or CI repair rounds. No assertion protecting an existing behavior was removed or weakened.

A third local development run reached the working populated read grant, then rejected an extra, newly proposed cache-header assertion: project bearer requests are refused by the native authority layer before the editor handler and that refusal has no cache-control header. The assertion was outside the requested outcomes and was removed before publication. The original owner configuration no-store, private and Vary assertions remain intact, as do every original refusal and non-disclosure assertion. Product behavior was not changed; the test makes no private-cache claim for the bearer refusal response. The actual failed log is retained.

## Results

Product candidate: 2dd59a3535a1369ce78f1c13703a52d9a0c14346, branch cloud/sd-spool-c-f334. The initial commit was pushed immediately through the supplied guard; its first attempt succeeded. No PR is required: the branch push starts Verify. The exact candidate Verify is push run 42143289065; initial REST discovery returned in_progress. Its exact SHA is recorded in ci-discovery.json. No workflow was dispatched or rerun.

OPS-001: PARTIAL to PARTIAL. Before and after: 22 DONE, 48 PARTIAL, 35 MISSING; all 105 Status rows retained. All 259 table lines were retained across this commit. No acceptance text, status, application source, provider integration, workflow or version pin changed. The only product-tree changes relative to the requested base are the existing editor journey, its OPS-001 evidence citation and the generated source lock. No test registration was added or deleted; no duplicate or pin test was introduced. Existing assertions remain intact, with the project read control strengthened from an empty-list HTTP status to a populated issue read.

Origin main was 1045eb74227c9cba54a7e5d6acb120b3daab6d99 at the candidate synchronization. Fetch and rebase reported the branch up to date. The supplied f333 base remains an ancestor, preserving that writer's commit. The lane's existing f333 landing order remains unchanged. Candidate identities and trailers were checked over the entire origin main to HEAD range, including all side parents; both candidate commits have fleet author and committer identities and no prohibited trailers.

The setup and build commands completed with exit 0 through cloud_run. No private setup output is part of this packet. The local OWNER EDITOR journey passed before the commit; exact-candidate repeat and mechanical results are recorded in checks.json. Typecheck and the first-party check also passed before the candidate. The documented contract write and check passed; generated views were restored from origin main. A check of those intentionally restored views returned 1 for stale ACCEPTANCE.md, as required by the cloud contract. No generated view was committed. The source lock was regenerated by the documented command and its check passed. No migration was added or edited; the migration-ledger check does not apply.

## Public-door probes

PROBE OPS-001 acceptance-8-anonymous: GET /api/editor/config without authority -> HTTP 403; no config or expiresAt.
PROBE OPS-001 acceptance-8-project-grant: native project and release creation, accepted capture, then exact-project issue read -> HTTP 200 with the one captured issue, expected title and count 1; GET /api/editor/config with the same live grant -> HTTP 403, both alone and with an owner cookie; the subsequent populated project projection is unchanged.
PROBE OPS-001 acceptance-8-native-owner: native owner session GET /api/editor/config -> HTTP 200, expected management configuration, current expiry bounded by 30 seconds, no-store and private cache, Vary Cookie; the same owner still succeeds after the refusals.
PROBE OPS-001 acceptance-8-current-session-revocation: POST /auth/signout -> HTTP 204; the existing browser action removes the editor without reloading at 1440 and 390; the revoked cookie gets HTTP 403 with no configuration or expiry, while another native owner cookie still gets HTTP 200.
PROBE OPS-001 acceptance-6: none, unsafe-answer-path command qualification is explicitly omitted by the planner; the held setup-resume journey is unchanged.

The existing journey also retains the ordinary unconfigured installation, partial configuration failure, method refusal, exact-origin document CSP, interactive management iframe, live preview and undo across native history, focus preservation, and actual browser frame-ancestors refusal. The local management service is the only network edge fixture. Auth, project management, release creation, intake, evidence read and editor config use the emitted application and migrated D1. The two screenshots were visually inspected; the revealed management panel fits both 1440 and 390. No UI implementation or homepage changes were made.

## DONE-RIDERS and pre-ready assessment

No DONE promotion or judge request is made. The row assessment records the limits explicitly:

1. PARTIAL: acceptance 8 is reached through tests/owner-editor.mjs OWNER EDITOR, lines 39 to 94 and 130 to 140. Acceptance 6 and held command qualification remain outside this round.
2. PASS for the changed point: a real populated issue is read by the live grant, which is then denied editor authority without losing its read projection; native owner authority succeeds. Lines 57 to 94.
3. PERMITTED GENERATED-VIEW EXCEPTION: exact-SHA push run 42143289065 completed with failure only because ACCEPTANCE.md is intentionally stale; the build stopped at that check and the downstream test matrix was skipped. No successful CI journey is claimed. The existing Verify owner-ui shard runs pnpm test:admission, whose existing command invokes OWNER EDITOR; no CI shape changed. Generated-view-only failure is an explicit lander exception.
4. PASS local proof binding: checks.json records the final candidate SHA, commands, actual exits and time; relevant input hashes are recorded in proof-inputs.json. Browser screenshots belong to the final repeat when it passes.
5. PASS unchanged scope metadata: OPS-001 retains BASE-ACCESS-001, BASE-INSTALL-001 and BASE-DATA-001 citations at CONTRACT.md line 95.
6. PARTIAL deliberately: the unsafe-answer-path Gap remains explicit. The evidence citation now identifies the actual acceptance-8 outcomes. Local write and check pass; restored generated views require the lander's regeneration. Existing judgment history is retained without claiming a new full-clause judgment.
7. PASS: no acceptance point changed and no new policy ruling was needed.
8. PASS for this authority point: owner success, live project denial, mixed-cookie denial and session revocation are exercised through public doors. Lines 39 to 94 and 130 to 140.
9. LIMIT PRESERVED: no provider, account or native-device qualification is claimed. R-20 and all existing external holds remain unchanged.
10. NOT APPLICABLE: no policy default or authority behavior was introduced.
11. PENDING LANDER: main equality, exact-candidate workflow qualification, full-history publication scanning and Run site are fleet gates. This cloud neither scans nor lands main.

Pre-ready self-check: changed authority behavior has positive and negative public assertions; no pre-existing assertion was removed, skipped, narrowed or hidden behind a width condition. The new fixture preserves the existing empty-project browser flow using an independently populated read project. This round changes no erasure or replay behavior. The no-config and no-expiry refusals, current-session fencing and unaffected alternate owner are checked. No product screen changed; browser and CSP proof is retained. Source lock is fresh. Changed product lines contain no email-shaped fixture values or provider-shaped keys. Publication scan is NOT RUN in cloud and is not represented as complete or zero findings. Run site and guarded landing are not claimed.

## Remaining limits and handoff

Unsafe-answer-path proof and the held setup-resume command journey remain unchanged. Owner-account deployment and real provider qualification remain separate gates. All account, device, ct and existing queue holds, release prerequisites and f333 ordering are retained. The scope is completed partial evidence work, not full-clause DONE. No new product blocker was found. Publication and landing remain with the maintained Mac lander.

## Final CI result and custody

Exact-SHA push Verify 42143289065 completed with conclusion failure on 2dd59a3535a1369ce78f1c13703a52d9a0c14346. Build job 127648656461 failed in Check source and portable contract with this actual error: `ACCEPTANCE.md: generated content differs; run contract-docs write.` Contract prose reported 0 errors and 0 warnings, and the source freshness check completed before that line. The other failed jobs, shards (spool) 127648847451 and verify 127648886921, are downstream aggregation guards; the application test and runtime jobs were skipped after the build failed. Their actual failure logs are included. This is the explicitly permitted generated-view-only exception, not a green CI test claim and not a real product failure. No view was committed to repair it, no workflow was rerun or dispatched, and there was no CI repair round. The exact candidate's own local editor, typecheck, first-party, generator and lock checks all passed; checks.json contains their actual exits.

MECHANICAL lock=node scripts/edition-authoring/cli.mjs lock then node scripts/edition-authoring/cli.mjs check exit=0; views=node src/base/contract-docs.mjs write then node src/base/contract-docs.mjs check, followed by restoration from origin main exit=0; ledger=none exit=0.

The product branch is pushed, with fleet identity and trailer checks passed on every candidate. Publication scan, regeneration of the view, guarded landing and exact landed Run site remain the fleet's responsibility. Readiness is a branch handoff under the generated-view exception, not product acceptance, DONE or landing. Evidence publication carries only this packet and is independent of that product handoff.

The three CI failure logs preserve the actual commands and failure output. GitHub runner environment-header sections were removed before evidence selection; raw archive output is retained privately outside the packet and is not published. No credentials, environment dump, private setup log, held key material or symlink is selected. Six GitHub invocations were used, including one completed-log read for each failed job; the two status reads were 306 seconds apart. No blocked blob download was retried.
