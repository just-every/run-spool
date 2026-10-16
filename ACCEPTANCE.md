# Spool acceptance

Target scope approved 16 October 2026: a US development team can replace Sentry, Datadog Error Tracking, Rollbar or Bugsnag for web/server/mobile capture, team investigation, release health, alerting, migration and verified repair. CONTRACT.md defines the full target; these journeys specify how a build round proves each clause through the shipped product. They do not claim every journey already runs.

The current implementation baseline is `8f4d8fe3398de51567a0f0b04514c310e08547ba`. Status meanings match CONTRACT.md: done for the stated implemented bounded behavior, partial for a working subset, missing for no implementation proof. Citations point to existing source/tests, not newly invented programs. Local results and provider doubles qualify only their tested boundary. Real SDK/device, buyer-export, repository and hosted provider acceptance remains separate.

## Required verification by clause

For every new flow, exercise the public UI/API/command rather than direct database mutation; use controlled network/provider edges only in tests. At 1440 and 390 inspect the changed user path and all empty/loading/denied/error/success states using realistic test data, keyboard/focus and reflow checks. A build round runs tests for what it touches; pushed CI is the complete wall. Keep the existing implemented journey catalogue below, the Base publication scan and all existing contract/command checks passing.

### Evidence core

- **ERR-001 — Bounded admission. Status: done.** Send valid, invalid, oversize, foreign-project and conflicting-retry envelopes through public ingest; inspect the outcome and unchanged rows for refusals.

  Current evidence: `src/domain/admission.ts`; `src/domain/capture.ts`; `tests/product-runtime.mjs`; `tests/multilingual.mjs` Python/Go tests use constructed envelopes; broad runtime SDK compatibility is SDK-001.

- **ERR-002 — Atomic acceptance. Status: done.** Ingest an event twice, then change its raw secret under the same ID; inspect one occurrence and aggregate increment, one local alert and an explicit conflict without partial rows.

  Current evidence: `src/domain/admission.ts`; `src/domain/capture.ts`; `tests/product-runtime.mjs`

- **ERR-003 — Scrub before storage. Status: done.** Ingest privacy canaries and inspect stored events, issue views, packets, archives and delivery content; common secrets are removed while ordinary diagnostic content survives.

  Current evidence: `src/domain/privacy.ts`; `src/domain/scrub.ts`; `tests/privacy-table.mjs` Coverage is the present native/Sentry projection; new context and replay controls remain unfinished.

- **ERR-004 — Separated authority. Status: done.** Call each private transport anonymously and with wrong-scope, foreign-project, revoked and fenced grants; denied writes change no state, and direct map URLs reveal no private bytes.

  Current evidence: `src/domain/api.ts`; `src/domain/credential-fence.ts`; `src/domain/agent-access.ts`; `tests/agent-handoff.mjs`; `tests/dev-credentials.mjs`

- **ERR-005 — Source map identity. Status: done.** Capture a minified second-origin exception before and after uploading the matching map; compare original coordinates, immutable admission diagnostics, mismatch refusal and confidential source exclusion from packets.

  Current evidence: `src/domain/artifacts.ts`; `src/domain/packet.ts`; `tests/triage-journey.mjs`; `tests/sentry-sdk.mjs` Current storage is 20 flat maps of 256 KiB per project; broader artifact processing is SRC-001 and SDK-002.

- **ERR-006 — Audited triage and regression. Status: done.** Resolve a captured issue, admit its fingerprint in a newer and then older release, and inspect regression identity. Preview/apply/undo split and merge through owner HTTP/UI, reject stale revisions and inspect original membership.

  Current evidence: `src/domain/admission.ts`; `src/domain/operators/grouping.ts`; `tests/alerts-native.mjs`; `tests/operator-flow.mjs`; `tests/operator-ui.mjs` Same-release recurrence policies, bulk actions and collaborative triage are TEAM-003.

- **ERR-007 — Sanitized evidence packet. Status: done.** Read the same packet through HTTP, CLI and official MCP transport at size/retention/import/loss boundaries; compare projections and verify no secrets, source bytes, writes or cross-project reads.

  Current evidence: `src/domain/packet.ts`; `src/domain/agent-projection.ts`; `packages/agent/bin/spool-agent.mjs`; `tests/agent-handoff.mjs`

- **ERR-008 — Loss counters and repair observation. Status: done.** Record a repair through owner HTTP, deny every project-grant write, then exercise deployed/no-events, healthy exercise, older-release event, loss and recurrence cases; inspect packet verdicts and absence of side effects from manual records.

  Current evidence: `src/domain/repairs/routes.ts`; `src/domain/repairs/observation.ts`; `tests/repair-recovery.mjs` The bounded current verdict cannot prove unobserved users, differently grouped failures or unknown client loss.

