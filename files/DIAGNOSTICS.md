# Resolved local check findings

Author: Run Edit Run fleet (sd), 2026-11-17 UTC.

- The first broader triage run reported `stale-offline-issue overflow` at 390. The new assignment form was sharing a narrow flex row with Status. The phone layout now stacks those controls and allows the picker to shrink; the final focused journey checks issue/list overflow at both widths, and the triage run is repeated.
- The release identity browser journey initially could not reach the Release selector inside collapsed Filters. Its existing filtering assertion now opens Filters first. Its named-resolution step explicitly reopens the resolved issue before choosing Resolve, retaining the original state transition and boundary assertions. The corrected release journey passed.
- The new resolved-sample triage probe initially navigated with a full page load, which correctly discarded its memory-only key. The probe now pastes its test key into the provided field before sending, as an owner must do after a reload. No credential persistence was added.
- Typecheck caught cleanup of a still-used `Field` import in OperatorPanel during implementation; the import was restored, and typecheck passed.
- 12ui improve could not run its hosted generation because it required an unavailable account connection. The supplied UX decisions, current Spool theme and actual browser proof are the design basis; no generated 12ui result is claimed.

- The first attempt to tie a result to its new alert compared the alert's application timestamp with the event's database timestamp, which are independent clocks. The focused setup journey refused the unsupported "New alert raised" result. Results now match the persisted alert's `trigger.event` to the SDK's returned event ID, falling back to a plain received result if no such alert is available.

- The stale/offline journey captured its comparison URL before the asynchronous event selection had appeared in the address. It now waits for both selected-event parameters before taking the baseline; the exact URL-preservation, unsent-draft and nonmutation assertions remain.

- Final screenshots exposed the legacy navigation "unseen" badge after row-level viewing words had been moved to Details. A separate published commit removes the navigation badge as well, preserving the browser-local viewing facts and Details count.
- A fast press of the new primary Comment button could precede the discussion read, leaving no editor to focus. The action now retains a one-time focus request until the authorized editor mounts. The existing team journey holds the real discussion GET, presses Comment while loading, releases the request and asserts actual editor focus before posting.

- Compatibility review found that resolving member aliases to names while building a durable grouping explanation would freeze account names into historical snapshots and could exceed the existing 80-character responsibility-label bound. Grouping snapshots retain the original bounded alias field; their owner presentation describes an alias as Member assignment. Header/list/Activity still resolve current assignee names on authorized reads, without copying account identity into that snapshot.

- Verify 44130811317 passed the full triage journey, then owner setup failed: its replacement-key event still used the obsolete spool-setup/browser-test tuple, rejected as unregistered (422). The fixture now reads release/build from the browser-captured sample. The public owner-setup flow passed locally with the replacement-key, revoked-key refusal, archive and mapped-role assertions intact. The replacement SHA cannot be qualified here because the ten-call API budget is exhausted.
