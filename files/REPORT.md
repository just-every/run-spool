# sd-spool-design-issues-3

Repository: just-every/run-spool  
Branch: cloud/sd-spool-design-issues-3  
Candidate: fdcbe49c5f65a04faf69ce08ceddb72568bc41af  
Tree: 45c5c0a24614e4d4dc86eff09221fcd2c363b3b2  
Initial main: f44efc8c76f8f11753b89465cc3fcb7b64760570  
Integrated main: 53b460837d5a58266c39d03a9f923e09e9c29fb7  
Original round: a510bbb5505f8468c833bb42cd43350396438f83

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).

## Plan and execution

1. Applied fleet identity, decrypted-bundle Git authentication, publication hooks and launcher instructions. Cloned only the declared Spool repository, depth-one and blobless, then deepened as needed. Setup applied 103 migrations and emitted RER_SETUP_READY. Private setup output is excluded; its numeric exit was not separately captured.
2. Confirmed the original a510bbb head and linearly replayed the net five-commit round on fresh main. Preserved main's Sentry credential privacy changes, contract judgments and unrelated prose. Saved/pushed 388c978d44e4e13cc952553618b93cef0efe7456.
3. Ran the unmodified Sentry CLI journey three times on main and three on the replay, with hard timeouts and actual exit/log receipts. Found one socket failure in each set. Added bounded recovery only for failed owner GETs, with real HTTP fault tests. Saved/pushed 5f4dfd83c931fbc5e8d860604a11778e90ddce02.
4. Ran the Issues journey, generators and ordered build checks; saved/pushed proof commit 21a434c38bf0b467bca76c294f63b726c7fa8e2c. Its exact-SHA Verify passed Sentry and project erasure but exposed the policy-display race and an intermittent restore POST socket closure.
5. Reproduced the policy race deterministically through the browser/public API, fixed stale reads in OperatorPanel, and pinned that ordering in the desktop owner journey. Qualified fresh connections for restore POSTs without replaying writes. Saved/pushed 240376854a6d7f3bd89ec2054fa58be006ae722a with [skip ci].
6. Main advanced by a qs dependency lock patch. The cloud preservation rule requires merging updated main after published saves. Merged 53b4608, installed its frozen lock, reinstalled fleet hooks, regenerated and checked the authoritative inputs, and reran the ordered build and full runtime journey. The final merge commit is an explicit exception to the initial linear replay; no published history was rewritten.
7. Audited all five candidate commits, including side-parent traversal. All authors/committers are the fleet identity and no co-author trailers remain. Committed/pushed fdcbe49c5f65a04faf69ce08ceddb72568bc41af. The committed source equals the checked merged snapshot. No PR, release, tag, default-branch push or Base refresh was performed.
8. Captured the final emitted app at 1440 and 390. Functional proof assertions run at 1440; phone captures are visual proof. Observe exact-SHA Verify through one REST watcher within the ten-call budget, then publish the complete selected non-secret report packet to the separate evidence ref. Fleet retains publication scanning and landing.

## Sentry comparison and recovery

| Unmodified harness | Full passes | Socket failures | Runs |
| --- | ---: | ---: | ---: |
| Fresh main f44efc8 | 2 | 1 | 3 |
| Raw replay 388c978 | 2 | 1 | 3 |

Main failed with UND_ERR_SOCKET in fieldRefusalFlow's owner inventory read after an archive/refusal sequence. The replay failed with ECONNRESET in boundaryState/populatedDenialFlow after the API-002 probes. Its last retained server request completed HTTP 200 after 14.243 seconds. Neither retained failure log shows a Worker exception or D1/SQLite error. This small comparison supports an existing local transport flake; it does not establish an Issues API crash.

The Sentry test retries only UND_ERR_SOCKET or ECONNRESET on an owner GET, at most twice, after public /health becomes ready. Readiness is bounded to five probes with two-second deadlines and 200ms pauses; retries send Connection: close. Writes, HTTP refusals, assertions and other transport errors are never retried. Real HTTP fixtures prove FIN-close/TCP-reset recovery, one mutation attempt, unchanged 403, three attempts on persistent socket failure, and bounded failure on an unhealthy Worker. Full recovered Sentry passed on 21a434c and on the clean final fdcbe49 commit, both exit zero.

## Failures exposed by exact-SHA Verify

Verify 44191699045 on 21a434c completed/failure: 24 jobs succeeded, four skipped, two actual suite jobs failed and two dependent aggregate jobs failed. Sentry and project-erasure jobs succeeded. Each failed actual job archive was fetched once; sanitized actual logs and receipts are included.

Owner-ui job 134423302538 timed out waiting for Enabled after adding a suppression policy. A controlled experiment held an assignment-triggered panel read at its last reference request. The policy save appeared and the public API retained one policy; releasing the older read hid the policy. A local policy revision fence now rejects reads begun before or during a policy write. The same controlled experiment passes, and the full owner journey includes this ordering at 1440. The existing phone journey remains intact. No assertion was relaxed.