- **ERR-009 — Archive, restore and retention. Status: done.** Export a populated installation via browser and rer, restore into an independent empty destination, compare retained records and inspect inert work. Refuse tampered, conflicting and nonempty-target imports before mutation; retain repair gaps after cutoff.

  Current evidence: `src/domain/archive.ts`; `src/domain/portability.ts`; `src/domain/retention.ts`; `scripts/installer/portability.mjs`; `tests/product-runtime.mjs`; `tests/agent-handoff.mjs` This is the retained Base portability replacement: source/maps are portable; installation authority and executable grants are not. Scheduled policies are GOV-002.

- **ERR-010 — Release gates. Status: partial.** Run the named implemented journeys on the emitted Worker, inspect 1440/390 end states, then qualify each supported runtime/device and configured real provider with a buyer-controlled account.

  Current evidence: `tests/triage-journey.mjs`; `tests/agent-handoff.mjs`; `tests/repair-recovery.mjs`; `tests/execution-journey.mjs` Local journeys exist; full target, hosted/provider and native-device acceptance remain open.

### Teams and triage

- **TEAM-001 — Organizations, members and project permissions. Status: partial.** Invite two teammates and an external read-only collaborator; grant access to disjoint projects, triage concurrently, remove a member and verify immediate denial across UI, HTTP, SDK-management, CLI and exports.

  Current evidence: `src/auth/session.server.ts`; `src/domain/owner-authority.ts`; `tests/owner-erasure.mjs` Only one active owner and isolated projects exist. Successor invitation is transfer, not team membership.

- **TEAM-002 — Accountable assignment and ownership rules. Status: partial.** Connect a repository with overlapping ownership rules, capture matched and unmatched errors, confirm accountable assignment and destination, then remove the owner and inspect reassignment/history without leaked access.

  Current evidence: `src/domain/operators/policies.ts`; `tests/operator-flow.mjs` Current assignment is an operator label; authenticated teammates, CODEOWNERS and assignment notifications are absent.

- **TEAM-003 — Collaborative lifecycle and bulk triage. Status: partial.** Two members discuss and bulk-triage searched issues, resolve for the next release, exercise same/new/old-release recurrence and expire a suppression; confirm one accountable follow-up and stale-write refusal.

  Current evidence: `src/domain/api.ts`; `src/domain/operators/policies.ts`; `tests/operator-flow.mjs`; `tests/triage-journey.mjs` Single-issue state and literal suppression/corrections exist; comments, bulk triage and collaborative recurrence policies do not.

### Capture and release health

- **SDK-001 — Multi-language SDKs and DSN-compatible intake. Status: partial.** For every named runtime, execute an unmodified Sentry SDK with only its DSN changed plus Spool setup, capture handled/unhandled failures and flush/restart; reconcile persisted issue, release and discard outcomes through the public UI/API.

  Current evidence: `src/domain/sentry/convert.ts`; `src/domain/sentry/routes.ts`; `packages/sdk/src`; `tests/sentry-sdk.mjs`; `tests/multilingual.mjs` Real browser/Node SDK journeys only; Python/Go payload subsets are tested. Other runtimes and mobile SDKs are absent.

- **SDK-002 — Native crashes and symbolication. Status: missing.** Build signed test iOS/Android and React Native/Flutter apps, crash and hang on real devices, relaunch offline/online, upload matching/mismatched symbols via CI and inspect one deobfuscated issue without duplicate sessions.

  Current evidence: No implementation evidence yet.

- **SDK-003 — Automatic breadcrumbs and private context. Status: partial.** Toggle each instrumentation category in browser/server setup, trigger a failure with secret-bearing URLs/forms, and compare the occurrence timeline, before-send filtering, truncation and stored/forwarded privacy projection.

  Current evidence: `src/domain/capture.ts`; `src/domain/sentry/convert.ts`; `packages/sdk/src/browser.ts`; `tests/privacy-table.mjs` Supplied breadcrumb messages are stored; full automatic instrumentation and configurable context capture are absent.

- **SDK-004 — User feedback attached to failures. Status: missing.** An end user reports a browser/mobile failure with optional screenshot/contact, a teammate triages and replies, an anonymous abuse attempt is bounded, and withdrawal removes the canaries from issue, storage and export.

  Current evidence: No implementation evidence yet.

- **SDK-005 — Crash-free sessions and release health. Status: partial.** Run known healthy/crashing sessions across two app versions and devices, vary sampling and offline delivery, then reconcile adoption and crash-free rates against submitted sessions and visible gaps.

  Current evidence: `src/domain/exposure/proof.ts`; `src/domain/exposure/intake.ts`; `tests/execution-journey.mjs` Repair-specific exposure proof exists; general session intake and release-health dashboards do not.

### Investigation and source

