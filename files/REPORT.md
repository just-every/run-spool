# Spool capture truth

Repository: just-every/run-spool
Branch: cloud/main-spool-capture-truth-1
Base reproduced: 26d13d4 (main at clone).
Final product candidate: 28bd1e7857c63015aaef5f23f9dd8f7ff2e43cb3. Both product commits were pushed through the fleet guard on their first attempts. Final exact-SHA Verify: run 43184017655; current state is recorded in ci-receipt.json.

## Result and implementation

The public unmodified Sentry Node SDK emitted one feedback item and one session. Main persisted feedback_accepted=1 and session_stored=1, then the actual scheduled scanner created two overdue loss rows, each with Recorded capture loss=1. After the fix the same successful receipt counts remain, with zero loss attention rows.

The follow-up scanner excludes successful storage, duplicate, withdrawal, successful check-in forwarding and accepted release-normalization receipts from loss work. Existing genuine refused items, trimming, unsupported telemetry, SDK discards and failed deliveries keep their current paths. The next scheduled scan durably cancels old mistaken loss attention with successful_capture_not_loss, preserving the operational record/source ID and its creation audit. Queued or blocked alternate notices for that canceled work are also canceled with a reason. They cannot be requeued by later scans. The follow-up read projects no Recorded capture loss value for a successful outcome, including a retained old cancellation.

A public three-occurrence issue was split through the rendered Correct grouping dialog, applied and undone. Main restored all three occurrences and correctly aliased the split short ID, but listed a second empty open/unowned issue. The fix excludes count-zero native aggregates from ordinary issue lists, query-wide search/facets/exports, report issue counts and project/team digest work counts. It does not delete the empty source record, move an alias differently, erase a correction or change occurrence grouping. After undo the ordinary total/open/unowned counts remain 1/1/1; the split short ID resolves to the original and correction history remains undone and inspectable.

## Before and after

| Observation | Before | After |
| --- | ---: | ---: |
| feedback_accepted receipts | 1 | 1 |
| session_stored receipts | 1 | 1 |
| Overdue false capture-loss rows after successful intake | 2 | 0 |
| Ordinary issue total after split undo (baseline 1) | 2 | 1 |
| Open count after split undo (baseline 1) | 2 | 1 |
| Unowned count after split undo (baseline 1) | 2 | 1 |
| Restored occurrences | 3 | 3 |
| New test registrations | 0 | 0 |

The extended SDK journey also checks a genuine invalid intake (one loss), three real unmodified SDK before_send discards, two preexisting mistaken attention records, pending alternate notice cancellation, unchanged genuine loss custody and repeated-scan idempotency. These are behavioral assertions through the emitted Worker and public doors; only old operational custody is seeded to represent an existing installation.

## Plan and validation

PLAN.md contains the complete task plan. Existing tests/sentry-sdk.mjs, tests/operator-flow.mjs, tests/operator-ui.mjs and tests/agent-handoff/packet.mjs are extended; no test file or registration is added. The full SDK and triage journeys pass locally. The triage run includes the new desktop rendered list/count assertions and completes its existing phone smoke. The independent before/after receipts use public SDK intake and rendered split/undo; final exact-candidate screenshots show the two changed screens after data has loaded at 1440 and 390. Screenshots contain synthetic product data only.

The application build, typecheck and contract-document check passed. The product journey and final source lock/check passed and are recorded in CHECKS.json. Actual SDK, triage, product, typecheck and contract check logs are included as separate files. An initial concurrent product run failed at a fixture clock door with HTTP 404: these suites share .artifacts/local-test-entry.mjs. The run was repeated alone to avoid shared wrapper interference; this is recorded transparently rather than weakening a check.

No acceptance text or clause judgment is changed. Contract status counts stay 23 done / 54 partial / 28 missing. ERR-008 and GROUP-001 retain main's existing done judgment and SDK-007 retains partial; this builder makes only partial scoped claims. Source lock is regenerated last before the candidate commit.

## First CI failure and correction

The first exact-SHA Verify (43180790185 at 958ff23cd5acbd7190a52fbebcb3a2209cf64ad8) failed in verify (agent-handoff), Run suites, at importGap in tests/agent-handoff/packet.mjs. The original count-zero filter was too broad: a supported Sentry issue-only import deliberately has no collected events, but its history and named packet gaps must remain inspectable. This was a regression caused by the candidate, not an unrelated flake.

The second commit centralizes the listing predicate and preserves the two supported imported algorithms, sentry-import-v1 and rollbar-import-v1, while excluding empty native correction aggregates. The existing importGap test now explicitly asserts imported list/search visibility and still checks the empty packet's named historical gap. Its focused emitted-Worker/public import run passes, as do the native split/undo probe, build, typecheck and regenerated source lock. Published history was preserved and main was merged (already up to date). The full local final-candidate agent-handoff run passed the corrected imported-history path and scheduled retention, then hit its 90-second installer caps/setup deadline after reset, before archive-cap assertions. That setup code is unchanged; this timeout is recorded in agent-local-receipt.json, not represented as a passing full journey. No assertion was deleted, skipped or weakened. CI's original diagnostic tail is in ci-first-failure.txt, with its actual receipt in ci-first-candidate.json.

## Claim scope and defaults

CLAIM ERR-008 PARTIAL points=none tests=tests/sentry-sdk.mjs#successful Node feedback/session capture and genuine-loss follow-ups
CLAIM SDK-007 PARTIAL points=none tests=tests/sentry-sdk.mjs#successful Node feedback/session capture and genuine-loss follow-ups
CLAIM GROUP-001 PARTIAL points=3 tests=tests/operator-flow.mjs#operatorFlow; tests/operator-ui.mjs#operatorUi
DEFAULT ERR-008: Existing mistaken attention is reconciled by the next scheduled scan, retaining its source identity and a cancellation reason. No real capture counter or provider outcome is rewritten.
GAP SDK-007: This round does not qualify every envelope category, runtime or provider outcome; existing broader clause gaps remain.
GAP GROUP-001: No grouping-policy expansion or additional acceptance point is claimed.

## Publication and custody

Only the declared product repository and named cloud branch are written. No PR is required by the repository instructions. The branch candidate has no skip-CI marker. Fleet identity and trailer inspection covers every unpublished candidate commit. Product pushes use the fleet cloud push guard. Evidence is published separately to refs/heads/evidence/main-spool-capture-truth-1.

The cloud adaptation reserves the full publication scan, generated-view landing and main integration/deployment gates for the fleet's own host. A pushed branch or published evidence packet is not proof of acceptance, landing, provider delivery or deployment. Exact-SHA Verify status is reported separately in ci-receipt.json and the final custody line.
