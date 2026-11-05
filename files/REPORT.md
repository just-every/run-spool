# sd-spool-c-f330 results

Product: just-every/run-spool, branch cloud/sd-spool-c-f330, head `9c20965daa8bae8063f95b10390c4f3b1b5675ad`.
Base: `ae15d7004a5ccdc44be7a455454f51a86c026eea`.
Predecessor recovered: `45912f0f0f004edb79ad03f576d3d67ca4c38bb1`.
PR: none required; branch pushes are a Verify entry point.

BASE-AGENT-001 moves **missing to partial**. Its six acceptance outcomes are qualified at the implemented native MCP transport boundary. Full-clause DONE is not claimed. Counts change from 22 done, 47 partial, 36 missing to 22 done, 48 partial, 35 missing; all 105 parent Status rows survive in both new commits. The campaign row to update is BASE-AGENT-001 only.

## Work and scope

The unfinished predecessor was replayed onto current main without retaining its stale source lock or changing its published branch. The first new commit, `904529593333cdb8e65006b7554ece0aaf8c1d9b`, saved the recovered protocolContract journey with a stronger populated-custody baseline and was pushed with skip-ci. The landing candidate adds valid-mutation checks for method mismatch and foreign Origin, then records the qualified slice in CONTRACT.md. A fresh fetch and merge of main reported already up to date before the candidate was committed. Main and every other writer's commits remain ancestors.

The focused saga is `tests/agent-door/protocol-contract.mjs` protocolContract, registered in `tests/agent-door.mjs`. It reuses `tests/agent-door/runtime.mjs` and two independent emitted-Worker installations with real local D1 and all migrations. Inputs enter native organization, project, release, ingest, issue and approval routes, then the MCP transport. No product runtime, Base pin, workflow, homepage, optional capability or lifecycle declaration was changed. The suite's existing assertions remain intact. The existing journey gains the focused transport saga; there is no new standalone CI test command, pin assertion or duplicate removed.

The added baseline performs a real native MCP suppression, obtains native sponsor approval under held policy, then reopens the issue through its native person route. The refusal snapshot therefore contains real issues, events, releases, alerts, prior native operation attribution and replay custody; the held installation also contains an executed approval. Proposal rows and the complete saved custody tables are compared, even where a table has no rows. This is stronger than taking snapshots of empty agent ledgers.

## Frozen transport rubric and proof map

All references below are to `9c20965daa8bae8063f95b10390c4f3b1b5675ad` and the single protocolContract saga. Each row runs under independent autonomous and held policies.

| Rubric | Acceptance outcome | Native public-door proof | Result |
| --- | --- | --- | --- |
| R1 | Discovery describes supported revisions, capabilities, server information and instructions | Lines 36–45 perform the first modern request before initialize. Lines 53–61 reconcile the complete discovery with legacy initialization. | PASS locally |
| R2 | Handshake-free modern requests and initialized legacy client expose the same tools | Lines 46–61 compare the complete nonempty 55-name catalogue, full tool descriptions and discovery between revisions. | PASS locally |
| R3 | Unsupported revisions have the named refusal | Lines 88–91 assert HTTP 400, UnsupportedProtocolVersion, code -32022, the requested revision, all advertised supported revisions and unchanged populated state. | PASS locally |
| R4 | Repeated lists are deterministic with private cache fields | Lines 35, 46–50 and 58–60 compare repeated full modern and legacy results, sorted unique names, ttlMs and private cache scope. | PASS locally |
| R5 | Foreign Origin and mismatched method headers refuse | Lines 93–107 check both discovery and a valid native mutation: HTTP 403 for foreign Origin, HTTP 400 HeaderMismatch for a method mismatch, and unchanged populated records and custody. | PASS locally |
| R6 | Oversized bodies refuse without an effect | Lines 75–87 populate and assert the baseline. Lines 100–127 send the same valid mutation with declared-length and streamed oversized padding, require HTTP 413, compare complete native snapshots, then execute the bounded positive control exactly once, after approval under held policy. | PASS locally |

The boundary's incumbent is remote MCP transport. The public-door proof concerns client negotiation, lists, explicit refusals and native-state safety; it does not claim a full incumbent product replacement or live hosted qualification. The exact-candidate Verify event and result are recorded separately in the CI receipt below.

## Actual local results

- Candidate emitted-Worker journey: `candidate-agent-door.json` and `candidate-agent-door.log`, exit 0 on `9c20965daa8bae8063f95b10390c4f3b1b5675ad`. It includes all six probes under both policies and the existing approval, Pause, attribution, revocation, erasure, archive and replay journeys.
- Candidate typecheck: `candidate-typecheck.json`, exit 0 on `9c20965daa8bae8063f95b10390c4f3b1b5675ad`.
- Candidate first-party check: `candidate-first-party.json`, exit 0 on `9c20965daa8bae8063f95b10390c4f3b1b5675ad`.
- Installed shared checker: `installed-conformance.json` and `installed-conformance.log`, exit 0, **9095 of 9095 assertions passed**. It ran on the saved code head. `conformance-binding.json` proves its runtime, declarations, driver and fixtures are byte-identical on the candidate; only the new focused saga changed, and the shared checker does not import it.
- Contract generator write and check passed before the generated views were restored from origin/main. The restored view check exits 1 as expected because ACCEPTANCE.md is deliberately left for lander regeneration. Neither generated view is committed.
- Source lock regenerated last and its check passed. `mechanical.json` binds these operations and the clean-tree result to `9c20965daa8bae8063f95b10390c4f3b1b5675ad`. No migration was added or edited; ledger check is not applicable.
- Initial setup used the required launcher and toolchain, followed by the public noninteractive setup command. It completed successfully and built the emitted application. Local Node was v24.19.0 and pnpm 10.12.4 under the supplied toolchain script; the repository's Node and rer pins remain unchanged. CI retains the pinned Node 22.20.0 runner.
- The source changes add no address-shaped fixture, credential or secret. `prepublication-review.json` records zero addresses in added text. All candidate authors and committers are the fleet identity; no coauthor trailer survives. `identity-audit.txt` covers every candidate commit, including all parents.