- **GROUP-001 — Explainable grouping and durable corrections. Status: partial.** Capture equivalent and distinct failures across builds, preview a custom rule, apply it to future and explicitly selected historical events, undo a correction and inspect alert rates, immutable originals and repair gaps.

  Current evidence: `src/domain/operators/grouping.ts`; `src/domain/operators/provenance.ts`; `tests/operator-flow.mjs`; `tests/operator-archive.mjs` Default grouping and exact retained-event split/merge exist; configurable future grouping rules do not.

- **FIND-001 — Search, facets and saved investigation views. Status: partial.** Ingest more than the current list limit across projects/releases, find an older off-page event with combined filters, save a view, open it as permitted/forbidden teammates and reconcile query counts and export.

  Current evidence: `src/domain/api.ts`; `src/ui/workbench/IssueList.tsx`; `tests/product-runtime.mjs` Current client search/status/release filters operate over at most 100 loaded groups, not the full corpus.

- **FIND-002 — Impact, trends and team reporting. Status: partial.** Open a multi-release issue and a team report over a known event/session set; reconcile totals, affected counts and triage durations, compare time zones and verify a read-only export omits inaccessible projects.

  Current evidence: `src/domain/packet.ts`; `src/ui/workbench/IssueView.tsx`; `src/domain/issue-release.ts`; `tests/triage-journey.mjs` Counts, retained first/last and release context exist; user/session analytics and team reports are absent.

- **SRC-001 — Build artifacts and CI pipelines. Status: partial.** Build equivalent minified apps with each named bundler, upload from each CI/CLI path using deploy-only authority, capture a real failure and check mapped frames; deny reads/writes outside artifact scope and show a failed/incomplete upload.

  Current evidence: `packages/sdk/src/sourcemaps/plugin.mjs`; `packages/sdk/src/sourcemaps/cli.mjs`; `src/domain/sentry/deploy-routes.ts`; `tests/sdk-package.mjs` Vite/Rollup and Spool CLI upload exist; webpack/esbuild and sentry-cli/CI compatibility remain incomplete.

- **SRC-002 — GitHub, GitLab and Bitbucket source context. Status: partial.** Connect a private repository on each host, deploy a commit that changes the failing frame, follow its source link and suspect explanation, revoke the grant and inspect immediate denial without stale privileged reads.

  Current evidence: `src/domain/fixes/provider.ts`; `src/domain/operators/deployments.ts`; `tests/execution-journey.mjs` GitHub grant and draft PR read-back is tested with a provider double; source links, suspect commits, CODEOWNERS and other hosts are absent.

- **REL-001 — Release and deployment history. Status: partial.** Report started/completed/failed deployments from CI, repeat callbacks, abandon one, roll back production and inspect included commits, timeout follow-up and regression ordering for delayed old events.

  Current evidence: `src/domain/sentry/deploy-routes.ts`; `src/domain/operators/deployments.ts`; `tests/operator-flow.mjs` Completed manifests and registered sequence exist; included-commit history, start/timeout workflow and full rollout history do not.

- **REL-002 — Suspect change and release comparisons. Status: partial.** Deploy two commits while retaining old clients, trigger first/regressed errors and an unrelated spike, inspect candidate reasons and comparable release rates, then reject a false suspect without changing occurrences.

  Current evidence: `src/domain/issue-release.ts`; `src/domain/exposure/proof.ts`; `tests/alerts-native.mjs`; `tests/execution-journey.mjs` First/last release and recurrence correlation exist; commit causality and general release comparison do not.

- **CTX-001 — Error-linked traces, logs and request performance. Status: partial.** Exercise a browser-to-service-to-job failure with propagated trace IDs, inspect one correlated waterfall/log path and missing-sample labels, then open authorized Datadog/Splunk context and verify revoked export credentials stop forwarding.

  Current evidence: `src/domain/otlp/routes.ts`; `src/domain/otlp/convert.ts`; `tests/otlp-flow.mjs` Only bounded OTLP/HTTP JSON logs are accepted; trace/span identity is not persisted and traces/metrics are refused. Forwarders are absent.

- **CTX-002 — Privacy-controlled session replay. Status: missing.** Opt in on a realistic checkout/account flow, trigger an error, play the preceding path from issue detail, verify masked fields in stored replay and exports, then revoke access and erase the session across playback/artifacts.

  Current evidence: No implementation evidence yet.

### Alerts and delivery

- **ALERT-001 — Filtered rules and real anomaly detection. Status: partial.** Create filtered rules in the app, replay normal/burst/seasonal/low-traffic windows with loss, inspect baseline and threshold reasons, and reconcile exactly one alert per qualifying transition and no alert outside its filter.

  Current evidence: `src/domain/alerts/rules.ts`; `src/domain/alerts/spikes.ts`; `tests/alerts-native.mjs` New/regression and fixed-window count rules exist; historical baselines, crash-rate and rich routing filters are absent.

