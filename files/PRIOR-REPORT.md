# sd-spool-sdk027-4 report

Run Edit Run fleet (sd), 2026-11-16T22:59:33.529164+00:00.

Repository: just-every/run-spool. Branch: cloud/sd-spool-sdk027-4.
Fresh main: e29a9f44ad44315d65b4e12d7f2e69b739f67233.
Final product candidate: c5570fd9cdd52208ce39acbb41a46e19d666f043.
No PR was required or opened under this seed's fleet branch landing rules.

The admitted 150,000-event proof passed on the exact candidate in run
sd-spool-sdk027-4-erasure-20261116T223452Z: owner confirmation took 24.681905 client seconds and
7.185 receipt seconds, below the unchanged 300-second bar.
The public restore returned HTTP 200 for all 150,000 events. Retained events
remained 150000; matching identities went from
150000 to 0. See scale-receipt.json and
scale-journey.log for the actual run, counts, times and safe completion receipt.

The full plan is PLAN.md. This round first read the previous report pinned at
ad084acbc01efd8e604e3b20de1bf1f894c02805/files/REPORT.md, retained as
PRIOR-REPORT.md. It began at the landed e29a9f44ad44 main and did not redo its
batched erasure implementation or owner identity API.

The archive refusal was a deliberate product validator limit below the required
volume, not a harness artifact. Before this change src/domain/archive.ts:132
refused any project above 10,000 events with Archive event budget; native legacy
archive rows had a separate 10,000-row check at line 85. CONTRACT.md:453 and
455–460 require end-user erasure within 300 seconds in a 150,000-event project.
CONTRACT.md:1068 explicitly requires whole-project streaming archive/export/
restore at 150,000 or more, while 1073 and 1077 name the 160,000-event corpus
and empty-destination restored-count reconciliation. Those lines settle the
volume: the archive budget was wrong against the contract.

The implementation raises the archive event budget to 160,000 per project and
the legacy event-row allowance to that corpus. It preserves non-event legacy
row budgets, scalar/payload bounds, the 20-origin policy, schema/checksum,
aggregate, grouping, project references, identity hashes and erasure fences.
An early one-pass project tally rejects an over-budget archive before payload
hashing and identity validation. Identity validation uses a Set keyed by exact
project/event/occurrence instead of scanning every event for every identity;
its membership, duplicate, policy and HMAC checks are unchanged. This replaces
quadratic occurrence membership work with a linear index. There is no new
persistent identity store, schema or migration and no direct database planting.

The 160,000-event budget remains an explicit bounded implementation limit.
GOV-003 also requires no retained-event count limit and broader sustained intake,
streaming and plan behavior; this round does not complete that clause. Public
intake still has its existing 10,000-retained-event and minute budgets. The
archive change admits the contracted proof through restore without relaxing
those unrelated ingest guards.

Both committed scale modes start with a real synthetic public Sentry capture
and grow its valid checksummed JSONL archive, then use the actual HTTP restore,
owner identity query and issue-count doors. There is no smaller-volume fallback.
The erasure mode checks 150,000 matched, retained, tag and captured-text counts,
then confirms removal through the owner door. It asserts receipt completion,
150,000 removed identities/tags/captured-text records, unchanged retained event
and issue totals, unavailable affected-user identity, and zero matching identity
query rows/facets. It saves the exact checked-out SHA and run ID. Its actual
command was:

`RER_CANDIDATE_SHA=c5570fd9cdd52208ce39acbb41a46e19d666f043 RER_SCALE_RUN_ID=sd-spool-sdk027-4-erasure-20261116T223452Z cloud_run perl -e 'alarm 2400; exec @ARGV' -- node tests/end-user-erasure-volume.mjs`

The separate 160,000-event mode passed on the same candidate, run sd-spool-sdk027-4-archive-final-20261116T224251Z.
It restored 160000 events into an empty installation, reconciled
public issue and identity counts, and archived 160000 events and
160000 identities with matching issue totals. Restore stage,
including fixture construction, took 276.087 seconds;
archive request/download/projection took 357.314 seconds.
A valid checksummed 160001-event archive returned HTTP
400 with Archive event budget and left its separate
destination empty. See archive-volume-receipt.json and archive-volume.log.
Both modes ran outside push Verify under a 2,400-second hard alarm.

An earlier saved-head attempt on d58542fcb06d2578ba623b5741ecac7a1a5aca23
admitted 160,000 events in 282.302 seconds, then its GET /api/archive hit the
client's default five-minute response-header timeout (UND_ERR_HEADERS_TIMEOUT;
no HTTP response). That incomplete attempt is retained in archive-first-attempt.json
and archive-volume-save.log and is not presented as a completed archive proof.
The final harness gives its installed Undici transport the outer 2,400-second
deadline and restores/destroys that dispatcher in cleanup. It changes no
product limit and does not extend the 300-second erasure assertion.

A supplemental final-candidate archive attempt was interrupted when the execution
environment reattached and its process handle disappeared. It produced no
completion receipt and is not claimed as proof; archive-interruption.json and
archive-volume-interrupted.log retain the observation. The completed archive
receipt above is from the unchanged candidate's restarted run.

