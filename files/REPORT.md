# Spool S9 alert-rule import

Builder sd, 20 November 2026 UTC. Repository just-every/run-spool. Branch cloud/sd-spool-s9-import-alert-rules-1.

## Plan and reproduction

1. Reproduce on a depth-one, blobless checkout of main at 804a4ad15e6c8e1c52f0069dcf610ba1f5d2342c. Parse the ten-rule synthetic export with parseSentryOrganization and organizationMapping, then plan, apply, authorize the roster invitation, and approve rules through the existing owner HTTP import door. Record the reason or destination status by rule.
2. Map supported conditions and delivery settings to the existing Spool types. Preserve owner approval and require native recipient authority. Keep unsupported rules in the review report by name and reason.
3. Extend the existing Sentry alert import journey. Preview each mapped rule through the native ruleInput door, prove named omissions and refusal cases, run the ordered build checks and touched suites, verify the exact branch SHA, and publish this packet on the separate evidence ref.

| Synthetic rule | Main result | Candidate result |
| --- | --- | --- |
| Numerical severity | Invalid severity | Sentry level 40 is native error with the original comparison. |
| Reappeared issue | Unsupported ReappearedEventCondition | Native reactivation. |
| Shared threshold destination | Destinations differ by threshold, and the team did not bind | Both thresholds bind to one team destination despite different source action IDs. |
| Aliased crash-free rate | Unsupported aggregate | Native crash-free rate, below 95% critical and 99% warning, resolves above 99.5%. Waits for the first session. |
| Transaction wildcard | Unsupported metric search filter | Native transaction glob /v1/*. |
| HTTP status wildcard | Unsupported metric search filter | Native error-event tag glob 5*. |
| Issue owners | Disabled and reported as needing an email destination | Disabled and named with the missing native ownership rules. |
| Imported team | Roster assigned Imported project, and approval could not bind the team | Explicit invitation assigns Synthetic On Call, and approval binds that team with active-member fallthrough. |
| First seen | Active | Active. |
| Unsupported condition | Unsupported EventAttributeCondition | Disabled and named with the unsupported condition. |

The ten-rule fixture improved from 1 expressible rule to 8, with disabled or unmapped definitions dropping from 9 to 2. The candidate's 8 accepted definitions comprise 7 active and 1 waiting for session data after approval. Each passed the native rule preview and its input validation. No deliveries were generated. Applying the import still leaves proposals inert until owner approval.

The extended journey also verifies that unknown severity 55, AllMembers fallthrough, different destinations at different thresholds, and HTTP status filtering on the transactions dataset are named refusals. Native ActiveMembers and NoOne fallthrough are preserved where the target binds. Sentry's NotifyEmailAction defaults to ActiveMembers when no setting is provided. Older plan payloads without stored fallthrough keep their original NoOne behavior. The roster can assign a single unambiguous imported team on explicit invitation and keeps existing custom assignments and the legacy slug matching door.

## Clause

MIG-001 remains partial with no judgment or generated-view changes. The evidence covers alert preview and named omission behavior within points 1 and 7, including the existing guarded-undo checks. Remaining obligations include full collection reconciliation and the UX gaps in the clause, plus the real authorized Sentry export/API lifecycle, genuine signed receipt, and production-volume dual-run and cutover.

Native mapping files touched under src/domain/alerts are filters.ts and targets.ts. Neither changes native validation. No tests were registered separately. The new fixture case extends the existing alertRulesImport journey.

## Publication history

The first product push, db65530c260493cfe64a3954ac5642c1e98e6c75, failed Verify run 44783955288 in the build job's source check. The lock had been generated before Git tracked the new fixture and roster helper, so it omitted both. The contract documentation job passed.

The follow-up 17a07a88355a0cae30f98fd9eafe846305493067 adds both tracked files to sources.lock.json. A committed-tree source check passed. The two commits have identical application source and test files. Both author and committer identities and all trailers were checked before publication.

## Final verification

On 17a07a88355a0cae30f98fd9eafe846305493067, the ordered native-export, first-party, source lock, offline Base-copy, application build, integration, agent-surface and type checks all passed, followed by the generated contract check and the touched Sentry alert import journey. The wider Sentry HTTP, organization import, roster/ownership and Business import journeys also passed. The existing native-alert suite passed all three tests.

At 17:48 UTC, Verify run 44785125719 reported in progress for the exact pushed SHA. That observation used the last call in the ten-call GitHub budget. Product custody is PUSHED. The evidence transfer is independent of Verify and landing.
