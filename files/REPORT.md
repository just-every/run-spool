# Spool stranger-35 defect round

Run Edit Run fleet, 16 November 2026. Tag: main-spool-stranger35-trips-1.
Repository: just-every/run-spool. Product branch: cloud/main-spool-stranger35-trips-1.

## Plan

1. Install fleet authentication and commit hygiene, read launcher and repository instructions, and create the named branch from current main.
2. Reproduce the four trips through the emitted application's public UI and HTTP doors before editing their causes. Leave any already repaired trip unchanged.
3. Correct only the stale capture categories, exposed routing label, and same-person status/assignment revision handling that reproduce. Preserve actual concurrent-write fences and provide recovery instructions for a genuine conflict. Source-map instructions change only if current main's prerequisite/alternate prepared-map route remains broken.
4. Extend the existing release/capture, alert-rule and triage journeys without adding registrations; assert behavior at 1440, retain the existing phone smoke, and collect changed screens at 1440 and 390 with secret fields masked.
5. Run touched journeys and typecheck only, merge fresh main after any published save, regenerate/check the source lock last, inspect every candidate identity/message and push through the supplied guard. Keep product work separate from this packet.
6. Discover and poll exact-SHA Verify with the ten-call budget and 300-second polling interval. Publish this actual report and receipts through the dedicated evidence ref, then relay the outcome to main.

## Initial findings

Current main already includes explicit customer Node/npm prerequisites on the source-map page and a reachable setup guide, dated 15 November. The installer's supported `rer run --script` executes a JavaScript file; it is not a general npm or arbitrary build launcher. Verify the current page before deciding that trip's disposition.

Current main's capture notice incorrectly says sessions are unsupported. Intake currently persists sessions and transaction timing summaries, text feedback and bounded client-discard counts; individual spans, full traces, replays, profiles, attachments, logs and metrics remain outside stored evidence. Releases already shows observed session health.

Current main renders `deploymentLabel(row.id)` as an extra member deadline label beside the owner's destination name. Member deployment selection remains privacy-preserving and separate.

Current main's status PATCH returns its new revision, but IssueView ignores it and waits for a packet refresh; assignment can use the old revision. Comment receipts already have a local revision bridge. Preserve that behavior while bridging status receipts too.

## Scope and judgments

No migration, release/version change, CONTRACT judgment, generated acceptance view, hosted deployment or new capability is planned. No DONE claim. Existing unrelated legacy prose stays intact; only current capture summary statements are reconciled.

## Results

- Trip 1 — not reproduced on main adc3de69b9ae0ff60e41897f8ff7662fd656d560: Releases explicitly requires the customer's build tools, links to a working Node/npm preparation section, and explains the prepared-map upload alternative. The existing first-project journey completes that prepared-map upload and verifies an original-source frame. No source-map product change.
- Trip 2 — reproduced in first-project setup and Capture; fixed with five category-specific support/limit rows and matching active capture documentation.
- Trip 3 — reproduced as “Member deadline label: Email route Pine CCA4E165” beside “Checkout on-call”; fixed by removing that owner-facing generated alias while retaining the chosen name and existing member privacy rules.
- Trip 4 — reproduced with status PATCH 200 followed by assignment PATCH 409 while only the packet read was delayed. Status receipts now advance the loaded issue revision. Real stale-writer assignment still returns 409 with instructions to reload, review and save, retaining the draft and preserving the other writer's assignment.

Typecheck and build passed. Alert UI and owner setup passed. Existing first-project journey passed at 1440, including prepared-map upload and mapped-frame verification, with masked 1440/390 captures. Triage passed completely: 22 groups and 102 retained captures at 1440/390. The extension proves immediate status-to-assignment saving and genuine concurrent-write refusal, draft preservation, unchanged other-writer assignment, and reload/save recovery.

