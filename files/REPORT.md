# Sentry capture and import accounting

Signed: Run Edit Run fleet, 17 November 2026 (UTC).

Product: `just-every/run-spool`, branch `cloud/sd-spool-import-sentry-1`, head `8f3fe12f0153fe7d91a55e00ed7e5c4853b9ecba`. The remote ref was checked and matches. First preservation save: `0638b3ad31cf19644ed0e9f7b21ebf102d55e809`. No PR was created; no main/default ref, product identity, release, contract judgment, generated acceptance view or copied Base source was changed. The fleet retains publication scanning and landing custody.

The complete plan is in PLAN.md. The implementation follows its six steps: deterministic documented-schema captures; offline sanitization and checked pagination; independent recursive accounting; bounded exact native fencing and resumable scale; owner/signed-door regressions; separate evidence publication. No provider account, customer data or paid API was used. The planner's report-only ref `evidence/ct-import-plan-spool-1` was read through Git. The only shipped platform/rules reference was briefs/RULES.md; no unavailable platform text or ruling was invented.

## Delivered behavior

`scripts/fixtures/sentry-organization.mjs` generates fixed baseline/scaled API captures, sanitized Spool-owned bundles, documentation links and receipts. Projects, keys, issues, singleton event details, releases, current workflows/detectors, singleton ownership and members/teams cover eight requested families. The examples use reserved synthetic identities and public documented response shapes. The committed capture is reproducible. This is not a claim of a native universal Sentry organization export.

`scripts/sentry-export.mjs` is offline. Tests acquire its documented responses from a local HTTP fake, following real Link headers. It checks endpoint/scope, all-state issue queries, bounded pages, opaque cursors and terminal completion. Truncation, repeated/cross-origin pages, malformed responses and unsupported endpoints refuse. Credential fields and URL credentials are removed before upload; reflections, including encoded forms, are removed and named. A credential reflected in a field name refuses without reflecting its value. The server's existing credential rejection and exact owner/project guards remain authoritative.

Owner plan/status/reconcile/history reads now expose each source kind's count and payload bytes; full capture page/source/sanitized byte inventories; every unique source leaf/empty-container pointer, disposition, byte count and readable reason; every array length and wholly omitted index; rejected-record accounting; inert loader settings; and a per-source byte ledger that sums exactly to the separate source/native totals. Redacted pre-upload paths are listed even when their values no longer exist. Private originals are not usable native mappings. Unsupported families remain unsupported. Replacement loader script tags are null with a reason: no Spool grant was minted or activated.

The Sentry parsed-record quota rises from 500 to 1,000, including the synthesized manifest. Other importer quotas remain 500; upload/per-record bytes remain 2 MiB. The shared target adapter uses compact JSON SQL predicates that compare every native column, identity, revision and exact source metadata, together with full-set count/orphan guards. It does not trust revision markers alone. Existing 2 MiB native/custody/value, SQL and 1,000-statement fences remain in place. Apply/undo keep the existing bounded resumable door; no Base adoption or copied-Base edit was needed. Undo now removes a deleted imported project's otherwise orphaned short-ID prefix, preserving exact auxiliary-graph restoration.

## Actual synthetic results

| Measure | Baseline | Scaled |
| --- | ---: | ---: |
| Parsed records (including manifest) | 26 | 530 |
| Unique records / equal duplicates | 25 / 1 | 529 / 1 |
| Captured responses/pages | 25 | 279 |
| Field dispositions | 582 | 15,450 |
| Array inventories | 89 | 2,357 |
| Raw response bytes | 16,026 | 417,238 |
| Sanitized response bytes | 15,947 | 417,159 |
| Uploaded wrapper bytes | 26,934 | 509,843 |
| Source record payload bytes | 15,907 | 416,865 |
| Present native value/provenance bytes | 18,789 | 598,601 |
| Native projects/releases/issues/events | 1 / 1 / 8 / 8 | 1 / 1 / 260 / 260 |

Both profiles paused after a bounded apply request, reopened status with the same durable job, resumed, reconciled, re-imported identical bytes with zero native changes, and undid newest-first to the exact populated control archive. The scaled proof ran outside CI on the committed head above. The independent oracle checks every actual source path and schema disposition; native packet coordinates are also read through the public API. The report identifies earlier exception loss, unused symbolicated coordinates, locals, unknown nested extensions, unsupported roster/alert/ownership/key fields and redaction markers. A 1,002-frame source explicitly reports omitted middle indices 500 and 501. Conflicting duplicates, record overflow, malformed rejected exception detail and cancelled reviews preserve native state.

