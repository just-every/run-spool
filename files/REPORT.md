# Spool identity-default continuation
Author: Run Edit Run fleet, 15 November 2026.

Repository: just-every/run-spool.
Branch: cloud/main-spool-stranger32-trips-1-c1.
Current published candidate: adc3de69b9ae0ff60e41897f8ff7662fd656d560.
Original round retained: 8b4eff1b26e22be045ea4527e1d5263f74ddb0e7.
Main base at the last fetch: 74b7105bd756ac76a2e90086928a44af5e8cb5d1.
First continuation candidate: 1e45483aaa1c08b77e32375d601e7c331697e784, preserved as an ancestor.

The continuation repairs three privacy-journey fixtures that implicitly depended on the former drop default. It keeps the original round's product code and keep-as-sent default. Every fixture first asserts that a new project keeps the four supported identity fields, then selects drop through the actual policy preview/save HTTP door when proving scrubbing. No archive-privacy assertion, matching count, authority refusal or acceptance registration was removed or weakened. PLAN.md contains the full plan and its cause-based CI follow-up. ORIGINAL-REPORT.md preserves the original report and its detailed trip results; its old candidate and CI observations are historical.

## The assigned erasure-preview failure

Unmodified 8b4eff1b reproduced 3 !== 2 at tests/end-user-erasure-preview.mjs:48. The assertion counts private project identity keys, not matching events or an erasure receipt. The third project was called dropped but inherited keep and correctly minted a third identity key when it received a user. Baseline 74b7105b passed before edits. The fixture now explicitly drops all four identity fields for that project and verifies it has no key; only the two retaining projects have keys, and those keys remain independent.

Matching counts are unchanged: two matches among four initial keep events; three among five after hash intake; foreign captures do not change that count; drop makes email matching unavailable with one unattributable event. The preview still changes no product rows, reveals no values or keys and refuses unauthorized sessions, grants and origins. The 3 !== 2 failure was not a matching-count defect, so no new erasure operation was introduced. This remains an explicitly incomplete, preview-only SDK-027 journey.

## The assigned session failure

Unmodified 8b4eff1b reproduced the whole-archive user-identifier assertion at tests/session-flow.mjs:46. Baseline 74b7105b passed before edits. Unmodified Node/browser SDK crashes send error events as well as sessions. The new keep policy correctly retains user.id in private event_identities, which the owner's private archive includes. Session DIDs independently pass through keyed project hashing in src/domain/sessions/intake.ts.

The journey selects drop before SDK intake and retains the whole-archive raw-user absence assertion. An additional health_sessions-specific assertion states the session guarantee directly. Exact reference reconciliation, six individual sessions, aggregate counts, backpressure, grant fences, archive restore and project erasure remain asserted. Keep-as-sent and legacy-policy preservation remain proven by identityFlow, including creation disclosure, a new persisted keep row, legacy missing-row drop, existing stored drop and the installation scrubbing floor.

## The later CI-exposed multilingual failure

First-candidate Verify 43739835617 completed with failure on 1e45483aaa1c08b77e32375d601e7c331697e784. Its only reported primary failure was tunnel; its dependent shards/spool and verify aggregates failed with it. The failed archive was read once for job 132890785238. It confirms the repaired session journey, session backpressure, identityFlow and the SDK-package journey passed. The later tests/multilingual.mjs then failed at line 100 with discard PRIVATE_USER. This assertion had been hidden behind the prior session failure.

The multilingual fixture deliberately sends Sentry user.email=PRIVATE_USER, then asserts the owner's archive contains none of the synthetic private canaries. Local reproduction on the first candidate produced the same failure. It now asserts fresh keep and explicitly chooses drop before the scrubbing captures. Every existing archive canary assertion is retained, as are native/Sentry equivalence, grammar, deduplication, scope, late path mapping, admission immutability, JS-only execution, historical archive restoration and project erasure. Its full local journey passed after the change. This was a related privacy-fixture repair, not an infrastructure rerun or a new product feature.

## Local validation and evidence

Actual outputs and receipts are selected explicitly in this packet:

- repro-original.log, repro-main.log and reproduction-context.json record both assigned journeys before any edits on the original head and baseline.
- erasure-preview-fixed.log and exact-head-journeys.json/log record the repaired assigned journeys. FIRST-EXACT-HEAD-JOURNEYS.json/log preserve the first candidate's exact-head run.
- touched-checks.json records the full selected owner-claim, Sentry SDK, Sentry HTTP, owner-erasure, triage, native-alert and prepared first-project entrypoints. The initial owner-claim attempt stopped only because discussionFlow called Playwright directly and its managed browser binary was absent. owner-claim-rerun.json and owner-claim.log record the successful unchanged-suite rerun with the external cloud Chromium preload. No browser configuration workaround was committed to the product.
- The full Sentry SDK entrypoint passed in 328.30 seconds, Sentry HTTP in 595.82 seconds, owner erasure in 381.48 seconds, triage at 1440/390 in 367.20 seconds and native alerts with no skips in 172.53 seconds. The actual prepared rer-dev first-project journey passed at 1440 and captured its changed setup screens at 390; its owned server processes were stopped.
- multilingual-before.json/log and multilingual-after.json/log record the newly exposed assertion and the successful complete fix. The final typecheck returned zero. Contract generation check, source-lock regeneration and source check all returned zero; source-checks-final.json and the final source logs are the actual receipts.
- Screens include count-only matching/unavailable erasure previews, release health, project creation policy, archive preview and readable evidence at 1440/390. No credential pane, private archive, environment dump or held-out gate material is selected.