- **ALERT-002 — Email, Slack, Teams, Oncall and PagerDuty. Status: partial.** Connect each destination using buyer-controlled accounts, test and trigger a filtered new/regressed issue, follow its exact issue link, acknowledge from chat/on-call where supported, rotate/revoke credentials and reconcile delivery history without duplicate pages.

  Current evidence: `src/domain/alerts/mail.ts`; `src/domain/alerts/webhook.server.ts`; `src/domain/alerts/destination-management.server.ts`; `tests/alerts-egress.mjs`; `tests/alerts-ui.mjs` Page-managed email and signed generic webhooks exist; native Slack/Teams/Oncall/PagerDuty adapters and real delivery qualification are missing.

- **ALERT-003 — Destination tests, digests and snoozing. Status: partial.** Add and test each channel, enable only after reviewing its result, schedule a US-timezone digest, snooze through a burst and expiry, and inspect one digest/resumption plus unchanged issue evidence for test sends.

  Current evidence: `src/domain/alerts/destination-management.server.ts`; `tests/alerts-ui.mjs` Main now tests page-managed email destinations. Cross-channel tests, digests, recipient confirmation and timed snoozing remain missing.

- **ALERT-004 — Durable follow-up and visible automation failure. Status: partial.** Interrupt before and after the send boundary, restart, expire a lease, revoke a rule and lose a provider response; inspect durable state, deduplication, operator follow-up and explicit reconciliation, then restore without replay.

  Current evidence: `src/domain/alerts/dispatch.ts`; `src/domain/fixes/workflow.ts`; `tests/alerts-runtime.mjs`; `tests/alerts-immediate.mjs`; `tests/execution-journey.mjs` Durable bounded alert/fix histories exist; alternate failure notification and universal overdue/lease follow-up are incomplete.

### Delivery integrations

- **TRACK-001 — Vector, Jira and Linear issue sync. Status: partial.** Create a ticket from a Spool issue in each tracker, repeat the action, resolve/reopen on both sides, reject a stale/forged callback and disconnect; confirm one ticket, consistent links and visible conflict rather than silent overwrite.

  Current evidence: `src/domain/repairs/routes.ts`; `src/domain/fixes/workflow.ts`; `tests/repair-recovery.mjs` Manual repair links and draft PR history exist; tracker creation and status synchronization do not.

### Migration and portability

- **MIG-001 — Sentry organization migration. Status: partial.** With a real buyer export/API account, preview/reconcile all named collections, apply/resume, compare issue/event/artifact samples, dual-run unchanged SDKs and cut over; inspect unsupported mappings and guarded undo preserving native edits.

  Current evidence: `src/domain/sentry-import/source.ts`; `src/domain/sentry-import/mapping.ts`; `tests/sentry-import.mjs`; `tests/sentry-sdk.mjs` Custom bounded synthetic organization bundles and browser/Node DSNs work; real Sentry export/API reconciliation and full collection mapping are unproved.

- **MIG-002 — Datadog Error Tracking migration. Status: missing.** Import a real Datadog buyer project, review mappings and exceptions, reconcile sampled issue/event/history records and monitor rules, dual-run one service and cut over with no imported alert replay or duplicate native events.

  Current evidence: No implementation evidence yet.

- **MIG-003 — Rollbar migration. Status: missing.** Migrate a real Rollbar project with resolved and reactivated items, compare counts/stacks/deploys and rules, resume an interruption, exercise the replacement capture setup and verify history causes no outbound work.

  Current evidence: No implementation evidence yet.

- **MIG-004 — Bugsnag migration. Status: missing.** Migrate a real Bugsnag web/mobile project, reconcile sampled errors/events and release stability inputs, repoint capture and symbol CI, inspect an original native stack and show gaps where source exports lack historical sessions.

  Current evidence: No implementation evidence yet.

- **MIG-005 — Up-and-comer switching paths. Status: missing.** For a buyer-controlled project in each named service, preview/import representative errors and lifecycle, reconcile source counts and links, cut over capture, and verify resumed imports are idempotent and imported history stays inactive.

  Current evidence: No implementation evidence yet.

- **API-001 — Public APIs, attachments and full export. Status: partial.** Use a read-only service grant to paginate all retained records and attachments, reconcile with the UI/archive, reject foreign scope, export a large query with named bounds and restore without secrets or active work.

  Current evidence: `src/domain/api.ts`; `src/domain/packet.ts`; `src/domain/archive.ts`; `tests/agent-handoff.mjs` Bounded packets and complete current private archives exist; broad paginated APIs, attachments and report exports do not.

### Governance and operation

