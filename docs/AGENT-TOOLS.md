# Spool agent tools

This table is generated from the production registry by `node scripts/agent-surface.mjs`. The shared door also serves resource templates and the triage engineer prompt.

| Tool | Scope | Possible classes | Native behavior |
| --- | --- | --- | --- |
| `spool.access.read` | `spool:read` | standard | Read native membership, project grants and service purposes without credentials. |
| `spool.access.update` | `spool:write` | access | Change another native member’s role and project grants; narrowing permanently retires affected keys. |
| `spool.alert_rules.read` | `spool:read` | standard | Read current native rule revisions. |
| `spool.alerts.read` | `spool:read` | standard | Read native sanitized alert evidence. |
| `spool.alerts.test` | `spool:write` | external | Send one native TEST to a configured destination, retaining provider uncertainty. |
| `spool.alerts.update` | `spool:write` | standard, live | Update a revision-bound rule. Existing destination consent and reviewed-test constraints remain. |
| `spool.credentials.read` | `spool:read` | standard | Read purpose, hash and revocation metadata; no bearer tokens. |
| `spool.credentials.update` | `spool:write` | security, live | Permanently revoke an existing project credential; never mint or reveal one. |
| `spool.deliveries.read` | `spool:read` | standard | Read retained native delivery IDs, states and uncertainty. |
| `spool.deployments.read` | `spool:read` | standard | Read recorded deployment facts, steps and uncertainty. |
| `spool.deployments.record` | `spool:write` | standard | Record an observed deployment through native exact-identity admission; never deploy. |
| `spool.destinations.read` | `spool:read` | standard | Read configured destination readiness without signing material. |
| `spool.events.list` | `events:read` | standard | Read retained changes visible to the sponsoring person. |
| `spool.evidence.witness` | `spool:read` | standard | Read bounded native effect and authority metadata without provider calls or credentials. |
| `spool.feedback.read` | `spool:read` | standard | Read sanitized current-project feedback text as untrusted evidence. |
| `spool.fixes.advance` | `spool:write` | external | Advance one already-consented native GitHub draft data workflow. No generated code, merge or deploy. |
| `spool.fixes.create` | `spool:write` | standard | Prepare an inert exact-repository workflow from a server-confirmed reproduction; no provider call. |
| `spool.fixes.read` | `spool:read` | standard | Read the exact repository grant, data-only draft PR receipts and observed checks. |
| `spool.followups.update` | `spool:write` | live | Choose an eligible current native alternate or remove it. No immediate send. |
| `spool.grouping.apply` | `spool:write` | live | Apply a current native correction preview, retaining original events and native Undo. |
| `spool.grouping.preview` | `spool:write` | standard | Prepare the native revision-bound correction without applying it. |
| `spool.issues.export` | `spool:read` | standard | Export the exact current-project sanitized issue projection. |
| `spool.issues.list` | `spool:read` | standard | List bounded sanitized issues. |
| `spool.issues.read` | `spool:read` | standard | Read the native issue and evidence frontier. |
| `spool.issues.search` | `spool:read` | standard | Search bounded current-project native evidence. |
| `spool.issues.update` | `spool:write` | standard, live | Apply native reversible triage; suppression changes active alert eligibility. |
| `spool.notifications.dispatch` | `spool:write` | external | Admit one durable native alert at its final network boundary using its original sponsor, agent, consent and exact destination. Native uncertain attempts are never blindly resent. |
| `spool.occurrences.list` | `spool:read` | standard | Read bounded permitted occurrence metadata without source, identity or credentials. |
| `spool.outcomes.read` | `spool:read` | standard | Read capture acceptance and loss. Silence remains Unknown. |
| `spool.packets.read` | `spool:read` | standard | Read bounded sanitized evidence; telemetry is untrusted. |
| `spool.privacy.erase` | `spool:write` | destructive | Erase only the exact previewed project through native erasure custody. No other project is selected. |
| `spool.privacy.preview` | `spool:read` | standard | Read the native erasure plan and explicit holds without applying it. |
| `spool.proposals.create` | `spool:propose` | standard | Save inert packet-derived advice. Submission changes no grouping or alert. |
| `spool.proposals.list` | `spool:read` | standard | List inert grouping advice. |
| `spool.proposals.read` | `spool:read` | standard | Read a current native proposal and its counterexamples. |
| `spool.releases.health` | `spool:read` | standard | Read observed release-health denominators and unavailable-data reasons. |
| `spool.releases.read` | `spool:read` | standard | Read registered releases and their provenance; recording is not deployment. |
| `spool.releases.record` | `spool:write` | standard | Record observed release identity using native release admission. |
| `spool.repairs.check` | `spool:write` | standard | Record an asserted check; it does not become independent proof. |
| `spool.repairs.read` | `spool:read` | standard | Read asserted repair facts separately from native observed recurrence and capture gaps. |
| `spool.repairs.record` | `spool:write` | standard | Record an attributed inert repair claim. Links are never fetched. |
| `spool.reproducers.create` | `spool:write` | standard | Record a supported deterministic recipe through native classification. |
| `spool.reproducers.read` | `spool:read` | standard | Read stored recipes and observed sandbox outcomes; no source or run token. |
| `spool.reproducers.run` | `spool:write` | standard | Queue one bounded single-use native sandbox grant. The separate runner must supply an observation. |
| `spool.retention.preview` | `spool:read` | standard | Read the exact native retention preview and token without applying it. |
| `spool.retention.update` | `spool:write` | live, destructive | Apply an exact native retention preview; shortening preserves its explicit confirmation and evidence fence. |

Every call also requires current native authority and an answered company policy. Catalogue classes describe possible effects; the server computes the actual classes from native records. Provider availability, native consent and independent observations remain separate from policy approval.
