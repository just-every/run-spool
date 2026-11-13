# Spool local invitation carry

Repository: just-every/run-spool
Branch: cloud/main-spool-local-invite-truth-1-c1
Terminal candidate: 81ffe485a2755d9bcc242ab4cff399bdd2e6bfd3
Base: 8049c9153f1d987bba6211bc05b8405b06101a6f
Carried source: 9fd605e63a7f93fde47f5c91380b79a31d51f41b against 0f9809608a4ba84b23f4f8ece165605fcdd1acba

## Scope and implementation

The original three-commit change is squashed onto current main. Local invitations use the invitee's single-use native confirmation and membership-bound session, without exchanging or receiving the owner's dev gate. The product-owned local adapter preserves Base's pinned persona and CLI behavior and admits only native invitation witnesses or current, active, invitation-bound member sessions. Member proof cannot admit bearer grants, owner personas or one-click account shortcuts. The hosted Worker never loads this adapter and continues to refuse dev sessions/grants.

The invitation preview, Members invitation panel (the local handoff; there is no outbox viewer), README, AGENTS and member guide explain direct invitee access and the owner's separate authority. The sign-in page offers owner continuation only after that browser explicitly opens the owner gate, with a warning that continuation gives owner access to every project. A browser that previously received the owner gate retains that separate authority; member-only proof requires a fresh browser.

Conflict resolution kept main's newer usage receipt labels in Members.tsx and reapplied only the invitation paragraph. sources.lock.json is regenerated rather than hand-resolved. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md are preserved from main. No hosted authentication change, rer change, clause judgment, proof file or screenshot is included in the product commit.

## Deployment-history comparison

The main build at the base SHA passed tests/deployment-history.mjs with REL-002 and REL-001, including restore. The candidate build passed the same test with both outcomes. The former socket closure during archive restore did not reproduce on either tree. No speculative deployment-history or server upload change was made.

## Local validation

- Main setup/build: passed.
- Main tests/deployment-history.mjs: passed, actual log retained.
- Candidate build: passed, including deployed-output boundary checks. rer used its pinned Node 22.20.0 for builds/setup; direct local test/typecheck shells used Node 24.19.0 under the supplied cloud toolchain. Branch CI declares Node 22.20.0.
- Candidate tests/deployment-history.mjs: passed.
- Candidate tests/dev-credentials.mjs: passed. Covers independent invite acceptance, scoped read-only/project denials, next-request removal, absence of owner shortcuts, explicit owner-gate authority, hosted refusal, single-use and admin link refusal.
- Candidate pnpm typecheck: passed.
- First-party check: passed.
- Contract document check: passed; no generated views changed.

Further results, candidate identity, source check, browser proof and exact-SHA CI are recorded below when complete.

## Counts and judgments

Recorded judgment counts before and after: 22 done, 50 partial, 26 missing (98 total). No clause status, Gap or Evidence changes. The Verify suite registry remains 21 suites; the final change extends three existing standalone journeys (dev-credentials, triage-journey and runtime), with triage-auth retaining its existing helper registration. No new test registration or cap raise.

CLAIM TEAM-001 PARTIAL points=none tests=tests/dev-credentials.mjs#PROBE TEAM-001 rer dev invitation
GAP TEAM-001: This round proves local slices of acceptance 1 and 3 (membership and removal), not complete disjoint multi-member, linked service, hosted identity or provider acceptance. Existing recorded judgments remain unchanged.
DEFAULT TEAM-001: Keep the existing owner gate as separate owner authority; never distribute it to invitees and never change hosted sign-in.

Publication scan and guarded landing remain fleet-owned. Evidence publication is report custody only and does not signal product acceptance or landing.

## Final candidate and browser results

Candidate: 00ec1fdc1dc2e3f0e23ba5d36d2cd5698d436f95, one commit with sole parent 8049c9153f1d987bba6211bc05b8405b06101a6f. The final fetch found main unchanged, so no rebase or merge was needed. Fleet author/committer and empty trailers passed inspection. The guard pushed the named product branch on attempt 1. No PR is required by repository instructions; none was created.

Triage public journey passed: 22 groups, including triage-auth return-destination checks. Candidate source lock/check and contract check passed. All three contract documents are byte-identical to main; product-receipt.json records their SHA-256 hashes and ancestry.

Browser proof: four changed screens at 1440 and 390 (eight PNGs). Fresh invitee accepted directly without any owner gate, read only the granted project, and was refused after removal. No owner shortcut appeared in that browser. A fresh browser holding only the explicit owner gate showed the owner shortcut and explanation of access to every project. Members invitation inputs are masked; no access links, cookies or tokens appear in the screenshots. The authenticated-owner sign-in redirects to the app as expected; the final owner-screen proof uses a gate-only browser. The first premature dev start was refused while tests held the checkout, and was restarted only when they finished. The owned dev process and browsers were stopped.

Verify: run 43426580198 on the full candidate SHA. Initial REST discovery reported in progress. A single watcher observes at intervals of at least 300 seconds, within the ten-call budget. Final CI state will be appended after observation.

## Exact-SHA Verify correction

Initial Verify 43426580198 failed only in verify (runtime), Run suites; aggregate jobs failed as dependents. Importantly, deployment-history passed both REL-002 and REL-001 in CI under Node 22.20.0, including restore; the earlier socket failure did not recur. The actual failure was tests/runtime.mjs line 86, which expected anonymous sign-in to expose the owner shortcut, contradicting the requested fix. The earlier deployment-history failure had prevented this assertion from being reached in the original round.

The existing runtime journey now asserts no owner shortcut anonymously and retains the positive owner-entry assertion with the explicit owner gate. No registration was added, skipped or removed; the original positive authority check remains. The complete runtime journey passed locally under pinned Node 22.20.0. Source lock/check and contract check passed again. No application or documentation bytes changed in this correction, so the earlier deployment comparison and eight browser captures apply unchanged.

The brief explicitly permits one further real commit after a touched CI step fails. Because 00ec1fd was already published and published history must not be rewritten, the final branch has two commits: the original three-commit source change squashed as 00ec1fd, plus corrective test commit 81ffe485a2755d9bcc242ab4cff399bdd2e6bfd3. There is no merge commit. Main remains 8049c915, and all three contract files remain byte-identical to it.

Seven GitHub calls were used through failure classification and its one failed-job archive read. The final exact-SHA watcher discovers at ten minutes, then uses the two remaining observations at the permitted five-minute intervals. A single watcher runs at any time. Final status is recorded in ci-final-watch.json.

## Terminal result

Final Verify 43429671352 completed/success on exact SHA 81ffe485a2755d9bcc242ab4cff399bdd2e6bfd3, observed by REST on call 10 of the ten-call budget. The corrected runtime assertion and full branch wall are green. Initial Verify 43426580198 remains a recorded failure on the superseded SHA. No workflow rerun, force push or main push was used.

Final branch: cloud/main-spool-local-invite-truth-1-c1
Final head: 81ffe485a2755d9bcc242ab4cff399bdd2e6bfd3
History: two commits, no merge, same base 8049c915. The first is the requested squash; the second is the explicitly permitted correction after the touched CI step failed.
PR: none.
Blockers: none.
Judgments: unchanged (22 done / 50 partial / 26 missing). No new test registration. Contract/view hashes and ancestry are in product-receipt.json.

All relevant actual reports, receipts and selected proof are published on the separate evidence ref. The product tree contains only the requested product/docs/test changes and regenerated source lock. The clone is deleted after successful evidence publication; packet files remain outside it. The fleet still owns publication scanning, acceptance, integration and landing; no main update or Run site claim is made here.