- **GOV-001 — Enterprise identity and administration. Status: partial.** Configure SSO with each named provider, provision a member and project role, enforce step-up, revoke the IdP user while a session/grant is active and verify all private doors deny access; recover through the documented owner procedure.

  Current evidence: `src/auth/bindings.ts`; `src/editor`; `tests/owner-claim.mjs`; `tests/owner-editor.mjs` Native owner auth and linked identity bindings exist; organization SSO/SCIM and named enterprise-provider qualification do not.

- **GOV-002 — Retention, residency and data custody. Status: partial.** Set different retention windows, preview counts/coverage, hold/export one project and run the scheduled cutoff; inspect private artifacts removed, historical gaps, cost estimate and complete erasure/restore fences.

  Current evidence: `src/domain/retention.ts`; `src/domain/privacy.ts`; `tests/agent-handoff.mjs`; `tests/project-erasure.mjs` Manual cutoff, tombstones and explicit gaps exist; scheduled/plan retention, residency choice and legal holds do not.

- **BILL-001 — Predictable USD usage and ingestion budgets. Status: partial.** Run representative volume through a project budget, reconcile usage and displayed USD forecast, trigger warning/cap outcomes, adjust sampling, and complete a buyer-controlled billing sandbox invoice with tax and cancellation handling.

  Current evidence: `src/domain/admission.ts`; `src/domain/api.ts`; `tests/product-runtime.mjs` Accepted/rejected/budget counters exist; full client-discard accounting, cost forecasting and commercial billing are missing.

- **UX-001 — Mobile operations and accessible investigation. Status: partial.** At 1440 and 390, onboard a realistic team project, capture/map an error, search/assign/comment, follow an alert, approve a repair and inspect all end states with keyboard, screen reader checks and revoked/offline sessions.

  Current evidence: `src/ui/workbench`; `tests/triage-journey.mjs`; `tests/alerts-ui.mjs`; `tests/execution-journey.mjs` Current single-owner core has responsive/Axe journeys; full target team/mobile workflows are absent.

- **OPS-001 — Base commands and native admission. Status: done.** Use public rer install/setup/dev/export/import/reset and deployment dry-run in a fresh checkout and independent destination; preserve existing setup, reject unsafe answer paths and reused managed claims, and deny anonymous/project-grant editor access.

  Current evidence: `scripts/installer/local.mjs`; `scripts/installer/portability.mjs`; `src/editor`; `tests/commands.mjs`; `tests/owner-claim.mjs`; `tests/dev-credentials.mjs` Local command behavior is implemented; actual owner-account deployment and provider acceptance are separate gates.

- **AUDIT-001 — Permanent privacy-safe action audit. Status: partial.** Perform owner/member/agent and denied actions, restart/export/restore, erase an actor/project and inspect retained nonpersonal chronology, correct outcomes and absence of secret/erased identifiers.

  Current evidence: `src/domain/owner-authority.ts`; `src/domain/erasure`; `tests/project-erasure.mjs`; `tests/owner-erasure.mjs` Current destructive/triage and workflow audit exists; organization-wide audit UI/export and future provider paths are incomplete.

- **BASE-DATA-003 — Project and installation-owner erasure. Status: done.** Run public setup/dev/HTTP/export/import erasure journeys with canaries in every declared store, count-only preview/receipt, wrong-scope/origin/stale denials, a 10,000-event project erased within 300 seconds, successor handoff, resumed partial erasure and same/fresh-destination old-archive fences.

  Current evidence: `src/domain/erasure/declaration.ts`; `src/domain/erasure/owner-declaration.ts`; `src/modules/erasure`; `tests/project-erasure.mjs`; `tests/project-erasure-cap.mjs`; `tests/owner-erasure.mjs` Done for the current declared store and exact-identifier policy, not unimplemented mobile/replay/feedback stores or external copies. Full retained limits appear in the custody section above.

### Delivery integrations

- **INT-001 — Vercel and Netlify deployment connectors. Status: missing.** Deploy preview and production from each provider, upload artifacts, trigger a mapped error, fail/roll back a deployment and replay a callback; inspect one deployment identity and immediate disconnect/erasure fences.

  Current evidence: No implementation evidence yet.

### Push further

- **AI-001 — Controlled coding-agent handoff. Status: partial.** In each named agent client, request one issue packet, inspect its untrusted labels and missing coverage, refuse cross-project/mutation/prompt-injection requests, revoke the grant and confirm the next HTTP/CLI/MCP call is denied.

  Current evidence: `packages/agent/src`; `src/domain/agent-access.ts`; `src/domain/packet.ts`; `tests/agent-handoff.mjs` Generic read-only CLI/MCP is implemented; named client qualification and model-egress controls for automated work are incomplete.

