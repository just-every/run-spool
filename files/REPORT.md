# Spool Sentry alert rule import

Run Edit Run fleet · 18 November 2026 · sd-spool-import-alerts-1

## Plan

1. Use the existing owner and Business Sentry import pipeline to review legacy project issue rules, organization metric rules, and workflows with linked monitors. Record disabled proposals and exact source paths for omissions.
2. Create the native rules in one audited owner approval. Resolve member and team email recipients from the approved roster and native project scope. Keep unsupported destinations and conditions on disabled native records.
3. Keep dependent rules idle until matching user or session data arrives. Preserve manual preview requirements, exclude source history from evaluation, and check scheduling across a Worker restart.
4. Verify re-import, guarded undo, audit and project erasure through public doors. Capture the Settings receipt at 1440 and 390 CSS pixels. Build, check the contract and source lock, and follow exact-SHA Verify on the cloud branch.

## Import receipt

Your Sentry alert rules were brought over as rules waiting for your approval. Those that need data wait for their first event or session, and a rule whose Slack, PagerDuty or other destination Spool cannot reach is listed as needing a destination.

The synthetic export covers a new-issue rule, an event-frequency rule, unique users, warning and critical thresholds with a resolve threshold, crash-free sessions, session counts, session failure rate, a workflow with a linked monitor, a Slack destination, an unsupported aggregate and a malformed rule. A separate synthetic organization exercises a verified member, an explicitly assigned team and an unmapped member.

Migration 0114 extends the existing proposal discriminator and retains the roster rows. Migrations 0111–0113 were reserved by the concurrent setup and keys rounds. Rule state, provenance, the native alert feed and recipients use the existing stores. Approval creates local-feed rules where the source has no actions. The receipt lists destinations that require a native choice.

## Results

The primary fixture held 12 source definitions. It produced 10 pending proposals, one linked monitor, and one refused rule. Approval produced 10 native rules, with four waiting for observations. The fixture's normal, burst and recovery windows brought over seven historical events. Public preview measured zero live events from those windows and created no delivery. Matching events and a session activated the four waiting rules. The repeat schedule after restart kept the same alert feed. The fixture ended with zero deliveries, exact undo for an unchanged import, HTTP 409 for a locally edited native rule, and a completed project erasure.

The separate destination fixture bound a verified member and an explicitly assigned team, and kept an unmapped member rule disabled. The Settings action created the native rules through the browser. Both browser images show the same receipt states. The phone capture scrolls the existing dialog to the alert list.

## Scope and qualification

The fixture uses the [public Sentry workflow schema](https://docs.sentry.io/api/monitors/fetch-alerts/) and [monitor schema](https://docs.sentry.io/api/monitors/fetch-an-organizations-monitors/). Trigger times remain in private source custody. Unsupported mappings have named reasons and JSON paths. Spool uses the current native per-project rule and destination capacities.

Full target counts are 23 done, 54 partial, and 28 missing across 105 clauses before and after. MIG-001, ALERT-001 and AUDIT-001 remain partial. ERASE-001 remains done. One new public-door journey covers the alert import. The existing manual refusal assertions were preserved. The `aria-describedby` waits were added to the two existing Alerts UI checks that read the attribute, and the operator assignment check waits for its rendered alert.

GAP MIG-001: A real authorized Sentry export and production-volume dual run remain open.

GAP ALERT-001: This round qualifies import approval and the synthetic data-dependent rules. Source families and conditions outside the supported mapping are reported field by field.

GAP AUDIT-001: The import approval is qualified through the permanent audit. The full clause continues to cover other action families.

GAP ERASE-001: The alert import journey qualifies its project cascade. Existing production-scale qualifications remain separate.

The cloud VM delegates the complete publication scan and landing to the fleet. The two platform playbook reads returned HTTP 404 through the supplied GitHub credential. Work followed the shipped builder rules and the repository instructions.

## Validation

Local build, typecheck, repository and contract checks, pinned Base check, integration check, source lock, the Sentry import suite, the native alert suite, the Alerts browser suite and the old-archive suite passed. The focused Sentry alert journey completed project erasure. The broader local project-erasure suite hit startup timers twice and the outer time limit on an isolated retry.

Verify 44243712834 failed the repair-recovery archive journey with HTTP 409. Its historical fixture removed the roster proposal table while leaving the new alert-proposal migration in the recorded ledger. The follow-up commit rewinds both roster-era migration entries when the fixture removes that table. The previous-release archive then restored through the public restore route locally, and the existing unexpected-trigger refusal still returned HTTP 400. The final exact-SHA Verify status is in VALIDATION.json.