Before/after: 4 reported defects → 3 reproduced/fixed and 1 already addressed on main; new registrations 0 → 0; migrations 102 → 102; generated clause counts unchanged (23 done, 54 partial, 28 missing). No clause Status, Gap or Evidence edits; no CLAIM line because this round does not independently qualify a whole numbered clause point.


## Implementation details

- `IssueView` now takes the committed revision from the successful status response into the same local revision bridge already used by comments. The global pending-write flag coordinates controls until that response arrives. No conflict retry or last-write-wins bypass was introduced.
- Only assignment passes screen-specific conflict guidance to the existing operator conflict mapper; grouping's preview guidance remains intact.
- `AlertDestinations` no longer renders its extra deployment alias row. Existing project-member deployment option privacy remains intact.
- The shared `SentryIntake` component supplies the same category limits in first-project setup, Capture and the other places already rendering it. Active summaries in capture and switching docs agree; unrelated historical prose remains intact.
- Existing journeys were extended, with no added registration: owner setup actually admits a session and sees it on Releases; alert rules check a newly entered destination name and absence of a generated alias; operator triage saves after a status receipt while packet reads are held, fences another writer, keeps the draft, and recovers after reload. First-project setup still completes prepared-map upload and verifies a mapped original frame.

The cloud environment cannot perform the fleet's complete publication scan. Only the candidate diff was checked locally for credential-shaped values; the fleet retains publication/landing responsibility. No provider or hosted acceptance is claimed.


## Product custody

Candidate `242e038e96e7c68a06d637f11ba7cb21a2e0fa26` was pushed on the first guard attempt to `cloud/main-spool-stranger35-trips-1`. The pre-push fetch/rebase found main unchanged at `adc3de69b9ae0ff60e41897f8ff7662fd656d560`. Every candidate identity and full message was checked: one fleet-authored/fleet-committed commit, no trailers. No PR was created or required by this repository’s instructions. Exact-SHA Verify run: `43833603260`, initially queued; final result will be recorded below.

Exact-candidate public-door replay passed on `242e038e96e7c68a06d637f11ba7cb21a2e0fa26`: a 200 status write followed immediately by a 200 assignment write while packet reads were held; the chosen destination name has no generated route alias. `post-fix.json` records the result. Masked issue screens are retained at 1440 and 390.

CI snapshot after three GitHub calls (discovery plus two status queries at five-minute intervals): Verify `43833603260` remains `in_progress` on the exact candidate. Evidence is preserved independently while the builder continues waiting. This is not a READY or landing claim.


## Final result

Verify run `43833603260` completed successfully on exact candidate `242e038e96e7c68a06d637f11ba7cb21a2e0fa26`: https://github.com/just-every/run-spool/actions/runs/43833603260. Five GitHub calls total, with one watcher and at least 300 seconds between queries. No rerun or additional product push was required.

All touched checks passed: typecheck, build, source-lock check, alert UI, owner setup, first-project setup with prepared-map/original-frame proof, and triage (22 groups, 102 retained captures). Exact-candidate status/assignment replay passed separately. The complete relevant browser proof selection is included in the evidence tree, with credentials masked. No full local rer verify was run.

Trips 2–4 are fixed. Trip 1 did not reproduce through current main's explicit customer build-tool prerequisite, reachable preparation guide and working prepared-map alternative, so that product screen was left unchanged. Reproduced defects: 3 → 0. Four trips dispositioned: 3 fixed, 1 already addressed. New test registrations: 0. Migrations remain 102. Generated clause counts remain 23 done / 54 partial / 28 missing; clause Status, Gap and Evidence changes: none. No CLAIM or DONE claim is made. No PR was created. No blocker remains in this builder's scope; the fleet still owns publication scanning and landing.

The product clone will be removed after the final evidence transfer and remote-ref confirmation. Actual report and receipt files remain under `$HOME/rer-consolidation/work/main-spool-stranger35-trips-1/packet/` and the dedicated evidence ref. The implementation and proof plan above is complete.

Run Edit Run fleet, 16 November 2026.
