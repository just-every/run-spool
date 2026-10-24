# Owner review inbox

The Issues screen supports `review:pending`: a new or regressed issue is pending until its latest new-issue/regression alert is marked reviewed. The count covers the matching retained corpus, independent of pagination and browser-local Unseen state. A later regression returns the issue to pending review.

Select one issue or a displayed-page selection, choose Mark reviewed, then Preview triage. Apply records the reviewed alert boundary and one audited action atomically. It changes no triage state, resolution, issue revision, occurrence, grouping or assignment. A changed issue, new occurrence, regression or competing review invalidates the preview for the whole selection. Repeating review for an already reviewed boundary is a no-op.

Saved views contain only the validated `q`, `status`, `release` and `sort` query fields. Each project has at most 25 owner-only views. They have no stored title, reviewer identity or shared/team authority; unsupported identity fields such as `user.email` are refused. Saved query links are ordinary search links and never grant access. Native owner sign-in and exact-project authority apply on every read and write.

Review boundaries and saved queries travel in private archives and validated restores and are deleted by project and installation-owner erasure. Saved views and review actions are audited. Team search, shared views and additional priority semantics remain gaps.
