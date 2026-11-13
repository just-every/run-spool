# Spool member hints: main-spool-member-hints-1

Repository: just-every/run-spool
Branch: cloud/main-spool-member-hints-1
Product head: 30cc17837e934cc821948e34a694ca2b5d0ec0c7
Integrated main: 8049c9153f1d987bba6211bc05b8405b06101a6f
PR: none; this seed uses the fleet branch landing contract.
Verify: https://github.com/just-every/run-spool/actions/runs/43426549866
Exact-SHA CI status: completed / success

## Scope and result

C-1 and C-3 are implemented. C-2 and the invitee sign-in path were left to their assigned round. Ownership-transfer authorization, step-up enforcement, token construction and invitation acceptance were not changed. No CONTRACT.md, ACCEPTANCE.md or docs/CLAIMS.md bytes changed. No DONE claim or clause judgment was made.

The organization access response now describes whether authenticated local dev access confirms a transfer. The Verify panel, its status notice and the member transfer dialog explain local confirmation only for that session. Native sessions keep the existing no-email guidance and still receive step_up_required without native fresh proof.

An owner viewing a pending local invitation without an available saved link sees the existing recovery path: Manage access → Remove member, then invite the address again. A duplicate pending-invitation response remains 409 and names that same path. Accepted-member duplicate handling remains as before. The hint also gives a valid recovery for an expired or otherwise unavailable retained link without asserting a historical cause.

## Reproduction and browser proof

Both findings reproduced on current main through a real rer dev instance after public rer setup. The logged-in session was dev. The original Verify guidance said email confirmation could not be completed; a real accepted successor transfer returned 200 with transferred=true. A synthetic pending invitation created through the public API, with only its optional retained-link row removed to model an upgrade, displayed no recovery hint and returned 409 with the bare Member already invited error. The exact native token was accepted through the ordinary confirmation screen after local access; no acceptance code was modified.

The after receipts show local-access guidance, the missing-link row guidance, and the helpful duplicate 409. Members screenshots at 1440 and 390 mask every retained invitation input. The changed member transfer dialog is also captured at 1440 and 390 on the exact committed head. The native local-mail journey captures the original native guidance at both widths with its invitation input masked. Screenshot files are evidence-only, outside the product tree.

The full plan is PLAN.md. Browser observations are before-browser-receipt.json and after-browser-receipt.json. Product custody is product-provenance.json and product-push.txt. Local check results are CHECKS.json and the individual actual logs. GitHub call timestamps and exact-SHA observations are github-calls.jsonl, ci-discovery.jsonl and ci-polls.jsonl.

## Validation and limits

Passed: public setup, rer build, pnpm typecheck, the existing dev-credentials script, the extended localMailFlow public browser/API journey, the complete existing teamFlow journey, source lock generation, pnpm source:check and git diff --check. The journey asserts the missing-link recovery and helpful 409 by behavior, removes the old invitation through the real dialog, re-invites successfully, copies the newly retained native link, accepts it exactly once, and retains expiry, role, native proof and archive exclusion assertions. Dev credential tests distinguish gated dev access from native access. Test code adds no registrations or script entrypoints to the product.

Before/after targeted copy defects: 2 → 0. New test registrations: 0 → 0. Contract status counts: done 23 → 23, partial 54 → 54, missing 28 → 28; TEAM-001 remains done in the source contract. These copy follow-ups do not establish new hosted, provider or commercial acceptance.

The source lock was regenerated last after fetching and rebasing against unchanged main. Only the five touched source/test hashes changed. The candidate has one fleet-authored and fleet-committed product commit, no trailers and no skip marker; complete candidate messages and all reachable side parents were audited before the guarded push. The product remote advertises this exact head. Main was not pushed. The cloud cannot run the Mac publication scan; the fleet lander still owns publication, exact-main verification and landing.

## Claims and remaining scope

CLAIM TEAM-001 PARTIAL points=1,2,3 tests=tests/team-flow.mjs#teamFlow; tests/team-browser.mjs#localMailFlow

The claim cites the existing full TEAM-001 regression journey, including invitations and disjoint grants, concurrent triage and revocation, plus the extended local recovery test. It makes no new DONE claim and does not change the existing TEAM-001 judgment. Full independent gates remain authoritative.

Local harness notes: a broader existing teamFlow attempt reached a legacy direct Chromium launch that ignores the repository browser helper and therefore looked for an uninstalled Playwright binary. The actual launch failure is retained in team-flow-launch-failure.log. Its rerun uses the task-required /usr/bin/chromium and --no-sandbox for all launch sites through an external runner, without a product edit. The real ownership-transfer reproduction also changes the local owner; restarting its disposable fixture required aligning the ignored OWNER_EMAIL setting with that successor. No fixture setting or secret is in the packet or product commit.

No product blocker identified. Final readiness depends on the exact-SHA Verify observation reported above. Evidence transport is separate from product readiness and landing.