No full local rer verify was run. The new candidate's src tree is 345620ee27b86de42c59cf409441ec7597f6a93a, identical to the first candidate's src tree, so the emitted product build is unchanged. Only the multilingual fixture and its source-lock hash changed between the published continuation heads. The final branch Verify remains the full exact-SHA wall; local results do not replace it.

## Counts, scope and original round

The two assigned regressions went from two failures to zero. One additional default-dependent fixture failure was exposed by the full wall and went from one failure to zero locally. No test registrations were added or removed; package test-script entrypoints remain 28 before and after. Clause counts remain 23 done, 54 partial, 28 missing, 105 total. CONTRACT.md, its Status/Gap/Evidence cells and both generated views are unchanged. The continuation changes only tests/end-user-erasure-preview.mjs, tests/session-flow.mjs, tests/multilingual.mjs and sources.lock.json. Existing Team-004 proof images regenerated during the HTTP suite were restored and are excluded from the product commits. No mail-off lease file was edited.

All original-round product changes remain: assignment after a comment; readable archive/evidence details with explicit raw downloads; plain affected-user report wording; working grouping syntax and guide; source-map prerequisites; new-project keep defaults with legacy preservation and a scrubbing floor; the corrected erasure-fence guide; carried DSNs and accurate key lifetime wording; member key guidance; private address-independent destination aliases. The original GitHub-connection feature gap and ordinary local integration-egress activation gap remain. No provider, hosted deployment, release, Business qualification or app.happytohelp.com operation was performed.

CLAIM SDK-008 PARTIAL points=5 tests=tests/identity-flow.mjs#identityFlow
CLAIM ERASE-001 PARTIAL points=3,4 tests=tests/owner-erasure.mjs#owner self-erasure public flow; tests/owner-erasure-inflight.mjs#delayedOwnerWrites; tests/owner-erasure-inflight.mjs#delayedRestore
DEFAULT SDK-008: Newly created native projects persist keep-as-sent for the four supported user fields; existing, absent legacy and restored policies remain unchanged, and installation scrubbing still wins before persistence.
GAP SDK-008: Dedicated organization identity floors, imported Sentry identity setting adoption, additional user fields and trustworthy automatic client addresses remain outside the implemented policy surface; the existing installation scrubbing floor is preserved.
GAP ERASE-001: Shared import custody and the other already documented unsupported or ambiguous owner-attribution scopes remain; this round makes no DONE claim.
GAP AI-003: Complete local/hosted GitHub connection setup and a harmless native connection check require new integration/deployment support; a real App grant remains an owner prerequisite.
GAP ALERT-002: Ordinary local rer dev has no supported egress RPC binding setup; the existing linked operator-managed deployment procedure remains the available route.
GAP SDK-024: The same local egress activation gap applies to connected cron forwarding; no real receiver was contacted.

## Publication and remaining landing work

Both substantial commits were pushed immediately after their required local checks through the supplied cloud push guard. The second push advanced the same branch normally; published history was not rebased or force-pushed. Fresh main fetches and merges were already up to date. All five candidate commits, including side parents, passed fleet author/committer and full-message/trailer checks. Neither final commit has a skip marker. No main/default branch was pushed. No PR was created because this seed uses fleet branch landing. PRODUCT-RECEIPT.json and product-push.json identify the final product; FIRST-* receipts preserve the superseded candidate.

Five GitHub calls were used to discover/poll the first exact-SHA Verify and diagnose its completed failure: three status/discovery reads at least 300 seconds apart, one failed-job metadata read and one failed-job archive read. The public archive copy removes the workflow environment header. No blocked job-log redirects were retried. The new candidate's first Verify discovery is scheduled for 17:58:53 UTC, 15 minutes after its push, with one watcher and subsequent reads at least 300 seconds apart.

The required independent Opus data/auth gate, complete publication scan, generated-view landing and exact-main checks remain fleet landing work. Evidence publication is separate report transport and does not establish product acceptance or landing. Final exact-SHA CI and transfer custody are recorded below after observation.

Run Edit Run fleet, 15 November 2026: all three repaired journeys completed on the final published head adc3de69b9ae0ff60e41897f8ff7662fd656d560 with exit 0. The two assigned journeys completed at 17:46:01 UTC and multilingual at 17:46:32 UTC. Their exact-head JSON/log receipts are included, and the assigned count-only and session-health screenshots were refreshed from these final-head runs. The working tree remained clean.

Run Edit Run fleet, 15 November 2026: final-candidate Verify 43742749592 was observed in_progress on the exact final head at both 15 and 20 minutes after push. Seven total GitHub calls have been used. To preserve two calls for completed-failure diagnosis, the sole watcher was stopped and resumed without an API request, retaining the known run id and scheduling the last status read at the 30-minute mark (18:13:53 UTC). This changes neither product code nor CI.

## Terminal exact-SHA CI

Run Edit Run fleet, 15 November 2026: Verify 43742749592 completed/success on the final exact SHA adc3de69b9ae0ff60e41897f8ff7662fd656d560. https://github.com/just-every/run-spool/actions/runs/43742749592 is the actual run. The first failed Verify 43739835617 is superseded; its multilingual cause and log are preserved above. 8 of ten authorized GitHub calls were used. All three repaired journeys also passed on this final head locally. No product blocker remains; the independent Opus data/auth gate and full publication/landing checks remain with the fleet.

The complete explicitly selected packet is published separately to refs/heads/evidence/main-spool-stranger32-trips-1-c1. The exact evidence transport head is reported in the terminal EVIDENCE line. Evidence publication does not alter the product HEAD/index, establish acceptance or land main. After transfer verification, the clone is removed while this external packet remains.