- **AI-002 — Generate and test the smallest reproduction. Status: partial.** Approve a real captured failure, inspect a minimal failing case and competing-cause experiment, run malicious telemetry/timeout/missing-artifact cases, and repeat against the fixed release; failed setup cannot become not-reproduced success.

  Current evidence: `src/domain/reproducers/classify.ts`; `src/domain/reproducers/sandbox.ts`; `scripts/reproduce/runner.mjs`; `tests/execution-journey.mjs` Bounded mapped-JavaScript reproductions with supplied calls exist; automatic minimization, cause experiments and non-JS/mobile reproduction do not.

- **AI-003 — Minimal code repair as a tested pull request. Status: partial.** Authorize a scoped repair, observe a real source patch and regression failure-before/pass-after in a buyer repository, open one draft PR/MR, cancel/expire/revoke between steps and inspect durable results without unauthorized writes or duplicate branches.

  Current evidence: `src/domain/fixes/workflow.ts`; `src/domain/fixes/provider.ts`; `tests/execution-journey.mjs` Current GitHub double journey opens a data-only artifact PR and observes merge/checks; generated code fixes, real repository acceptance and GitLab are absent.

- **AI-004 — Prove the released repair from live rates. Status: partial.** Deploy a reviewed fix to only part of traffic, generate known healthy and failing flow exposure, introduce old-version errors and capture gaps, then restore coverage and recur; inspect rate comparison, inconclusive/reached/recurred states and one accountable recurrence follow-up.

  Current evidence: `src/domain/exposure/proof.ts`; `src/domain/repairs/observation.ts`; `tests/execution-journey.mjs`; `tests/repair-recovery.mjs` Current proof already compares baseline rates with a confidence bound, affected cohorts, rollout and capture gaps; autonomous production measurement, an ongoing watch and real-account acceptance remain missing.

- **AI-005 — Explain grouping proposals before applying. Status: partial.** Give the agent deceptively similar and rebuilt failures, inspect a proposal with counterexamples and rate/alert differences, reject then approve another, undo it and verify preserved originals and grouping-change coverage gaps.

  Current evidence: `src/domain/operators/grouping.ts`; `src/domain/operators/provenance.ts`; `tests/operator-flow.mjs` Exact manual previews and reversible provenance exist; agent proposals/counterexamples and projected rate effects are absent.

- **AI-006 — Prevent related failures from recurring. Status: missing.** Accept a repair, introduce a related failure at another authorized call site, inspect the inferred invariant and a failing regression case, reject a false positive, approve a scoped patch and observe later recurrence without automatic expansion.

  Current evidence: No implementation evidence yet.

- **AI-007 — Agent-runtime failure diagnosis and evaluated improvements. Status: missing.** Import/capture authorized failing tool/model runs, cluster a repeated fault with counterexamples, inspect cost/latency and error links, compare baseline/candidate on an approved offline dataset and refuse promotion or external data egress without approval.

  Current evidence: No implementation evidence yet.

## Existing implementation checks

Spool implements one native owner across isolated projects, Base operator-auth and loopback outbox sign-in, scoped ingest/read/deploy grants, scrubbed D1 evidence, bounded private maps, revision-aware triage, browser-origin policy, portability with native v1/v2 restore, manual retention, alerts, bounded Sentry intake and optional managed claim/editor integration. The recorded Base adoption pin is in [base-copies.json](base-copies.json); product-owned `src/**` remains authoritative.

`rer check --profile first-party`, source integrity (`pnpm source:check`) and offline Base-copy checks inspect local structure and recorded bytes; `pnpm integration:check` confirms the published deployment spec matches the emitted build. The operations check uses source and generated local installation inputs. `rer deploy --dry-run` builds and validates the actual package without provider calls. These checks do not establish hosted runtime, provider delivery or publication.

## Implemented public-door journey catalogue

`rer verify` and the CI shards build/typecheck the actual app and exercise the implemented public flows against emitted native Worker/D1 installations, including the project erasure journey below. Run touched tests locally; CI is the complete wall:

