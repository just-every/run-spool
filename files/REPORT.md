# sd-spool-import-sentry-3 report

Run Edit Run fleet, 17 November 2026 (UTC).

Repository: just-every/run-spool. Product branch: cloud/sd-spool-import-sentry-3.
Candidate: `f30b750c3355ed4acaa20f950ef0c6e7c36ef1c4`. No PR created; the repository has a branch-push Verify.
Only this declared repository was cloned or written. The complete plan is in
PLAN.md; actual behavioral and check receipts are ROSTER-RECEIPT.json,
CHECKS.json and CI-RECEIPT.json. The evidence ref is report custody only.

## Result

The existing Sentry import door accepts documented organization members,
teams, team-member responses and project ownership objects. Cursor validation,
whole-source identity, fingerprint review, durable apply/retry, reconciliation,
private originals, native provenance and guarded undo are reused.

The 17-record synthetic bundle produces two imported projects and nine pending
reviews: six members, two teams and one ownership proposal. One unknown source
role is rejected. Native member count stays **1 → 1** (the existing owner),
native invitations/grants/team bindings and mail stay unchanged by import, and
pending reviews go **0 → 9**. The exact source has 11 mapped effects; reconciliation
verifies 11 native targets, with all 17 records explained by retained source or
named omissions. This is intentionally not a lossless full-organization claim.
The raw export bytes stay in private import custody; no real account is used.

Source active/pending/expired users stay pending review. Owner maps to a proposed
admin; admin, billing and member map to native roles without importing owner
claim, sessions, verification, SSO or 2FA trust. Team/project scopes are explicit.
Unknown roles are rejected, and omitted fields are named in the plan and
`docs/SENTRY-ROSTER-IMPORT.md`. A separate owner invitation action binds selected
project scopes and calls the native invitation path. Its source review is fenced
before mail can be attempted. Acceptance in another browser gives only the
selected native project; native removal revokes that session. Source undo
cannot revoke this later native authorization.

Ownership preserves raw text, schema, matcher/owner IDs and source timestamps.
The owner-only preview shows deterministic first-source-match **proposal** order,
overlap, unmatched, unsupported schema/matchers and unresolved source owners.
Owner resolution is restricted to the same source organization's imported roster.
The proposals remain disabled. A timestamp is not a linked repository revision.
There is no CODEOWNERS fetch, provider consent, auto-sync, assignee notification
or live enable claim.

Review records restore pending and participate in project erasure. Shared
personal review records are withdrawn whole. Safe audit carries action/time/
outcome and random aliases through native archives; source email, ownership raw
text and sample paths do not enter permanent audit. Owner erasure retains a
shared-custody hold; restored owner-roster ambiguity may hold first. Short-ID
reservations remain after an otherwise exact native undo, as the existing native
policy requires.

## Validation and limits

The new public-door flow passes on the exact candidate SHA. It covers no-write
preview, native role/scope mapping, source-role rejection, exact re-import,
resumable apply, unchanged undo, later-native-authority protection, native
invitation/removal, ownership precedence/overlap/unmatched, refusal, inert
archive restore, portable safe audit and project custody erasure.
The Members disclosure, member review and ownership review are captured at
1440 and 390. Assertions use 1440; the 390 captures also check reflow for the
ownership screen. All six PNGs contain synthetic fixture data only.

The existing Sentry journey and the native team/browser and operator flows
pass. Typecheck, build, integration consistency, contract-doc check and source
lock check pass. The broader project-erasure CLI journey passed: seven assertion groups and
eight browser captures, including same-installation and fresh-destination
restore fences. CHECKS.json records the actual result. The initial local
420-second deadline was too short and is retained honestly in the receipt.
No full local verify or unrelated test suite was run.

The initial source schema migration required regenerating the existing deployment
integration spec; no deployment/project/edition/package identity was renamed.
Supporting archive, audit and owner-erasure glue outside the narrow file list
was necessary to keep the requested D-1/D-6 guarantees. No native role model,
owner trust, real mail/provider integration or repository consent was changed.
The 12ui hosted design tool required an unavailable account connection; the small
settings extension uses the existing native Members/Details patterns. No design
service output or account proof is fabricated.

## Contract custody

