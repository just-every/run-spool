# sd-spool-sdk027-6 report

Run Edit Run fleet (sd), 17 November 2026 UTC.

Repository: just-every/run-spool.
Product branch: cloud/sd-spool-sdk027-6.
Product head: dce7b40c301abe897d3a6a393a11097f556ac0cb.
Prior candidate: c5570fd9cdd52208ce39acbb41a46e19d666f043.
Origin main at preparation: e29a9f44ad44315d65b4e12d7f2e69b739f67233.
No PR is required by this seed's fleet branch landing rules; none was created.

The full executed plan is PLAN.md. This round makes one ordinary documentation
commit on top of the prior candidate, retaining both sdk027-4 product commits.
The measured-results section in docs/OWNER-ERASURE.md and the one-line pointer
in docs/USER-IDENTITY.md are the only prose edits. sources.lock.json covers docs
and was regenerated last; its only changes are those two docs' hashes. Source,
tests, workflows, contract judgments and generated views are unchanged. There
are no merge commits in origin/main..HEAD. The supplied prior-report URL returned
404, so the committed journey and evidence/sd-spool-sdk027-4 at
fb84a1bf05cbc9debdaf764ee1c11119f7f84b7a supplied the facts; the docs link that
actual evidence tree. prior-evidence-provenance.json and the copied actual
prior-scale-receipt.json and prior-archive-volume-receipt.json preserve provenance.

The docs record the already measured 150,000-event erasure in 24.681905 client
seconds and 7.185 receipt seconds, below the unchanged 300-second bar. Exact
receipt completionMs is 24681.905490000034. Matching identities fell from
150000 to 0 while retained events stayed 150000. The separate same-head archive
mode passed with 160000 restored events and 160000 archived events and identities.
A 160001-event archive returned HTTP 400, Archive event budget, and left the
separate destination empty. These are prior-candidate results, not fresh timing
claims on this documentation-only head. The archive budget increased from
10000 to 160000 events per project in the prior implementation; archiveEventsPerProject,
validateArchiveRows' early tally and validateArchive's legacy event-row guard in
src/domain/archive.ts enforce it. Broader GOV-003 volume/streaming obligations
and SDK-027's other gaps remain open. The section includes both actual committed
journey commands under the unchanged 2400-second outer alarm; neither was rerun.

Local touched checks passed: pnpm install --frozen-lockfile; source lock
regeneration; pnpm source:check; pnpm typecheck; git diff --check; clean product
index and leased-file checks. Actual outputs and checks.json are retained. The
provided toolchain selected pnpm 10.12.4 and retained newer VM Node 24.19.0;
pnpm warned that package.json pins 22.20.0, and typecheck still passed. No setup,
build, browser session, full local Verify, new test or pin test was needed for
these documentation-only edits. The existing root test scripts stay 131 to 131.
Contract counts stay 23 done / 54 partial / 28 missing, 105 total. SDK-027's
source status stays missing; the builder claim stays PARTIAL points 1,3,4,5.
No Status, Gap or Evidence cell changed. No clause was promoted or demoted.

The fresh origin/main was fetched and remained the existing ancestor. An initial
rebase attempt before staging was refused because the docs changes were unstaged;
it rewrote nothing. The docs commit preserves the requested ancestry without
needing a replay. Every author, committer, trailer and message among the three
candidate commits was inspected, including all parents: all use Run Edit Run
fleet <fleet@runeditrun.com>, with no co-author trailers. The installed clone-local
fleet cleanup hooks preserved repository hooks. The product diff passed injected-
value and credential-shaped-value checks. The guarded product push succeeded on
attempt 1, with exactly one product push. No force push, main update, rerun,
self-submission, tag, release, deployment or unrelated repository clone occurred.
The exact-tree publication scan, main landing and Run site remain fleet Mac gates.

CI and terminal custody follow.
The discovery and first two status reads used three GitHub calls, all separated
by at least 300 seconds. Verify was queued at discovery and still in progress
on both status reads. No completed failure or success was inferred from them.

CLAIM SDK-027 PARTIAL points=1,3,4,5 tests=tests/end-user-erasure-preview.mjs#endUserErasurePreviewFlow; tests/end-user-erasure-volume.mjs#SDK-027 volume
DEFAULT SDK-027: Owner-only, typed confirmation, no outbound action, value-free audit.
GAP SDK-027: Ordinary search UI, independent feedback and unsupported captured copies remain.


Exact-SHA Verify 43986847706 completed failure:
https://github.com/just-every/run-spool/actions/runs/43986847706
It ran on dce7b40c301abe897d3a6a393a11097f556ac0cb. The owner-ui job
133717655420 and sentry-cli job 133717655368 both PASSED, so the earlier
owner-ui failure did not recur. Build 133717184316 and contract-docs
133717184330 also passed. This is not a generated-view check exception.

The root failing job was 133717655276, runtime (ruby). Its first failing step
was number 20, Run ruby SDK journey, invoking node tests/sdk-runtimes.mjs ruby.
The exact assertion was:

    AssertionError [ERR_ASSERTION]: ruby: Spool outcomes reconcile with SDK-sent items
    at file:///home/runner/work/run-spool/run-spool/tests/sdk-runtimes.mjs:41:10

The actual outcome list contained these entries absent from the expected list:

    [ 'client_discarded:error:network_error', 1 ],
    [ 'client_discarded:log_byte:network_error', 521 ],
    [ 'client_discarded:log_item:network_error', 1 ],
    [ 'client_discarded:monitor:network_error', 1 ],

The log ended with ERR_ASSERTION, operator deepStrictEqual, and Process
completed with exit code 1. The complete actual sanitized failed-step archive
is ci-ruby-failed.log; ci-failure-analysis.json includes the exact error section,
step timestamps and all failing job IDs. The coverage rollups then failed:
133725126067 shards (spool), step Require every job in this coverage partition;
and 133725153348 verify, step Require the selected coverage and its proof.
They are downstream failures, not additional product assertions. Their status
and steps are preserved in ci-jobs.json. Other ordinary jobs passed.

The single Ruby log archive command succeeded:
gh run view 43986847706 --repo just-every/run-spool --job 133717655276 --log-failed
It was invoked once; no direct job-log blob redirects or blocked downloads were
attempted. Injected values, token patterns, URL queries/fragments and environment
sections were removed without printing them. Seven explicit GitHub commands
were used: one discovery, four status reads at least 301 seconds apart, one
post-completion jobs read and one failed-job archive. No rerun or dispatch was
made. No local reproduction, root-cause diagnosis or CI waiver is claimed for
this newly observed Ruby assertion failure. Code/test edits are outside the
brief and were not made. The exact-SHA Verify is red, so the candidate is
BLOCKED despite all touched local checks passing.

CI-only blocker: runtime (ruby) job 133717655276, Run ruby SDK journey,
outcome reconciliation at tests/sdk-runtimes.mjs:41:10. Successful exact-SHA
Verify remains required. Product custody is PUSHED, not READY or landed.

The complete selected report packet is published through the separate evidence
ref. Evidence transport does not change product refs/head/index and is not a
readiness or landing signal. The actual product receipt is
terminal-product-receipt.json. The product clone is retained until the evidence
publication and remote ref verification succeed, then deleted as instructed;
the packet and transport receipt remain outside that clone.

BLOCKED branch=cloud/sd-spool-sdk027-6 head=dce7b40c301abe897d3a6a393a11097f556ac0cb prerequisite="Successful exact-SHA Verify"
