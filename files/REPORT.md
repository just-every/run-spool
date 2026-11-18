# Spool Sentry alert import replay

Builder report for `sd-spool-import-alerts-3`.

## Plan and replay

1. Confirm the previous round at `9d389f449317e4c449e4b8624b992c59239186cc` and branch from fresh Spool main, initially `b24f4426c3900816e10e066d0bf95d06e10901a6`.
2. Replay the four alert-import commits in order, including the destination-review product repair, as ordinary commits. Keep the newer setup, key and alert UI behavior from main.
3. Retain migration `0114_sentry_alert_proposals.sql`. Regenerate the deployment ledger and cover archives before and after 0114, including an installation that applied 0112 and 0113 before 0111.
4. Check the public import door, the owner approval receipt, waiting-state activation, undo, erasure and manual alert refusals. Record the receipt at desktop and phone widths. Regenerate contract views for checking, then use main's copies and regenerate the source lock.
5. Refresh main before publication and publish the product candidate once. Check the exact candidate's Verify and publish this packet on the evidence ref.

## Product behavior

Your Sentry alert rules were brought over as rules waiting for your approval; those that need data wait for their first event or session, and any rule whose Slack, PagerDuty or other destination Spool cannot reach is listed as needing a destination.

Approval creates native rules. An unsupported condition remains in the receipt, with its source path and a disabled rule. Member and team email actions bind to approved, native roster records. The import retains original trigger dates as history. The manual rule preview still enforces its existing data requirements, including after a destination test is reviewed. Main's triage journey waits for the assignment conflict alert before reading its text.

Migration 0114 widens the proposal kind while preserving existing roster rows. The deployment migration ledger includes 0110 through 0114 in numeric order. Archive restore identifies the known late-0111 ledger order and checks destination-owned migration history and the historical schema. The test harness splits each migration into SQLite statements so adding 0114 does not exceed the local D1 statement size limit.

## Contract and gaps

Recorded contract counts are unchanged. Full target is 23 done, 54 partial, 28 missing across 105 clauses. Core is 23 done, 45 partial, 19 missing across 87 clauses. The agent surface is 0 done, 9 partial and 9 missing across 18 clauses.

The replay proposes no clause wording or status changes. The qualification concerns MIG-001 points 2 and 7, ALERT-001 points 2 and 4, AUDIT-001 approval auditing, and ERASE-001 point 1. The synthetic alert import journey does not qualify a real organization export or production-volume dual run, and it does not independently assert the archive round trip of the approval audit entry.

## Observed results

The fixture accounted for 12 source definitions. The import produced 10 proposals and left the native rule count at zero. Owner approval created 10 native rules. Four waited for matching users or sessions, and the observation and restart checks recorded five alert facts and zero deliveries. The malformed rule was refused. In a separate destination case, two approved roster destinations bound to native recipients and one unmapped recipient kept its rule disabled. Guarded undo preserved a native edit, and project erasure removed the import proposals and their created rules.

The populated release upgrade preserved 176 existing tables and 120 rows. The late-key upgrade applied 0110, 0112, 0113, 0111 and 0114 in that installation's application order. Archives before the late key, before the alert migration and after the alert migration restored into fresh targets with their evidence and roster proposals. The destination kept its own numeric migration ledger.

The import receipt was captured at 1440 and 390 pixels after native approval. The proof masks the synthetic approval address. These captures are filed alongside the journey's machine-generated receipt.

The core migration count went from 107 to 108. The receipt has the source-status rows at both widths, including the malformed rule that was refused.