Runtime job 134423302427 failed on POST /api/restore, ordinal 692, with UND_ERR_SOCKET and no recorded Worker exception or D1/SQLite error. The unfixed transport passed one complete local run, so the closure is intermittent and its mechanism is not proven. Restore tests now create a fresh public HTTP connection for each write, retain the original body/confirmation/status/response, and never replay a POST. A real server fixture proves fresh sockets, unchanged 409 refusal, and exactly one dropped POST. The full merged product-runtime journey passed, including semantic refusals, independent restores, retention and browser capture.

## Local checks and browser proof

Contract write/check passed; main's whole ACCEPTANCE.md and docs/CLAIMS.md were restored and neither view was committed. Integration/agent generation passed. The source lock was regenerated last and checked. The ordered native export, first-party checks, source check, offline Base-copy verification, public rer build, integration check, agent-surface check and typecheck passed on the merged snapshot. Stock read-only inspectSource passed on the clean final commit, verifying committed release inputs and matching 0.7.14 versions; the repository has no validate:release script. No release was invoked.

The full owner journey passed 22 groups and 110 legacy journey captures. Final focused browser proof passed eight checks and produced 18 PNGs: Capture result, Issues rows, filters/status vocabulary, header/assignment, saved suppression policy, plain resolution, resolved sample, regression and invalid-key recovery, once each at 1440 and 390. PNG dimensions, distinct state/width pairs and hashes were independently verified. Keys, password fields, SDK snippets and DSNs are masked. The policy dialog is readable at both widths. Earlier proof-driver attempts missed the explicit Assign action/label; those were driver failures, retained separately.

A quiet local project-erasure run passed seven groups, eight captures and clean shutdown; the reported 409-versus-202 race was not reproduced. An earlier baseline probe stopped at dev readiness under concurrent load before reaching an erase assertion; it provides no erase-race qualification. Some earlier wrapper shells stopped while children survived; actual kernel wait statuses recovered exit zero for the known raw repetitions and build. process-recovery.json records PID/start/status evidence. Later drivers used separate sessions and cloud_run's subreaper.

## Counts and clause status

| Tier | Before done/partial/missing | After done/partial/missing | Total |
| --- | --- | --- | ---: |
| Core | 23 / 45 / 19 | 23 / 45 / 19 | 87 |
| Agent surface | 0 / 9 / 9 | 0 / 9 / 9 | 18 |
| Full target | 23 / 54 / 28 | 23 / 54 / 28 | 105 |

Clause status changes: none. CONTRACT.md, generated views and release metadata equal integrated main. The round retains D5, D6, D7, D9, D15, D16 and D22. Shared installer source/text is unchanged. No clause meaning changed, so no release entry is required.

## Custody, CI and evidence

The named product branch is pushed and its full advertised head verified. Initial replay history was linear; the terminal history contains one required updated-main merge. Final native release-source inspection and all completed local touched checks passed. Terminal Verify 44201588936 completed/failure on the exact final SHA, observed at 2026-11-18T00:11:42Z. READY is not claimed.

The previous failed exact-SHA Verify is https://github.com/just-every/run-spool/actions/runs/44191699045. Terminal run: https://github.com/just-every/run-spool/actions/runs/44201588936. Discovery and later status receipts are included. Product readiness and report-only publication are separate. Evidence is published only under refs/heads/evidence/sd-spool-design-issues-3, with the exact terminal evidence head returned separately.

provenance.json, product-receipt.json and commit-audit.json bind source, build, identities and custody. comparison-receipts.jsonl, checks.jsonl, process-recovery.json and actual logs retain local outcomes. browser-proof.json and browser-proof-validation.json bind the final framed PNGs. ci-calls.jsonl and CI receipts retain exact-SHA watcher evidence. Selected files exclude credentials, private setup output, environment dumps, held-out material and symlinks.

BLOCKED: successful exact-SHA Verify. The final run failed. All ten permitted GitHub calls are recorded and exhausted; failed-job details for 44201588936 were not fetched, so its failing job/assertion is unknown and unclassified. No flake rerun was attempted and no green result is inferred from local checks or another SHA. The lane must inspect that run before accepting or changing the candidate. The initial linear-history condition was superseded only for the later main integration required by the cloud preservation instruction; the report does not claim a merge-free final candidate.

The completed-local-check checkpoint was published as dbd42ee2126c56b9bd4a9821dc893b601e008f67. The prior 731ba0d checkpoint round-trip verified 150 files and their manifest hashes, binding product fdcbe49. The terminal publication will include the final CI observation; its exact head is returned in the final EVIDENCE line.

Terminal product custody: branch cloud/sd-spool-design-issues-3, head fdcbe49c5f65a04faf69ce08ceddb72568bc41af, advertised remote head verified. Product commits and actual evidence are preserved remotely. No pushes were rejected. Local qualification passed, but the candidate is BLOCKED by failed exact-SHA Verify 44201588936. The ephemeral product clone will be removed only after successful final evidence publication, as requested; the actual packet remains under the fleet work directory.
