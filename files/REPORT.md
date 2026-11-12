# Plain release and delivery labels replay

Repository: just-every/run-spool
Branch: cloud/main-spool-plain-delivery-labels-1-r1-c3
Task: main-spool-plain-delivery-labels-1-r1-c3

## Plan

1. Configure fleet author/committer identity, decrypted-bundle Git authentication and commit hooks; read launcher and product instructions.
2. Start at current origin/main; squash the c2 label round without retaining its ancestry. Resolve conflicts by keeping current main's readable issue/actor references and snooze targets/periods, adding only c2's presentation changes. Preserve all current main test assertions and extend existing journeys, adding no registration.
3. Keep CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md byte-identical to origin/main; regenerate the source lock after all source/test changes, then run its check.
4. Install/setup/build with the cloud toolchain; run alerts-ui, the release identity flow through its existing public Worker fixture, and typecheck. Capture affected screens at 1440 and 390. Inspect the diff for repository fixtures and credential-shaped values.
5. Refresh main before the single final commit; ensure one commit over main, no merge commit, clean fleet identity/messages and no skip-CI marker. Push only the named cloud branch through the fleet push guard.
6. Discover and poll exact-SHA Verify through REST within the ten-call budget and 300-second cadence; publish actual report/receipt/screens separately to the evidence branch. Delete the product clone after successful custody and evidence publication.

## Boundaries

Presentation labels only. No delivery behavior, provider, release identity, grouping or contract judgment changes. No DONE claim. Full publication scan belongs to the fleet lander under this cloud assignment.

## Initial state

Current main: 461eb0f58adf9456aef587866dd013d628c38b9f.
Replay source: d92a108f47dcb3b59d2b8b085e4720ed1077830c.
The supplied red merge is reference only; none of its ancestry is added.

## Results

Product head: dc513779d58445111c87540416d80bd8b85ddc14. Exactly one commit over current main; no merge commit. Product branch pushed successfully on its first attempt. No PR was created: this branch is for the fleet lander.

All touched checks passed: setup (after resolving conflicts), build, alerts-ui, releaseIdentityFlow using the existing Worker/sign-in/public HTTP fixture, typecheck, contract-docs check, source-lock regeneration and source check. The original blocked-save assertion passed unchanged. No full local suite was run; exact-SHA branch Verify is the full gate.

Before/after static assertion call counts: alerts-ui 26 → 32; release-identity-flow 228 → 238. Every original assertion's source text survives unchanged. Added registrations: 0. The source summary stays 23 done, 54 partial, 28 missing, 105 total. Clause status changes: none. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are byte-identical to origin/main.

Conflict resolution retains main's issue/actor references, snooze rule names, timezone periods and readable resumption body. It adds c2's mailStatus formatter and explicit “No email sent.” text, removes the numeric false-child leak in delivery rows, and formats absent release/build identity at every UI location c2 changed. No domain delivery or identity semantics changed.

The whole diff was inspected for GitHub URLs and bare repository strings. Its sole GitHub URL is https://github.com/just-every/run-spool, confirmed publicly accessible with anonymous HTTP 200. Other owner/name-shaped quoted strings were reviewed as local paths or a MIME type. Credential-shaped diff checks passed. The fleet lander owns the full publication scan; it was not run in this cloud.

Browser proof: 40 actual screenshots at 1440 and 390 include the absent-release filter and issue facts, observed deployment labels, absent-build release/deployment history, delivery log, resumption and digest history. Assertions of this round run at 1440; the inherited journeys also retain their existing mobile checks. No assertion was removed, skipped or loosened. Generated tracked images were copied into the packet and restored in the product checkout; no proof files entered the product commit.

The local toolchain used Node 24.19.0 with pnpm 10.12.4, as permitted by the supplied cloud shim's minimum-Node behavior. CI uses its existing Node 22.20.0 pin. The first setup attempt built while squash conflict markers still existed; the resolved retry and explicit final build passed.

Exact-SHA Verify: run 43250182362 was discovered in progress on dc513779d58445111c87540416d80bd8b85ddc14 at 2026-11-12T15:45:25Z. One mistaken abbreviated-SHA discovery returned no runs and is counted against the API budget; no result was inferred from it. The single watcher polls the actual run no more than once every 300 seconds. https://github.com/just-every/run-spool/actions/runs/43250182362

CLAIM SDK-009 PARTIAL points=3 tests=tests/release-identity-flow.mjs#releaseIdentityFlow
CLAIM ALERT-003 PARTIAL points=none tests=tests/alerts-ui.mjs#destination tests, delivery states, timezone digests and snoozing
GAP SDK-009: This presentation round does not qualify all SDK runtimes or the clause's other acceptance points.
GAP ALERT-003: Local suppressed email and network-edge fixtures do not establish real provider delivery, all channels, or team digests/snoozes.

No current product blocker. Evidence publication, CI conclusion and clone cleanup are recorded below when complete.


## Final CI and custody

Exact-SHA Verify run 43250182362 completed successfully on dc513779d58445111c87540416d80bd8b85ddc14. 6 GitHub calls were used, including the mistaken initial discovery. This builder requested no workflow rerun and made no product correction commit.

Product custody: named cloud branch pushed successfully, one commit over main, no merge, no force-push and no main write. CI URL: https://github.com/just-every/run-spool/actions/runs/43250182362.

Evidence is published independently to refs/heads/evidence/main-spool-plain-delivery-labels-1-r1-c3. This does not land the product or waive the fleet publication scan. The product clone will be deleted after evidence transfer verification. Blockers: none.
