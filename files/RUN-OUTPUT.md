# Actual verification output excerpts

Run Edit Run fleet, 17 November 2026 (UTC).

These are non-secret completion lines from the actual local check output.
Initial failed attempts and the final exit codes are retained in CHECKS.json.

New roster/ownership:

Roster/ownership public flow passed: inert role/scopes, named unsupported role, exact retry and undo, ownership overlap/unmatched, native invite/removal, safe portable audit, erasure and 1440/390 UI. Synthetic only.

Sentry regression:

Sentry org import fixture public flows passed through the import door: CLI no-write plan, reviewed apply, retained exact bytes, duplicates, inert native graph, scope and origin denial, reopen/resume, relation-safe undo, native-edit/revoked-session protection and inert archive restore. Synthetic export only.

Native team/browser:

[TEAM-001] native invitations and magic sign-in, simultaneous scoped triage, stale revision refusal, maintainer policy, read-only identity projection, billing/admin limits, member deployments, member/service revocation, safe audit and owner transfer passed

Native operator:

operatorFlow public HTTP assertions passed

Project erasure:

Project erasure public journey passed: 7 groups; 8 captures.


## Compatibility regression output

node tests/old-archive.mjs:

PASS populated published release upgrades preserve existing rows and columns with declared attribution additions: 176 tables, 118 rows before and after
PASS populated 0068 upgrade: 201 tables preserved; five additive migrations applied
PASS pre-metric archive with complete native objects and hashed ledger restores into the metric schema
PASS old native archive restores into a fresh migrated target with all product rows and destination ledger intact
PASS old archive refuses an occupied target without changing its project
PASS genuinely mismatched schema and corrupted original archive binding still refuse
PASS current archive independently restores and mandatory bookkeeping exclusions retain person-owned tables

node tests/multilingual.mjs:

Multilingual public journey passed: native/Sentry equivalence, grammar/privacy/deduplication, scoped late path mapping, unchanged admission, JS-only execution, archive restoration and project erasure.

node tests/repair-recovery.mjs:

Repair recovery public journey passed: 6 groups; 16 captures; verdicts a,b,c,e,f,d.

Exact-SHA Verify 44086779185: completed/failure on f30b750c3355ed4acaa20f950ef0c6e7c36ef1c4. Latest job diagnostics not read: ten-call budget exhausted.