- Runtime, product/auth/restore and origin checks; the public CLI and independent first-project journeys at 1440 and 390, no-JavaScript sign-in, failed creation, once-shown keys, Axe/reflow, setup preservation, archive restore and completed restart.
- Agent handoff through `tests/agent-handoff.mjs` (`test:agent-handoff`): public rer setup/dev, compatible bounded packet, real second-origin minified mapping, immutable late-map evidence, coded map/retention/import/loss gaps, public archive/restore at the retained-event cap, secret exclusion, exact project read scope with unchanged state after denied writes, CLI environment/file/stdin inputs and exit/redirect handling, official SDK stdio tools and immediate HTTP/CLI/MCP revocation, plus once-shown key handoff at 1440/390 with masked captures, Axe and reload checks.
- Repair recovery through `tests/repair-recovery.mjs` (`test:repair-recovery`): public rer setup/dev HTTP under the owner dev persona records a repair, checks, approval, merge and deploy in a registered release; stale revision 409, unknown project/issue 404, http/javascript links and an oversize note 400, cross-origin 403, and agent (403), ingest and deploy (401) grants on every repair write, each with unchanged rows; no outbox message, alert or delivery row after any repair write while a real regression is routed. A real minified app on a second loopback origin reaches each verdict: deployed without events, other events without an exercise record (both inconclusive with named reasons), exercised with a healthy window (no recurrence after exercise), an older-release event listed and not counted with no regression, a rejected spike downgrading to inconclusive, and the same fingerprint in R (recurred, regression, event named). The packet before any repair only gains an empty list; after recurrence it names the failed repair inside the agent CLI fence. A pre-repair archive and a populated archive restore intact; retention keeps the repair and marks removed snapshot events. The repair panel reaches every state by clicking at 1440 and 390 with keyboard-only recording, visible focus, Axe and reflow checks.
- Alerts through Base development outbox and an exact-URL test-only trusted transport to a real durable HMAC receiver, including scheduled evaluation/retry, uncertainty, owner/project/origin controls and inert restore. Persisted feed, rules and delivery UI run at 1440 and 390. `tests/alerts-egress.mjs` drives the scheduled delivery path through the egress service's own transport (`createDevEgress`) to a real loopback TLS receiver: one signed webhook arrives once and is logged delivered, a private-address destination is refused with `egress_dns_not_public` before any connection, and a redirect is not followed and is recorded as uncertain.
- A real minified browser app on a second loopback origin, matching private maps, original coordinates, issue links, next-release regression and native triage at 1440 and 390. This is the separate `test:accessibility`/`test:ui` journey.
- Unmodified `@sentry/browser` and `@sentry/node` 11.6.0 programs with the DSN as the only changed SDK configuration, browser mapping at both widths and Node capture/flush. HTTP framing, unsupported-item accounting, origin/key isolation and release/map-only deploy scope are checked separately.
- Synthetic organization import dry run, reviewed apply/resume, exact private originals, inert historical data, grant-scope denial, guarded undo preserving native edits and archive separation. Synthetic fixtures qualify the adapter; a real owner export remains necessary for a claim that the importer migrates a real Sentry organization.
- Signed invalid/first/second owner claim, restart durability and additive existing-owner preservation; anonymous/project-grant editor refusal, revealed interactive iframe at 1440 and 390, live preview/undo through native navigation, focus preservation, CSP and logout revocation against a test-only management edge.
- Operator corrections inside the product journey (`test:product`, `tests/operator-flow.mjs` and `tests/operator-archive.mjs`) and the issue view (`test:ui`, `tests/operator-ui.mjs`): the independently labelled grouping corpus admitted through public ingest, split and merge previews that move nothing, revision-fenced apply and undo with original grouping provenance, operator-label assignment, literal suppression receipts and deployment manifests, archive tamper refusal, retention and project erasure of the new tables. See [OPERATOR-CORRECTIONS.md](docs/OPERATOR-CORRECTIONS.md).
- OTLP/HTTP JSON logs inside the Sentry intake check (`test:sentry`, `tests/otlp-flow.mjs`): the required resource/record profile, refusal of trace, metric, protobuf and compressed requests, ingest-grant and origin isolation, release/build registration, scrubbing of every free-text field and archive projection. See [OTLP-INTAKE.md](docs/OTLP-INTAKE.md).
- Exception languages through `tests/multilingual.mjs` (`test:languages`): structured and raw-text Python and Go exceptions through native and Sentry intake, path mapping by release, the "parsed from text" notice, refusal of foreign or malformed stacks, JavaScript-only maps and execution, and archive restore. See [SUPPORTED-LANGUAGES.md](docs/SUPPORTED-LANGUAGES.md).
- Reproduce, fix and measure through `tests/execution-journey.mjs` (`test:execution`): over public HTTP on the emitted Worker, a minified source-mapped failure is recorded as a supported reproducer (an unmapped one as unsupported) and run by `pnpm reproduce` in the workerd sandbox; Spool's behaviour check yields reproduced, not reproduced (including a forged observation) and failed (missing export, killed loop), and refuses a report that names an outcome, a reused token and a second claim. A fix workflow without `GITHUB_CONNECTION` stops at approved, awaiting connection with no provider request; with a GitHub API double it opens the branch, data-only file and draft pull request under the exact grant, refuses and revokes a broader token, observes merge, then deployment through a manifest naming the merge commit, refuses after expiry without contacting GitHub, and renews. The same reproducer on the fixed release is not reproduced. Exposure verdicts move through inconclusive (no exposure, too little exposure, capture gap), reached and recurred. Archive restore reproduces every view; 1440/390 panel, grant dialog and axe.
- Installation-owner personal-data erasure through `tests/owner-erasure.mjs` (`test:owner-erasure`, with `owner-erasure-authority`, `-resume`, `-finalization`, `-inflight` and `-archives`): sole-owner refusal, successor invitation and replacement, count-only preview, fresh-proof confirmation and atomic handoff to exactly one active owner, deleted/retired/captured data with whole-token matching and explicit holds, interrupted runs and finalization resuming, every owner write and restore admitted before the handoff refused with `409 authority_changed`, and pre-erasure archives refused. See [OWNER-ERASURE.md](docs/OWNER-ERASURE.md).

