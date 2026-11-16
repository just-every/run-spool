# sd-spool-sdk004-3 — SDK-004 GATE FIX 1

Signed: Run Edit Run fleet, 2026-11-16 (UTC).

Repository: just-every/run-spool
Product branch: cloud/sd-spool-sdk004-3
Product head: 0f6c5523e3b4974544a3f73883f9182295bee364
Required published starting head: c1920a0db12fa2684b415e4e2fae68e59d726d0b

## Result and scope

Implemented the brief's permitted option 2 for blocking item B. End-user erasure now truthfully discloses that consented feedback contact, screenshots and replies remain in the feedback inbox and are not matched or removed by the supplied identity. It tells the installation owner to withdraw the report from the feedback inbox to remove these details. It separately explains that deleting matching events deletes their exact attached feedback reports. Feedback is explicitly listed as unavailable for identity matching.

The same code-owned retained-scope exception feeds the preview, the unavailable-store list, the persisted ERASE-001 retained row, and the ordinary saved receipt. The submitted email is never interpolated into this wording. This changes disclosure, not erasure semantics. Contact matching remains a declared gap. The preferred implementation would require coordinated private-contact matching, counts and preview hashing, private-row concurrency fences, custody and erasure transaction changes. The current confirmation also depends on an event identity key, which a contact-only project need not have; the UI offers confirmation only when event matching is available. Matching mutable private_data safely therefore needs a broader selection/confirmation design and restore proof. This FIX round uses the explicit fallback rather than expanding selective erasure.

The crash-report modal paragraph now distinguishes its description-only path from the consented extension's private contact, screenshot review and replies. The obsolete parallel-erasure note now provides accurate removal instructions. The optional member-withdrawal-control follow-up was not changed; its misleading visible control remains a separate follow-up.

Own changes relative to the integrated starting feature are limited to src/domain/erasure/end-user.ts, docs/FEEDBACK.md, tests/feedback-flow.mjs and the regenerated sources.lock.json. No clause Status, Gap or Evidence cells changed. CONTRACT.md, ACCEPTANCE.md and docs/CLAIMS.md remain unchanged.

## History and custody

The original SDK-004 branch head and every ancestor are retained. Current main's SDK-027 search-tag erasure is integrated through a merge; both original c1920a0 and origin/main are ancestors of the candidate. This avoids rewriting published feature history while preserving the newer main implementation. An initial local rebase exploration was undone before any product publication; its temporary commits are not in the candidate. The final merge commit was made with explicit fleet author and committer environment variables and clone-local forwarding/cleanup hooks.

The fresh pre-push main fetch was already included. All candidate commits, including side parents, were inspected for author, committer, full message and trailers; every identity is Run Edit Run fleet <fleet@runeditrun.com>, with no co-author trailers. The candidate is a clean committed tree without a CI skip marker. Exactly one product push was made through cloud-push.py, and it succeeded on attempt 1. Only cloud/sd-spool-sdk004-3 was pushed as a product ref. No PR was created, and no default branch, release, tag, deployment or other repository was changed.

The fleet's publication scan, independent gate and landing remain on its Mac under the cloud instructions. That scan was not run here and is not claimed. Evidence publication is separate from product acceptance and custody.

## Validation and observed counts

All checks ran on the exact candidate tree. Typecheck, contract-docs check, source lock check and the build passed. sources.lock.json was regenerated after the final source edits and checked before commit. No generated contract views were committed.

The complete feedbackFlow entry point passed. It already invokes privateFeedbackFlow and feedbackMailFlow, so it covers consented contact, safe PNG metadata stripping, assigned-member review, private reply state and idempotency, mail-off, approved sender network fake, abuse refusal, archives, restore, withdrawal and exports. The added public-door assertions ingest one synthetic reporter identity and one consented linked feedback report, remove the event identity by email, and observe:

- Matching event identities: 1 before confirmation, 0 after removal.
- Feedback matching: unavailable, count null, with an explicit reason.
- The saved ordinary receipt repeats the preview limitation and contains no email.
- Private feedback report: 1 before removal, 1 after identity removal, removed by owner withdrawal.
- Its contact, screenshot and reply remain available after identity removal and in the next private archive until withdrawal, as disclosed.
- Receipt and audit omit the supplied identity. Withdrawal then removes contact, reply, description and screenshot from the private read doors and the storage-backed archive; replay is refused.