The candidate's existing agent-door browser regressions also exercise desktop and phone screens. This round changes no screen, so no new design or UI acceptance claim is made. The stderr Broken pipe diagnostic from workerd did not fail either successful native journey or the successful installed checker; all child runtimes completed normally.

## DONE-RIDERS assessment

This is a partial qualification, so the table does not assert full-clause DONE.

| Rider | Assessment | Evidence or remaining condition |
| --- | --- | --- |
| 1 | PASS for transport slice; full-clause remainder retained | R1–R6 above; resources and prompts remain undeclared and unserved. Exact-SHA Verify is an independent CI gate. |
| 2 | PASS for touched safety paths | Lines 75–127 use populated state, refused dangerous mutations and a successful bounded control with the real held approval. |
| 3 | CI result required | `.github/workflows/verify.yml` invokes pnpm test:agent-door in its existing agent-handoff shard and invokes the installed checker in its existing owner-ui shard. No workflow changed. |
| 4 | PASS for local evidence binding | Candidate journey and mechanical receipts name the full candidate SHA. Installed-checker byte equality is recorded in conformance-binding.json. |
| 5 | UNCHANGED | Existing SURFACE-001 cites BASE-AGENT-001; no inherited duty or receiving acceptance changed. |
| 6 | PARTIAL, honestly recorded | Evidence and Gap identify the qualified boundary and unqualified remainder. Generated-view freshness is intentionally left to the lander. The code-basis judgment names the saved code head; actual final proof is bound here to the candidate. |
| 7 | PASS | No acceptance text or inherited obligation changed; all 105 Status rows remain. No coverage rewrite occurred. |
| 8 | PASS for touched transport authority | Authenticated valid mutation completes; foreign Origin and mismatched headers refuse with identical populated state. Existing revocation and erasure journeys also pass. |
| 9 | PASS for truthful boundary | No account, provider, legal, device or hosted claim is made. Hosted qualification remains in the Gap. |
| 10 | NOT APPLICABLE | No new custody, consent, spending or authority policy default was adopted. |
| 11 | PENDING LANDER | Main was not changed. Publication scanning, regenerated views, guarded landing and exact-main Run site remain the Mac lander's gates. |

## Pre-ready self-check

Every named transport outcome is exercised through the public MCP door with an observable assertion. No existing assertion was removed, narrowed, skipped or put behind a condition. The enclosing native revocation, erasure and replay regressions pass; those claims are not expanded to omitted lifecycle families. There is no touched UI. Source lock is fresh. The full-history publication scan is NOT RUN in cloud and is not claimed COMPLETE: the guarded Mac lander owns it. Initial main Verify runs 42107126279 and 42101550974 and Run site 42107126150 were successful on the initial main SHA.

## Remaining scope and handoff

Resources and prompts remain undeclared and unserved. Complete registry and table-wide conformance, hosted qualification and obligations beyond this native transport slice remain unproved. Optional capabilities, unscoped lifecycle families, BASE-AGENT-012, SURFACE-001's continued hold, all account, device and ct holds, queue scope and release prerequisites remain unchanged. There is no new account, key or policy blocker for the selected transport POINTS. No other clause was started or promoted.

This packet is report-only evidence. Publication of its separate evidence ref is neither product acceptance nor landing. The product branch is the only product ref pushed; neither main nor another default branch was pushed. Exact product custody and CI observations are in RECEIPT.json and ci-discovery.jsonl. The full working plan is PLAN.md, and complete actual probe lines are PROBES.txt.

## Exact candidate CI observation

Push Verify **42123679408** completed on `9c20965daa8bae8063f95b10390c4f3b1b5675ad` with conclusion failure. The only originating failure is build job **127582316331**, command `node src/base/contract-docs.mjs check`: `ACCEPTANCE.md: generated content differs; run contract-docs write.` Source integrity and contract prose had passed. Dependent test and runtime shards were skipped; the aggregation jobs consequently failed. No CI assertion ran and failed. This is the explicit generated-view exception from the brief; it is not represented as an ordinary green Verify. The Mac lander must regenerate the views and obtain exact-SHA verification before landing. No dispatch or rerun was requested.

The failed-job archive was read exactly once with `gh run view 42123679408 --repo just-every/run-spool --job 127582316331 --log-failed`, exit 0. The local mechanical receipt independently records the same failure on restored views, and generator write followed by check exits 0. No repair was attempted. Four GitHub invocations were used: initial-main run discovery, candidate run discovery, completed-run job metadata and the one failed-job archive read. No status polling loop was run.

The candidate build command `npx -y @runeditrun/rer build` also passed on the final SHA; the post-build source lock check passed, with the checkout clean. The product ref matches the full candidate SHA.