`baseline-accounting.json` and `scaled-accounting.json` are the complete actual owner reconciliation reports, with locations, byte ledgers and array losses. `capture-receipt.json` records actual offline baseline export. `import-receipt.json`, `scale-driver.mjs` and `scale-run.log` record the exact-head scale proof. Source and native bytes differ because source totals include repeated/unsupported fields, while native totals encode converted/scrubbed fields, derived identities/timestamps and provenance. The per-source ledger reports every signed difference and its affected targets; response framing, sanitation and wrapper overhead are separate quantities, never compared as though they were native bytes.

## Validation and custody

Build, typecheck, source lock/check, contract-document check and diff whitespace check pass; actual command receipts are in checks-receipt.json. The signed Business journey passes 497 -> 499 records, including approval binding, over-allowance/gone-source/native-edit refusals, exact newest-first restoration, custody erasure and permanent key revocation. The original combined `tests/sentry-import.mjs` command completed all Sentry assertions and then failed in its following Bugsnag browser regression because the bundled browser was unavailable. The entire Bugsnag regression and then the complete combined owner command were rerun with the instructed `/usr/bin/chromium` and passed; this environment-only failed attempt is retained honestly in journey-receipt.json. The exact-head accounting driver additionally passes the malformed-event ledger case. No tests were deleted, skipped or weakened. The same two existing top-level owner/Business journey entrypoints remain; the two new helper modules are called from the owner journey.

No product UI screen was edited; the existing browser regression exercised its own 1440/390 flow. Local toolchain: Node 24.19.0 and repository-pinned pnpm 10.12.4, as selected by the supplied cloud toolchain. Branch CI uses its declared Node 22.20.0. Verify run 44083960124 completed/failure on the exact product SHA. The existing Alerts UI assertion at tests/alerts-ui.mjs:47 failed in job 134042431931. Its source/test/runtime are unchanged from origin/main, and a complete local replay passes at 1440/390. CI-BLOCKER.md, the sanitized failed-job log and source-hash receipt record the handoff. This is a real exact-SHA Verify blocker; the contract-generator exception does not apply. Evidence publication is report-only and cannot signal acceptance or landing.

Contract counts are unchanged: 23 done, 54 partial, 28 missing (105 total). MIG-001, API-002 and AUDIT-001 remain partial; their Status/Gap/Evidence cells and all acceptance text are untouched. Final capture hardening gathers removed credentials across all pages before projection; reflections on earlier pages are redacted and reflected metadata is refused. These regressions pass in schemaPages. No clause is claimed DONE. The qualified first-entry inventory does not complete MIG-001 acceptance 1, which names additional collections and usable replacement loader scripts.

CLAIM MIG-001 PARTIAL points=2,7 tests=tests/sentry-import/field-accounting.mjs#fieldAccounting; tests/sentry-import.mjs#public owner import journey; tests/business-import.mjs#signed bounded catch-up
CLAIM API-002 PARTIAL points=none tests=tests/sentry-import/schema-pages.mjs#schemaPages
CLAIM AUDIT-001 PARTIAL points=none tests=tests/sentry-import/schema-pages.mjs#schemaPages; tests/business-import.mjs#public signed import journey
DEFAULT MIG-001: Owner-only, deny by default, synthetic local responses only; source accounts, key settings, roster, ownership and alert history grant no authority and run no outbound work.
DEFAULT API-002: This adapter consumes documented capture schemas and Link pagination; it does not add a broad Web API or Terraform implementation.
DEFAULT AUDIT-001: Refusals and shared reports carry bounded codes, locations and counts rather than credential values or rejected raw bodies.
GAP MIG-001: R-2 remains HELD-EXTERNAL: no owner-authorized real Sentry account/export, production-volume dual run or cutover was available. Other named collections, richer event fidelity, usable loader replacement tags, native roster/configuration activation and arbitrary-size migration remain unqualified.
GAP API-002: Complete /api/0 compatibility, role/token mapping and unmodified Terraform plan/apply/import remain unproved.
GAP AUDIT-001: Full organization/member/provider action audit and every erasure boundary remain outside this bounded synthetic accounting proof.
EVIDENCE: The actual selected report packet belongs only on refs/heads/evidence/sd-spool-import-sentry-1. Product READY requires the separate exact-SHA Verify result and never follows from evidence publication.

BLOCKED branch=cloud/sd-spool-import-sentry-1 head=8f3fe12f0153fe7d91a55e00ed7e5c4853b9ecba prerequisite="Successful exact-SHA Verify"

The final exact-SHA import jobs succeeded: verify (sdk) 134042431907 (Sentry HTTP/import including schemaPages and fieldAccounting) and verify (execution) 134042432310 (including signed Business import). ci-jobs.json records all 32 terminal job statuses. The only failed assertion job is verify (alerts); shards (spool) and verify inherit that failure.
