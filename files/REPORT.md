# Spool local invitation scope

Repository: just-every/run-spool
Tag: main-spool-local-invite-truth-1
Branch: cloud/main-spool-local-invite-truth-1
Candidate: 9fd605e63a7f93fde47f5c91380b79a31d51f41b
Base/reproduced main: 0f9809608a4ba84b23f4f8ece165605fcdd1acba
PR: none; this repository supplies branch-push Verify and fleet landing.

## Result

Local invitees now open their own existing single-use, expiring invitation directly, without opening the owner's RER_OPEN link. Native confirmation creates a dev member session that works only in the local entry, with the member's current organization/project permissions. It never installs the owner gate. Removal refuses that session on the next request and the resulting sign-in page offers no owner shortcut. A browser deliberately given the owner's gate still offers Continue as owner and explicitly explains its owner authority and access to every project.

The hosted entry registers no member admission callback. Hosted sign-in presentation and native token/session policy are unchanged; the integration test verifies that the deployed entry still rejects dev invitations and dev member sessions even when supplied the dev key.

## Reproduction before edits

Ran fleet setup and the public rer setup/dev doors on current main. In separate Playwright contexts, a dev owner created a read-only invitation through the native organization API. Opening that invitation without the gate produced no confirmation control and its POST returned 400. Following the documented owner-gate-first handoff allowed acceptance. After removal, the member's project document redirected to sign-in, which offered Continue as owner. Clicking it returned an owner session and project evidence HTTP 200. The actual non-secret receipt is reproduction.json.

Before → after for an invitee browser that has never opened the owner gate:

- Invitation acceptance without owner gate: HTTP 400 → HTTP 303.
- Owner gate cookies delivered by member invitation: 0 → 0 (the former instructions had explicitly delivered that separate gate first).
- Owner shortcuts after removal: 1 after the formerly documented handoff → 0 on the corrected member-only path.
- Member project read after removal: refused (401), preserved; owner escalation no longer offered on the member-only path.
- Hosted dev token/session admission: refused → refused.
- Touched test script registrations: 2 → 2; no registrations added, removed or skipped.
- Generated Full target counts: 23 Done / 54 Partial / 28 Missing / 105 total → unchanged. No clause Status, Gap or Evidence edits and no DONE claim.

## Implementation

- Pinned Base operator-auth files are unchanged from main. src/auth/local-identity.server.mjs is a product-owned adapter based on the existing local dev wrapper, preserving its persona/CLI routing and adding only Spool's membership policy. Its imports and admission registration are the adaptations; future Base dev-wrapper refreshes should keep those existing routes aligned.
- Before native confirmation reads the body, the local adapter reads its bounded clone and caches the native invitation's membership proof in a per-request WeakMap. No secret is added to a header or cookie. Native confirmation retains issuer, expiry, revocation, single-use and transaction checks.
- Local member session admission binds the presented session digest to an unrevoked, unexpired dev session, the current native identity version, an active non-owner member and that member's recorded source invitation. Authorization headers and one-click/owner-persona paths cannot use this member proof. The existing owner gate remains independent.
- Only src/server.dev.ts imports this adapter. The hosted entry registers no member callback.
- Local sign-in renders the owner shortcut only after the existing owner gate admits that request. Its explanation explicitly names owner authority.
- Valid local team-invitation previews explain direct member access. Settings invitation custody, README, docs/MEMBERS.md and AGENTS.md now describe the direct handoff and warn against sharing owner RER_OPEN.
- Spool currently suppresses local mail and exposes no outbox viewer (`/__dev/outbox` remains 404). Instructions explicitly say so and direct the owner to the existing pending invitation list. No new mailbox, credential store, RER_OPEN mechanism or rer package change was introduced.

## Validation

