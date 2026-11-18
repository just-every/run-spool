# Spool Sentry alert import continuation

Builder record for sd-spool-import-alerts-3-c1, 18 November 2026 UTC.

## Plan and provenance

1. Resume from the saved alert-import head `cd2666344d56eadc1876c711fb114d9fb5bcc81b`. Compare it with current Spool main, preserve the newest contract judgments and replay only if the base requires it.
2. Check the import approval, waiting rules and destination outcomes through the owner door and the built Business imports receipt. Exercise native preview refusals, populated migration, archive restore, rollback and erasure.
3. Generate and check the contract views, restore main's views, rebuild the source lock and run the seed build steps. Inspect the full candidate identity range before pushing the named branch. Record exact-SHA Verify and publish the synthetic proof packet.

The saved branch had main `b24f4426c3900816e10e066d0bf95d06e10901a6` as its immediate base and contained four ordinary commits. The migration ledger has 0110 roster, 0111 key metadata, 0112 member identity, 0113 capture sources and 0114 alert proposals. The archive coverage exercises installations that received 0111 after 0112 and 0113.

## Product results

Your Sentry alert rules were brought over as rules waiting for your approval. Those that need data wait for their first event or session, and any rule whose Slack, PagerDuty or other destination Spool cannot reach is listed as needing a destination.

The fixture supplied 12 source definitions. One detector was linked to its workflow, one malformed definition was refused, and 10 source-linked proposals were recorded. The pre-approval project had zero native rules. Owner approval created 10 rules, with four active immediately, four waiting for user or session data, and two disabled rules whose receipt names the Slack destination or the unsupported aggregate. Live observations activated the four waiting rules and produced five alert facts with zero deliveries in the local journey. The roster fixture bound two destinations and left one unmatched member disabled.

The alert-import journey also exercised repeat approval, restart, native edit conflict on undo, undo of an unmodified import, and project erasure. Imported event history stayed out of live evaluation. The test fixture uses synthetic data throughout.

Main and candidate acceptance totals both show 23 done, 54 partial and 28 missing across 105 clauses. Homepage claims both show 3 done and 7 partial across 10 claims. The contract records MIG-001, ALERT-001 and AUDIT-001 as partial and ERASE-001 as done. One alert-import journey was added inside the existing Sentry import suite. The CI registration stayed in the existing SDK shard.

The current operator journey finds the assignment refusal by role and waits for the alert before reading it. The alert browser journey waits for the description attribute on the disabled save button, and the existing assertion checks the missing preview action after a reviewed destination refresh.

## Checks and custody

The saved branch was continued with a merge of main `ba5f3188ee9a09bff13fa3e1a8b6e1351b1a0c7d`, which upgraded Hono and its Node server adapter. The first published head was `be75971b3eef76c0c18e485903a4ceb56d2896d5`. Its local alerts, Sentry import, Business import and native old-archive suites passed. The old archive retained populated rows across 0114 and both sides of the late 0111 upgrade. GitHub’s alerts, SDK, owner UI, repair recovery, execution and project erasure jobs also passed on that head.

Verify run 44419292429 failed in the runtime and owner-erasure jobs. The runtime harness sent a 101,390-character statement from the combined migration file. The repair uses the existing SQLite-aware splitter, which bounds the largest statement in that file to 4,792 characters. Owner erasure's command-line restore saw a schema inventory mismatch before it could report the expected erasure fence. The CLI and fixture produced the same trigger with different comment text. The repair compares the full schema-object inventory with Base’s SQLite token identity, retaining the exact inventory and trigger semantics. The refusal assertions were preserved. [First Verify run](https://github.com/just-every/run-spool/actions/runs/44419292429)

The repair was pushed as `7db1a39f91289cf56850176e25b55e69629eaa0d` on `cloud/sd-spool-import-alerts-3-c1`. The build, TypeScript, integration, native export, first-party, contract views and source lock checks passed. The focused populated migration and archive test passed with the SQL comment variation. The complete old-archive assertions also passed with an in-process SQLite D1 adapter. The owner erasure journey returned the expected erasure-fence refusal for both old archives with an explicit later journal, and restored the old archive alone into a fresh installation. Repair-head journeys completed locally: Product browser and runtime journey, Synthetic Sentry alert import and desktop/mobile receipt, Alert browser suite and blocked-save preview assertion. Other repair-head journeys are recorded with their observed status in the validation receipt. The receipt images show the complete outcomes at 1440 and 390 pixels wide. The phone capture uses a taller viewport to show every outcome.

GitHub Verify run 44423718094 was **in_progress** with conclusion **pending** on the repaired SHA. [Verify run](https://github.com/just-every/run-spool/actions/runs/44423718094)

The fleet publication scan and landing gate follow this candidate.

## Claims

CLAIM MIG-001 PARTIAL points=2,7 tests=tests/sentry-import/field-accounting.mjs#fieldAccounting; tests/sentry-import/alert-rules.mjs#alertRulesImport

CLAIM ALERT-001 PARTIAL points=2,4 tests=tests/sentry-import/alert-rules.mjs#alertRulesImport; tests/alerts/conditions-journey.mjs#conditionsJourney

CLAIM AUDIT-001 PARTIAL points=none tests=tests/sentry-import/alert-rules.mjs#alertRulesImport

CLAIM ERASE-001 PARTIAL points=1 tests=tests/sentry-import/alert-rules.mjs#alertRulesImport

GAP MIG-001: A real authorized export and production-volume dual run remain unproved.

GAP AUDIT-001: The import approval audit passed locally. The new approval entry's archive round trip was not independently asserted.

DEFAULT MIG-001: Rules with no Sentry destination use local evaluation, without a delivery target. Explicit unbound or unsupported destinations remain disabled.
