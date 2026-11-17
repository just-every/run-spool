# Spool owner journeys — sd-spool-design-keys-1

Author: sd / Run Edit Run fleet. Date: 2026-11-17. Repository: just-every/run-spool. Branch: cloud/sd-spool-design-keys-1.

## Result and scope

Implemented the eight requested owner journeys. Product changes, focused test changes, one short documentation paragraph and the regenerated source lock belong on the product branch. Reports and screenshots belong only on the separate evidence ref. No contract text or status, generated acceptance view, release metadata, tag or rer pin was changed.

| Item | Before | Result |
| --- | --- | --- |
| D8 | Unnamed keys, creation time only, immediate revoke | Persisted names at creation and in existing-key Details; authenticated last-use times; consequence confirmation with Keep key and Confirm revoke. |
| D11 | Local invitation link collapsed, pending person shown as member | A just-created link and Copy link appear beneath the notice. Pending native identities read Invited. The local-only explanation links to the actual hosting guide. |
| D12 | Generic invitation with owner instructions | Validated links identify the actual inviter, organization, organization role and project roles, followed by Join. The local owner-entry warning is removed. Native expiry, cancellation, single use and role enforcement remain intact. |
| D13 | Destination/test/review/preview requirements revealed one at a time | A short email flow shows all steps, sends the actual test, explains local suppression/provider acceptance and uses Turn on as explicit review. It retains the server’s reviewed-test and native preview gates. Zero-delivery feed entries offer Add an email alert. |
| D14 | Inert subscription and preference controls; technical setup on the everyday screen | Inert issue Subscribe and Personal notifications controls are hidden. Working advanced integrations remain inside Details. |
| D17 | New grant and DSN above unrelated pages | A native dialog at creation has Copy and I’ve saved it. New grants clear on dismissal/navigation and do not precede other pages. Capture still sends a real test using the newly issued key. |
| D21 | Silent archive preparation and undated filename | Immediate Preparing your backup…, dated filename, then a completion line with the project count from the actual downloaded manifest. Downloaded private content still restores into an independent empty installation. |
| D24 | Technical table inventory on the main erasure preview | Selected project name plus issue, error, key and rule counts, an irreversible-action sentence and Download a backup first. Technical inventories and custody notes are collapsed in Details; typed confirmation and the plan hash remain required. The erasure API itself remains count-only. The receipt keeps keyboard focus when the app leaves the deleted project. |

## Truthfulness decisions

Older releases did not record per-key use, so a null timestamp reads **No recorded use**, rather than asserting **Never used**. Current successful credential admission records the actual last-use time. Slack and signed webhook delivery work in this implementation, so **Today, Spool alerts by email only** would be false and was omitted. Working Slack setup remains in collapsed Details, while the ordinary flow offers email. A local test explicitly says no email was sent; provider acceptance never claims mailbox receipt. See FACT-CHECKS.md for source and runtime boundaries.

## Verification and counts

The complete plan is in PLAN.md. Baseline and candidate evidence use synthetic projects and colleagues at 1440 and 390; keys and invitation-link values are masked. The packet’s check-*.json files are actual command receipts, with exit status, time and tested index tree. Older receipts precede the final copy-only clarification for unrecorded key use. The isolated triage retry passed. Later changes only clarify unrecorded key-use wording and preserve receipt focus; the focused erasure replay and exact-SHA CI qualify those changes.

Initial failures found and corrected a duplicated invitation fragment, misplaced key-use update, a missing archive validator entry for key_named, nested Details test selectors and an older test’s bundled-browser assumption. An initial archive round-trip retry also recorded a transient ECONNRESET; its actual receipt is retained as attempt-triage-transport.json. The full local erasure script’s separate rer dev startup exceeded its 90-second fixture deadline; its actual startup receipt is retained. The same rendered erasure helper is replayed directly against the emitted app, including actual deletion and its original focus/privacy/accessibility assertions. No flow assertion was removed to conceal a failure: changed UI tests retain the native storage, authority, archive and delivery assertions, and adapt the explicitly hidden controls to their requested absence.

Application suite registrations: **21 → 21**, with existing journeys extended and no new suite registration. Contract judgments: **23 done / 54 partial / 28 missing → unchanged**, 105 total. No clause status changes or promotions.

The 12ui skill was read and its improvement tool attempted. Hosted design-kit refinement required an unavailable sign-in; no hosted kit or alignment result is claimed. This round uses Spool’s existing styles and the supplied UX decisions. The limited staged-diff credential-pattern inspection is recorded separately; the fleet’s full publication scan remains a landing gate.

## Product and evidence custody

Final product head: `739c7ff1575296fd329c69769364f030618a7b11`. The implementation commit is `08265b641c58352aa90844d616cab14ad4b103b4`; follow-up commits correct the clean-tree source lock and generated deployment recipe. Remote custody is confirmed in PRODUCT-PUSH.json. Initial Verify `44126099965` failed on the stale screenshot hashes; Verify `44127951968` then passed source integrity but rejected a stale generated deployment recipe. The final head is pushed with Verify unqueried after the ten-call API budget was used; no green or READY claim is made. The candidate browser proof’s receipt names this exact source SHA. Check outcomes and final CI conclusion are recorded in the final receipts and terminal report. Evidence publication is report transport and does not assert acceptance or landing. No PR, release or main push was requested or performed.

No contract clause claimed; these are owner-journey design fixes (DIRECT 87).

Out-of-scope notice: GitHub’s push response reported 21 existing dependency alerts on the default branch (16 moderate, 5 low); no dependency or release change was made in this round.

CI correction: Verify 44126099965 rejected stale hashes for pre-existing retained screenshots. Tests had overwritten those tracked files; the product commit correctly excluded the screenshots, but the lock was generated before their restoration. A separate follow-up commit regenerates only sources.lock.json from the clean product tree. Published history is retained. The first run’s exact result and one-time failed-job logs remain in this packet.

Integration correction: regenerated management/integration/deployment-spec.json with the seed’s documented integration:sync command so it includes migration 0110. The generated project descriptor and workflow remain byte-identical. No version, release metadata, account or resource identifier changed. The final candidate has the exact CI build-step commands checked locally; independent branch Verify remains unconfirmed because the prescribed ten-call budget is exhausted.

Final local CI-build receipt: check-final-ci-build.json records exit 0 on `739c7ff1575296fd329c69769364f030618a7b11` for first-party check, source check, offline Base verification, application build, integration check and typecheck. The application, tests and migration bytes are identical to implementation commit 08265b641c58352aa90844d616cab14ad4b103b4. Final custody is PUSHED, with exact-SHA Verify unqueried after 10/10 GitHub calls; see CI-FINAL.json.