The final candidate's existing public browser journey passed. Its actual
browser-run.json and browser-receipt.json preserve the source SHA, command,
completion result, screenshot hashes and distinct restore results: old archives
return erasure_epoch in the same installation and in a fresh destination first
given the later archive; the later archive restores. The small old archive is
below either event budget, so this proof cannot be a capacity refusal. Owner
keyboard confirmation, anonymous/member/grant/foreign-origin refusal, safe
receipts/audit, populated raw/hash identity queries and erasure of supported
search/facet/text copies still pass. Assertions run at 1440, with matching,
unavailable, completion and erased-search screenshots at 1440 and 390. The
browser uses /usr/bin/chromium with --no-sandbox and closes its fixture contexts.

Touched verification passed: typecheck; final rer build; the public erasure
browser journey; the populated published/native legacy archive compatibility
journey; contract-docs check; regenerated source lock and source:check. No full
local verify or full suite was run. Sources.lock.json was regenerated last.
No existing assertion was removed, skipped or weakened. Root test scripts stay
131 before and after; no registration was added. The scale modes remain outside
push Verify. Checks and actual outputs are retained in the packet.

Optional ordinary owner search UI was not implemented: the required 12ui
workflow returned an account sign-in requirement unavailable in this task.
The exact skill read was
[12ui SKILL.md](skill://plugins_6a8915941e8c8191ae58d10e41cc322f/12ui-design/SKILL.md),
which requires an explicit design pick and says “Never work around the checkpoint
by approximating the design in CSS.” No credential was sought and no design
checkpoint was bypassed. The existing owner-only identity query API remains
available; ordinary user.* search UI remains a follow-up. The actual design
attempt log has its one-time sign-in code removed. Feedback contact matching
and feedback source files were left to the separate round.

SDK-027 remains a PARTIAL builder claim, now points 1,3,4,5. Point 2 still has
ordinary user-search UI, independent feedback, absent/uncorrelatable stores,
partial/grouping-sensitive/unsupported captured copies and derived snapshots as
gaps. No DONE claim or independent DONE gate is requested. CONTRACT.md status,
gap and evidence cells are untouched; SDK-027's source judgment remains missing.
Contract counts before = after: 23 done / 54 partial / 28 missing, 105 total.
Generated ACCEPTANCE.md and docs/CLAIMS.md are untouched and current.

DEFAULT SDK-027: Installation-owner-only destructive confirmation and focused identity reads; typed ERASE USER DATA, no outbound action, count-only preview and value-free safe audit.
GAP SDK-027: Ordinary user-search UI, independent feedback, absent/uncorrelatable stores and unsupported/partial/grouping-sensitive captured copies remain; GOV-003's broader volume and streaming target is not completed.

Verify 43971228356 completed failure on the exact candidate c5570fd9cdd52208ce39acbb41a46e19d666f043:
https://github.com/just-every/run-spool/actions/runs/43971228356.

The exact-SHA Verify is a real remaining blocker. Root jobs 133664472224
(verify owner-ui) and 133664472313 (verify sentry-cli) failed; shards (spool)
and verify then failed as coverage rollups. The first observed HTTP 409, then
read a null aria-describedby and timed out on #null at tests/operator-ui.mjs:74.
The second lost its socket during GET /api/projects/web/sentry-uploads in the
field-refusal snapshot at tests/sentry-cli/field-refusals.mjs:23/60
(UND_ERR_SOCKET, no HTTP response). The failing test files and operator
assignment UI are unchanged. These paths are outside the leased scale,
identity and erasure work. No root-cause fix, main reproduction or CI waiver
is claimed. The exact-SHA build, contract-docs and the other ordinary job results
are recorded in ci-jobs.json; local target proof does not replace full Verify.
Both failed-job archives were read once with the prescribed gh run view command,
and the sanitized actual logs and ci-failure-analysis.json are included.
Workflow environment sections, injected values and URL query/fragment data
were excluded. Nine explicit GitHub report/CI commands were used; no repeated
failed-job downloads or workflow reruns were made. Product custody is PUSHED
but BLOCKED for landing pending successful exact-SHA Verify, not READY.

CI discovery and observations are retained separately, with
at least 300 seconds between calls for that run. No green result is inferred
from another SHA; no dispatch, rerun, self-submission, release or deployment
was performed. No PR was required. Candidate commits use the fleet author and
committer, with no co-author trailers. Every candidate, including all parents,
was inspected before guarded pushes. The product diff and selected packet were
checked for injected values without printing them. No fleet evidence is on the
product branch. The full-history publication scan and guarded main landing /
Run site are Mac fleet gates, not claims made by this cloud.

The complete selected nonsecret packet is published separately through the
report-only evidence ref. Its manifest binds files and hashes to this product
head, without changing the product branch/head/index. Evidence publication is
transport, not acceptance, product readiness or landing. Product and evidence
custody are recorded in provenance.json and the terminal message.

CLAIM SDK-027 PARTIAL points=1,3,4,5 tests=tests/end-user-erasure-preview.mjs#endUserErasurePreviewFlow; tests/end-user-erasure-volume.mjs#SDK-027 volume
EVIDENCE SDK-027: Exact-SHA Verify 43971228356 FAILED (owner-ui and sentry-cli); scale run sd-spool-sdk027-4-erasure-20261116T223452Z admitted 150000 events and erased the selected user in 24.681905 seconds; same-head archive run sd-spool-sdk027-4-archive-final-20261116T224251Z; browser-run.json and eight 1440/390 screenshots.
