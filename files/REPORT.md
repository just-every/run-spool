# sd-spool-import-rules-1 report

Run Edit Run fleet — 17 November 2026 UTC.

No contract clause claimed; this is a move-in fault fix (main-pack-dedup-1, 17 Nov).

## Blocking contract and lease conflict

ALERT-001's current Requirement explicitly says: “A user condition on a project whose identity policy leaves no user key, or a session condition without session data, is refused at preview with the reason rather than evaluated against 0.” The requested on-and-waiting session behavior changes that requirement's meaning, even though the evaluator still withholds an empty denominator. The brief says a clause whose meaning changes and needs a RELEASE.json entry must STOP and report BLOCKED; the same lease prohibits RELEASE.json/release metadata edits. Contract text and statuses have not been altered. Finishing this assignment therefore needs the clause/release change to be authorized and reconciled; the candidate must not land under the current contract. This corrects the provisional report's statement that no clause meaning changed. No further product work was done after identifying this conflict.

The preserved product change lets the owner create or re-enable affected-user, session-percentage and crash-free-session rules before matching live observations exist. The saved rule remains on. Preview and rule list show the waiting reason, and the state clears on the first matching observation without an owner edit. The existing rule form and layout are retained; rule summaries use owner words. Destination testing/review, identity-policy refusal when all identity keys are deliberately dropped, preview freshness, privacy fences and historical-import silence remain enforced.

## What the old refusal protected

On fresh main 3b7a3ebe545f3bd9c6a979ca04d5687c6a375b09, the native Worker returned no preview token for absent user events or absent sessions, and enabled rule writes returned HTTP 400 (`before.json`: two refusals, zero saved rules). The evaluator already prevents a no-data alert: unique-user spike decisions require more users than the positive threshold; session error percentages use a null value without a denominator; crash-free-session SQL produces null without observed sessions, and the scheduler leaves metric status unchanged when the value is null. No zero-percent crash-free value is manufactured from no sessions.

Allowing enablement also exposes the existing mixed-kind route: a user rule can select both a spike and a new-issue event. The change therefore shares one filtered, live-observation predicate between waiting state and immediate routing, so an anonymous new issue cannot bypass a waiting user rule. The evaluator's denominator and threshold protections remain intact.

## Public-door and browser proof

`tests/alerts/waiting-data.mjs#waitingData`, called within the existing native alert test registration, uses the public Sentry organization-import door to create an empty project/release, then the owner alert API to create/re-enable rules, SDK envelopes to send observations, and the emitted Worker's scheduled handler to evaluate them. It proves three rules on with no deliveries in an empty project; wrong-environment data does not clear waiting; anonymous events do not supply users or sessions; sessions alone do not supply user events; the first matching crashed session clears waiting and automatically enters critical with a real zero-percent value; the first matching user event clears waiting without editing; later threshold crossing delivers; repeated evaluation does not duplicate delivery. A second empty project covers sessions-only intake and the mixed-kind anonymous-event guard. The existing identity-policy, stale-preview, denominator, history, reactivation and archive assertions remain in place. A cursor replay covers the real ingested receipt window for scheduled issue spikes; event/session payloads and retained received times are not manufactured by that proof.

`waiting-data.json` records stage outcomes. `browser-receipt.json` and the four `rules-*.png` files show the built owner page while waiting and after data at 1440 and 390. Behavior assertions run at 1440; the 390 captures are visual proof. The waiting preview also demonstrates that Save is available before a test event. All data and names are synthetic. Local mail is suppressed; this is no hosted/provider receipt.

## Scope limitation: no native Sentry rule carry exists on main

The requested existing import-apply path that leaves imported native rules off is absent on the supplied main. `src/domain/sentry-import/mapping.ts#organizationMapping` maps project, release, issue and event only. `targets.ts` has the same four native target kinds. Unsupported collections remain in private source custody and create no native target or destination authority.

`import-capability.json` records an actual public-door probe: a synthetic bundle with two source rules applied successfully and reconciled, but created one project and zero native alert rules. Consequently this round cannot honestly claim that Sentry-carried rules are automatically on or that its screenshots depict automatically carried native rules. The screenshots depict native rules explicitly created by the owner in an imported project. Native archive restore deliberately disables alert rules for safety; that separate behavior was preserved. A prerequisite rule-carry mapping and its destination-authorization policy are needed to finish the import portion. No speculative source rule translator, destination authority, or unrelated migration semantics were introduced.

## Checks, counts and publication

The detailed actual exits are in `checks.json` and `maintenance-checks.json`; the final source-lock exits are in `lock-checks.json`. The public build door is `npx -y @runeditrun/rer build`; this seed's pinned operator adapter declares one build step, `pnpm run --silent build:app`, which builds the capture bundle and Vite application in that order. The requested `pnpm run validate:release` is absent from this repository and exits 1 with `ERR_PNPM_NO_SCRIPT`; it was not silently skipped or replaced with a release operation. No contract text or judgment, release metadata, version, tag or rer pin was edited. The requested behavior does change the meaning of the quoted ALERT-001 requirement; that is a blocking lease conflict, not a completed acceptance claim.

Native alert registrations remain 3 → 3. Contract counts remain Done 23, Partial 54, Missing 28, Total 105, with no clause status changes (`counts.json`). No generated acceptance/claim views are committed. The source lock is regenerated last. Product identity, exact pushed SHA and exact-SHA CI evidence are recorded in `product-receipt.json` and `ci.json`.

The full plan is `PLAN.md`. Product pushes use the supplied cloud push guard and the named branch only. The complete explicitly selected non-secret packet is transported separately on the evidence ref. The Mac fleet retains responsibility for its publication scan, landing and post-landing checks. This report does not claim the missing Sentry rule-carry behavior is implemented.

Current product custody: branch `cloud/sd-spool-import-rules-1`, head `dfd4d220dccf5a044c46613260e5b8f6cdf6a091`, pushed successfully on the first guarded attempt. Verify run `44153158707` was discovered in progress on that exact SHA. No PR was created. At the stop condition, the latest exact-SHA poll (19:11:20 UTC) still reports in_progress with no conclusion; four GitHub calls have been used. No green or terminal result is claimed. Product work stops for the explicit contract/lease conflict, not for API-budget exhaustion.

The additional D1 shape check passed all five routing statements; the changed admission statement has 27 expanded FROM items and depth 67, within the documented 90/90 margin (`sql-size.json`).

Terminal task disposition: BLOCKED by the quoted ALERT-001 preview-refusal requirement versus the requested behavior and the no-release-metadata lease. The absent native Sentry rule-carry mapping is an additional incomplete part of the assignment. The named product branch and all actual evidence remain preserved. A green CI result cannot resolve either scope/contract prerequisite.

Final observed CI: Verify run 44153158707, exact head dfd4d220dccf5a044c46613260e5b8f6cdf6a091, status in_progress, conclusion null, checked 2026-11-17T19:11:20.020596+00:00. CI remains an additional unmet READY prerequisite. No CI watcher remains running.