- cloud_run node tests/dev-credentials.mjs: exit 0, including the actual src/server.dev.ts and deployed entry over migrated D1. Existing script extended with independent token acceptance, no owner gate cookie, dev session kind, assigned read-only project, ungranted-project/write refusals, owner-persona/one-click/persona-list refusals, removal, no owner link in sign-in HTML, single-use refusal, explicit-owner-gate restoration, hosted token/session rejection and preserved admin invitation-link denial. Existing capture/build/agent credential and identity fences also passed.
- pnpm typecheck: exit 0 after final source and test edits.
- cloud_run npx -y @runeditrun/rer build: exit 0, including the production dev-layer exclusion check.
- Triage public journey: exit 0, 22 check groups and 101 JPG captures at its existing 1440/390 widths.
- Updated the existing triage journey to assert no anonymous owner offer, then explicitly open the owner gate before its retained owner setup assertion. Its hostile-return-destination helper now supplies the owner gate before checking the owner shortcut’s sanitized target. This preserves the existing authority and redirect assertions under the corrected sign-in behavior; no registration was added.
- node scripts/edition-authoring/cli.mjs lock and pnpm source:check: exit 0; regenerated after the new source was tracked, so the new member-admission module is included.
- node src/base/contract-docs.mjs check: exit 0. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md were untouched.
- pnpm run check -- --profile first-party: exit 0 after the correction. Offline Base-copy verification: exit 0; all pinned auth copies match main.
- git diff --check: passed. Worktree clean at candidate push.
- Browser proof through actual rer dev: independent owner and member contexts; no test session or token rows manufactured. Assertions at 1440. Changed screens captured once at 1440 and 390: Settings invitation list, invitation confirmation, removed-member sign-in and owner-gate sign-in. Private invitation input masked. browser-receipt.json and the eight PNGs record the results. Screenshots were regenerated through the corrected product-owned adapter before its commit; source bytes match the final candidate. One browser launch before dev readiness was discarded before invitation setup; the successful run began after /health returned 200.
- Exact-SHA Verify for the final candidate: run 43388345534, https://github.com/just-every/run-spool/actions/runs/43388345534. Discovery found queued. The final permitted REST observation at 2026-11-13T08:03:44.871796+00:00 was in_progress with no conclusion on the exact candidate SHA. The task’s ten-call GitHub budget is exhausted. Terminal custody is PUSHED; no green Verify or landing is claimed. Actual observations are recorded in ci-receipt.json.

## Custody and limitations

Fetched origin/main and rebased unpublished changes before the first push; fetched and merged current main before the corrective push, then regenerated the lock last. Main was unchanged from the reproduced base. Product identity and every candidate message/trailer were inspected before the one product push; author and committer are Run Edit Run fleet <fleet@runeditrun.com>, with no trailers. All three product pushes succeeded through the cloud guard on attempt 1. The first head cd4ef4f4ef4aab230b2512c054a36f76659fd427 failed Verify 43384908495, build job 131751065274, step Check source and portable contract: SC-05 rejected six edited pinned Base auth files. That cause was corrected in the second real commit by restoring all pinned bytes and moving the local policy into the product-owned adapter. No published history was rewritten. The exact failed log and first run receipts are retained. A subsequent review found the two existing anonymous-owner test assumptions described above; those were updated in a further real test commit. The intermediate head f41997d1b9eeb1cb3afd73d238761e9e1188a017 was last observed in_progress in Verify 43386492766, then superseded; it is not green evidence for the final candidate. The final first-party source check and offline Base-copy verification both pass locally. No main/default-branch push or force push occurred. No PR was required or opened. Product proof and report files are excluded from the product tree and published only on the dedicated evidence ref.

A browser that already received the owner's gate keeps that separate owner authority. This change prevents the documented member path from handing it out; it does not revoke previously shared owner gates or alter their reset lifecycle. Hosted provider delivery was not changed or newly qualified. Existing local session renewal after expiry remains outside this finding. The full publication scan and landing belong to the Mac fleet.

## Clause report

CLAIM TEAM-001 PARTIAL points=none tests=tests/dev-credentials.mjs#Spool dev credentials

This round proves local invitation/session scoping and removal without an owner shortcut. It does not independently claim the whole multi-person, key and linked-service acceptance points or change their judgments. The exact-SHA Verify exercises the existing complete team journeys separately.

DEFAULT TEAM-001: Use the existing native local invitation as scoped member admission; preserve the owner's separately held dev gate.
GAP TEAM-001: No new hosted-provider or complete team qualification is claimed by this local-only round.

The full executed plan is PLAN.md. The final test-only commit followed another main fetch/merge (main remained unchanged), then a fresh source lock and passing source/contract checks. No product blocker is known from local checks. The initial evidence publication e0e870921f3f5c28dc5f4fd48f341d4c5f0ff57a was fetched independently and its manifest and all 31 file hashes verified. Exact-SHA Verify remained in_progress at the final permitted poll; its actual observation is in ci-receipt.json. All ten GitHub calls were used: Uptime reference, first-head discovery/status/jobs/failed build log, intermediate-head discovery/status, final-head discovery and two final-head status reads.

Final handoff: PUSHED branch=cloud/main-spool-local-invite-truth-1 head=9fd605e63a7f93fde47f5c91380b79a31d51f41b. Verify 43388345534 remains in_progress. No local product or account blocker was identified. Fleet owns remaining CI observation, publication scan and landing. The task clone will be deleted after final evidence verification.