The existing endUserErasurePreviewFlow also passed on the merged implementation. It proves typed owner confirmation, counts and value-free receipts/audit, matching search-tag removal, other-project isolation, exact DID matching, event deletion and restore fences. The actual ERASURE-RECEIPTS.json records 4 removed event identities and 6 removed search-tag entries in the primary removal; the later deletion removes 1 matching event, 1 exact session identity and 1 attached feedback report. Older archives refuse with erasure_epoch, and the current archive restores. Keyboard, Axe, text-size and reflow checks pass. The changed preview and completed receipt were captured at both 1440 and 390; the proof shows the truthful feedback limitation in each. Screens were visually inspected.

An unnecessary direct privateFeedbackFlow invocation was started after the full feedback journey had already passed. It stalled during runtime startup, before assertions, and was terminated with only its own process group; the scratch directory was removed. Its actual shell exit was 247 and its diagnostic is retained as DUPLICATE-STARTUP.log. This aborted duplicate is not passing evidence and does not replace any failed product assertion. The normal full feedback entry point is the passing proof.

Before/after clause ledger counts: 23 done / 54 partial / 28 missing, unchanged. SDK-004 remains PARTIAL with points 2, 3 and 4 claimed. Blocking false-disclosure item: 1 before / repaired by the permitted fallback. No new test registration was added; an existing public journey was extended. No test was deleted, skipped or weakened.

## CI

Exact-head Verify status and run IDs are recorded in CI-REST.json and the terminal report. A single REST watcher is used, with at least 300 seconds between run discovery/status calls. No unrelated or older SHA is used as evidence. CI results will be appended below before evidence publication.

## Packet

PLAN.md contains the complete execution plan. CHECK-RECEIPT.json records exact commands and outcomes. ERASURE-RECEIPTS.json is the actual generated public-door receipt result. The packet also includes full completed check logs, commit identity/message and ancestry records, push receipt, exact-SHA CI REST records and the changed screens at desktop and phone widths. Only explicitly selected regular non-secret files are published to evidence/sd-spool-sdk004-3; no evidence enters the product branch.

CLAIM SDK-004 PARTIAL points=2,3,4 tests=tests/feedback-flow.mjs#feedbackFlow; tests/feedback-flow.mjs#privateFeedbackFlow; tests/feedback-flow.mjs#feedbackMailFlow
DEFAULT SDK-004: explicit consent, authorized team review, manual sending and audited actions.
GAP SDK-004: end-user widget/localization, unmodified attachment intake and selective-erasure integration remain incomplete.

## Final exact-SHA CI result and blocker

Verify 43950756529 completed **failure** on exact candidate 0f6c5523e3b4974544a3f73883f9182295bee364: https://github.com/just-every/run-spool/actions/runs/43950756529. Its sentry-cli job 133593240362 failed at 20:37:41 UTC with TypeError: fetch failed, caused by SocketError: other side closed (UND_ERR_SOCKET). The stack is tests/sentry-cli-compat.mjs:26 (api), tests/sentry-cli/debug-flow.mjs:62 (state), :70 (debugFlow). This is a local Worker connection closure on the state snapshot's /api/projects/web/sentry-uploads API read after its /api/archive projection, not a failed feedback or erasure assertion. The two files are unchanged relative to main and to the required starting feature head. This report does not assume the failure is harmless or claim the full Verify is green.

Every other substantive job passed, including build, contract-docs, all runtime jobs, sdk, runtime, owner-ui, both owner erasure/project erasure jobs, project-erasure-cap, repair-recovery, wizard, alerts, execution, tunnel and agent-handoff. The shard and final verify aggregate jobs then failed because sentry-cli failed. Their failed logs were also read once. Six REST discovery/status calls, one completed-job-list call and three gh run view --log-failed calls consumed the ten-call budget. The three log archive commands succeeded; no signed blob redirects were used and no archive retry occurred. Public copies omit the CI environment sections; the command outcomes and non-environment failure text are retained.

No workflow rerun, empty commit, force push or out-of-lease CLI fix was made. The permitted SDK-004 fallback is complete, locally proven and pushed, but terminal custody is BLOCKED pending Successful exact-SHA Verify. The lane needs a separately scoped repair of the archive/connection test path and a new genuine candidate/green Verify under its ordinary gates. No successful push or missing-work blocker remains. There is no unpushed product work.