No clause acceptance point, Status, Gap or Evidence cell changed. Generated
ACCEPTANCE.md and docs/CLAIMS.md remain untouched. Summary counts remain
23 done / 54 partial / 28 missing / 105 total. TEAM-001 and ERASE-001 retain their
existing done judgment; MIG-001, TEAM-002 and AUDIT-001 retain partial. The claims
below describe this round's proof and do not demote existing judgments.

CLAIM MIG-001 PARTIAL points=2,7 tests=tests/sentry-import/roster-ownership.mjs#rosterOwnershipFlow
CLAIM TEAM-001 PARTIAL points=1,3 tests=tests/team-flow.mjs#teamFlow; tests/sentry-import/roster-ownership.mjs#rosterOwnershipFlow
CLAIM TEAM-002 PARTIAL points=none tests=tests/sentry-import/roster-ownership.mjs#rosterOwnershipFlow
CLAIM AUDIT-001 PARTIAL points=1,2 tests=tests/sentry-import/roster-ownership.mjs#rosterOwnershipFlow
CLAIM ERASE-001 PARTIAL points=1,2 tests=tests/sentry-import/roster-ownership.mjs#rosterOwnershipFlow
DEFAULT MIG-001: Source roles/scopes are pending review; import grants no access, sends no mail and imports no identity trust.
DEFAULT TEAM-001: Only the installation owner separately authorizes imported native invitations; native acceptance and revocation remain authoritative.
DEFAULT TEAM-002: First-source-match proposal precedence is explicit; rules remain disabled and unsupported matchers/owners stay unresolved.
DEFAULT ERASE-001: Withdraw shared personal source reviews whole; owner self-erasure holds on retained shared custody or ambiguous attribution.
GAP MIG-001: Entries 1-2 and local synthetic native fixtures only; no real buyer export/account, real email, full named-collection migration, production dual run or cutover.
GAP TEAM-002: No real repository account, exact linked CODEOWNERS revision, accountable native assignee/destination or due/unowned notification proof; disabled proposals do not complete TEAM-002.
GAP AUDIT-001: This round qualifies its new actions through local public doors, not every existing product action.
GAP ERASE-001: Selective owner erasure of shared import custody remains held; downloaded copies/provider backups are outside the installation fence.
EVIDENCE: ROSTER-RECEIPT.json, CHECKS.json, CI-RECEIPT.json and six synthetic browser PNGs; full publication scan remains the fleet lander's existing gate.

## CI feedback and corrected candidate

The first exact-SHA Verify (44081913572 on 427828960f1389e15f28b0b55a2a8c7ed2b86e80) failed three leaf jobs: runtime/old-archive, tunnel/multilingual restore, and repair-recovery/archive. CI-JOBS.json and the three sanitized job logs retain the actual failure diagnostics; environment sections and URL queries are omitted. They were each read once with gh run view --job --log-failed.

The correction recognizes the exact pre-roster provenance discriminator and excludes only the declared absent store/objects when comparing earlier inventories. It also retains tableless compatibility rules when current archives carry roster custody without a ledger. Prior-release fixtures now model the new table's absence and the old discriminator explicitly. No foreign-schema or binding assertion was removed. The old-archive and multilingual suites pass locally after the fix; repair-recovery passed locally (six groups and 16 captures). The revised candidate and its exact roster/browser proof are pushed; its new Verify completed with failure, as recorded below. No green CI or READY is claimed from the earlier SHA.

## Terminal outcome

BLOCKED: exact-SHA Verify 44086779185 completed with failure on f30b750c3355ed4acaa20f950ef0c6e7c36ef1c4. The ten-call GitHub budget is exhausted (five first-run status/discovery reads, one failed-job listing, three one-time failed-job log reads, and the revised exact-SHA discovery). The latest failed-job diagnostics were NOT READ. The latest failure is not attributed to a guessed cause or treated as green. Fleet follow-up must inspect this exact run and obtain a successful exact-SHA Verify before landing.

All targeted local checks now pass, including the old-archive, multilingual, complete repair-recovery and exact revised roster/ownership flows. REGRESSION-RECEIPT.json has actual completion output. The original CI failures are retained in CI-JOBS.json and three sanitized logs. No test guarding existing behavior was removed; the earlier-schema test changes declare only the added store/discriminator and preserve the unknown-object, occupied-target and binding assertions.

Product commits are safely pushed on the named branch. No main/default branch, PR, release or deployment was written. Contract statuses remain unchanged. No READY or landing claim is made.