- BASE-DATA-003 project erasure, implemented at `c279cd2d1fc02acfbc1160201782935e5324ddef` (GitHub Verify run 38215335300 green on that head), through `tests/project-erasure.mjs` (`test:project-erasure`): public rer setup/dev/HTTP/export/import plants unique canaries in event free text, source-map content, an alert recipient and webhook label, an issue title, a repair note, Sentry-import originals and the project name, and keeps a pre-erasure archive. The preview carries counts without personal values or identifiers; anonymous requests get 401, ingest/agent/deploy grants 403, an unknown project 404, a wrong confirmation 400 and a cross-origin request 403, each with every archived row, receipt and outbox entry unchanged. A project at the retained-event cap (10,000 occurrences) is erased within 300 seconds. The preview, typed confirmation and receipt are reached by clicking at 1440 and 390 with Axe and no horizontal overflow; a second erase finds nothing and changes nothing. Afterwards no canary or erased identifier remains in any D1 table or column, the development outbox or a fresh archive; surviving audit rows keep only kind, time and a random label shared with the receipt; unrelated projects keep every row. The pre-erasure archive is refused on the same installation (HTTP and `rer import`), and by a fresh destination that first received the post-erasure archive, including a child-only archive refused as `erased_row:events`; a brand-new store given the older archive with the newer one as `--journal` refuses it, and given only the older archive accepts it (the stated limit). [CONTRACT.md](CONTRACT.md) declares scope exceptions and external limits.

Program presence and dependency pins are not passing results. Completion reporting identifies the exact source head, tests actually run and CI outcome; inspect relevant responsive captures personally. Before push, run Base's publication scan on the exact committed tree. The lane publication gate uses the installed rer `0.2.29-1cb1b9d1` scanner: `node <installed-rer>/scripts/publish-check.mjs --repo <checkout> --ref HEAD --project just-every/spool --repository https://github.com/just-every/run-spool`. Use full local history, zero findings on the exact pushed head, no added exclusions, and report a failure or incomplete scan rather than treating it as a pass. Regenerate only derived metadata required to match the edited documents; confirm no unrelated entries changed and preserve every integrity check.

## External acceptance and engineering obligations

- SDK-001/002 require actual supported runtime SDK executions and native device crash/symbol pipelines. Constructed Python/Go envelopes, browser/Node SDK results and a DSN subset do not establish broad compatibility.
- MIG-001 through MIG-005 require real buyer-controlled exports/API reconciliation with each named source. Current synthetic Sentry organization bundles establish only their adapter behavior; document omissions and do not replay imported work.
- ALERT-002/003 require separately configured mail/chat/paging accounts and recipient checks. A production webhook requires an enforcing egress service; URL preflight or a test transport does not qualify its DNS pinning, TLS or caller/destination controls. Mail/API acknowledgement is not recipient receipt. Local dev suppresses mail.
- SRC-002, TRACK-001, INT-001 and AI-003 require buyer-controlled provider applications, least-privilege setup and real repository/tracker/deployment results. The current GitHub provider double creates a data artifact PR; it proves neither generated source repair nor live repository writes. Owner-recorded repair links remain inert text.
- AI-002 through AI-007 require isolated execution, approved source/model/data scope, cost limits, clear failed/inconclusive outcomes and human control at the stated boundaries. Actual live repair-rate verification needs observed exposure, not an empty feed. Spool never auto-merges or deploys.
- GOV-001/002 and BILL-001 include provider setup, agreements, US data custody, organization identity and USD billing as engineering obligations. This contract round neither calls paid services nor changes provider/publication/account configuration. Hosted editor authorization and deployed edit-to-source behavior also need their own buyer account qualification.
- BASE-DATA-003 preserves every cascade, preview/typed-confirmation, audit, receipt, five-minute cap, successor-transfer, ambiguous-attribution hold, resume/write-freeze and archive-fence limit detailed in CONTRACT.md. Tests must inspect private maps, Sentry-import originals/custody, alert recipient/history/outbox, workflow tokens/leases and unrelated projects. Older offline archives without a later journal, external messages/provider records and D1 backups/Time Travel remain explicit limits. Every new telemetry/replay/feedback table or object store extends the declaration before shipping.

**Target status: 53 clauses — 11 done, 32 partial, 10 missing.**
