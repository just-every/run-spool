<!-- Generated from CONTRACT.md by contract-docs. Edit CONTRACT.md, then regenerate. -->

# Accept a Spool installation

The primary journey: Exercise the capabilities and acceptance journeys below.

## Progress

| Tier | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Core | 25 | 36 | 21 | 82 |
| Agent surface | 0 | 0 | 0 | 0 |
| Later | 0 | 0 | 0 | 0 |
| Full target | 25 | 36 | 21 | 82 |

Judged from the code and tests at commit `01588d3d4167bf40da7bd9c0bbe5d2e131639fb0` (23 October 2026). SRC-004 count, bounded formats, owner byte caps, preserved drafts and custody and SRC-001 minified bundlers, portable required sets, checksums and late artifacts were reviewed through public upload, issue, archive and erasure doors; unrelated clauses retain their recorded evidence and gaps. Field proof register: 0 rows; 0 passed, 0 failed, 0 not run.

## Core

### Evidence core

#### ERR-001 — Bounded admission

Core · published · **done**

**Requirement.** Native version-1 JavaScript, Python and Go exception envelopes require active exact-project ingest credentials, registered release/build identity and bounded fields. Invalid, oversized, volume-limited and conflicting retries have explicit outcomes. Each project admits at most 120 outcomes a minute (`minute_budget`) and retains at most 10,000 events (`retained_event_budget`); over-limit intake returns 429 with `Retry-After` and a counted outcome. GOV-003 carries the target that replaces both limits with its named volume reasons and published sustained rate. Artifact URLs in envelopes are never fetched. Sentry error intake now implements SDK-009's default acceptance with no release or an automatically created release/dist; only its opt-in registered-sequence-only policy requires registration. Native version-1 intake keeps the registered release/build prerequisite. The broader SDK target is SDK-001.

**Acceptance.**
1. Send valid, invalid, oversize, foreign-project and conflicting-retry envelopes through public ingest; inspect the outcome and unchanged rows for refusals.
2. Exceed the per-minute and retained-event limits and confirm the explicit 429, `Retry-After` and counted reason, with no partial rows.

**Evidence.** `src/domain/admission.ts`; `src/domain/capture.ts`; `migrations/core/0008_occurrence_identity.sql`; `tests/product-runtime.mjs`; `tests/multilingual.mjs`
**Gap.** Python/Go tests use constructed envelopes; broad runtime SDK compatibility is SDK-001 and SDK-012 to SDK-019. Removing the 120-a-minute and 10,000-retained limits is GOV-003.

#### ERR-002 — Atomic acceptance

Core · published · **done**

**Requirement.** Accepted means a sanitized occurrence, its group aggregate and its local new/regression alert commit atomically. Retry identity is project plus event ID and SHA-256 of canonical original accepted JSON before scrubbing: identical retry never increments, changed raw content conflicts even if its sanitized result matches. Raw bytes are not retained. Group algorithm version and basis remain inspectable.

**Acceptance.**
1. Ingest an event twice, then change its raw secret under the same ID; inspect one occurrence and aggregate increment, one local alert and an explicit conflict without partial rows.

**Evidence.** `src/domain/admission.ts`; `src/domain/capture.ts`; `tests/product-runtime.mjs`
**Gap.** None.

#### ERR-003 — Scrub before storage

Core · published · **done**

**Requirement.** Apply the native allowlist, bounded text, query/fragment removal and sensitive-text scrubbing before persistence. Native envelopes contain no headers, cookies, request bodies or personal user identity; the `user` interface that unmodified Sentry SDKs send is governed by SDK-008's project identity policy instead. An optional random installation identifier supports bounded exposure measurement; it is never a name or address. Telemetry, source and notes are untrusted data and cannot authorize execution. The event fields SDK-010 keeps from unmodified Sentry SDKs (frame local variables, SDK-sent source context lines, exception values, tags, contexts, request, extra and thread stacks) pass through these scrubbers and SDK-003's server-side rules before storage, and default secret names are masked inside frame variables. Default protection persists when SDK-003 and CTX-002 introduce opt-in context; those captures require their own field policies and previews. Redaction does not promise removal of arbitrary semantic personal data.

**Acceptance.**
1. Ingest privacy canaries and inspect stored events, issue views, packets, archives and delivery content; common secrets are removed while ordinary diagnostic content survives.

**Evidence.** `src/domain/privacy.ts`; `src/domain/scrub.ts`; `tests/privacy-table.mjs`
**Gap.** Coverage is the present native/Sentry projection; new context and replay controls remain unfinished.

#### ERR-004 — Separated authority

Core · published · **done**

**Requirement.** Every private API/document checks the current owner session or its exact ingest, deploy or read-only project grant itself. Cookie writes enforce same origin. Revocation and identity fencing take effect on the next request; confidential maps are never public. Ingest cannot read, deploy can only register releases/upload artifacts and record deployment starts/callbacks, and read-only agent grants cannot mutate. TEAM-001 extends this model to collaborative membership without broadening existing credentials.

**Acceptance.**
1. Call each private transport anonymously and with wrong-scope, foreign-project, revoked and fenced grants; denied writes change no state, and direct map URLs reveal no private bytes.

**Evidence.** `src/domain/api.ts`; `src/domain/credential-fence.ts`; `src/domain/agent-access.ts`; `tests/agent-handoff.mjs`; `tests/dev-credentials.mjs`
**Gap.** None.

#### ERR-005 — Source map identity

Core · published · **done**

**Requirement.** Private flat Source Map V3 lookup matches project, release, build, debug ID and SHA-256 before presenting original coordinates. Missing, invalid or mismatched maps retain generated frames and a reason. Late uploads never rewrite immutable admission snapshots; current lookup is labeled separately. Lines are one-based, columns zero-based. A project stores at most 20 flat maps of 256 KiB; indexed (`sections`) maps are refused with a reason and `sourceRoot` is not applied. SRC-004 carries indexed maps, `sourceRoot`, published capacity and opt-in source fetching. Spool never fetches a remote URL.

**Acceptance.**
1. Capture a minified second-origin exception before and after uploading the matching map; compare original coordinates, immutable admission diagnostics, mismatch refusal and confidential source exclusion from packets.
2. Upload an indexed (`sections`) map and a 21st map in the same project and confirm each is refused with its reason.
3. SDK-010 rich stacks retain up to 1,000 frames per exception, while current source-map lookup projects only 30 located coordinates; expanded mapped lookup is inherited by SRC-004 and this clause without discarding retained SDK stack evidence.

**Evidence.** `src/domain/artifacts.ts`; `src/domain/packet.ts`; `tests/triage-journey.mjs`; `tests/sentry-sdk.mjs`
**Gap.** Indexed maps, `sourceRoot` and published capacity are SRC-004; broader artifact processing is SRC-001 and SDK-002.

#### ERR-006 — Audited triage and regression

Core · published · **done**

**Requirement.** Revision-checked open, acknowledged, resolved and suppressed changes are audited. An issue resolved in its current release reopens as a regression on a recurrence in a later release; delayed older-release events cannot invent one. For native version-1 events the order is the registered sequence, never guessed semver; Sentry events follow the project's stated rule in SDK-009, including releases later enriched by registration. SDK-009 implements resolve in the next or a named release and plain Resolve; TEAM-004 inherits resolution from a commit's release. Plain Resolve regresses on the next accepted event in any release. Recognized JavaScript bundle hash suffixes do not split grouping; native anchors and reported frames stay immutable. Corrections retain exact occurrence provenance and reversible fenced apply/undo.

**Acceptance.**
1. Resolve a captured issue, admit its fingerprint in a newer and then older release, and inspect regression identity.
2. Preview/apply/undo split and merge through owner HTTP/UI, reject stale revisions and inspect original membership.

**Evidence.** `src/domain/admission.ts`; `src/domain/operators/grouping.ts`; `tests/alerts-native.mjs`; `tests/operator-flow.mjs`; `tests/operator-ui.mjs`
**Gap.** Today's Resolve records the current registered release as its watermark (resolve in the current release); same-release recurrence policies, next/named-release resolution, bulk actions and collaborative triage are TEAM-003, and plain Resolve and automatic Sentry releases are SDK-009.

#### ERR-007 — Sanitized evidence packet

Core · published · **done**

**Requirement.** A compatible v1 packet exposes issue/lifecycle/grouping, retained release sequence and per-event release/build/environment, generated/original coordinates, immutable diagnostics beside current lookup, links and coded coverage gaps. UTF-8 JSON is bounded to 256 KiB and ten events, removing oldest events first and naming included/available counts even if none fit. It excludes source snippets, sourcesContent and artifact bytes. It carries the latest computed repair observation and newest three owner-recorded repairs, with omitted history named. CLI and stdio MCP keep exact-project read authority and untrusted/no-execution labels; they cause no model egress.

**Acceptance.**
1. Read the same packet through HTTP, CLI and official MCP transport at size/retention/import/loss boundaries; compare projections and verify no secrets, source bytes, writes or cross-project reads.

**Evidence.** `src/domain/packet.ts`; `src/domain/agent-projection.ts`; `packages/agent/bin/spool-agent.mjs`; `tests/agent-handoff.mjs`
**Gap.** None.

#### ERR-008 — Loss counters and repair observation

Core · published · **done**

**Requirement.** Expose windowed accepted/rejected/budget outcomes, SDK-reported discards by category and reason, and unknown pre-transport loss. Reported discarded errors are a loss input and prevent a quiet feed from proving a repair; other discarded categories do not imply lost errors. Only the owner records revision-checked repair links, scrubbed notes, checks, approval/merge/deploy facts and an exercised-flow record. Links are HTTPS origin/path text and never fetched. Manual repair writes send no notifications or external work. Compute recur/reasoned inconclusive/no-recurrence-after-exercise from stored release sequence, maps, events, exercise and loss; list older-release events separately. Missing exercise, capture, map, exposure or retention yields inconclusive. Never label a quiet feed fixed. AI-004 adds rate-based live proof.

**Acceptance.**
1. Record a repair through owner HTTP, deny every project-grant write, then exercise deployed/no-events, healthy exercise, older-release event, loss and recurrence cases; inspect packet verdicts and absence of side effects from manual records.
2. Current evidence: `src/domain/repairs/observation.ts`; `src/domain/exposure/proof.ts`; `src/domain/sentry/client-reports.ts`; `tests/client-report-flow.mjs`; `tests/repair-recovery.mjs` Windowed server receipts and SDK-reported error discards are explicit loss inputs; reported discarded errors prevent a quiet feed from proving a repair.
3. Existing revision-fenced manual repair observation remains.
4. Unknown pre-transport loss, full session denominators and live agent proof remain gaps.

**Evidence.** `src/domain/repairs/observation.ts`; `src/domain/exposure/proof.ts`; `src/domain/sentry/client-reports.ts`; `tests/client-report-flow.mjs`; `tests/repair-recovery.mjs`
**Gap.** Windowed server receipts and SDK-reported error discards are explicit loss inputs; reported discarded errors prevent a quiet feed from proving a repair. Existing revision-fenced manual repair observation remains. Unknown pre-transport loss, full session denominators and live agent proof remain gaps.

#### ERR-009 — Archive, restore and retention

Core · published · **done**

**Requirement.** Versioned private archives carry stored source bytes, checksums, migration identity, triage, maps, repairs/checks, operator corrections and inert agent grouping proposals (including server-computed review snapshots), reproduction/fix/exposure history, sanitized Sentry evidence, feedback, capture/grouping/release policies and erasure journal. Base owns staging, JSONL integrity, empty-target guards and atomic inactive restore; HTTP/CLI and legacy v1/v2 decoding share semantic validation. Run tokens, step leases, owner sessions, project grants, alert destination records/credentials and dispatch queues never travel; retained alert rules restore disabled and delivery history is historical. Older archives restore newly introduced collections empty under versioned rules. An archive holds at most 10,000 events and 20 artifacts per project and refuses more with `Archive event budget` or `Archive artifact budget`; GOV-003 carries streaming archives of any retained volume. Manual cutoff retention removes private derived content, keeps repair snapshots with coverage gaps and exposes the deduplication horizon. Imported history creates no active grant, dispatch or current repair proof.

**Acceptance.**
1. Export a populated installation via browser and rer, restore into an independent empty destination, compare retained records and inspect inert work.
2. Refuse tampered, conflicting and nonempty-target imports before mutation; retain repair gaps after cutoff.
3. ERR-009 delivery validators (`src/domain/alerts/delivery-archive.ts`) carry alert_provider_events, alert_digest_settings, alert_snoozes, alert_suppressed and alert_scheduled_mail as investigation/configuration data.
4. Restored schedules and quiet hours are disabled; restored snoozes and scheduled mail are historical and never send.
5. Raw recipient receipts and passing-test authority do not travel.
6. Project and installation-owner erasure declare all new stores.

**Evidence.** `src/domain/archive.ts`; `src/domain/portability.ts`; `src/domain/retention.ts`; `scripts/installer/portability.mjs`; `tests/product-runtime.mjs`; `tests/agent-handoff.mjs`; `tests/old-archive.mjs`
**Gap.** This is the retained Base portability replacement: source/maps are portable; installation authority and executable grants are not. Scheduled policies are GOV-002; streaming archives above 10,000 events or 20 artifacts per project are GOV-003 and SRC-004.

#### ERR-010 — Release gates

Core · published · **partial**

**Requirement.** A release must exercise real capture, symbolication, privacy, permissions, persistence and independent restore through the shipped app. Fresh setup has no demo rows. Private flows are accessible and responsive with explicit empty, failure and unavailable states. Source presence, local providers or a green build cannot substitute for hosted, mobile, integration or real-account acceptance. UX-001 and each connector clause specify the expanded product gates.

**Acceptance.**
1. Run the named implemented journeys on the emitted Worker, inspect 1440/390 end states, then qualify each supported runtime/device and configured real provider with a buyer-controlled account.

**Evidence.** `tests/triage-journey.mjs`; `tests/agent-handoff.mjs`; `tests/repair-recovery.mjs`; `tests/execution-journey.mjs`
**Gap.** Local journeys exist; full target, hosted/provider and native-device acceptance remain open.

#### OPS-001 — Base commands and native admission

Core · published · **done**

**Requirement.** The public rer command contract uses declared Node/pnpm pins and one setup manifest for terminal/browser. Setup claims or preserves the owner and private settings, stops its temporary app and leaves empty product data; rer dev uses real assets/HMR and private local identity. Local dev grants never authorize deployed entry. Reset is confirmed/contained and preserves source, exports and deployment receipts. Export/import share Base integrity and inactive empty-target restore. Deployment dry-run makes no provider request. Managed signed first-owner admission precedes auth dispatch; editor config independently checks the owner and has short expiry/exact-origin CSP.

**Acceptance.**
1. Use public rer install/setup/dev/export/import/reset and deployment dry-run in a fresh checkout and independent destination; preserve existing setup, reject unsafe answer paths and reused managed claims, and deny anonymous/project-grant editor access.

**Evidence.** `scripts/installer/local.mjs`; `scripts/installer/portability.mjs`; `src/editor`; `tests/commands.mjs`; `tests/owner-claim.mjs`; `tests/dev-credentials.mjs`
**Gap.** Local command behavior is implemented; actual owner-account deployment and provider acceptance are separate gates.

#### BASE-DATA-003 — Project and installation-owner erasure

Core · published · **done**

**Requirement.** The owner has count-only preview, typed confirmation bound to the exact current plan, resumable destructive steps and a completion receipt with per-table counts/times and no personal values. Project-root cascade, anonymized permanent audit, portability tombstones, source-import custody withdrawal, stale-write fences are preserved, and project erasure completes within five minutes for a project at today's 10,000-event admission limit. GOV-003 carries erasure within 15 minutes for 150,000 retained events. Owner self-erasure first transfers authority to a verified successor; it refuses unsupported/ambiguous attribution rather than damaging other people's data. All current declared tables and outbox copies participate; new capture stores must extend this declaration before release.

**Acceptance.**
1. Run public setup/dev/HTTP/export/import erasure journeys with canaries in every declared store, count-only preview/receipt, wrong-scope/origin/stale denials, a 10,000-event project erased within 300 seconds, successor handoff, resumed partial erasure and same/fresh-destination old-archive fences.

**Evidence.** `src/domain/erasure/declaration.ts`; `src/domain/erasure/owner-declaration.ts`; `src/modules/erasure`; `tests/project-erasure.mjs`; `tests/project-erasure-cap.mjs`; `tests/owner-erasure.mjs`
**Gap.** Done for the current declared store and exact-identifier policy, not unimplemented mobile/replay/feedback stores or external copies. Full retained limits appear in the custody section above. Completion is measured at 10,000 retained events within 300 seconds (`tests/project-erasure-cap.mjs`), today's admission limit; the 150,000-event obligation is GOV-003.

### Teams and triage

#### TEAM-001 — Organizations, members and project permissions

Core · target · **partial**

**Requirement.** A US development team creates an organization, invites multiple simultaneous members, organizes projects by team, and grants owner/admin, billing (usage, budgets and invoices only), project maintainer, member and read-only access with least privilege. Removal revokes sessions, keys and linked service authority; service accounts have explicit project scopes. Private data, search, exports and integrations obey membership on every transport. Owner transfer remains available without restricting the organization to one active contributor. Before project role doors ship, enforce project-maintainer authority for SDK-006 inbound filter and GROUP-001 grouping-policy management, replacing the current owner proxy without granting authority outside the member’s project/team scope.

Before this capability ships, every new human/service action, denial, export and notification inherits AUDIT-001: safe permanent actor/subject aliases, time, action and truthful outcome; permissioned organization cursor history/export; append-preserving portability and erasure that removes attribution links without relabeling old facts.

TEAM-001 supplies member deployment authority; the current installation owner acts for REL-001 until then.

**Acceptance.**
1. Invite two teammates and an external read-only collaborator; grant access to disjoint projects, triage concurrently, remove a member and verify immediate denial across UI, HTTP, SDK-management, CLI and exports.
2. ALERT-004 alternate-operator responsibility is inherited here: until member roles ship, the installation owner is accountable and configures the alternate destination (default No alternate).
3. Team roles must preserve an accountable alternate operator, visible broken-destination and overdue follow-up, and nonrecursive deduplication.
4. ALERT-003 team digests and team snooze inherit this clause before team roles ship: buyer-timezone daily/weekly error digests, required snooze expiry, one durable resumption notice, counted/listed suppressed alerts, and loss/backlog visible through maintenance and quiet hours.
5. The installation owner acts for these scopes until this clause is implemented.

**Evidence.** `src/auth/session.server.ts`; `src/domain/owner-authority.ts`; `tests/owner-erasure.mjs`
**Gap.** Only one active owner and isolated projects exist. Successor invitation is transfer, not team membership.

#### TEAM-002 — Accountable assignment and ownership rules

Core · target · **partial**

**Requirement.** Assign issues to real members/teams, import GitHub/GitLab CODEOWNERS at the exact linked revision, and define service/path/environment fallback ownership. Preview precedence and unmatched cases, route notifications to the assigned team, and notify assignees of due or unowned work. Work is due when an assigned issue stays unacknowledged past the project's acknowledgment window (set by a maintainer, default 24 hours), when a snooze, suppression or resolve-in-next-release deadline expires, or when a linked delivery ticket's due date passes; unowned work is an issue with no assignee after the project's unowned window. A due notice goes to the assignee, then to the owning team and the ALERT-004 alternate if still unacknowledged. Assignment history survives member departure without conferring access. Rules can be tested and disabled by a maintainer.

**Acceptance.**
1. Connect a repository with overlapping ownership rules, capture matched and unmatched errors, confirm accountable assignment and destination, let an assigned issue pass its acknowledgment window and an unassigned one pass its unowned window and confirm one due notice to the assignee and one unowned notice to the team, then remove the owner and inspect reassignment/history without leaked access.

**Evidence.** `src/domain/operators/policies.ts`; `tests/operator-flow.mjs`
**Gap.** Current assignment is an operator label; authenticated teammates, CODEOWNERS and assignment notifications are absent.

#### TEAM-003 — Collaborative lifecycle and bulk triage

Core · target · **partial**

**Requirement.** Teams comment, mention, subscribe (delivery per TEAM-005) and inspect an issue activity timeline; bulk assign, acknowledge, resolve, merge or suppress a selected search result with a preview. Resolution may be plain (Resolve with no release: the next accepted event in any release, or with no release, regresses it, as in Sentry, under SDK-009), in the current release, in the next release, in a named release, or from a commit/PR citation (TEAM-004). The recurrence policy is stated in project settings, with this default: after a release resolution, a same-release repeat does not reopen the issue but is counted on it as "recurred in resolved release" and shown on its timeline; a maintainer can set the project to reopen same-release repeats instead, previewed and audited. Old-release repeats remain separately visible and cannot fabricate newer-release regression; an event with no release after a release resolution follows SDK-009. Suppression (archive) supports reason, forever, expiry/count/affected-user threshold, until escalating (unarchive when volume exceeds the issue's forecast from its own history, with the forecast shown) and snooze, with due follow-up and an audit trail. Every issue has a priority (high, medium or low), set automatically when it opens from its level and history (fatal and error high, warning medium, info and debug low; escalation or regression raises it) and editable by a member. A manual edit sticks against later automatic changes, appears with its actor in the timeline and is audited, and FIND-001 filters, ALERT-001 conditions and TEAM-005 settings can use it. Concurrent edits refuse stale decisions.

**Acceptance.**
1. Two members discuss and bulk-triage searched issues, resolve for the next release, exercise same/new/old-release recurrence (a same-release repeat after a release resolution is counted as recurred in resolved release without reopening, and reopens once the project policy is switched), plain-resolve an issue and confirm the next same-release event regresses it, expire a suppression and push an archived-until-escalating issue past its shown forecast; confirm one accountable follow-up and stale-write refusal.
2. Confirm a new fatal error opens as high priority and a warning as medium, set one to low by hand and confirm a later escalation leaves the manual priority with its actor shown.
3. Current evidence: `src/domain/operators/bulk-triage.ts`; `src/ui/workbench/BulkTriage.tsx`; `src/domain/releases/routes.ts`; `tests/bulk-triage-flow.mjs`; `tests/release-identity-flow.mjs`; `docs/BULK-TRIAGE.md` Owner search results support page selection, preview and atomic acknowledge, reopen, current-release and plain resolution with project/revision/occurrence/authority fences and per-issue audit.
4. Single-issue literal suppression and split/merge corrections remain.
5. Comments, member assignment, manual priority, next/named resolution and collaborative recurrence/suppression policies remain absent.

**Evidence.** `src/domain/operators/bulk-triage.ts`; `src/ui/workbench/BulkTriage.tsx`; `tests/bulk-triage-flow.mjs`; `tests/investigation-flow.mjs`; `docs/BULK-TRIAGE.md` SDK-009 supplies plain/current/next/named owner and bulk resolution.
**Gap.** Shared team discussion, member assignment, priority and collaborative recurrence/suppression policies remain absent.

#### TEAM-004 — Issue short IDs and resolution from commits and pull requests

Core · target · **done**

**Requirement.** Every issue has a stable human-readable short ID per project (for example `CHECKOUT-1A3`), shown in the UI, alerts, packets, exports and search; it survives merge/split as an alias. A commit message or a GitHub PR / GitLab MR title or description containing `Fixes`, `Resolves` or `Closes` followed by a short ID (case-insensitive) links that commit or PR to the issue as soon as SRC-002 receives it, visible on the issue timeline. When a release includes the commit, or the merged PR's merge commit, whether the release was registered through REL-001 or SRC-003, or auto-created under SDK-009 and given commits by a later registration or by SDK-009's commit-SHA association, the issue resolves in that release with commit, PR and author recorded. A later occurrence in a newer release reopens it as a regression under ERR-006; an occurrence in an older release cannot. Citations of unknown, other-project or inaccessible short IDs change nothing and appear in the repository link log with the reason.

**Acceptance.**
1. Push a commit and merge a PR that each cite an issue's short ID, register a release containing both through the release API and through `sentry-cli releases set-commits`, and confirm both issues show the link immediately and resolve in that release.
2. Capture each fingerprint in a newer release (regression) and an older one (no regression), and cite another project's short ID (no change, logged).
3. Repeat with an auto-created release named by the merge commit's full SHA and no CI registration, and confirm the issue resolves in it.
4. SDK-009 automatic full-SHA releases inherit commit/PR association here: resolve cited issues when the linked commit is included, retaining author and citation and protecting older-release recurrence.
5. Short IDs are `<PREFIX>-<number>`: a per-project counter in Crockford base32 behind a prefix derived once from the project identifier (`<prefix>_2` when taken), never reused or reassigned; an erased project's prefix stays retired.
6. Migration `0059_short_ids_commit_citations.sql` numbers existing issues in first-seen order, and a restore of an older archive numbers its issues the same way.
7. Merge moves every short ID of the absorbed issue to the survivor as an alias; split keeps the original's ID and gives the split-out issue the next number; guarded undo restores the recorded mapping, a split-out ID then opening the original where its occurrences returned.
8. Lists, issue view, search, JSON/CSV exports, packets, the agent CLI/MCP, alert email and webhook bodies and digests carry it; packets, issue links and citations accept any short ID or alias in any case. Until SRC-002 delivers provider pushes, commits reach Spool through the deploy-key release door (`commits`) and deployment door (`includedCommits`), each a bare full SHA (no citation) or `{sha, message, author: {name, email}}` with author kept as sent and the message scrubbed. A citation links at once to a live issue of the same project and shows on the issue timeline; any other is written to the owner's repository link log with the literal citation, SHA and reason: `unknown` (no issue has the ID), `other_project` (another project's issue) or `inaccessible` (imported history, which a deploy key cannot change). Repeats are idempotent. A cited issue resolves, under SDK-009's named resolution and the project's ordering rule, in the first release that includes the commit: the registered or deployment release, or an auto-created release whose name is the commit's full SHA, which includes it as soon as Spool holds that commit; because a deploy key delivers each commit inside a registration, an auto-created SHA release resolves the issue when it orders before the registered or deployment release that delivers the commit, and one that orders after it — as one created later always does — is associated with the commit while the earlier resolution and its older-release protection stand. The resolution records commit SHA and author, with the PR empty until SRC-002 supplies one, and raises the issue revision so stale owner and bulk decisions are refused. Commit author and message are personal data shown on owner surfaces only (the issue timeline). Packets, agent CLI/MCP, alert email/webhook bodies and exports carry short ID, citation, release and SHA, adding author and message only after the owner turns on the audited, revision-fenced per-project sharing choice (default off); digests never carry them. A retention cutoff removes author and message from commits received before it and from the alert copies that carried them; project erasure removes every short ID, prefix, commit, link and log row; installation-owner erasure replaces the owner's whole-token identifiers in commit authors and messages. Private archives carry all of it and restore inert, re-running no resolution and sending nothing. Journey **TEAM-004 short IDs, commit citations, resolution and unknown-ID link log** extends `tests/release-identity-flow.mjs` (run by `tests/sentry-http.mjs`), `tests/operator-flow.mjs`, `tests/agent-handoff.mjs`, `tests/alerts-runtime.mjs`, `tests/alerts/delivery-flow.mjs`, `tests/sentry-import.mjs`, `tests/old-archive.mjs`, `tests/project-erasure.mjs` and `tests/owner-erasure.mjs`; migration `migrations/core/0059_short_ids_commit_citations.sql`, `src/domain/short-ids/`, `src/domain/commits/` and `docs/SHORT-IDS.md`. Retained 1440/390 states: `docs/retained-verification/team004/`. GitHub pull request and GitLab merge request citations and `sentry-cli releases set-commits` commits are inherited obligations of SRC-002 and SRC-003, which carry their real provider receipts; none is claimed here.

**Evidence.** `src/domain/short-ids/`; `src/domain/commits/`; `migrations/core/0059_short_ids_commit_citations.sql`; `src/ui/workbench/CommitTimeline.tsx`; `src/ui/workbench/RepositoryLinkLog.tsx`; `src/ui/workbench/CommitSharing.tsx`; `tests/release-identity-flow.mjs`; `tests/operator-flow.mjs`; `tests/agent-handoff.mjs`; `tests/alerts-runtime.mjs`; `tests/alerts/delivery-flow.mjs`; `tests/sentry-import.mjs`; `tests/old-archive.mjs`; `tests/project-erasure.mjs`; `tests/owner-erasure.mjs`; `docs/SHORT-IDS.md`; `docs/retained-verification/team004/` Journey **TEAM-004 short IDs, commit citations, resolution and unknown-ID link log**: stable per-project short IDs in lists, issue view, search, JSON/CSV exports, packets, CLI/MCP, alert email/webhook bodies and digests, kept as aliases through merge, split and guarded undo; deploy-key release and deployment door citations (Fixes, Resolves or Closes, any case) linked at once on the issue timeline; unknown, other-project and imported-history citations logged with reason and changing nothing; idempotent repeats; resolution in the first including release under SDK-009's named resolution and ordering, with newer-release regression, older-release protection and auto-created SHA release association; author/message owner-only by default and shared by the audited owner choice; retention, project and owner erasure; inert byte-identical restore; v0.6.0 upgrade numbering; 1440/390 states.
**Gap.** None for the deploy-key release and deployment doors. Real GitHub PR, GitLab MR and `sentry-cli releases set-commits` receipts are SRC-002 and SRC-003 inherited obligations, pending there.

#### TEAM-005 — Per-member notification settings and issue subscriptions

Core · target · **missing**

**Requirement.** Each member chooses, per project and per notification type, what reaches them and on which personal channel (email, Slack direct message, Microsoft Teams chat). The types are workflow (resolution, regression, assignment, comment, mention), issue alert, deploy and weekly report. A member is subscribed to an issue by being assigned directly or through a team, commenting, being mentioned, bookmarking it or pressing subscribe; the issue shows why, and an explicit unsubscribe overrides automatic subscription until the member subscribes again. Workflow notifications go to subscribers other than the actor. Deploy notifications go to members whose commits are in the release. The weekly report is opt-in per member. A member can opt out of a project's personal alert email without disabling the rule for others; only an admin can make a rule's delivery mandatory, and the member's settings show it. Every message carries a settings and one-click unsubscribe link that applies before the next message.

**Acceptance.**
1. Two members save different per-project and per-type settings.
2. Trigger an assignment, comment, mention, resolution, regression, issue alert, a deploy containing one member's commit and the weekly report, and confirm each member receives exactly the messages and channels they chose.
3. Unsubscribe through a message link and confirm the next qualifying event sends nothing to that member while the other is unaffected.
4. ALERT-003 personal digests inherit this clause before member notifications ship: each member's daily/weekly schedules, timezone, channel selection and unsubscribe controls must preserve one digest per calendar period and loss/backlog reporting.
5. The current personal digest belongs to the installation owner only.

**Evidence.** None.
**Gap.** No implementation proof yet: per-member notification settings and issue subscriptions.

### Capture and release health

#### SDK-001 — Multi-language SDKs and DSN-compatible intake: browser JavaScript and Node.js

Core · target · **done**

**Requirement.** Developers capture automatic unhandled and manual exceptions using maintained Sentry SDKs. The SDK-001 runtimes are browser JavaScript, Node.js, Python, Go, Java/JVM, Ruby, PHP, .NET, iOS, Android, React Native, Flutter, Electron, Unity, Rust, Elixir and Kotlin Multiplatform. Any clause that says "SDK-001 runtimes" means this whole set. Existing standard Sentry SDK applications repoint their DSN without rewriting capture code. Every envelope item they send, not only errors, is accepted and routed to the clause that uses it as listed in SDK-007 (sessions, transactions and spans, profiles, replays, feedback, attachments, client reports, logs and metrics). Events with no `release`, an SDK-inferred release or a release CI never registered are accepted under SDK-009. SDK-007's versioned capability diagnostics identify each unsupported item type and loss until full support lands; unsupported behavior stays an engineering gap. This clause qualifies browser JavaScript and Node.js. On 22 October 2026 the rest of the original SDK-001 was moved, unchanged, to these clauses:
- SDK-012: server runtimes;
- SDK-013: Electron;
- SDK-014: Unity;
- SDK-015: iOS;
- SDK-016: Android;
- SDK-017: React Native;
- SDK-018: Flutter;
- SDK-019: Kotlin Multiplatform;
- SDK-020: guided and framework setup;
- SDK-021: tunnels and ad-blocker delivery;
- SDK-022: first-party ingest subdomain;
- SDK-023: loader script;
- SDK-024: check-ins to Uptime;
- SDK-025: persisted non-error outcomes for every runtime.

Together these fifteen clauses make up exactly the original obligation.
- **SDK-001 qualification run** (applied by SDK-001 and SDK-012 to SDK-019 to each runtime they name). The run is a push Verify job or a named scheduled workflow. It runs one unmodified Sentry SDK program at a pinned SDK version twice: once against a reference collector and once against Spool, with only the DSN changed. Each run uses default integrations plus the options the Sentry setup wizard enables for that platform: sessions, tracing, logs, replay (browser and mobile), the feedback widget or feedback API, and attachments. Where an SDK version lacks an option, the evidence names that version and option.
  - **Q1 handled:** a captured exception is a persisted occurrence, read through the public API and UI.
  - **Q2 unhandled:** an uncaught failure or crash is persisted as unhandled.
  - **Q3 flush/restart:** after a flush and a process or app restart, the same failure groups into the same issue without a duplicate occurrence.
  - **Q4 item reconciliation:** every item the reference collector received has exactly one Spool outcome under SDK-007, either persisted or counted by category and reason in capability diagnostics. Nothing is silently dropped.
  - **Q5 release:** the release and dist (or "none") equal what the SDK sent, and the release is auto-created under SDK-009.
  - **Q6 discards:** client-report discards appear in BILL-001 usage.
  - **Q7 refusal:** refused or undeliverable events create nothing.

  Persisted session, trace, replay, log, attachment and widget outcomes for every runtime belong to SDK-025.

**Acceptance.**
1. Apply the qualification run to `@sentry/browser`, in Chromium at 1440 and 390 with build-plugin source maps resolving the original line, the feedback widget and replay enabled, and to `@sentry/node`.
2. SDK-009 runtime qualification for Node is inherited here: unmodified Node no-release and inferred-SHA intake, including release-less alerts and release-scoped no-release counts.

**Evidence.** Q1–Q7 Node: `tests/sdk-runtimes.mjs` ([SDK-001] node journey), `tests/runtimes/node.mjs`; Q1–Q7 browser, real widget/replay and build-plugin original line: `tests/sentry-sdk.mjs`, `tests/runtimes/browser.mjs`; lifecycle reports: `tests/client-report-sdk.mjs`; inherited SDK-009 Node identity: `tests/runtimes/node.mjs`; screens: `docs/retained-verification/sdk001/`.
**Gap.** None for browser/Node qualification at @sentry/browser and @sentry/node 11.6.0. Sessions, traces, replay, logs and attachments remain counted as unsupported; persisted outcomes remain SDK-025. No real provider, device or consent was used.

#### SDK-002 — Native crashes and symbolication

Core · target · **missing**

**Requirement.** Collect iOS/macOS native crashes, Android crashes and ANRs, hybrid React Native/Flutter failures, Electron/desktop native crashes as Crashpad/Breakpad minidumps, and their device/OS/app version context under privacy controls. CI uploads dSYM, ELF/native debug symbols, ProGuard/R8 mappings and Flutter split-debug information, at their real build sizes under SRC-004's published debug-file capacity (up to 2 GiB per file, no file count limit), through Spool's CLI or, unmodified, the Sentry Android Gradle plugin, the Xcode build-phase upload script, `fastlane-plugin-sentry`, `@sentry/react-native` and `sentry_dart_plugin` paths listed in SRC-003. Match UUID/build/architecture before symbolication, show original frames and inline context with explicit missing/mismatch diagnostics, and preserve offline crash delivery across app restart. ANR and app-hang events keep every thread's stack with its crashed/current flags and state (SDK-010). Minidumps, Apple crash reports, screenshots and view hierarchies are accepted up to SDK-011's published limits, never refused under a smaller request bound. Heavy symbolication runs in isolated bounded workers. Before any additional intake category ships, it inherits SDK-006: enforce Origin/Referer and all applicable available transport/category filters before acceptance, name unavailable fields, and preserve truthful filtered and client-discard accounting.

**Acceptance.**
1. Build signed test iOS/Android and React Native/Flutter apps, crash and hang on real devices, relaunch offline/online, upload matching/mismatched symbols from CI through the unmodified Gradle plugin, Xcode build phase, Fastlane action and Dart plugin, and inspect one deobfuscated issue without duplicate sessions; crash an Electron app and symbolicate its minidump.
2. Upload a 40 MiB dSYM and the next release's ProGuard mapping and confirm both symbolicate.

**Evidence.** None.
**Gap.** No implementation proof yet: native crashes and symbolication.

#### SDK-003 — Automatic breadcrumbs and private context

Core · target · **partial**

**Requirement.** Opt into bounded console, network, DOM interaction, navigation and server-operation breadcrumbs with category switches, sampling, per-field allow/deny rules and client-side before-send hooks. Default SDK capture excludes secrets and request bodies; user identity follows SDK-008's per-field project identity policy, and adding approved request properties requires explicit project policy, preview and erasure coverage. Capture ordering and truncation are visible so investigation never implies a complete user history. Server-side rules also run on every item SDK-007 accepts from unmodified Sentry SDKs (message and `logentry` params, exception values, stack frame local variables and SDK-sent source context lines kept under SDK-010, thread stacks, tags, extra, contexts, breadcrumbs, request, user fields kept under SDK-008, span and log attributes, and attachment metadata) before storage, with no SDK redeploy. A rule's field selector can address any of these, including one frame variable by name or every frame variable (Sentry's `$frame.vars.<name>` and `$frame.vars.**`), a request header, an `extra` key, a context key, the exception value and the log entry, and MIG-001 imports Sentry advanced scrubbing rules with those selectors unchanged: a maintainer adds organization or project additional sensitive fields and safe fields, and custom rules that apply a built-in pattern (credit card, IP address, email, password, auth token, US Social Security number) or a custom regex to a field selector with remove, mask, hash or replace. Each rule is previewed against retained events, audited and applies to later intake only; organization rules apply to every project and cannot be weakened by a project.

**Acceptance.**
1. Toggle each instrumentation category in browser/server setup, trigger a failure with secret-bearing URLs/forms, and compare the occurrence timeline, before-send filtering, truncation and stored/forwarded privacy projection.
2. Add an organization sensitive field, a project safe field and a custom regex mask rule in the app, preview them, then send an unmodified Sentry SDK event, span and log carrying canaries in tags, extra, contexts and message text, and confirm the canaries are removed or masked in storage, issue views, packets and exports while safe fields survive.
3. From an unmodified Python SDK with default `include_local_variables`, raise an error whose frame locals hold `password`, `api_key` and an ordinary value, add a `$frame.vars.order_note` mask rule, and confirm `password` and `api_key` are masked by default, `order_note` is masked by the rule, and the ordinary local survives in issue detail.
4. SDK-010 inherits project custom server scrubbing rules here.
5. Its opt-in request capture must preview and scrub cookies, bodies and environment before storage; until that policy exists those fields are excluded with request_policy_excluded notes.
6. Query strings retain diagnostic parameters after decoded secret-name masking and ERR-003 text scrubbing, with named trimming.

**Evidence.** `src/domain/capture.ts`; `src/domain/sentry/convert.ts`; `packages/sdk/src/browser.ts`; `tests/privacy-table.mjs`
**Gap.** Supplied breadcrumb messages are stored; full automatic instrumentation and configurable context capture are absent.

#### SDK-004 — User feedback attached to failures

Core · target · **partial**

**Requirement.** An accessible, localizable feedback widget lets the affected user submit a description and optional contact/screenshot against an event or independently. It asks consent, strips sensitive metadata, supports attachment review and abuse controls, and connects duplicate reports to the issue without publishing identity. Submissions from the unmodified Sentry feedback widget, `captureFeedback`, the crash-report modal and legacy `user_report` items arrive through SDK-007 and get the same attachment, consent, abuse and erasure handling. The assigned team can reply through approved email with delivery state; withdrawal/erasure removes feedback and attachments across exports.

**Acceptance.**
1. An end user reports a browser/mobile failure with optional screenshot/contact, a teammate triages and replies, an anonymous abuse attempt is bounded, and withdrawal removes the canaries from issue, storage and export.
2. Submit the same through an unmodified Sentry feedback widget, `captureFeedback` and a legacy `user_report` and confirm each attaches to its issue; open Spool's widget in Spanish and confirm its visible labels and accessible names are Spanish.
3. Current evidence: `src/domain/feedback/`, `src/ui/workbench/FeedbackPanel.tsx`, `tests/feedback-flow.mjs`, `tests/sentry-sdk.mjs` and `docs/FEEDBACK.md` cover text feedback intake, exact occurrence association, owner review/withdrawal and archive/erasure custody.
4. `tests/sentry-sdk.mjs` ([SDK-004] `reportDialogFlow`, `tests/report-dialog-flow.mjs`) qualifies the unmodified browser SDK and queued loader stub through the hosted crash-report modal at 1440/390: explicit consent, exact occurrence association, empty/consent/send/minute-limit errors, focus/close behavior, identical key-state refusal, contact-option exclusion and withdrawal from the next export.
5. Screens:.
6. Default ADOPTED: description-only qualifies the crash-report-modal sentence; contact stays a Gap.
7. Spool’s independent localized widget, contact/replies, screenshots/attachment review, broader abuse policy and full end-user erasure remain gaps.

**Evidence.** `src/domain/feedback/`; `src/ui/workbench/FeedbackPanel.tsx`; `tests/feedback-flow.mjs`; `tests/sentry-sdk.mjs` ([SDK-004] reportDialogFlow); `tests/report-dialog-flow.mjs`; `src/domain/report-dialog/`; `docs/FEEDBACK.md`
**Gap.** The hosted crash-report modal is qualified through the unmodified browser SDK and queued loader stub at 1440/390, sharing the consented description-only feedback intake, exact occurrence association and withdrawal. Text descriptions from modern Sentry feedback events/items and legacy user_report are scrubbed, retry-safe and linked to an exact retained occurrence or shown as standalone/unavailable-reference reports in the owner inbox. Issue review and withdrawal, archive restore, retention and project/owner erasure cover this store. Contact and attachments are excluded; Spool’s independent localized widget, contact/replies, screenshot review, broader abuse policy and end-user identity erasure remain absent.

#### SDK-005 — Crash-free sessions and release health

Core · target · **partial**

**Requirement.** Ingest sessions from unmodified Sentry SDK `session` and `sessions` items (SDK-007) and from Spool SDKs, including sessions whose release CI never registered, which auto-create it under SDK-009, honoring each SDK's session mode (per page load or navigation in the browser, per app start and foreground on mobile, request aggregates on servers) and status (ok, exited, errored, crashed, abnormal). Publish sessions, crash-free users/sessions (users counted from each session's `did` and the event user key under SDK-008's one definition), affected users, version adoption, crash/ANR rates and trends by environment, app version, device and OS, with explicit exposure denominators, sampling and capture loss. Define session boundaries; session identity follows SDK-008's project policy. Compare rollouts and rollbacks against comparable cohorts: a partly adopted release is compared with the previous release over the same window, environment, device and OS mix, with its adoption share and confidence shown, and a rollback shows the restored release's rates beside the rolled-back one's; healthy sessions must be observed rather than inferred from absent exceptions. Export reports with their denominator and uncertainty. Before any additional intake category ships, it inherits SDK-006: enforce Origin/Referer and all applicable available transport/category filters before acceptance, name unavailable fields, and preserve truthful filtered and client-discard accounting.

**Acceptance.**
1. Run known healthy/crashing sessions across two app versions and devices, through unmodified Sentry browser, mobile and server SDKs with default release health and through Spool SDKs, vary sampling and offline delivery, then reconcile adoption and crash-free session and user rates against the sessions each SDK submitted and visible gaps.
2. Roll a new version out to about 20% of devices with a higher crash rate and confirm the comparison shows both releases' crash-free session and user rates over the same window with adoption share and confidence; then roll back and confirm the rolled-back release stops gaining sessions and the comparison shows the restored release's rates beside it.
3. SDK-009 session release identity is inherited here: sessions accept no release, auto-create and enrich a release/dist with first-seen environment and SDK metadata, and enforce the same optional strict ordering policy; release-scoped session figures exclude and count release-less sessions.

**Evidence.** `src/domain/sessions/`; `src/domain/identities/key.ts`; `tests/sentry-sdk.mjs` ([SDK-005] sessionFlow); `tests/session-flow.mjs`; `tests/sdk-runtimes.mjs`; `tests/old-archive.mjs`; `tests/owner-erasure.mjs`; `migrations/core/0072_release_sessions.sql`; `docs/SENTRY-SESSIONS.md` Observed individual/aggregate session intake, per-project keyed DID hashes, automatic release identity, bounded owner/exact-project read and JSON health export, explicit denominators, observed adoption and 95% Wilson intervals now exist. Unmodified default Node healthy/crashed and browser healthy/unhandled sessions reconcile against a reference collector with only DSN changed; browser unhandled is preserved separately from process crash. Sessions create no occurrence, issue, alert or accepted-error unit. Origin and available category filters, per-item refusal and named bounds apply; session client-discard protocol tokens remain counted. Populated upgrade, private key/aggregate archive restore and project/owner erasure are proven. Releases and suspect comparisons reflow at 1440/390 without serious Axe findings or icon-only controls.
**Gap.** Mobile session modes, device/OS/version cohorts and ANR rates, comparable adoption cohorts, rollback, trends, the 20% rollout acceptance, runtime-specific health qualification beyond Node/browser, Spool-SDK sessions and full SDK-008 policy/role scope remain absent. Idle-project expiry, aggregate replay deduplication and category backpressure headers remain gaps. Unauthenticated key refusals do not mutate project counters; loader disabled state is not an independently disabled ingest-key policy. The inherited sentence "sessions accept no release" remains unmet: this brief and SDK-007 require release-less sessions counted invalid. Default ADOPTED: session users use keyed per-project hashes only until full SDK-008 policy; the key is private-archive-only.

#### SDK-006 — Ingest-time inbound filters and allowed domains

Core · target · **done**

**Requirement.** A project maintainer turns on server-side inbound filters in the app, with no SDK redeploy: browser-extension errors, legacy browsers (by named browser and version), localhost and loopback, known web crawlers (maintained user-agent list), React hydration errors, ChunkLoadError and failed dynamic imports, client IP addresses and CIDR ranges, error-message patterns, specific releases and environments, and allowed `Origin`/`Referer` domains (exact and `*.domain` wildcard) for browser DSNs. Filters run at intake, before grouping, alert evaluation and billable usage: a matching event creates no issue, occurrence, alert or billable unit and is counted per filter as `filtered` in BILL-001 usage. Each filter shows its recent match count and a preview against retained events before it is enabled; changes are audited and apply to later intake only. A browser event whose `Origin` or `Referer` is not an allowed domain is refused with an explicit status and no CORS grant, protecting a public browser DSN from abuse. New projects name their default-on filters at creation, and each can be turned off. The owner acts as project maintainer until TEAM-001 provides project roles. Error-specific rules apply to errors only. Every accepted category checks Origin/Referer and available transport fields (trusted client IP, user agent/browser and localhost); feedback also checks supplied release/environment. Client reports lack error, release and environment fields: these are named unavailable, and a filtered report contributes no claimed SDK-discard quantities. Historical preview covers retained errors, naming non-retained IP and missing fields unavailable. SDK-002, SDK-005, SDK-007, CTX-001 and CTX-002 must apply the applicable filters before their additional categories ship; BILL-001 must carry the existing counters into commercial usage. Origin/Referer refusal counters count refused transport requests; item filters count matched category items. Neither counter is a claimed SDK-discard quantity.

**Acceptance.**
1. Enable each named filter in the app, send matching and non-matching events through an unmodified Sentry SDK and native ingest, and confirm the matching ones create no issue, alert or billable usage and appear per filter as filtered in usage while the others are accepted.
2. Send from a non-allowed `Origin` and `Referer` and confirm refusal without a CORS grant; disable a filter and confirm later matching events are accepted.

**Evidence.** `src/domain/filters/`; `src/domain/admission.ts`; `src/domain/origins.ts`; `src/ui/workbench/InboundFilters.tsx`; `tests/inbound-filter-flow.mjs`; `docs/INBOUND-FILTERS.md`
**Gap.** SDK-006 public journeys exercise every named filter through native intake and the installed unmodified Node SDK with app-enabled policies at 1440/390; browser SDK intake, preview, revision/audit fencing, counters, disabling, no occurrence/alert/accepted unit and Origin/Referer refusal without CORS are covered. Feedback and client reports enforce available transport fields; feedback also filters supplied release/environment, while error-message rules remain error-only. Filtered client reports never add SDK-discard quantities. Settings names category coverage and unavailable historical fields. Owner acts as maintainer until TEAM-001; SDK-002/005/007 and CTX-001/002 inherit category filtering before shipping. BILL-001 inherits these admission counters; commercial invoices are not claimed.

#### SDK-007 — Sentry envelope item coverage from unmodified SDKs

Core · target · **partial**

**Requirement.** When a team changes only the DSN, Spool accepts every item its unmodified Sentry SDKs send (browser/Next.js, Node, Python, iOS, Android, React Native and the other SDK-001 runtimes) at the `/envelope/` and legacy `/store/` endpoints and at Sentry's dedicated `/minidump/`, `/unreal/` and `/security/` endpoints, and routes each item type to the clause that uses it: Before any additional intake category ships, it inherits SDK-006: enforce Origin/Referer and all applicable available transport/category filters before acceptance, name unavailable fields, and preserve truthful filtered and client-discard accounting.
- `event` (errors and default events, including ANR and app-hang `threads`) → ERR-002 atomic acceptance, keeping and showing the whole event as SDK-010 lists it (every exception in the chain and exception groups, full frames with source context and local variables, tags, contexts, request, extra and message events), under SDK-009's release rules (accepted with no release, or with an unregistered release that is created automatically; ERR-001's registration precondition does not apply unless the project chose registered sequence only), SDK-001 and SDK-002; the event's `user` interface and the identity data `sendDefaultPii` adds pass through SDK-008's identity policy before storage.
- `session` (per-session updates) and `sessions` (server-mode aggregates) → SDK-005 crash-free session and user rates, adoption and release health, with each session's `did` under SDK-008; an unregistered session release is created automatically under SDK-009, and a session with no release, which Sentry also refuses, is counted as invalid with that reason.
- `transaction` and `span` (including standalone and v2 span items), with the envelope's dynamic sampling context → CTX-001: the trace waterfall beside every error that shares its `trace_id`, with sampled-out spans labeled.
- `profile` and `profile_chunk` → CTX-001: the profile of the transaction or span that contains the error.
- `replay_event`, `replay_recording` and `replay_video` → CTX-002, under its consent, masking, sampling, retention, role-scoped playback and erasure rules; server-side masking is reapplied to recording payloads.
- `feedback` (Sentry feedback widget, `captureFeedback`, crash-report modal) and legacy `user_report` → SDK-004, attached to the associated event and issue or kept standalone.
- `attachment` (`event.attachment` files including screenshots, `event.view_hierarchy`, `event.minidump`, `event.applecrashreport`, and Unreal context and log types) → API-001 storage and role-checked viewing, and SDK-002 native crash processing, under ERR-003/SDK-003 scrubbing and SDK-011's published per-item limits.
- `client_report` (client-side discards by reason and data category) → BILL-001 client-discarded volume and the ERR-008/SDK-005 loss inputs.
- `log` (Sentry Logs, `Sentry.logger` and console capture) → CTX-001 structured logs correlated to the error by trace and span.
- `trace_metric` (Sentry's trace-connected metrics) → CTX-001 metric points on the trace beside the error.
- `check_in` → Uptime, as stated in the boundaries.
- `/security/` CSP violation reports → issues grouped by directive and blocked URI, under SDK-006 filters. `/minidump/` and `/unreal/` crash uploads → SDK-002 crash events.

**Acceptance.**
1. For the browser (Next.js), Node, Python, iOS, Android and React Native Sentry SDKs, change only the DSN and enable sessions, tracing, profiling, logs, metrics, replay (browser and mobile), the feedback widget and screenshot and view-hierarchy attachments, then trigger errors.
2. Confirm that SDK-005 crash-free session and user rates reconcile with the sessions each SDK sent; that the error's issue detail shows its Sentry-SDK trace waterfall, profile, logs and replay at the error time; that widget feedback attaches to the issue; that the screenshot opens for a permitted member and is refused for an unpermitted one; and that client-report discards appear in BILL-001 usage.
3. Send a CSP report and an Electron minidump and confirm each becomes an issue.
4. Send a `statsd` item and an unknown item type and confirm each appears in capability diagnostics with its count and no silent drop.
5. Exhaust a replay-category budget and confirm `X-Sentry-Rate-Limits` names only that category while errors are still accepted.
6. Run the whole journey with each SDK's default transport compression (including the Python SDK with `brotli` installed) and confirm that no envelope is refused for its encoding or size (SDK-011) and that each error's issue detail shows its full exception chain, tags and contexts (SDK-010).
7. Before any additional intake category ships, it inherits SDK-006: enforce Origin/Referer and all applicable available transport/category filters before acceptance, name unavailable fields, and preserve truthful filtered and client-discard accounting.
8. Current evidence: `src/domain/sentry/wire.ts`; `src/domain/sentry/routes.ts`; `src/domain/sentry/client-reports.ts`; `src/domain/feedback/`; `tests/sentry-http.mjs`; `tests/client-report-flow.mjs`; `tests/sentry-sdk.mjs` Errors, text feedback and client_report items are routed after complete envelope framing. SDK-reported discards are counted by bounded reason/category and quantity, separately from accepted events; invalid reports are individually counted while valid companion errors continue. The real Node SDK flush emits reports through its normal transport; automatic browser lifecycle report emission is qualified by the [SDK-001] journey in `tests/sentry-sdk.mjs`. Unsupported categories remain diagnosed. Check-ins are routed under SDK-024. Bounded sessions and release health are routed under SDK-005, with keyed DID hashes and named limitations. Traces, profiles, replay, logs, metrics, dedicated crash/security doors, category backpressure and full runtime qualification remain absent.

**Evidence.** `src/domain/sentry/wire.ts`; `src/domain/sentry/routes.ts`; `src/domain/sentry/client-reports.ts`; `src/domain/feedback/`; `tests/sentry-http.mjs`; `tests/client-report-flow.mjs`; `tests/sentry-sdk.mjs`
**Gap.** Errors, text feedback and client_report items are routed after complete envelope framing. SDK-reported discards are counted by bounded reason/category and quantity, separately from accepted events; invalid reports are individually counted while valid companion errors continue. The real Node SDK flush emits reports through its normal transport; automatic browser lifecycle report emission is qualified by the [SDK-001] journey in `tests/sentry-sdk.mjs`. Unsupported categories remain diagnosed. Check-ins are routed under SDK-024. Bounded sessions and release health are routed under SDK-005, with keyed DID hashes and named limitations. Traces, profiles, replay, logs, metrics, dedicated crash/security doors, category backpressure and full runtime qualification remain absent.

#### SDK-008 — Sentry user identity policy, affected users and end-user erasure

Core · target · **partial**

**Requirement.** Each project has an identity policy for the `user` interface that unmodified Sentry SDKs send through `Sentry.setUser` and framework integrations: `id`, `email`, `username`, `ip_address` (with `{{auto}}` resolved at intake to the connecting client address, or to the client address forwarded by an SDK-021 tunnel the project trusts, never from an untrusted forwarded header), `name`, `geo`, `segment` and custom user data, each session's `did`, and the identity data `sendDefaultPii` adds (framework-populated user fields and the request's client address). For each field a maintainer chooses keep as sent, hash (a keyed per-project hash, so equal values still count and match as one user and the raw value is never stored; the key travels only inside the private ERR-009 archive) or drop (never stored, and `{{auto}}` never resolved). Project creation shows the policy and states its default: keep every field as sent, as Sentry does, except where an organization floor or a MIG-001-imported Sentry setting ("prevent storing of IP addresses", data scrubbing of user fields) requires hash or drop. Cookies, authorization headers and request bodies that `sendDefaultPii` adds stay under ERR-003 and SDK-003 scrubbing; keep never retains them. Every policy change is previewed against retained events (events, users and saved searches affected), audited under AUDIT-001 and applies to later intake; retained values can be converted only toward a stricter choice (keep to hash to drop), with a preview. Organization policy sets a floor that projects cannot weaken, and SDK-003 server-side rules run on kept values after the policy.

An event's user key is the first present of `user.id`, `user.email`, `user.username` and `user.ip_address` after the policy (a hashed value counts as itself; a dropped field is skipped), the same precedence as Sentry's `user` tag so MIG-001 counts reconcile; Spool SDK events use their random installation identifier (ERR-003). Every affected-user figure uses this one definition: the issue stream's Users column and sort, issue detail, FIND-002 reports and widgets, SDK-005 crash-free users, ALERT-001 user conditions, AI-004 cohorts and MIG-001 comparisons. Each figure also shows how many events had no user key; when no event in scope has one, it shows unavailable with the reason (the policy drops identity, or the SDK sent none), never 0.

FIND-001 accepts `user.id`, `user.email`, `user.username` and `user.ip` (exact values, and CIDR ranges for `user.ip`) as search keys and facets with counts. A hashed field matches only its hashed token, so a raw-value search finds nothing; a dropped field is unsearchable and the search says so. Raw identity values are visible, searchable and exportable only to roles the project grants identity access (owner, admin, maintainer and member by default); read-only collaborators and service grants see counts and hashed tokens unless granted. ERR-007 packets, AI-001 egress, alert and chat deliveries and ALERT-005 unfurls carry counts only, never raw identity.

End-user erasure: a maintainer enters one user's id, email, username or IP address, and a count-only preview lists the matching events, sessions, feedback, attachments, replays and search entries (a hashed field is matched by hashing the supplied value). On typed confirmation Spool removes that user's identity values from events, sessions, search indexes and facets, SDK-004 feedback contact, CTX-002 replays and attachment metadata, or deletes the user's events when the maintainer chooses. Later exports and archives omit the values, and the receipt has counts and times only. AUDIT-001 records the action without the value. The erasure joins the BASE-DATA-003 journal and restore fence, so a restore reapplies it and an older archive that still holds the value is refused. It completes within 300 seconds in a project holding GOV-003's 150,000-event published volume.

Before this capability ships, every new human/service action, denial, export and notification inherits AUDIT-001: safe permanent actor/subject aliases, time, action and truthful outcome; permissioned organization cursor history/export; append-preserving portability and erasure that removes attribution links without relabeling old facts.

**Acceptance.**
1. With an unmodified Sentry browser SDK and Python SDK and only the DSN changed, send errors to one issue from three identified users (`setUser` with id, with email only and with username only) and from two anonymous visitors whose browser SDK sends `ip_address: "{{auto}}"`.
2. Under keep: the issue stream's Users column and issue detail show 5 affected users, matching Sentry's count in the MIG-001 dual run, `user.email:<one of them>` finds exactly that user's issues, the user facet lists the five keys with counts, and a read-only collaborator sees the count but no values.
3. Change the policy to hash with its preview and audit entry: counts stay 5, no raw email or IP exists in storage, issue views, packets, exports or the archive, and a raw email search finds nothing.
4. Under drop: no identity is stored and the Users column shows unavailable with its reason, never 0.
5. Erase one user by email: the count-only preview names the matching records, and afterwards the value is gone from search, facets, issue views, exports and the next archive, the receipt and audit carry no value, and restoring an older archive is refused.
6. SDK-010 user identity and opt-in request capture inherit the identity/privacy policy here: user id, email and IP for users affected, request cookies, bodies and environment must remain subject to field policy and preview before capture.
7. Until SDK-003 and this policy ship, user is excluded with identity_policy_unavailable and those request fields with request_policy_excluded; no identity capture is implied by event fidelity.

**Evidence.** `src/domain/identities/`; `src/ui/workbench/IdentityPolicy.tsx`; `src/ui/workbench/AffectedUsers.tsx`; `migrations/core/0073_identity_policy.sql`; `tests/sentry-sdk.mjs` ([SDK-008] identityFlow); `tests/identity-flow.mjs`; `tests/execution/exposure.mjs`; `tests/old-archive.mjs`; `tests/owner-erasure.mjs`; `docs/SENTRY-IDENTITY.md`
**Gap.** Four-field id/email/username/ip_address keep/hash/drop policy, count-only preview, stale approval refusal, audited atomic stricter conversion and later intake now exist. The owner issue section shows known and unattributed users; exact-project read-only grants and packets receive counts only. Unmodified browser and Python programs reconcile with a reference collector with only DSN changed: three explicit identity types and two literal IPs count 5 known users; two auto-address visitors stay unattributed. Hash preserves the count without raw values in storage, views, packets or archives; drop shows unavailable with its reason. Native random-client counts agree with repair exposure. Migration 0066 preserves populated upgrades, private archive restore and project/installation-owner erasure; a successor chooses a fresh policy above the safe historical revision floor. Settings and issue sections pass 1440/390 overflow and serious Axe checks with no icon-only controls. Gap: Default ADOPTED: all four fields drop; keep/hash require an explicit owner choice. The clause's keep-as-sent default remains an open ruling. Project creation policy display, name/geo/segment/custom/default-PII fields, per-field session DID policy, user search/facets and saved-search previews, project member identity roles, end-user erasure by email, organization floor (TEAM-001), MIG-001 import/dual run, issue-stream/sort, alert/report/cohort shared figures remain absent. The Worker exposes no connecting socket address: auto remains unavailable, so the specified five-user acceptance using two auto visitors is unproven. No forwarded header or tunnel is trusted; SDK-021's existing open rule is unchanged. SDK-005 session DID stays keyed-hash-only.

#### SDK-009 — Release identity from unmodified Sentry SDKs: no release, automatic releases, ordering and plain Resolve

Core · target · **done**

**Requirement.** In Sentry a `release` is optional and needs no registration first, so Spool accepts Sentry SDK events and sessions with the release identity unmodified SDKs send, on every SDK-001 runtime, without a CI step:
- **No release.** An event with no `release` is accepted, grouped and stored with release shown as "none". It counts in issue totals, the issue stream, FIND-001 search (`!has:release`), ALERT-001 conditions and FIND-002 dashboards. It is excluded only from release-scoped figures (release history, per-release counts, SDK-005 adoption and crash-free rates by release, REL-002 comparison), and each of those names how many events had no release.
- **Automatic release creation.** The first event or session carrying a `release` (with or without `dist`) that the project has not seen creates that release, as Sentry does, whether the SDK took it from configuration, `SENTRY_RELEASE`, an inferred git commit SHA (Python, Node), the Apple default `CFBundleIdentifier@CFBundleShortVersionString+CFBundleVersion`, the Android, React Native or Flutter default `package@versionName+versionCode`, or a build plugin's injected value. An absent `dist` is its own identity and never means "latest". The release records its first-seen time, first environment and the SDK name and version that created it, and is labeled "auto-created" until CI registers commits, artifacts or a deploy for it. Later registration of the same name through REL-001, `sentry-cli releases new/set-commits/finalize/deploys` or a build plugin (SRC-003) enriches that release and removes the label; it never splits it or changes its first-seen time. A name Sentry's release naming rules refuse (empty, `.`, `..`, `latest`, containing a newline, tab, `/` or `\`, or over 200 characters) creates no release: the event is accepted with release "none" and an "invalid release name" processing note counted per reason. When the name is a full commit SHA that exists in a repository linked through SRC-002, the release is associated with that commit, so suspect commits and TEAM-004 resolution work without a CI step.
- **Ordering rule.** Each project shows its release ordering rule in project settings. One transitive total order governs release lists and exports, resolve in the current or next release, TEAM-004 resolution, regression, `release:latest` and REL-002 comparison. Lists use ascending order (a descending view reverses that same order); "latest" is always its final release, never a separately guessed version or registered sequence.
  - **Default: first seen.** Order all releases by first-seen time, with registration counting as seen when it precedes intake. Equal first-seen times are broken by release name in UTF-8 byte order. Later enrichment never changes first-seen time.
  - **Optional: semver.** All names that parse as semantic versions, including `package@1.2.3+45` and `1.2.3`, come first, ranked by semver precedence (major, minor, patch and prerelease; build metadata does not affect precedence). Equal precedence is broken by first-seen time, then release name in UTF-8 byte order. Every non-semver name (SHA, date or free text) follows the semver releases, ordered by first-seen time and then release name in UTF-8 byte order. A pair never switches comparison rules based on the other release's name.
  - **Registered sequence only.** A maintainer can instead choose the stricter rule Spool's native intake uses: order by registered sequence, and refuse a Sentry SDK event or session with no release, or with an unregistered release or `dist`, with its named reason (`missing_release_register_required` or `unregistered_release_or_build`) and a pointer to registration. Each refusal is counted under that reason in project outcomes, BILL-001 usage and the MIG-001 dual run.

  A rule change is previewed (which resolved issues' regression boundaries move), audited and applies to later events. First-seen, semver and registered total orders now share the same list, latest, preview, current-resolution and regression comparison. Existing cached version keys are upgraded without changing first-seen times.
- **Plain Resolve.** Resolve with no release, in the issue view, bulk triage (TEAM-003) and chat actions (ALERT-005), regresses the issue on the next accepted event in any release or with no release, as in Sentry, and fires the ALERT-001 regression condition once. Resolve in the current, next or a named release keeps ERR-006's older-release protection under the project's ordering rule. An event with no release on an issue resolved in a release cannot be ordered, so it does not reopen the issue; it is counted on the issue as "seen with no release after resolve", shown on its timeline and offered as an ALERT-001 condition.
- **Bounds.** Automatic creation obeys SDK-006 filters (including release patterns and allowed domains for browser DSNs) and BILL-001 key rate limits. A maintainer can limit automatic creation to release names matching a pattern; an event whose release falls outside it is accepted with release "none" and a counted reason, never refused.

**Acceptance.**
1. With only the DSN changed, send unmodified Node SDK errors with no release and with an inferred SHA release; constructed envelopes exercise the wider release formats.
2. SDK-012 inherits the Python journey; SDK-015 to SDK-018 inherit the Apple, Android, React Native and Flutter release identities.
3. Confirm all are accepted and create issues and alerts, the two releases appear as auto-created with first-seen time and creating SDK, and the release-less events count in issue totals and search and are named as "no release" in release-scoped views.
4. Register one of those releases afterwards through the native release API and confirm it enriches the same release; SRC-003 inherits the sentry-cli and build-plugin journey.
5. Plain-resolve one issue and send the same error in the same release: it is Regressed and one regression alert fires.
6. Resolve another issue in the next release across two auto-created semver releases (`app@1.2.0`, `app@1.10.0`) and two SHA releases: regression follows the stated order, an older-release event does not regress it, and a release-less event is counted on the issue without reopening it.
7. Create a mixed history first seen in this order: `1.2.0`, `abc123`, `1.10.0`, `1.2.0-rc.1`, `def456`.
8. Under default first-seen order, every list and export returns that order and latest is `def456`. Under semver order, every list and export returns `1.2.0-rc.1`, `1.2.0`, `1.10.0`, `abc123`, `def456`, and latest is `def456`. Repeat calls under each setting, sort every permutation of the five releases to the same result, and check all comparison triples for transitivity. Include equal first-seen timestamps and semver names with equal precedence but different build metadata to prove the first-seen and byte-order tie breaks. Confirm `release:latest`, release comparisons and regression use the chosen order. Send an event with an invalid release name and confirm it is accepted as release "none" with its counted note. Switch the project to "registered sequence only" with its preview and confirm an unregistered release and a missing release are each refused with the named reason and counted in project outcomes, usage and the MIG-001 dual run. Existing event release identity is complete. SDK-005 inherits sessions; SRC-003 sentry-cli and build-plugin enrichment; SRC-002 and TEAM-004 linked full-SHA association; ALERT-001 release-less conditions; SDK-001 and SDK-012 to SDK-019 unmodified runtime/device qualification; MIG-001 dual-run reconciliation; ALERT-005 chat Resolve. Each inherits the sentences and acceptance above before shipping its capability. The owner acts as maintainer until TEAM-001. Next freezes the latest release at resolution time and regresses strictly later; named resolution regresses at the chosen existing release or later. No-release occurrences remain counted without reopening either. Legacy no-dist events and observed build records are migrated using retained Sentry dist evidence. Where retention removed that evidence, old registrations and artifacts keep their original explicit identity because their intended dist cannot be recovered. Absence and explicit valid SDK dist values cannot collide for new intake.

**Evidence.** `src/domain/releases/`; `src/domain/sentry/convert.ts`; `src/domain/operators/bulk-triage.ts`; `src/ui/workbench/ResolutionPicker.tsx`; `tests/release-identity-flow.mjs`; `tests/bulk-triage-flow.mjs` Event identity, no-dist separation and upgrade, automatic release enrichment, first-seen/semver/registered total ordering, plain/current/next/named owner and bulk resolution, revision-fenced previews, strict/pattern/name outcomes, archive restore and 1440/390 picker journeys.
**Gap.** None for existing event release paths. Future sessions, CLI/plugins, linked commits, alert conditions, runtime/device qualification, migration and chat actions inherit SDK-009 in SDK-005, SRC-003, SRC-002/TEAM-004, ALERT-001, SDK-001, MIG-001 and ALERT-005 respectively.

#### SDK-010 — Sentry event fidelity: exception chains, frames, local variables, tags, contexts and request

Core · target · **done**

**Requirement.** Every `event` that SDK-007 admits from an unmodified Sentry SDK (through `/envelope/` or `/store/`) keeps the data below. Issue detail, FIND-001 search, GROUP-001 grouping, SDK-003 scrubbing and API-001 export use it. Every admitted field in this list is retained at conversion subject to the explicit capture-policy exclusions below, each named on the event. Any trimming is named on the event and counted in SDK-007 capability diagnostics, never silent. An event is never refused because it has an exception chain, an exception group, frame variables, many frames or no stack trace.
- **Exception chain.** Every `exception.values` entry is kept in SDK order, each with its `type`, `value`, `module`, its own stack trace and its `mechanism` (`type`, `handled`, `synthetic`, `source`, `is_exception_group`, `exception_id`, `parent_id`). This covers:
  - JavaScript and Next.js `error.cause` chains from the default LinkedErrors integration (five levels);
  - Python `raise … from` and implicit `__context__` chains;
  - Python 3.11+ `ExceptionGroup`/`BaseExceptionGroup`, including `asyncio.TaskGroup` failures, with every child;
  - Java/Kotlin `Caused by` and suppressed exceptions;
  - .NET `InnerException` and `AggregateException`;
  - Go wrapped errors.

  Exception groups are accepted on every runtime. Issue detail shows each exception with its own frames, marks the root cause, and shows exception-group children as a tree under "Related Exceptions", as Sentry does. The issue title follows Sentry's rule: the type and value of the exception Sentry would title the issue with. FIND-001 searches every exception in the chain (`error.type`, `error.value`, `error.mechanism`, `error.handled`, `error.unhandled`).
- **Frames.** Each frame keeps `filename`, `abs_path`, `module`, `package`, `function`, `raw_function`, `symbol`, `lineno`, `colno`, `in_app`, `platform`, `pre_context`, `context_line`, `post_context`, `vars`, `instruction_addr`, `symbol_addr`, `image_addr`, `addr_mode` and `trust`, plus the event's `debug_meta` images for SDK-002 symbolication.
  - **Frame bound.** Spool keeps up to 1,000 frames per stack trace, above every SDK-001 runtime's default capture. Beyond that it removes middle frames, keeps the 500 innermost and 500 outermost, and shows "N frames omitted" in their place.
  - **Variable bound.** Frame variables are kept as sent, within SDK-011's 1 MiB event item limit, to 10 levels of nesting and 16 KiB per value. A deeper or longer value is cut with a visible mark.
  - **SDK trimming.** The SDK's own `_meta` trimming and filtering remarks are kept and shown.

  Issue detail shows each frame's SDK-sent source context lines (`pre_context`, `context_line`, `post_context`), labeled as sent by the SDK and kept distinct from ERR-005 mapped source and SRC-002 repository links. It also shows the frame's local variables, expandable by key. A frame whose variables set `__traceback_hide__` to true is hidden from the view and from grouping (GROUP-001). A raw stack trace view shows the whole chain as text in the runtime's own format (Python traceback, JavaScript `Error.stack`, Java `Caused by`), minified or original. It has one-click copy and shows only what the viewer's role and the scrubbers allow.
- **Event data.** Spool keeps:
  - `level`, `logger`, `transaction`, `server_name`, `environment`, `dist`, `platform`, `modules` and `fingerprint`;
  - `sdk` (name, version, integrations and packages);
  - `message` and `logentry` (`message`, `params`, `formatted`);
  - `tags`, both SDK automatic tags and custom `setTag` values;
  - `contexts`: browser, os, device, runtime, app, gpu, culture, cloud_resource, trace, response, state, feature flags and custom contexts;
  - `request`: `url`, `method`, `query_string` after ERR-003 query scrubbing, and `headers`, `env`, `cookies` and `data` under SDK-003 rules and SDK-008;
  - `extra`;
  - `threads`, with each thread's stack, `crashed`/`current` flags and state;
  - every breadcrumb the SDK sends (its default 100), each with type, category, level, timestamp, message and data.

  Spool derives Sentry's event tags: `level`, `handled`, `mechanism`, `environment`, `release`, `dist`, `transaction`, `url`, `server_name`, `browser`, `browser.name`, `os`, `os.name`, `device`, `device.family`, `runtime`, `runtime.name` and `user` (SDK-008). Each event shows its tags, contexts, request and extra as structured sections. Every tag is a FIND-001 search key and facet. Issue detail shows a per-issue tag summary that lists each tag key's top values, with counts and percentages over all the issue's events and an "other" bucket.
- **Message events.** A `captureMessage` event, or any event with no exception and no stack trace, is accepted as an issue with its level and tags. It is grouped by its message template (`logentry.message` before parameters, otherwise `message`). A stack trace sent by `attachStacktrace` is shown and used for grouping.
- **Grouping, scrubbing and egress.** GROUP-001 groups over the whole exception chain and exception group. SDK-003 server rules, ERR-003 scrubbers and default secret-name masking run on every kept field, including frame variables, context lines, exception values, request, contexts, extra and thread stacks, before storage. ERR-007 packets gain the chain, frame identities, tags and contexts within their 256 KiB bound and named truncation. SDK-sent context lines and frame variables reach agents or model providers only through AI-001's previewed field selection.

**Acceptance.**
1. Exercise the following conversion journeys through admitted envelopes, with unmodified Node/browser intake.
2. SDK-012 inherits the unmodified Python/Java default-integration journey with only the DSN changed. - A Python `raise ValueError(...) from KeyError(...)` whose frame locals hold a `password` and an ordinary value.
3. Confirm both exceptions appear in issue detail with their own frames, SDK-sent source context lines and local variables.
4. Confirm the `password` local is masked in storage, issue views, packets and exports while the ordinary local survives. - The same wrapper exception with two different root causes.
5. Confirm two issues and two ALERT-001 new-issue alerts. - A Python `ExceptionGroup` with two children, and an `asyncio.TaskGroup` failure.
6. Confirm each is accepted and the children appear under Related Exceptions. - A Node error with `cause`, a Next.js server error wrapped with `cause`, and a Java `Caused by` chain.
7. Confirm each chain is shown with its root cause marked. - A browser event with `setTag("tenant","acme")` and the SDK's browser and os contexts.
8. Confirm the tags and contexts appear on the event, the issue's tag summary shows `tenant`, `browser.name` and `os.name` with counts and percentages, and `tenant:acme browser.name:Chrome` finds the issue. - A Django error with `request` data. Confirm the URL, method and allowed headers show while the cookie and authorization headers are scrubbed. - A bare `captureMessage("quota exceeded for %s", ...)`. Confirm it is accepted as an issue grouped by the template. - A 1,200-frame recursion. Confirm 1,000 frames are kept with "200 frames omitted" shown. - Copy the raw stack trace of the Python chain. Confirm the copied text shows both tracebacks with no masked value revealed. Current capture excludes user identity, request cookies, bodies and environment with named processing notes until SDK-003/SDK-008 opt-in field policies and previews exist. Query strings are retained after decoded secret-name masking and ERR-003 scrubbing, bounded to 16 KiB with a named trimming note. SDK-003 inherits custom server rules; AI-001 previewed agent field selection; SDK-011 transport/item limits; SDK-012 full unmodified Python/Java qualification; ERR-005/SRC-004 the wider map projection. These inherited capabilities keep their own status and acceptance; no user identity or raw request opt-in is implemented here.

**Evidence.** `src/domain/sentry/evidence.ts`; `src/domain/sentry/query.ts`; `src/ui/workbench/SentryEvent.tsx`; `tests/fidelity-flow.mjs` (SDK-010). Rich chain/group/frame/local/context evidence, scrubbed query retention, named exclusions, archive/packet privacy and bounded trimming.
**Gap.** None for current admitted conversion. SDK-003/SDK-008 inherit opt-in request/identity policy and custom rules, AI-001 previewed source/local egress, SDK-001 broader runtime qualification, SDK-011 wire limits and ERR-005/SRC-004 expanded map lookup.

#### SDK-011 — Sentry intake encodings, published size limits and per-item refusal

Core · target · **partial**

**Requirement.** Everything an unmodified Sentry SDK sends with its default transport gets through Spool's intake door. This covers SDK-007's `/envelope/`, `/store/`, `/minidump/`, `/unreal/` and `/security/` endpoints, the SDK-001 tunnel handlers and the first-party ingest subdomain.
- **Encodings.** Request bodies are accepted uncompressed or with `Content-Encoding` `gzip`, `deflate`, `br` (Brotli) or `zstd`, and with or without a `Content-Length` (chunked transfer). This includes the Python SDK, which uses Brotli whenever the `brotli` module is installed. Decompression is streamed and stops at the limits below, so a decompression bomb is refused as too large without exhausting memory. An encoding outside this list is refused with 415 naming the encoding, and the refusal is counted.
- **Published limits.** Setup, documentation and capability diagnostics publish these limits, each at least equal to Sentry's documented ingest limits:
  - 40 MiB for a compressed request;
  - 200 MiB for an envelope after decompression, including all items;
  - 1 MiB for each event (error or transaction), span, log or metric item;
  - 100 KiB for a check-in item;
  - 4 KiB for a client report item;
  - 50 MiB for a profile item;
  - 10 MiB for a compressed replay item and 100 MiB after decompression;
  - 200 MiB of uncompressed attachments per event, covering attachments, screenshots, view hierarchies, minidumps, Apple crash reports and Unreal crash files, including through `/minidump/` and `/unreal/`;
  - 100 sessions per envelope and 100 session aggregate buckets per `sessions` item.

  A maintainer can lower a project's limits, with a preview of affected recent traffic, but cannot raise them above the published figures. Attachment, minidump, profile and replay items stream to the isolated storage named in the boundaries and are never held whole in request memory.
- **Per-item refusal.** An item over its limit, or an item that fails to parse, is refused alone with its reason (`item_too_large` or `invalid_item`, with the item type), and the rest of the envelope is accepted. The response and a `client_report`-compatible outcome name the refused item. Only a request over the compressed-request or decompressed-envelope limit is refused whole, with 413 and the limit named.
- **Counting.** Each refusal, whether an unsupported encoding, an oversized request, an oversized item or an invalid item, is counted per item type, reason, SDK name and version in project outcomes, SDK-007 capability diagnostics, BILL-001 usage and the MIG-001 dual run. None of them consumes billable quota.

**Acceptance.**
1. With only the DSN changed: - Send errors from an unmodified Python SDK with `brotli` installed.
2. Confirm the issue is created. - Send `deflate`, `zstd`, `gzip`, uncompressed and chunked-transfer envelopes.
3. Confirm each is accepted.
4. Send an unsupported encoding and confirm a counted 415 that names it. - Send a 900 KiB error event.
5. Confirm it is accepted. - Send an iOS and an Android crash with `attachScreenshot` and a 2 MiB view hierarchy, an Electron crash with a 5 MiB minidump through `/minidump/`, and a mobile replay segment near the 10 MiB compressed limit.
6. Confirm each is stored and viewable by a permitted member. - Send one envelope holding a 1.5 MiB event item and a valid error.
7. Confirm the error is accepted and the oversized item is refused alone with `item_too_large`.
8. Confirm the refusal is counted in project outcomes, capability diagnostics, BILL-001 usage (no quota consumed) and the MIG-001 dual run. - Send a small compressed body that expands past 200 MiB. Confirm a 413 naming the limit, with no memory exhaustion and nothing stored. - Lower one project's attachment limit with its preview. Confirm a larger screenshot is refused alone and counted.

**Evidence.** `src/domain/sentry/wire.ts`; `src/domain/sentry/routes.ts`; `tests/sentry-http.mjs`; `tests/sentry-sdk.mjs`
**Gap.** Uncompressed, `gzip` and `deflate` bodies are accepted with bounded decompression. Public-door SDK-011 proof checks deflate issue creation and expanded-size refusal, unsupported encodings named in 415 responses and counted with header/query ingest grants, and malformed event JSON refused as `invalid_item` while a valid companion is admitted without extra accepted units. The whole request remains capped at 256 KiB compressed, 1 MiB expanded and 100 items; `br`/`zstd`, Sentry-equal limits, oversized-item isolation, streamed heavy-item storage and full usage/dual-run reconciliation remain absent.

#### SDK-012 — Unmodified server-runtime SDKs: Python, Go, Java/JVM, Ruby, PHP, .NET, Rust and Elixir

Core · target · **done**

**Requirement.** Each runtime passes the SDK-001 qualification run, in one push Verify job per runtime with its toolchain.

**Acceptance.**
1. - Q1 to Q7 for each of the eight runtimes. - **P1 (inherited from SDK-009):** unmodified Python no-release and inferred-SHA intake, including a release-less alert and release-scoped no-release counts. - **P2 (inherited from SDK-010):** the unmodified Python SDK with default integrations:   - `raise … from`;   - an `ExceptionGroup`;   - default `include_local_variables`;   - SDK context;   - Django request data over a real request. - **J1 (inherited from SDK-010):** unmodified Java `Caused by` and suppressed chains.
2. Constructed envelopes qualify conversion only.

**Evidence.** `tests/sdk-runtimes.mjs`; `tests/runtimes/`; `tests/runtimes/screens.mjs`; `tests/runtimes/python.mjs`; `tests/runtimes/java.mjs`; `src/domain/sentry/auth.ts` Push Verify jobs runtime (python), (go), (java), (ruby), (php), (dotnet), (rust) and (elixir) each run one unmodified SDK program against a reference collector and against Spool with only the DSN changed. Q1: "every SDK error event is a persisted occurrence", "handled exception chain persisted" and the handled issue read through the UI at 1440 and 390. Q2: "unhandled failure persisted as unhandled" (sentry-go v0.50.0 marks a recovered panic only with level fatal, client.go line 805, which Spool keeps); in runtime (elixir) a crashed Task is reported by the SDK's logger handler with handled false, and `tests/runtimes/elixir/app.exs` attaches its cart in the process that runs the checkout, because sentry 14.0.0 loses a crash whose caller holds an attachment (the handler passes the caller's context as capture options, lib/sentry/logger_utils.ex line 30; Sentry.Event.create_event/1 refuses :attachments, lib/sentry/event.ex line 196; the handler swallows the error, lib/sentry/logger_handler.ex line 475). Q3: "the restarted process groups into the same issue" with no duplicate occurrence. Q4: "Spool outcomes reconcile with SDK-sent items" with tracing, logs and an attachment from every runtime and sessions from Python, Java, Ruby (request mode), .NET and Rust; sentry-go v0.50.0, sentry/sentry 4.34.0 (PHP) and sentry 14.0.0 (Elixir) offer no sessions. Q5: "release and dist equal what the SDK sent" and "release is created automatically". Q6: client-report discards in project outcomes (BILL-001 usage) from Python, Go, Java, .NET, Rust and Elixir; sentry/sentry 4.34.0 sends none (Client.php lines 354-366 only log a before_send drop) and sentry-ruby 7.1.0 sends none from this process (Sentry.close flushes the report, sentry-ruby.rb line 303, before stopping the worker that records the discard, line 312). Q7: "refused or undeliverable events create nothing". P1: "the release-less event raises one new-issue alert", "release-less alert names no release", "SDK-inferred git SHA is the release", "release-scoped no-release count" and the Releases and Alerts screens at 1440 and 390. P2: the raise-from chain, ExceptionGroup, default local variables, SDK context and "Django request headers are kept". J1: the Caused by chain with a suppressed exception (java verify).
**Gap.** None for this clause. Persisted session, trace, log and attachment outcomes belong to SDK-025 and check-ins to SDK-024; the Rust SDK's native-style frames without file and line belong to SDK-002. Constructed envelopes (`tests/multilingual.mjs`) qualify conversion only.

#### SDK-013 — Unmodified Electron SDK

Core · target · **done**

**Requirement.** Errors in the `@sentry/electron` main and renderer processes pass Q1 to Q7 in a packaged app run under a virtual display in a push or scheduled job. Native minidumps remain SDK-002 and SDK-011.

**Acceptance.**
1. Errors in the `@sentry/electron` main and renderer processes pass Q1 to Q7 in a packaged app run under a virtual display in a push or scheduled job.
2. Native minidumps remain SDK-002 and SDK-011.
3. Current evidence: [SDK-013] `tests/sdk-runtimes.mjs electron`, push Verify `runtime (electron)`, runs one packaged app twice with only its DSN changed.
4. The first Linux proof is job 120145163135 in run 39870933106.
5. Exact versions: @sentry/electron 8.3.0, Electron 45.0.0 and @electron/packager 20.3.0.
6. The app is packaged into an unpacked Linux directory with ASAR, run under Xvfb, and never launched on macOS.
7. Native minidumps remain SDK-002 and SDK-011.   - Q1: `tests/runtimes/electron/main.cjs` and `tests/runtimes/electron/renderer.cjs` capture their own handled failures; the generic journey asserts every reference error is a persisted occurrence.
8. Main and renderer issues are read through the public API and UI at 1440 and 390.   - Q2: the same app raises a real main uncaught exception through the default integration and a renderer timer error through the default global handler. `tests/runtimes/electron.mjs` asserts both exception types persist with `mechanism.handled:false`.   - Q3: handled, crash, handled across packaged-app relaunches; the generic journey and Electron adapter assert both handled groups count two, both unhandled groups count one, and all six occurrence IDs are unique.   - Q4: the runtime journey reconciles every reference item exactly with Spool outcomes. The first proof sends six errors, six logs, six transactions, five sessions, four attachments, five feedback items, three replay events, three replay recordings and six client reports. Errors and feedback persist; other telemetry is counted by category and reason, with storage remaining SDK-025. Main/renderer defaults stay enabled except `SentryMinidump`, explicitly disabled identically for both collectors; ordinary main sessions remain enabled. Replay is enabled in the renderer. No native minidump or abnormal-session recovery claim is made.   - Q5: the generic journey compares release/dist with SDK-sent identities and asserts automatic creation with the creating SDK.   - Q6: SDK-generated `before_send` discards reconcile into BILL-001's project outcomes usage door, six discarded errors in the first proof.   - Q7: the same packaged app with a refused key and an undeliverable DSN exits normally, and the public issue counts remain unchanged. The SDK's supported online `makeElectronTransport` is used for both collectors. This qualifies flush/relaunch grouping; durable offline transport recovery is not claimed. Network requests are restricted to the DSN origin; fixture IPC and local files remain local. Retained screens: `docs/retained-verification/sdk013/`. Gap: none for this bounded JavaScript qualification. No real provider, device or consent was used.

**Evidence.** Q1–Q7: `tests/sdk-runtimes.mjs` ([SDK-013] electron journey), `tests/runtimes/electron.mjs`, `tests/runtimes/electron/`; main/renderer handled and unhandled API/UI, relaunch grouping, exact item reconciliation, release/dist, SDK discards and refusal. Screens: `docs/retained-verification/sdk013/`.
**Gap.** None for @sentry/electron 8.3.0 JavaScript qualification in packaged Electron 45.0.0 on Linux Xvfb. Official online transport; native minidumps disabled for both collectors. Durable offline/native recovery remains unproven under SDK-002/SDK-011; persisted telemetry stays SDK-025. No real provider, device or consent was used.

#### SDK-014 — Unmodified Unity SDK

Core · target · **missing**

**Requirement.** A Unity player build with the Sentry Unity SDK passes Q1 to Q7. The CI job needs an activated Unity license. Obtaining one is engineering work recorded here, not a waiver.

**Acceptance.**
1. A Unity player build with the Sentry Unity SDK passes Q1 to Q7.
2. The CI job needs an activated Unity license.
3. Obtaining one is engineering work recorded here, not a waiver.
4. Current evidence: No implementation evidence yet.
5. The CI job needs an activated Unity license; obtaining one is engineering work, not a waiver.

**Evidence.** None.
**Gap.** No implementation proof yet. The CI job needs an activated Unity license; obtaining one is engineering work, not a waiver.

#### SDK-015 — Unmodified iOS (Apple) SDK

Core · target · **missing**

**Requirement.** A `sentry-cocoa` test app passes Q1 to Q7 on an iOS simulator or device in a named macOS job, with mobile replay, feedback and screenshot or view-hierarchy attachments, and a crash sent on the next launch (Q3). SDK-009 inherited: the default `CFBundleIdentifier@CFBundleShortVersionString+CFBundleVersion` release is auto-created, with release-less alerts and release-scoped no-release counts. Real-device crash and symbol pipelines stay with SDK-002.

**Acceptance.**
1. A `sentry-cocoa` test app passes Q1 to Q7 on an iOS simulator or device in a named macOS job, with mobile replay, feedback and screenshot or view-hierarchy attachments, and a crash sent on the next launch (Q3).
2. SDK-009 inherited: the default `CFBundleIdentifier@CFBundleShortVersionString+CFBundleVersion` release is auto-created, with release-less alerts and release-scoped no-release counts.
3. Real-device crash and symbol pipelines stay with SDK-002.
4. Current evidence: No implementation evidence yet.
5. A named macOS job with an iOS simulator or device is engineering work.

**Evidence.** None.
**Gap.** No implementation proof yet. A named macOS job with an iOS simulator or device is engineering work.

#### SDK-016 — Unmodified Android SDK

Core · target · **missing**

**Requirement.** A `sentry-android` test app passes Q1 to Q7 on an emulator or device in a named job, with mobile replay, feedback and attachments. SDK-009 inherited: the default `package@versionName+versionCode` release is auto-created, with release-less alerts and release-scoped no-release counts.

**Acceptance.**
1. A `sentry-android` test app passes Q1 to Q7 on an emulator or device in a named job, with mobile replay, feedback and attachments.
2. SDK-009 inherited: the default `package@versionName+versionCode` release is auto-created, with release-less alerts and release-scoped no-release counts.
3. Current evidence: No implementation evidence yet.
4. A named job with an Android emulator or device is engineering work.

**Evidence.** None.
**Gap.** No implementation proof yet. A named job with an Android emulator or device is engineering work.

#### SDK-017 — Unmodified React Native SDK

Core · target · **missing**

**Requirement.** A `@sentry/react-native` app passes Q1 to Q7 on both iOS and Android, for JS-layer and native-layer errors. SDK-009 inherited: the React Native default release identity, with release-less alerts and release-scoped no-release counts.

**Acceptance.**
1. A `@sentry/react-native` app passes Q1 to Q7 on both iOS and Android, for JS-layer and native-layer errors.
2. SDK-009 inherited: the React Native default release identity, with release-less alerts and release-scoped no-release counts.
3. Current evidence: No implementation evidence yet. iOS and Android jobs are engineering work.

**Evidence.** None.
**Gap.** No implementation proof yet. iOS and Android jobs are engineering work.

#### SDK-018 — Unmodified Flutter SDK

Core · target · **missing**

**Requirement.** A `sentry_flutter` app passes Q1 to Q7 on both iOS and Android, for Dart and platform errors. SDK-009 inherited: the Flutter default release identity, with release-less alerts and release-scoped no-release counts.

**Acceptance.**
1. A `sentry_flutter` app passes Q1 to Q7 on both iOS and Android, for Dart and platform errors.
2. SDK-009 inherited: the Flutter default release identity, with release-less alerts and release-scoped no-release counts.
3. Current evidence: No implementation evidence yet. iOS and Android jobs are engineering work.

**Evidence.** None.
**Gap.** No implementation proof yet. iOS and Android jobs are engineering work.

#### SDK-019 — Unmodified Kotlin Multiplatform SDK

Core · target · **missing**

**Requirement.** A shared module using `sentry-kotlin-multiplatform` passes Q1 to Q7 from its JVM/Android and iOS targets.

**Acceptance.**
1. A shared module using `sentry-kotlin-multiplatform` passes Q1 to Q7 from its JVM/Android and iOS targets.
2. Current evidence: No implementation evidence yet.

**Evidence.** None.
**Gap.** No implementation proof yet.

#### SDK-020 — Guided setup command and published framework setup

Core · target · **done**

**Requirement.** A guided setup command, comparable to the Sentry setup wizard:
- detects the framework;
- installs the SDK;
- writes the DSN, release and source-map configuration as a reviewable diff;
- sends a test event;
- writes nothing when it refuses.

Spool publishes framework setup for React/Next.js, Express, Django/FastAPI, Spring, Rails, Laravel and ASP.NET Core. Setup names Sentry's `tunnelRoute` limitation and its replacement (SDK-021).

**Acceptance.**
1. - **G1:** run the command on a fresh Next.js app and on a fresh Django app; the applied change equals the reviewed diff. - **G2:** the source-map configuration is written and maps a real error. - **G3:** the test event is accepted, and only Spool's receipt counts it. - **G4:** a bad DSN or an unsafe path writes nothing. - **G5:** the seven framework guides are published.

**Evidence.** G1–G4: `tests/setup-flow.mjs` ([SDK-020] packed setup journey: reviewed/applied patch, real production error before/after map upload, receipt and no-write refusals). G5: `docs/SENTRY-SWITCHING.md` (Framework setup). Screens: `docs/retained-verification/sdk020/`.
**Gap.** G2 is the JavaScript-framework point, proven on Next.js: the original app/page.js line maps after the generated production build invokes spool-sourcemaps; the same application/release without upload is unmapped. Django states Python has no source maps to configure. Other framework generators remain guidance; no real provider, device or consent was used.

#### SDK-021 — Tunnel handlers and ad-blocker delivery

Core · target · **partial**

**Requirement.** Sentry's Next.js `tunnelRoute` rewrite only targets Sentry's hosted ingest, so Spool ships two handlers for the SDK's standard `tunnel` option:
- a drop-in Next.js tunnel route handler;
- a generic server tunnel handler (Node and Python).

Both check the envelope's DSN header against the project and forward the client address for SDK-008.

**Acceptance.**
1. With a standard ad-blocker list enabled in a browser, deploy a Next.js app first with `tunnelRoute` (setup shows the named limitation), then with the Spool tunnel handler.
2. Confirm every browser error arrives through the handler and reconciles in the MIG-001 dual run.

**Evidence.** `packages/sdk/src/tunnel.ts`; `packages/sdk/src/next.ts`; `packages/tunnel-python/spool_tunnel.py`; `tests/tunnel-flow.mjs`; `docs/SENTRY-SWITCHING.md`
**Gap.** Node, Next.js and Python tunnels with the DSN check, forwarded origin, rate-limit reply and bounded body; the default route blocked and the tunnel delivered under the EasyPrivacy Sentry rules in the Ghostery engine. Remaining: a real ad-blocker browser extension and the MIG-001 dual run are unexercised. Client address through a tunnel: tunnels forward `X-Forwarded-For`, but Spool honours no forwarded address (SDK-008). Default ADOPTED pending ct (ct ASK open: which tunnels Spool may trust): deny by default; no tunnel is trusted, `{{auto}}` resolves only from the connecting address, so events through a tunnel carry the tunnel server's address.

#### SDK-022 — First-party ingest subdomain

Core · target · **missing**

**Requirement.** Spool serves project ingest on a buyer-owned first-party subdomain (CNAME with managed TLS) that the DSN names. The hosted deployment and the DNS zone are engineering work recorded here.

**Acceptance.**
1. Repeat the SDK-021 ad-blocker deployment with the subdomain DSN.
2. Confirm every browser error arrives and reconciles in the MIG-001 dual run.

**Evidence.** None.
**Gap.** No implementation proof yet. The hosted deployment, the DNS zone and managed TLS are engineering work recorded in the clause.

#### SDK-023 — JavaScript Loader Script per DSN key

Core · target · **done**

**Requirement.** Sites that embed Sentry's Loader Script (`js.sentry-cdn.com/<key>.min.js`) get a Spool loader script per DSN client key, served from Spool or the SDK-022 subdomain. Its SDK version and its tracing, replay and feedback options are set in the key's settings, and lazy loading and `Sentry.onLoad`/`sentryOnLoad` behave as before. The real-organization loader-key inventory and replacement listing are carried by MIG-001 (ct carve, 23 October 2026). SDK-009 is inherited: loader events without a release are accepted and counted, and explicit release/dist identity and grouping match the directly bundled browser SDK.

**Acceptance.**
1. Replace a site's Sentry loader tag with the Spool loader, configured with the same key settings.
2. Confirm lazy loading, `Sentry.onLoad` and an error capture.

**Evidence.** `tests/sentry-sdk.mjs` ([SDK-023] loaderFlow); `tests/loader-flow.mjs`: lazy call/error capture API/UI, eager and both hooks, force load, key settings/integrations, uniform key refusal, direct-SDK identity/grouping/outcomes and release-less intake; `tests/loader-upgrade.mjs`: populated same-key upgrade; `tests/old-archive.mjs`: released upgrade/restore; public archive/restore/erasure in `tests/loader-flow.mjs`; push verify (sdk) and verify (runtime); screens `docs/retained-verification/sdk023/`.
**Gap.** The real-organization key/settings inventory and replacement listing is a MIG-001 Gap under ct's 23 October carve, with its sentence retained verbatim there. Own Spool path; no Sentry key reuse. Only the shipped browser SDK version is selectable; optional capture starts off. Pre-load automatic instrumentation remains unqualified; the hosted legacy report dialog is qualified under SDK-004. Feedback screenshots are disabled. Trace/replay storage remains with its owning clauses. No real provider call, device or consent was used.

#### SDK-024 — Cron check-ins routed to Uptime

Core · target · **partial**

**Requirement.** Spool accepts Sentry SDK check-in envelopes (`capture_checkin`, `@monitor`, `Sentry.withMonitor`) at the DSN and forwards them to the buyer's connected Uptime heartbeat, linking the job's errors to it. Without a connection they are counted as unrouted in capability diagnostics, never silently dropped.

**Acceptance.**
1. Send one check-in with a connected Uptime heartbeat and one without.

**Evidence.** `src/domain/checkins/`; `migrations/core/0069_checkin_routes.sql`; `src/ui/workbench/CheckInRoutes.tsx`; `tests/sentry-sdk.mjs` ([SDK-024] checkInFlow); `tests/checkin-flow.mjs`: connected start/success/failure receipts, unconnected check-in counted unrouted, refusals and failures, trace link, custody and populated upgrade; `tests/sdk-runtimes.mjs` with `tests/runtimes/harness.mjs`: server-runtime check-ins counted unrouted in Q4; `tests/old-archive.mjs`; `docs/CHECK-INS.md`
**Gap.** The receiver in the proof is a recorded double of Uptime's documented heartbeat door at the egress edge: no real Uptime installation received a receipt, and DONE needs Uptime's own heartbeat route (run-uptime main read at `9f50e5050d206551ca4c7e2af8dbbe2cb5b405b5`, not run). Linking: the unmodified Node SDK (`@sentry/core` 11.6.0 `captureCheckIn`, `contexts.trace`) and Python SDK (`sentry-sdk` 2.72.0 `scope.py` `_apply_contexts_to_event`) stamp the check-in and the job's errors with one trace id, which Spool shows on the occurrence (Node proven through the UI and API; Python read from source only); sentry-go v0.50.0 (`interfaces.go` `checkInMarshalJSON`) and sentry-elixir 14.0.0 (`lib/sentry/check_in.ex`, caller-supplied `contexts`) send no trace on a check-in, so their errors have no link. Sentry's duration, monitor config, release, environment and check-in id have no receiving field in Uptime's heartbeat door and are not forwarded; receipts keep arrival order. Defaults ADOPTED: DONE needs the real Uptime door; only what the SDK data truthfully carries links an error to a check-in. No real provider call, device, live Uptime installation or consent was used.

#### SDK-025 — Persisted non-error outcomes for every SDK-001 runtime

Core · target · **partial**

**Requirement.** For each runtime, the session, trace, replay, log, attachment and feedback-widget items from its qualification run are persisted and reconciled through the public UI and API, in the clauses that own them (SDK-004, SDK-005, SDK-007, CTX-001, CTX-002, API-001).

**Acceptance.**
1. As each owning clause ships storage, rerun every family's qualification run and reconcile the persisted issue, release, session, trace, replay, feedback, attachment and discard outcomes.

**Evidence.** `src/domain/feedback/`; `src/domain/sentry/client-reports.ts`; `tests/sentry-sdk.mjs`; `tests/client-report-flow.mjs`; `tests/sdk-runtimes.mjs`
**Gap.** Feedback text and client-report discards persist for browser/Node (and Java and .NET feedback in the SDK-012 runs); bounded sessions persist under SDK-005 (Node/browser health qualified; other runtime health remains a gap), while traces, replay, logs and attachments are counted as unsupported.

### Investigation and source

#### GROUP-001 — Explainable grouping and durable corrections

Core · target · **done**

**Requirement.** Group occurrences stably across builds and runtimes, explain the fingerprint/rule version, support SDK fingerprints and project grouping rules, and preview future rule effects against retained events. Bulk split/merge corrections preserve original grouping, alert/repair coverage and undo provenance. New intake follows the chosen versioned rule; historical regrouping is explicit and cannot erase previous failure evidence. Stack trace rules honor the per-frame `in_app` flag and the in-app include/exclude options that unmodified Sentry SDKs send, and let a maintainer mark frames in-app or not in-app (`+app`/`-app`) and include or exclude them from grouping (`+group`/`-group`) by path, module, package, function and platform family (Sentry's `stack.abs_path`, `stack.module`, `stack.package`, `stack.function` and `family` matchers), previewed against retained events and applied to later intake. The issue view collapses frames that are not in-app, and grouping uses in-app frames when any exist; MIG-001 imports Sentry stack trace and fingerprint rules. The default rule groups over the whole exception chain SDK-010 keeps, processing each exception in turn as Sentry's default does. The same wrapper exception with different root causes therefore makes different issues. An exception group is grouped by its top-level exception and its children. Frames hidden by `__traceback_hide__` are left out of grouping. A message event with no stack groups by its message template. Fingerprint rules can match any exception in the chain (`error.type`, `error.value`), the message, the level, the logger, tags and SDK name, as Sentry's fingerprint matchers do. Each event has a grouping information view. It shows the rule version, the variant used (exception chain, stack, message or custom fingerprint) and, per exception, which frames and values contributed to the hash and which did not, with the reason (not in-app, hidden by a `-group` rule, or `__traceback_hide__`). The owner acts as maintainer until TEAM-001 provides project roles. Native JavaScript, Python and Go accept opt-in versioned path/function/family stack rules and type/message/family fingerprint rules; absent native module/package/tag/SDK fields are named unavailable. Without a matching rule their native v1 identities remain unchanged. Historical regrouping means an explicit selected-occurrence correction with preview, version, audit, immutable original membership and guarded undo; rule activation applies forward only. Policy changes retain repair coverage gaps and never replay alerts or alter loss counters. TEAM-001 must enforce the maintainer authority before its role doors ship, and MIG-001 must import and preview grouping rules before migration completion.

**Acceptance.**
1. Capture equivalent and distinct failures across builds, preview a custom rule, apply it to future and explicitly selected historical events, undo a correction and inspect alert rates, immutable originals and repair gaps.
2. Add a `stack.module:vendor.* -app` rule and a `-group` rule, preview them, and confirm later events collapse those frames in the issue view and group by the remaining in-app frames, and that a frame an unmodified Sentry SDK sends with `in_app: false` is collapsed.
3. Send one wrapper exception with two different root causes and confirm two issues, then open each event's grouping information view and confirm it names the chain variant and marks the contributing and non-contributing frames with reasons.
4. Add a fingerprint rule on `error.type` of the inner exception and confirm later events follow it.
5. Send a Python frame with `__traceback_hide__` set and confirm it is hidden and excluded from the hash.

**Evidence.** `src/domain/grouping/`; `src/domain/sentry/grouping.ts`; `src/ui/workbench/GroupingRules.tsx`; `tests/grouping-rules-flow.mjs`; `tests/operator-flow.mjs`; `tests/fidelity-flow.mjs`; `docs/GROUPING-RULES.md`
**Gap.** GROUP-001 public journeys cover native JavaScript/Python/Go and Sentry matching/unmatched rules, no-write retained-event previews, audited revision-fenced forward activation, immutable policy versions and per-occurrence contribution snapshots. Default native identities remain unchanged without matching rules. Explicit selected-occurrence split/merge and guarded undo preserve original membership, payloads, counters, alert history and repair coverage; policy activation itself adds an honest repair gap. Rules, versions and snapshots survive private archive restore and are removed by project erasure. Native and Sentry preview/save/conflict and explanation screens are exercised at 1440/390. Owner acts as maintainer until TEAM-001; TEAM-001 and MIG-001 inherit their role/import doors before completion.

#### FIND-001 — Search, facets and saved investigation views

Core · target · **partial**

**Requirement.** Search the entire authorized retained corpus by time window, message, stack/function, project/team, environment, release (including `release:latest` under the project's SDK-009 ordering rule and `!has:release` for events sent with no release), severity, priority (TEAM-003), status, owner, every tag SDK-010 keeps or derives (SDK automatic tags such as `browser.name`, `os.name`, `device.family`, `runtime.name`, `url`, `transaction`, `server_name`, `handled`, `mechanism` and `level`, and every custom `setTag` key), any exception in the chain (`error.type`, `error.value`, `error.handled`), the `user.id`, `user.email`, `user.username` and `user.ip` keys under SDK-008's identity policy and role scope, and approved event properties. The issue stream shows and sorts by affected users (SDK-008) and by priority. Facets, counts, ordering and cursor pagination reflect the full query. A For Review inbox per project and team lists new, regressed and escalating issues that no member has reviewed yet, with a count; a member marks one or many reviewed, and it leaves the inbox for everyone with an audited actor. Save/share views and deep links without conferring access; exports use the same query and report bounds or refusals rather than silently truncating.

**Acceptance.**
1. Ingest more than the current list limit across projects/releases, find an older off-page event with combined filters, open the For Review inbox, mark an issue reviewed and confirm it leaves the inbox for a teammate, save a view, open it as permitted/forbidden teammates and reconcile query counts and export.
2. Search `user.email:<a customer's address>` and confirm exactly that user's issues and user-facet counts, repeat as a read-only collaborator and confirm the values are hidden, and filter and sort the stream by priority and by affected users.
3. Search `tenant:acme browser.name:Chrome` and `error.type:KeyError` over events sent by unmodified Sentry SDKs, and confirm the matching issues and facet counts, including an issue whose `KeyError` is the inner cause of a wrapper exception.
4. Current evidence: `src/domain/investigation/search.ts`; `src/domain/investigation/query.ts`; `src/ui/workbench/IssueList.tsx`; `tests/investigation-flow.mjs`; `tests/bulk-triage-flow.mjs`; `docs/INVESTIGATION.md`; `docs/BULK-TRIAGE.md` Full retained-project search, combined event filters, whole-query facets/counts, cursor pages and bounded JSON/CSV exports work.
5. The owner can select the displayed result page and preview atomic triage; counts and exports reflect the changes.
6. Team/identity/priority search, collaborative review inbox and saved shared views remain absent.

**Evidence.** `src/domain/investigation/search.ts`; `src/domain/investigation/query.ts`; `src/ui/workbench/IssueList.tsx`; `tests/investigation-flow.mjs`; `tests/bulk-triage-flow.mjs`; `docs/INVESTIGATION.md`; `docs/BULK-TRIAGE.md` ;  `src/domain/review/`; `src/domain/investigation/search.ts`; `src/domain/investigation/query.ts`; `tests/bulk-triage-flow.mjs` [FIND-001]; `docs/REVIEW-INBOX.md`
**Gap.** Owner-only review:pending count/filter, atomic previewed review of one/selection and regression reopening; 25 validated saved queries per project, authority-safe links, archive/restore/erasure and 1440/390 proof. Team search, shared views and additional priority remain gaps.

#### FIND-002 — Impact, trends and team reporting

Core · target · **partial**

**Requirement.** Issue detail shows every exception in the chain with its own frames and exception-group children under Related Exceptions (SDK-010). It shows the SDK-sent source context lines and local variables of each frame, labeled apart from ERR-005 mapped source and SRC-002 repository links, and the event's tags, contexts, request, extra, threads and breadcrumbs. It has a per-issue tag summary (top values per key, with counts and percentages over all events in the issue) and a raw stack trace view with copy. An All Events list shows every retained event in the issue, filtered by any FIND-001 query (tags, release, environment, user), with oldest, latest, recommended (the most complete recent event), previous and next event navigation; the detail view follows the event chosen. It also shows first/last occurrence, occurrence totals, distinct affected users (SDK-008's one definition, with the count of events that had no user key) and sessions, rate and release history. Release-scoped figures (release history, per-release counts, SDK-005 adoption and crash-free rates by release, REL-002 comparison) exclude events sent with no release and name how many there were (SDK-009); every other figure counts them. Dashboards report error volume, new/regressed/resolved backlog, time to acknowledge/repair, team ownership and release stability with transparent time zones, sampling, retention and dropped-event denominators. Custom dashboards hold widgets that run FIND-001 queries (count, rate, affected users or sessions, grouped by any approved field), and a free-form event query table saves and shares queries. Share permissioned reports and export CSV/JSON.

**Acceptance.**
1. Open a multi-release issue and a team report over a known event/session set that includes events sent with no release (counted in totals, excluded and named in release-scoped figures); reconcile totals, affected counts and triage durations, compare time zones, build a custom widget and saved event query that match the same totals, and verify a read-only export omits inaccessible projects.
2. Open an issue from an unmodified Python SDK chained exception and confirm the chain, context lines, local variables, tags, contexts, request and tag summary match the events sent, then copy the raw stack trace.
3. Open that issue's All Events list, filter it by `tenant:acme`, step from the oldest to the latest event and confirm the detail follows each chosen event.
4. Current evidence: `src/domain/investigation/events.ts`; `src/ui/workbench/EventExplorer.tsx`; `src/ui/workbench/SentryEvent.tsx`; `src/ui/workbench/RepositorySource.tsx`; `tests/fidelity-flow.mjs`; `tests/repository-source-flow.mjs` Owner detail selects exact retained occurrences with cursor pages, combined event queries, navigation, chain/context/raw evidence and all-issue tag counts.
5. Selected source frames now link through explicit recorded mappings to exact repository revisions, distinct from SDK context and map coordinates.
6. User/session analytics, custom dashboards, team reports, permissioned report exports and provider qualification remain absent; agent packets retain their minimized scope.

**Evidence.** `src/domain/investigation/events.ts`; `src/ui/workbench/EventExplorer.tsx`; `src/ui/workbench/SentryEvent.tsx`; `src/ui/workbench/RepositorySource.tsx`; `tests/fidelity-flow.mjs`; `tests/repository-source-flow.mjs`
**Gap.** Owner detail selects exact retained occurrences with cursor pages, combined event queries, navigation, chain/context/raw evidence and all-issue tag counts. Selected source frames now link through explicit recorded mappings to exact repository revisions, distinct from SDK context and map coordinates. User/session analytics, custom dashboards, team reports, permissioned report exports and provider qualification remain absent; agent packets retain their minimized scope.

#### SRC-001 — Build artifacts and CI pipelines

Core · target · **partial**

**Requirement.** Automate exact-release/debug-ID artifact publication from Vite, webpack, Rollup and esbuild builds in GitHub Actions and GitLab CI, through Spool's own CLI and plugins and through the unmodified sentry-cli subcommands and Sentry build plugins enumerated in SRC-003. Verify upload checksums, required artifact sets, access and retention before deployment; expose incomplete builds and support safe late artifacts. Source bundles and native symbols are private, separately authorized and portable, with the capacity, map formats, retention and per-file failure reporting SRC-004 publishes; a build's full artifact set is stored for every release.

**Acceptance.**
1. Build equivalent minified apps with each named bundler, upload from GitHub Actions and GitLab CI with Spool's CLI and with each SRC-003 path using deploy-only authority, capture a real failure and check mapped frames; deny reads/writes outside artifact scope and show a failed/incomplete upload.
2. Upload a second and third release of the same build and confirm every map of each release is stored and used.

**Evidence.** `packages/sdk/src/sourcemaps/`; `src/domain/source-map-builds.ts`; `tests/sdk-package.mjs` (sourceMapPlugins, [SRC-001]); `tests/source-map-plugins.mjs`; `docs/SOURCE-MAPS.md`
**Gap.** Packed Vite/Rollup/webpack/esbuild plugins share injection/upload, declare required map sets, verify stored checksums, reject incomplete builds before output publication and allow late completion. Release details name missing maps; declarations archive/restore and erase. Required-set declarations are bounded to 2000 names and 256 KiB. Remaining: real GitHub Actions and GitLab CI application jobs, full SRC-003 unmodified CLI/Sentry-plugin matrix, private source bundles/native symbols (SRC-004), deployment access/retention checks beyond exact deploy authority and the artifact set, Next.js and Hermes builds.

#### SRC-002 — GitHub, GitLab and Bitbucket source context

Core · target · **partial**

**Requirement.** Connect GitHub, GitLab and Bitbucket with explicit repository grants. Link stack frames to exact revision/file/line, ingest releases and included commits, read CODEOWNERS, and show suspect commits with reasons and uncertainty. When an issue first appears in a release that includes a PR/MR, Spool comments once on that PR/MR with the issue link, short ID and suspect reason. Frame paths map to repository paths through per-repository code mappings (a stack root such as `webpack://_N_E/./src/`, `app:///` or `/app/` to a source root and branch), derived automatically from in-app frames that match repository files and editable by maintainers; MIG-001 imports Sentry's code mappings, and an unmapped frame says so rather than linking a guessed path. Handle renames, monorepos and revoked/private repositories without leaking source. GitHub App and GitLab application setup, credential rotation, webhook signature verification and read-back reconciliation are part of delivery.

**Acceptance.**
1. Connect a private repository on each host, deploy a commit that changes the failing frame, follow its source link and suspect explanation, see one comment on the introducing PR/MR, revoke the grant and inspect immediate denial without stale privileged reads.
2. Confirm a derived code mapping links a `webpack://` Next.js frame and an edited mapping links a Django `/app/` frame to the right file and line, and that an unmapped frame says it is unmapped.
3. Current evidence: `src/domain/repository-links.ts`; `src/domain/operators/deployments.ts`; `src/ui/workbench/RepositorySource.tsx`; `tests/repository-source-flow.mjs`; `docs/REPOSITORY-SOURCE.md` Explicit owner/deploy-recorded manifest and path mappings link Python/Go reported coordinates and mapped JavaScript originals to full-SHA GitHub, GitLab and Bitbucket file/line URLs.
4. Missing/unsafe/unmatched evidence is visibly unmapped; links are labeled unverified and no source is fetched.
5. Provider grants, access revocation, automatic mappings, suspect commits, CODEOWNERS, PR comments and real-account qualification remain absent.
6. Existing GitHub draft-PR read-back uses a provider double.
7. Required before this path ships: AUDIT-001 covers its human/service actions, denied/stale attempts, exports and notifications with safe actor/subject/time/action/outcome facts, organization cursor history/export, append-preserving portability and unlinkable erasure.
8. REL-001 connected included-commit read-back is proved here, without treating caller-recorded commits as fetched ancestry. SDK-009 full-commit-SHA association is inherited here: an automatically created release whose full SHA exists in a linked repository is associated with that commit without CI registration, enabling suspect commits and TEAM-004 resolution. TEAM-004 provider citations are inherited here: GitHub pull request and GitLab merge request title and description citations, the merged pull request's merge commit as the resolving commit, the pull request recorded on resolution, and connected-repository full-SHA association each pass through TEAM-004's citation parser, repository link log and resolution before SRC-002 ships them. The journey cites one issue from a real pull request title and one from a merge request description, merges both, and confirms each links at once, resolves in the release that includes the merge commit with the PR or MR recorded, and that an unknown or other-project citation is only logged.

**Evidence.** `src/domain/repository-links.ts`; `src/domain/operators/deployments.ts`; `src/ui/workbench/RepositorySource.tsx`; `tests/repository-source-flow.mjs`; `docs/REPOSITORY-SOURCE.md`
**Gap.** Explicit owner/deploy-recorded manifest and path mappings link Python/Go reported coordinates and mapped JavaScript originals to full-SHA GitHub, GitLab and Bitbucket file/line URLs. Missing/unsafe/unmatched evidence is visibly unmapped; links are labeled unverified and no source is fetched. Provider grants, access revocation, automatic mappings, suspect commits, CODEOWNERS, PR comments and real-account qualification remain absent. Existing GitHub draft-PR read-back uses a provider double. TEAM-004 provider citations are inherited here: GitHub PR and GitLab MR title/description citations, merged-PR merge commits, PR recorded on resolution and connected full-SHA association pass TEAM-004's parser, link log and resolution before shipping; no real provider receipt yet.

#### SRC-003 — sentry-cli and Sentry build-plugin compatibility

Core · target · **partial**

**Requirement.** A team's existing CI keeps working against Spool when only the Sentry URL, organization/project slugs and auth token change. Compatible sentry-cli subcommands: `releases new`, `releases set-commits` (`--auto` and explicit `--commit`), `releases finalize`, `releases deploys new`, `deploys new`, `sourcemaps inject`, `sourcemaps upload` (debug-ID and release/dist), `debug-files upload` (dSYM, ELF/DWARF, Breakpad, ProGuard/R8 mappings and Dart symbols), `debug-files bundle-sources` and `send-event`. Compatible build integrations: `@sentry/webpack-plugin`, `@sentry/vite-plugin`, `@sentry/rollup-plugin`, `@sentry/esbuild-plugin`, `@sentry/nextjs` `withSentryConfig` source-map upload, the Sentry Android Gradle plugin, the Sentry Xcode build-phase upload script, `fastlane-plugin-sentry` (`sentry_create_release`, `sentry_upload_sourcemap`, `sentry_debug_files_upload`, `sentry_finalize_release`, `sentry_create_deploy`), `@sentry/react-native` bundle and Hermes source-map upload (including Expo) and `sentry_dart_plugin`. Spool serves the Sentry API endpoints these clients call (chunk upload and assemble, release, commit, deploy and debug-file routes) under deploy-only project authority with the ERR-005 and SDK-002 identity checks and SRC-004's published capacity: the chunk-upload options these clients read advertise sizes that fit a production build, every map and debug file each release emits is stored, and a failed file is named with its reason in the client's output. An unsupported flag or endpoint fails with an explicit error naming the command, never a silent success.

Before this capability ships, every new human/service action, denial, export and notification inherits AUDIT-001: safe permanent actor/subject aliases, time, action and truthful outcome; permissioned organization cursor history/export; append-preserving portability and erasure that removes attribution links without relabeling old facts.

Unmodified CLI/plugin release creation, commit registration, finalization and deploy enrichment for REL-001 belong to SRC-003, preserving the same release identity and first-seen time.

**Acceptance.**
1. In GitHub Actions and GitLab CI, run each listed sentry-cli subcommand and each listed bundler, Next.js, Gradle, Xcode, Fastlane, React Native and Dart integration unmodified except for URL, slugs and token.
2. Capture a real failure from each built app and confirm the release, commits, deploy, maps and symbols are registered and frames are original.
3. Run the Next.js and React Native uploads for three consecutive releases of a production-sized build and confirm no upload is refused for artifact count or for a map within SRC-004's size limit.
4. Run an unsupported flag (named failure) and repeat an upload with an ingest or read-only token (refused, nothing stored).
5. SDK-009 release registration is inherited here: unmodified sentry-cli releases new/set-commits/finalize/deploys and Sentry build plugins enrich the existing auto-created release without changing first-seen identity.
6. The acceptance journey registers an auto-created SDK release through sentry-cli releases new and set-commits and verifies that no second release is created.
7. TEAM-004 commit citations are inherited here: commits that unmodified `sentry-cli releases set-commits` registers (`--auto` and `--commit`) pass through TEAM-004's citation parser, repository link log and resolution; their real `sentry-cli` receipts are proved here.
8. **Today (21 October 2026, partial):** Spool serves the Sentry doors these clients call under `/api/0`, authorized by a project deploy key alone: chunk-upload options and chunks, artifact-bundle assemble, release create, finalize, get and list, commits sent with their messages and authors, deploys, and debug-file assemble. Ingest, read-only agent, revoked, unknown and other-project keys store nothing. The released `sentry-cli` 3.8.1 and the Vite, esbuild, Rollup and webpack plugins (11.8.0, via the newer `sentry` CLI) run unmodified in `tests/sentry-cli-compat.mjs` against the emitted Worker: an SDK-created release is enriched with its sequence, first-seen time and first environment intact; `releases set-commits` (`--auto`, `--commit` and `--local`, all falling back to the client's git history because no repository is connected) passes TEAM-004's parser, link log, resolution and older-release protection; maps stored by debug ID, or by release, dist and script URL when nothing was injected, map a real SDK failure to its original line; every refused file is named with its reason in the client's output; an interrupted chunk upload resumes. Every new door and denial carries an AUDIT-001 action; the new release and deploy tables archive, restore inertly and erase with their project, and staging and receipts are never archived. The limits are those of ERR-005 as shipped: flat maps of 256 KiB, 100 sources, 20 per project; SRC-004's capacity is not implemented, so larger builds are refused file by file and the advertised options say so. **Not done:** native debug files (dSYM, ELF/DWARF, Breakpad, ProGuard/R8, Dart) are refused by name until SDK-002; `--auto` and `--commit` through a connected repository need SRC-002 (the newer `sentry` CLI refuses them by name); the Android Gradle plugin, Xcode script, `sentry_dart_plugin` and the GitHub Actions and GitLab CI matrix were not run; a local Next.js, Fastlane and Expo run is recorded in `docs/retained-verification/src003/` with the refusals it met; and three production-sized Next.js and React Native releases are owed on SRC-004. See `docs/SENTRY-CLI.md`.

**Evidence.** `src/domain/sentry-cli/`; `src/domain/sentry/convert.ts`; `src/domain/artifacts.ts`; `migrations/core/0060_sentry_cli.sql`; `src/domain/audit/classify.ts`; `tests/sentry-cli-compat.mjs`; `tests/sentry-cli/`; `docs/SENTRY-CLI.md`; `docs/retained-verification/src003/`
**Gap.** The released `sentry-cli` and the Vite, esbuild, Rollup and webpack plugins run unmodified against the emitted Worker under deploy-only authority: release new, set-commits (TEAM-004 citations, link log, resolution), finalize, deploys, debug-ID and release/dist source maps with original frames, `send-event`, per-file refusals in client output, interrupted-upload resume, denials storing nothing, archive, restore and erasure. Not done: native debug files (SDK-002), `--auto` and `--commit` through a connected repository (SRC-002), Android Gradle, Xcode, Dart, the GitHub Actions and GitLab CI matrix, and three production-sized Next.js and React Native releases (SRC-004 capacity; a local Next.js and Expo run was refused file by file).

#### SRC-004 — Published source map and debug-file capacity

Core · target · **partial**

**Requirement.** Every artifact a production build emits is stored and used, release after release:
- **Capacity.** There is no per-project or per-release limit on the number of source maps, source files, artifact bundles or debug files. Each source map or source file may be up to 190 MiB, Sentry's only stated per-map limit, with any number of `sources` and mappings within that size. Each debug file (dSYM, ELF/DWARF, PDB, Breakpad, ProGuard/R8 mapping, Dart/Flutter symbols, Hermes and React Native bundle maps) may be up to 2 GiB. Spool's chunk-upload options endpoint advertises chunk size, concurrency and maximum file size so that unmodified `sentry-cli` and the SRC-003 plugins upload files of these sizes. Uploads stream through chunked assembly to the isolated storage the boundaries name, never held whole in request memory.
- **Formats.** Indexed (`sections`) maps, `sourceRoot`, `sourcesContent`, `ignoreList`/`x_google_ignoreList` (those frames are marked not in-app under GROUP-001), debug IDs (`debugId`/`debug_id`) and release/dist artifact names including `~/` URL prefixes are applied under ERR-005's identity checks, not refused.
- **Retention and cost.** An artifact is kept while any retained event in its release or build uses it, and for at least the project's GOV-003 retention window after its last upload or use. It then expires under GOV-003's rules with a named gap, and an issue whose map has expired shows generated frames with that reason. Artifact storage is metered in USD under BILL-001, and the only capacity refusal is a buyer-set artifact storage cap (`artifact_storage_cap`).
- **Failures.** A failed upload is named per file and reason (too large, malformed map, identity mismatch, storage cap, authority) in the `sentry-cli`/plugin assemble response and CI output, in Spool's CLI output and in the release's artifact view, and the release is marked incomplete under SRC-001. It is never a bare 429.
- **Source fetching.** A project that hosts public maps may opt in (off by default) to fetching minified JavaScript and its `sourceMappingURL` map from named HTTPS origins, optionally sending a project secret header as Sentry's security token does. Fetching runs in an isolated worker under these size limits, refuses private-network addresses and redirects to another origin, labels the map as fetched with its URL and fetch time, and keeps fetched maps private under the same retention. MIG-001 imports Sentry's source-fetching and allowed-domain settings, and setup offers the CI upload step as the default path.

**Acceptance.**
1. Build a production Next.js App Router app (more than 100 chunks, a vendor chunk map over 2 MiB) and a React Native Hermes release, and upload with unmodified `withSentryConfig` and `@sentry/react-native` for three consecutive releases.
2. Confirm every map is stored, and that an error in a vendor-chunk frame and an app frame in the third release shows original source.
3. Upload an indexed map, a map with `sourceRoot` and a 50 MiB map, and confirm each resolves.
4. Upload a 40 MiB dSYM and a ProGuard mapping, and confirm they symbolicate and deobfuscate.
5. Confirm no upload is refused for artifact count.
6. Set an artifact storage cap and confirm the next upload names each refused file and the cap in CI output and the release view.
7. Advance the clock past retention for a release with no retained events and confirm its maps expire with a named gap.
8. Opt one project into source fetching from an allowed origin, confirm a frame resolves from the fetched map, and confirm a private-network URL is refused. SDK-010 source lookup inherits expansion beyond the existing 30-coordinate map projection here. Rich SDK stack retention and this source-map projection are independent; the source/debug capacity journey must cover the expanded lookup before claiming it.

**Evidence.** `src/domain/artifacts.ts`; `src/domain/source-map-storage.ts`; `migrations/core/0067_artifact_storage.sql`; `tests/sdk-package.mjs` (sourceMapCapacity, [SRC-004]); `tests/sentry-cli-compat.mjs` (chunkFlow, durableFlow); `docs/SOURCE-MAPS.md`; `tests/product-runtime.mjs` (byte-cap concurrency); `tests/repair-recovery/archive.mjs` (historical inventory)
**Gap.** Bounded D1 maps (1 MiB, 1000 sources, bounded expanded-map paths), indexed section offsets, source roots, embedded sources and ignore lists are stored; no lifetime map count, optional owner byte cap, per-file CLI/release refusal and private archive/restore/erasure. Remaining: 190 MiB maps/2 GiB debug files, native symbolication, streamed assembly, use-based expiry and USD pricing, remote source fetching, ignore-list frame classification under GROUP-001, expanded SDK-010 lookup projection, production Next.js App Router/Hermes builds; prepared-map picker remains flat/256 KiB.

#### REL-001 — Release and deployment history

Core · target · **done**

**Requirement.** Register builds, commits and per-environment deployment start/success/failure/rollback with actor, timing and included commit range. CI retries are idempotent; abandoned starts become visibly timed out and notify their owner. Releases auto-created from Sentry SDK events (SDK-009) appear in release history labeled auto-created, with first-seen time, first environment and creating SDK; a later registration of the same name through the release API, `sentry-cli` or a build plugin enriches that release with commits, artifacts and deploys and removes the label, never creating a second release. The project's SDK-009 ordering rule governs regression, while deployment history records multiple environments, progressive exposure and rollback without rewriting past event identity.

Native release/deployment doors are implemented now. SRC-003 inherits the unmodified CLI/plugin registration journey, SRC-002 inherits connected commit read-back, and TEAM-001 inherits member authority. Starts carry the caller's explicit deadline and selected existing email destination; overdue evaluation appends one truthful timeout and one notice attempt (local mail is labeled suppressed), never an inferred deployment failure. Included ranges and exposure remain caller recorded. Restored history is inert.

**Acceptance.**
1. Report started/completed/failed deployments from CI, repeat callbacks, abandon one, roll back production and inspect included commits, timeout follow-up and regression ordering for delayed old events.
2. Let a Sentry SDK event auto-create a release, then enrich the same name through the native release/deployment API and confirm one release with its original first-seen time.
3. SRC-003 proves the inherited unmodified `sentry-cli`/plugin registration journey; SRC-002 proves connected included-commit read-back.

**Evidence.** `src/domain/deployments/`; `src/domain/releases/order.ts`; `migrations/core/0049_deployment_history.sql`; `migrations/core/0050_release_order_keys.sql`; `tests/deployment-history.mjs` (REL-001); `tests/release-identity-flow.mjs`
**Gap.** Native owner/deploy-key start, progress, success, failure, rollback, commits and environment history; idempotent/conflicting callbacks; explicit owner deadlines evaluated twice with one notice; shared total order; first-seen enrichment; scope/revocation denials; inert restore and erasure; 1440/390 history. SRC-003 owns unmodified CLI/plugin registration, SRC-002 connected commit read-back and TEAM-001 member authority, each in its text and acceptance.

#### REL-002 — Suspect change and release comparisons

Core · target · **partial**

**Requirement.** Connect first occurrence, reactivation and rate change to the release/deployment window, suspect commit and changed source; compare release cohorts, adoption and loss before attributing impact. Keep correlation distinct from a demonstrated cause and preserve older-release failures during rollout. An engineer can confirm or reject a suspect and record evidence for later agent learning.

**Acceptance.**
1. Deploy two commits while retaining old clients, trigger first/regressed errors and an unrelated spike, inspect candidate reasons and comparable release rates, then reject a false suspect without changing occurrences.

**Evidence.** `src/domain/suspects/`; `src/ui/workbench/SuspectChanges.tsx`; `migrations/core/0070_suspect_decisions.sql`; `tests/deployment-history.mjs` ([REL-002] suspectFlow); `tests/suspect-flow.mjs`; `tests/old-archive.mjs`; `tests/owner-erasure.mjs`; `docs/SUSPECT-CHANGES.md`
**Gap.** First retained occurrence and reactivation release/commit candidates now name their basis and recorded deployment window as correlation, not demonstrated cause. Owner confirm/reject with bounded scrubbed evidence is audited and leaves occurrences, counts, grouping and status unchanged; private restore and project/owner erasure cover judgments. Same-window per-release occurrence/distinct-issue counts retain older-release failures; `tests/session-flow.mjs` adds observed SDK-005 session rates, denominators, adoption share and Wilson intervals beside them. Gap: comparable device/OS adoption cohorts beyond SDK-005’s observed session rates, rate-change attribution, changed-source matching (receipts have no file lists), agent packet provenance and learning from judgments (AI-006). Default ADOPTED: a suspect is only a labelled candidate; no automatic agent action.

#### CTX-001 — Error-linked traces, logs and request performance

Core · target · **partial**

**Requirement.** Capture OpenTelemetry traces/spans, and the `transaction`, `span`, `profile`, `profile_chunk`, `log` and `trace_metric` items unmodified Sentry SDKs send (SDK-007), with error links across browser, backend and jobs, showing the failing request waterfall, latency, dependencies, correlated structured logs, the profile of the failing transaction, trace-connected metrics and approved RUM context (including web vitals) beside the stack. A web vitals view per page and release shows LCP, INP, CLS, FCP and TTFB at p75 with the good/needs-improvement/poor distribution and sample count, and a transaction summary shows p50/p95 duration, failure rate and throughput; these are the views ALERT-001 metric alerts link to. Preserve trace/span IDs through intake, sampling and exports. OTLP and Sentry-SDK telemetry intake follows GOV-003's published sustained rate and named volume reasons. Link or forward context to Datadog and Splunk with permissioned deep links and explicit data/minimization controls. Performance problems found in the same spans open as issues under CTX-004. This is error diagnosis, not ownership of their entire APM/log warehouse. Before any additional intake category ships, it inherits SDK-006: enforce Origin/Referer and all applicable available transport/category filters before acceptance, name unavailable fields, and preserve truthful filtered and client-discard accounting. CTX-001 inherits AI-005 trace-variant comparison in grouping proposals: persist permitted trace identity and compare trace variants alongside stack, release and route before this clause is complete; AI-005 currently names "trace identity unavailable".

**Acceptance.**
1. Exercise a browser-to-service-to-job failure with propagated trace IDs, once instrumented with OpenTelemetry and once with unmodified Sentry SDKs with tracing, profiling and logs enabled, inspect one correlated waterfall/log/profile path and missing-sample labels for each, open the page's web vitals view and reconcile p75 LCP and CLS with the sent measurements, then open authorized Datadog/Splunk context and verify revoked export credentials stop forwarding.

**Evidence.** `src/domain/otlp/routes.ts`; `src/domain/otlp/convert.ts`; `tests/otlp-flow.mjs`
**Gap.** Only bounded OTLP/HTTP JSON logs are accepted; trace/span identity is not persisted and traces/metrics are refused. Forwarders are absent. OTLP intake shares the 120-a-minute and 10,000-event caps that GOV-003 removes. CTX-001 inherits AI-005 trace-variant comparison; current grouping proposals name trace identity unavailable.

#### CTX-002 — Privacy-controlled session replay

Core · target · **missing**

**Requirement.** Attach browser and mobile session replay to the exact error/session/time, with console/network timeline and trace links. Offer first-party capture, which accepts the unmodified Sentry replay format (`replay_event`, `replay_recording` and `replay_video` from `replayIntegration` and the mobile SDKs, linked by the event's `replay_id`, per SDK-007) as well as Spool's own recorder, and link replays recorded elsewhere through the CTX-003 connectors. First-party capture has consent and sampling, default input/text/media masking, exclusion zones, retention and role-scoped playback. Replay segments are accepted up to SDK-011's published replay limits (10 MiB compressed, 100 MiB decompressed per item). Replay never includes production credentials by default; access/export/erasure is audited and missing replay remains explicit. Before any additional intake category ships, it inherits SDK-006: enforce Origin/Referer and all applicable available transport/category filters before acceptance, name unavailable fields, and preserve truthful filtered and client-discard accounting.

**Acceptance.**
1. Opt in on a realistic checkout/account flow with Spool's recorder and, separately, with an unmodified Sentry `replayIntegration` and mobile replay, trigger an error, play the preceding path from issue detail at the error time, verify masked fields in stored replay and exports, then revoke access and erase the session across playback/artifacts.

**Evidence.** None.
**Gap.** No implementation proof yet: privacy-controlled session replay.

#### CTX-003 — Third-party replay connectors

Core · target · **missing**

**Requirement.** Link errors to replays the buyer already records in PostHog Session Replay, LogRocket, FullStory and Datadog RUM Session Replay. Each connector uses a least-privilege buyer API credential and reads the session identifier that provider's browser SDK attaches to the Spool event, or matches by an approved session property and time. Issue detail shows the linked replay at the error timestamp as a permissioned deep link with provider metadata (start, duration, page); Spool never copies replay content. Missing, expired or inaccessible replays carry a reason. Revoking the connector credential or the viewing member's Spool permission stops new links and refuses opening existing ones from Spool; disconnecting removes stored replay references under BASE-DATA-003. Sentry Replay links imported by MIG-001 follow the same model.

**Acceptance.**
1. For each of PostHog, LogRocket, FullStory and Datadog, record a session with the provider SDK beside the Spool or Sentry SDK, trigger an error and open the linked replay from issue detail at the error time.
2. Revoke the connector permission and confirm the link is refused with a reason, and that no replay content exists in Spool storage or exports.

**Evidence.** None.
**Gap.** No implementation proof yet: third-party replay connectors.

#### CTX-004 — Performance issues from transactions and spans

Core · target · **missing**

**Requirement.** Spool detects performance problems in the `transaction` and `span` data that unmodified Sentry SDKs and OpenTelemetry send (SDK-007, CTX-001) and opens them as issues in the same issue stream as errors, with the same short IDs, ownership, priority, triage, alerts, tracker links and AI-002/AI-003 handoff. Detectors: N+1 database queries, N+1 API calls, slow database queries, consecutive database queries, consecutive HTTP calls, large HTTP payloads, large render-blocking assets, uncompressed assets, and main-thread file I/O and database work on mobile. Each detector is on by default with a stated threshold (duration, repetition count or size) that a maintainer can change or disable per project, with a preview against retained spans; changes are audited and apply to later intake. Each issue groups by the offending span pattern (normalized query or URL and parent operation) and shows the evidence span tree, the repeated or slow spans, the transaction and release, affected users (SDK-008) and occurrence counts, with a link to the trace waterfall; sampling rates are shown with the counts. Resolution and regression follow ERR-006 and TEAM-003, and detected issues bill against the span data category in BILL-001, not the error category.

**Acceptance.**
1. In a Node or Python service and a Next.js app instrumented once with unmodified Sentry SDKs with tracing on and once with OpenTelemetry, trigger an N+1 query loop, a slow query, consecutive HTTP calls and a large render-blocking script, and a main-thread file read in a React Native app.
2. Confirm one performance issue per pattern appears in the issue stream with its span evidence, trace link and affected users, alerts under ALERT-001 and is assigned under TEAM-002.
3. Raise one detector's threshold above the observed value and confirm later traffic opens no new issue, then deploy a fixed release and confirm resolve and regression behave as for errors.

**Evidence.** None.
**Gap.** No implementation proof yet: performance issues from transactions and spans.

### Alerts and delivery

#### ALERT-001 — Filtered rules and real anomaly detection

Core · target · **partial**

**Requirement.** Configure new issue, reactivation, regression, frequency/count/rate threshold, seen by more than N users in a window (SDK-008's affected-user definition), percent of sessions affected in a window (SDK-005 denominators) and crash-rate/spike rules by project/team, environment, severity, priority, release and approved payload properties. A user condition on a project whose identity policy leaves no user key, or a session condition without session data, is refused at preview with the reason rather than evaluated against 0. Historical-baseline detection accounts for traffic, seasonality, sampling and missing capture rather than renaming a fixed threshold anomaly detection. Preview the matched history, owner, evaluation window and destination before enabling; deduplicate each rule/window transition. The new issue condition fires for a new root cause under an existing wrapper exception, because GROUP-001 groups over the whole exception chain (SDK-010). The regression condition fires once for every regression ERR-006, TEAM-003 and SDK-009 define, including the first accepted event after a plain Resolve, in any release or with no release. Metric alerts on the transactions and spans Spool ingests under CTX-001 and SDK-007 cover p50/p75/p95/p99 duration, failure rate, throughput, Apdex and the web vitals LCP, INP, CLS, FCP and TTFB, filtered by transaction name, project, environment and release, with warning and critical thresholds or a change-from-baseline comparison, a resolve threshold, and the same preview, deduplication and destinations; MIG-001 imports Sentry metric alert rules. Alerts on host, container or infrastructure metrics stay with the connected APM named in the boundaries.

**Acceptance.**
1. Create filtered rules in the app, replay normal/burst/seasonal/low-traffic windows with loss, inspect baseline and threshold reasons, and reconcile exactly one alert per qualifying transition and no alert outside its filter.
2. Fire one seen-by-more-than-3-users rule and one percent-of-sessions-affected rule from known user and session sets, and confirm the user rule is refused at preview on a project whose policy drops identity.
3. Plain-resolve two issues and send one event in the same release to the first and one with no release to the second; confirm one regression alert each.
4. With unmodified Sentry tracing, push a transaction's p95 duration and a page's LCP over warning and then critical thresholds and back, and confirm one alert per transition and a resolve.
5. SDK-009 release-less alert conditions are inherited here: new and regression conditions include accepted events with no release, and seen-with-no-release-after-resolve is an available counted condition.

**Evidence.** `src/domain/alerts/rules.ts`; `src/domain/alerts/spikes.ts`; `tests/alerts-native.mjs`
**Gap.** New/regression and fixed-window count rules exist; historical baselines, crash-rate and rich routing filters are absent.

#### ALERT-002 — Email, Slack, Teams, Oncall and PagerDuty

Core · target · **partial**

**Requirement.** Route actionable error alerts to email, Slack, Microsoft Teams, sibling Oncall and PagerDuty, with project/issue/release links, short ID, ownership, severity and recovery/update semantics, plus the inbound triage actions named in ALERT-005. Use named provider adapters and least-privilege account setup, signed inbound actions, rotation and revocation. Teams choose separate destinations per rule. Discord channels receive formatted alerts through a channel webhook with issue links. Signed HTTP webhooks remain available for custom automation. Mail adapters support configured US providers such as Amazon SES, Resend and SendGrid; provider acknowledgment stays distinct from recipient receipt.

Before this capability ships, every new human/service action, denial, export and notification inherits AUDIT-001: safe permanent actor/subject aliases, time, action and truthful outcome; permissioned organization cursor history/export; append-preserving portability and erasure that removes attribution links without relabeling old facts.

**Acceptance.**
1. Connect each destination, including a Discord channel webhook, using buyer-controlled accounts, test and trigger a filtered new/regressed issue, follow its exact issue link, perform each ALERT-005 action for that destination (Slack and Teams resolve, archive and assign; PagerDuty and Oncall acknowledge and resolve sync), rotate/revoke credentials and reconcile delivery history without duplicate pages.
2. Every new ALERT-004 integration action and channel inherits an accountable owner, due condition, durable queued/running/blocked/failed/uncertain/completed/canceled state, inspectable attempts, one durable follow-up, and explicit reconciliation or authorized resend for unknown effects before shipping.
3. ALERT-003 delivery-state and reviewed-test obligations apply to every future adapter before shipping: Slack and Teams posted with message identifier; PagerDuty and Oncall triggered, acknowledged and resolved; Discord's channel webhook carries HTTP status and signature observations where supported.
4. Every adapter keeps provider acknowledgment distinct from recipient receipt.

**Evidence.** `src/domain/alerts/slack.server.ts`; `src/domain/alerts/slack-destinations.server.ts`; `tests/alerts-egress.mjs` ([ALERT-002] slackFlow); `tests/alerts-ui.mjs` ([ALERT-002] slackUI); `tests/slack-flow.mjs`; `tests/slack-ui.mjs`; `tests/old-archive.mjs`; `tests/owner-erasure.mjs`; `migrations/core/0071_slack_destinations.sql`; `docs/ALERT-WEBHOOKS.md` Page-managed email and signed generic webhooks remain; native Slack issue alerts now share the durable queue and INTEGRATION_EGRESS, require a reviewed test, retain a posted message identifier separately from recipient receipt, stop on rotation/revocation, expose bounded API/HTTP/timeout/egress failures and exclude tokens from every read/archive. Safe acknowledgments restore inert; migration 0064 preserves populated upgrades, and project/owner erasure removes the new stores. Existing follow-up states account for failed Slack issue alerts; alternate notices use email or signed webhooks.
**Gap.** Teams, Oncall and PagerDuty adapters, Discord channel webhooks, chat actions (ALERT-005/TEAM-001), broader recovery/update semantics, Slack as an alternate follow-up destination and real Slack qualification (NOT RUN). Default ADOPTED: Slack posts a sanitized summary and exact issue link only; no interactive action or Slack app endpoint, and the recorded edge double earns no real-Slack claim.

#### ALERT-003 — Destination tests, digests and snoozing

Core · target · **partial**

**Requirement.** Test every destination before enabling a rule with distinct test wording and no issue mutation, then show each channel's delivery states separately: email accepted by provider, delivered, bounced or complained (from provider events); Slack and Teams posted with message identifier; PagerDuty and Oncall triggered, acknowledged and resolved; webhook HTTP status and signature receipt. Deliver daily/weekly project and personal error digests in the buyer timezone, with new/regressed/unowned work, usage and failed automation. Snooze by issue/rule/team with an expiry and one resumption notice; maintenance and quiet hours cannot hide event loss or erase backlog.

**Acceptance.**
1. Add and test each channel, inspect its named delivery states, enable only after reviewing its result, schedule a US-timezone digest, snooze through a burst and expiry, and inspect one digest/resumption plus unchanged issue evidence for test sends.
2. Existing email and signed-webhook destinations require a recorded passing test and explicit owner review before a rule can be enabled.
3. Tests say TEST and preserve the complete archive row projection, including issues, alerts, assignments and counters.
4. Changed recipients disable their rules and require a new reviewed test.
5. Previously enabled rules keep running until the recipient changes; disabled rules visibly explain the passing-test and owner-review requirement.
6. Provider acceptance is separate from recipient receipt; no event yet is explicit.
7. Signed SendGrid Event Webhooks join the mail delivery custom argument, reject forged/unsigned/unknown deliveries before storing any event, and deduplicate event IDs.
8. History retains each processed/delivered/deferred/bounce/dropped/spamreport event; deferred and dropped retain their own names. Complaint and the other provider-event transitions are currently signed-fixture proof, labelled fixture on screen. A webhook records that its signature header was sent and the HTTP status observed; receiver signature verification is not claimed. Project timezone is a validated IANA name, default UTC. Daily and Monday-ending weekly schedules use completed calendar periods and durable period keys across DST and overlapping ticks, through the existing mail sender. Digests show new/regressed/unowned totals and a bounded issue list, capture-receipt usage/loss, ALERT-004 failed/overdue automation and the held-alert backlog, with scrubbed text and no event payload. Personal means the installation owner until TEAM-005; team digests and team snooze inherit TEAM-001. Issue/rule snooze and project maintenance require expiry; capture continues, suppressed deliveries remain counted/listed, and one durable owner resumption notice is queued per expiry. Quiet hours also preserve loss and backlog in digests and Needs attention. Expired held deliveries require explicit owner release. Archives carry digest settings, provider-event rows, snoozes, held-delivery rows and digest/resumption history as inert investigation/configuration data; raw recipient receipts, destination tests and active jobs are excluded. Restored settings disable schedules and quiet hours; restored snoozes and scheduled mail never send. Project/owner erasure declares all new stores. Journey **ALERT-003 destination tests, delivery states, timezone digests and snoozing never hide loss** extends `tests/alerts-runtime.mjs`, `tests/alerts-egress.mjs` and `tests/alerts-ui.mjs`; migration `migrations/core/0058_alert_delivery.sql`, `src/domain/alerts/`, `src/ui/alerts/`, and `docs/ALERT-DELIVERY.md`. Retained 1440/390 states: `docs/retained-verification/alert003/`. **Real provider receipt (21 October 2026):** after the SendGrid Event Webhook was repointed to the RunEditRun mail-event relay at 01:33Z, exactly one real production email went out through Base's mail sender with the Spool seed marker (provider HTTP 202 at 02:42:33Z), and its delivered event, signed with SendGrid's production key (fingerprint prefix `09bf2526d0e6`) and verified by the relay's pinned `verifySendGridWebhook` (outside this repository), reached the registered seed test target at 02:42:48Z: event-ID SHA256 `ca9c500bac89bc611799fa37b1fb7e04dec3fe5c96b3ae8ed6aab37c3f36c528`, provider submission-ID hash `e8b0883f…2d4d5`, marker `gr-mailrelay-proof-1-85d6f2dea6f745c1`. Projection of that event as delivered in Spool's own delivery log is not claimed. The seed registry was restored empty and the scratch target deleted; no further mail is sent. Bounce and complaint remain signed-fixture transitions. The relay's request, HTTP 5xx and forwarding-failure counters for 01:33–02:33Z are unverified (its Workers logs are not enabled); no zero-failure claim is made.

**Evidence.** `src/domain/alerts/`; `src/ui/alerts/`; migration `migrations/core/0058_alert_delivery.sql`; `tests/alerts-runtime.mjs`; `tests/alerts-egress.mjs`; `tests/alerts-ui.mjs`; `docs/ALERT-DELIVERY.md` Reviewed tests for every existing channel; provider event timelines, calendar digests and durable snooze/backlog flows; inert portability and declared erasure; 1440/390. Real provider receipt 21 October 2026: one production email (provider HTTP 202 at 02:42:33Z) and its delivered event, signed with SendGrid's production key (fingerprint prefix 09bf2526d0e6), at the registered seed test target at 02:42:48Z; event-ID SHA256 ca9c500bac89bc611799fa37b1fb7e04dec3fe5c96b3ae8ed6aab37c3f36c528, submission-ID hash e8b0883f…2d4d5, marker gr-mailrelay-proof-1-85d6f2dea6f745c1; seed registry restored empty.
**Gap.** Real bounced and complained provider events are unproven: one real production-signed delivered event is recorded (evidence); bounce and complaint stay signed-fixture transitions until real events arrive through the owner-held SendGrid Event Webhook. The relay's 01:33–02:33Z request, HTTP 5xx and forwarding-failure counters are unverified (Workers logs not enabled); no zero-failure claim.

#### ALERT-004 — Durable follow-up and visible automation failure

Core · target · **done**

**Requirement.** Every alert, integration action, deployment timeout and agent step has an accountable owner, due condition, durable queued/running/blocked/failed/uncertain/completed/canceled state and inspectable attempts. Restart and repeated evaluation do not duplicate messages or work. Only proven-unaccepted sends may retry; uncertain effects need explicit reconciliation or authorized resend. Broken destination/rule and overdue unacknowledged work notify an alternate operator without recursive alert storms. Restored history remains inert.

**Acceptance.**
1. Interrupt before and after the send boundary, restart, expire a lease, revoke a rule and lose a provider response; inspect durable state, deduplication, operator follow-up and explicit reconciliation, then restore without replay.
2. The installation owner is the accountable owner and alternate operator until TEAM-001.
3. A project may configure one existing alternate destination, default No alternate.
4. A send pending for five minutes, an open unacknowledged alert after 24 hours, a deployment deadline or an expired fix lease leaves one durable Needs attention row and one permanent AUDIT-001 follow-up fact.
5. Alternate notices have stored source/destination deduplication keys; their own failure never creates another notice.
6. The attention view shows due conditions, source state, attempts and alternate notice outcomes.
7. Unknown effects require explicit reconciliation or owner-authorized resend; a fix resend requires the owner to Advance the workflow, and reconciliation of a known provider mutation requires its recorded result.
8. Follow-up configuration, queues, attempts and step fences are operational stores excluded from archives; the safe audit chronology survives and restored history does not dispatch. ALERT-002, TRACK-001, INT-001 and AI-003/AI-004 inherit the same owner/due/state/attempts and follow-up obligation for their future integration and agent actions. ALERT-003 snooze expiry, held backlog, capture loss and digest/resumption send failures use the same durable Needs attention and deduplicated follow-up semantics. Snooze, maintenance and quiet hours never erase loss or backlog; restored digest/snooze history remains inert.

**Evidence.** `src/domain/follow-up/`; `src/server.ts`; `src/domain/fixes/workflow.ts`; `src/ui/alerts/NeedsAttention.tsx`; `tests/alerts-runtime.mjs`; `tests/execution-journey.mjs` Durable owner/due/state/attempts, one safe audit fact and Needs attention row per interrupted/failed/overdue source, nonrecursive deduplicated alternate notices, explicit uncertain reconciliation and authorized resend, expired provider-boundary fences, inert archive restore and 1440/390 owner views.
**Gap.** None for existing actions. TEAM-001 inherits alternate roles; ALERT-002, TRACK-001, INT-001 and AI-003/AI-004 inherit future actions.

#### ALERT-005 — Chat and paging triage actions and link unfurls

Core · target · **missing**

**Requirement.** Slack and Microsoft Teams issue alerts carry Resolve (now or in the next release), Archive (forever, until escalating, or for a count or duration) and Assign (to a member or team of that project) controls. Each action checks the clicking chat user's linked Spool member identity and project role; an unlinked or under-privileged user gets a private explanation with an account-link prompt, and the issue does not change. The message updates in place with the new state and actor, and the action appears in the issue timeline and AUDIT-001. Spool issue, event and release links pasted in Slack unfurl into a preview (title, short ID, status, assignee, counts, last seen, release) for linked members with access, and stay bare links otherwise; no event payload is revealed. PagerDuty and Oncall incidents created from Spool sync both ways: acknowledging the incident acknowledges the issue, resolving it resolves the issue, and the reverse, with loop prevention. A linked member can start an AI-002/AI-003 investigation from Slack under the app's approval and budget policy. Inbound actions are signature-verified (Slack signing secret, Teams bot authentication, PagerDuty and Oncall webhook signatures), replay-protected and idempotent.

Before this capability ships, every new human/service action, denial, export and notification inherits AUDIT-001: safe permanent actor/subject aliases, time, action and truthful outcome; permissioned organization cursor history/export; append-preserving portability and erasure that removes attribution links without relabeling old facts.

**Acceptance.**
1. From a Slack alert and a Teams alert, a linked member resolves one issue, archives another until escalating and assigns a third to a team; confirm state, timeline, audit and the updated message.
2. An unlinked user and a read-only member are refused with no change.
3. Paste an issue link and confirm the unfurl for an authorized member and none for an unauthorized one.
4. Acknowledge and resolve a PagerDuty and an Oncall incident and confirm the issue follows, then resolve in Spool and confirm the incident resolves.
5. Replay a signed action (one effect) and forge one (refused).

**Evidence.** None.
**Gap.** No implementation proof yet: chat and paging triage actions and link unfurls.

### Delivery integrations

#### TRACK-001 — Vector, Jira and Linear issue sync

Core · target · **partial**

**Requirement.** Create or link a delivery issue in sibling Vector, Jira or Linear with a previewed sanitized diagnostic summary, source/release links and owner. Sync resolution/reopening and external status idempotently with signed callbacks; for Jira also sync assignee and comments both ways, and offer create-ticket as an ALERT-001 rule action, loop prevention and conflict visibility. GitHub/GitLab Issues are optional destinations under the same model. Spool owns error triage; the connected tracker owns the delivery backlog and planning.

Before this capability ships, every new human/service action, denial, export and notification inherits AUDIT-001: safe permanent actor/subject aliases, time, action and truthful outcome; permissioned organization cursor history/export; append-preserving portability and erasure that removes attribution links without relabeling old facts.

**Acceptance.**
1. Create a ticket from a Spool issue in each tracker, repeat the action, resolve/reopen on both sides, sync a Jira assignee and comment both ways, create a Jira ticket from an alert rule, reject a stale/forged callback and disconnect; confirm one ticket, consistent links and visible conflict rather than silent overwrite.

**Evidence.** `src/domain/repairs/routes.ts`; `src/domain/fixes/workflow.ts`; `tests/repair-recovery.mjs`
**Gap.** Manual repair links and draft PR history exist; tracker creation and status synchronization do not.

### Migration and portability

#### MIG-001 — Sentry organization migration

Core · target · **partial**

**Requirement.** MIG-001 lists each Sentry loader key with its settings and the replacement script tag. Guide a real Sentry buyer through organization/project, member and team roster (as pending invitations with mapped roles), environment, release, issue/event, triage, ownership, alert, saved search, source artifact, attachment, feedback, replay link, dashboard, data scrubbing settings (sensitive and safe fields and advanced rules, mapped to SDK-003), inbound filter (mapped to SDK-006), IP-storage and user identity settings (mapped to SDK-008) JavaScript Loader Script key settings (mapped to the SDK-023 loader), stack trace and fingerprint rules (mapped to GROUP-001), code mappings (mapped to SRC-002), JavaScript source fetching and allowed-domain settings (mapped to SRC-004), retention and quota settings (mapped to GOV-003 and BILL-001), metric alert rules (mapped to ALERT-001) and release names, versions and dates (so SDK-009 ordering continues across cutover) migration using authorized export/API adapters. Preview source-to-target mapping, unsupported items and count/byte reconciliation; retain provenance/private originals, resume safely and undo only unchanged imported records. Repoint standard SDK DSNs for a measured dual-run/cutover that compares Sentry and Spool counts per SDK-007 item type (errors, affected users under SDK-008's definition, sessions and crash-free rates, transactions, replays, feedback, attachments and client reports), so each difference is attributed to a named cause (for example an identity policy that hashes or drops a field, an inbound filter, sampling, tunnel loss, a release refused under SDK-009's registered-sequence-only rule, or an item refused under a project limit lowered below SDK-011's published figures; events with no release, SDK-default releases, every SDK-default content encoding and items within Sentry's documented limits are accepted and are never an unexplained difference; a refusal for retained event count, a fixed per-minute budget or source map count is never an explained difference and fails the dual run under GOV-003 and SRC-004), and it compares sample events field by field (exception chain length, frame count, tags and contexts kept under SDK-010), with retained rollback configuration and a checked rollback procedure. Import history cannot send alerts, grant account authority or prove current health; explicitly reauthorize teams, integrations and secrets. Before migration completion, import and preview the versioned GROUP-001 stack/fingerprint rules with provenance and immutable original membership; import history never activates live effects without explicit approval.

**Acceptance.**
1. With a real buyer export/API account, preview/reconcile all named collections, apply/resume, compare issue/event/artifact samples and the imported scrubbing rules and inbound filters, dual-run unchanged SDKs, including services that send no release, mobile builds with SDK-default releases, a Python service with `brotli` installed and mobile crashes with screenshots, and reconcile per-item-type counts, affected users and crash-free rates with Sentry at the buyer's production volume through a deploy-incident burst, with no deficit attributed to retained capacity or a fixed per-minute budget, then cut over; inspect unsupported mappings and guarded undo preserving native edits.
2. SDK-009 migration reconciliation is inherited here: reconcile automatic release/dist identity, release-less counts and named strict-policy refusals in the Sentry dual run and usage, without duplicating releases on later registration.

**Evidence.** `src/domain/sentry-import/source.ts`; `src/domain/sentry-import/mapping.ts`; `scripts/sentry-import.mjs`; `tests/sentry-import.mjs`; `tests/business-import.mjs`; `tests/sentry-sdk.mjs`
**Gap.** Custom bounded synthetic organization bundles move through the one import door (owner session or Business grant) with plan, reviewed fingerprint, apply, reconcile and undo, and browser/Node DSNs work; real Sentry export/API reconciliation and full collection mapping are unproved.

#### MIG-002 — Datadog Error Tracking migration

Core · target · **missing**

**Requirement.** Import Datadog Error Tracking issues, events, service/environment/version tags, triage, release and available trace/log links with authorized API/export adapters. Map monitors/notification rules into previewed Spool rules and external destinations; preserve source IDs, timestamps and unsupported fields. Reconcile counts and time windows, retain read-only history, dual-run SDK/OTel intake and switch error monitoring without requiring migration of the full Datadog observability platform.

**Acceptance.**
1. Import a real Datadog buyer project, review mappings and exceptions, reconcile sampled issue/event/history records and monitor rules, dual-run one service and cut over with no imported alert replay or duplicate native events.

**Evidence.** None.
**Gap.** No implementation proof yet: datadog Error Tracking migration.

#### MIG-003 — Rollbar migration

Core · target · **missing**

**Requirement.** Import Rollbar projects/items/occurrences, environments, deploys, status/assignment, grouping fingerprints, comments, tracker links and notification policies through a documented authorized export/API path. Preserve source identities and private artifacts where obtainable; name unavailable data. Provide dry-run, reconciliation, resumable apply/guarded undo and a SDK cutover guide that preserves diagnostic context and explicitly reports conversion losses.

**Acceptance.**
1. Migrate a real Rollbar project with resolved and reactivated items, compare counts/stacks/deploys and rules, resume an interruption, exercise the replacement capture setup and verify history causes no outbound work.

**Evidence.** None.
**Gap.** No implementation proof yet: rollbar migration.

#### MIG-004 — Bugsnag migration

Core · target · **missing**

**Requirement.** Import Bugsnag/SmartBear organizations/projects, errors/events, stability and release metadata, app versions/stages, triage, collaborators, source-map/symbol references and integrations available through buyer-authorized APIs/exports. Reconcile event and session denominators separately; missing historical sessions never become a fabricated crash-free rate. Preview mapping and unmigratable artifacts, resume/undo safely and document mobile/web SDK and symbol-upload cutover.

**Acceptance.**
1. Migrate a real Bugsnag web/mobile project, reconcile sampled errors/events and release stability inputs, repoint capture and symbol CI, inspect an original native stack and show gaps where source exports lack historical sessions.

**Evidence.** None.
**Gap.** No implementation proof yet: bugsnag migration.

#### MIG-005 — Up-and-comer switching paths

Core · target · **missing**

**Requirement.** Offer documented, reviewed import/cutover adapters for PostHog Error Tracking, GlitchTip and Better Stack Error Tracking. Preserve available errors, lifecycle, releases, project tags and replay/trace links, with per-source mapping, loss and reconciliation reports. PostHog analytics stays in PostHog or the buyer's chosen analytics product; imported replay links require their original permissions and never imply ownership of external data.

**Acceptance.**
1. For a buyer-controlled project in each named service, preview/import representative errors and lifecycle, reconcile source counts and links, cut over capture, and verify resumed imports are idempotent and imported history stays inactive.

**Evidence.** None.
**Gap.** No implementation proof yet: up-and-comer switching paths.

#### API-001 — Public APIs, attachments and full export

Core · target · **partial**

**Requirement.** Expose versioned, paginated, project-scoped APIs for issues, occurrences, release/session reports, feedback, approved attachments and audit, with documented limits, cursors and compatibility. Export a complete authorized project or search in JSON/CSV and an integrity-checked private archive at any GOV-003 retained volume, streamed rather than refused for the project's event count; preserve attachment identity and erasure provenance. Attachments include the screenshots, view hierarchies, minidumps and crash reports unmodified Sentry SDKs send (SDK-007); each is viewable and downloadable only by members with access to its project, and every view is audited. API/webhook integrations including Sentry integration-platform workflows receive explicit capability mapping; Sentry Web API scripts and Terraform keep working through API-002.

**Acceptance.**
1. Use a read-only service grant to paginate all retained records and attachments, open a Sentry-SDK screenshot as a permitted member and be refused as an unpermitted one, reconcile with the UI/archive, reject foreign scope, export a large query with named bounds and restore without secrets or active work.
2. Export a 160,000-event project whole in JSON and as a private archive and reconcile its counts.

**Evidence.** `src/domain/investigation/records.ts`; `tests/investigation-flow.mjs` ([API-001] recordReadFlow); `tests/records-flow.mjs`; `docs/INVESTIGATION.md`
**Gap.** Version-1 cursor-paginated occurrence metadata (project and issue) and scrubbed feedback report reads now share exact-project read authority, bounds, ordering and uniform wrong-scope refusal. The public journey reconciles multiple pages with issue detail and inbox totals, then proves withdrawal and erasure. Existing bounded issue JSON/CSV export remains. Gap: attachment storage/viewing audit/downloads (currently counted sentry_unsupported_attachment), release/session record pagination beyond SDK-005’s bounded health report, audit API, streaming exports/archives at GOV-003 volume and the 160,000-event acceptance remain absent.

#### API-002 — Sentry Web API and Terraform compatibility

Core · target · **missing**

**Requirement.** Scripts and infrastructure-as-code written against Sentry's Web API keep working when only the base URL and auth token change. Spool serves Sentry's `/api/0/` endpoints for organizations, teams, members, projects, project client keys (DSNs, including per-key rate limits), issues (list with Sentry search syntax, get, update, bulk mutate and delete), events, releases, issue alert rules and metric alert rules, with Sentry's cursor `Link` pagination. Sentry-style organization and personal auth tokens map to TEAM-001 roles and are limited to their scopes and projects. The community Terraform provider for Sentry (`jianyuan/sentry`) manages `sentry_team`, `sentry_project`, `sentry_key`, `sentry_issue_alert` and `sentry_metric_alert` unmodified except for base URL and token, and plan, apply and import are idempotent. An unsupported endpoint or field fails with an explicit error naming it, never a silent success; every write is audited under AUDIT-001.

**Acceptance.**
1. Run a script that lists issues with a Sentry search query, paginates past the first page, assigns one and bulk-resolves several through `/api/0/`, and confirm the UI matches.
2. Run `terraform plan`, `apply` and `import` with the `jianyuan/sentry` provider against Spool to create a team, a project, a key with a rate limit and issue and metric alerts, then re-plan and confirm no changes.
3. Call an unsupported endpoint (named error) and attempt a write with a read-only token (refused, nothing changed).

**Evidence.** None.
**Gap.** No implementation proof yet: sentry Web API and Terraform compatibility.

### Governance and operation

#### GOV-001 — Enterprise identity and administration

Core · target · **partial**

**Requirement.** Connect Auth0, Okta and standard SAML/OIDC identity providers for organization SSO, enforce verified domains, MFA/step-up policy and SCIM provisioning/deprovisioning, and audit role changes. Preserve a controlled recovery owner without bypassing provider revocation. Members can also sign in with Google (Workspace or personal account) or GitHub as plain login options linked to their member identity; an admin can require one, restrict Google sign-in to verified domains and GitHub sign-in to a named GitHub organization, and removal, MFA and step-up still apply. Native email-link/local development setup remains usable; managed first-owner admission and editor access reuse native authority rather than adding a parallel identity model.

**Acceptance.**
1. Configure SSO with each named provider, provision a member and project role, enforce step-up, revoke the IdP user while a session/grant is active and verify all private doors deny access; recover through the documented owner procedure.
2. Sign in one member with Google and another with GitHub, restrict Google sign-in to the verified domain and confirm an outside Google account is refused, then remove the GitHub member and confirm the next request is denied.

**Evidence.** `src/auth/bindings.ts`; `src/editor`; `tests/owner-claim.mjs`; `tests/owner-editor.mjs`
**Gap.** Native owner auth and linked identity bindings exist; organization SSO/SCIM and named enterprise-provider qualification do not.

#### GOV-002 — Retention, residency and data custody

Core · target · **partial**

**Requirement.** Publish US-first hosting/subprocessor and residency options, telemetry/artifact/replay retention windows and deletion timing, none below GOV-003's minimums (errors at least 90 days by default, every data type at least 30 days), with automatic expiry under GOV-003 and artifact retention under SRC-004. Owners configure per-project retention with dry-run, schedules, storage/usage estimates and legal-hold/export controls; longer retention is an explicit USD plan choice. No expiry silently improves historical denominators or deletes independent anonymized audit. Record retention and dedup cutoffs in packets and reports. New storage/worker providers require a declared data-flow and erasure policy.

Before this capability ships, every new human/service action, denial, export and notification inherits AUDIT-001: safe permanent actor/subject aliases, time, action and truthful outcome; permissioned organization cursor history/export; append-preserving portability and erasure that removes attribution links without relabeling old facts.

**Acceptance.**
1. Set different retention windows, preview counts/coverage, hold/export one project and run the scheduled cutoff; inspect private artifacts removed, historical gaps, cost estimate and complete erasure/restore fences.
2. Advance the clock past a project's window with no manual action and confirm its oldest events expire automatically while new events are still accepted.

**Evidence.** `src/domain/retention.ts`; `src/domain/privacy.ts`; `tests/agent-handoff.mjs`; `tests/project-erasure.mjs`
**Gap.** Owner-only per-type 30–90-day windows (default 90), dry-run counts/range/coverage, typed shortening, audited legal hold/release and estimated stored bytes exist. Holds pause expiry only, never erasure; policy/hold archive, restore and erase, and packet notes state hold status. `tests/agent-handoff.mjs` and `tests/project-erasure.mjs` [GOV-002], 1440/390 Settings. Gaps: residency, commercial plan windows and session aggregates.

#### GOV-003 — Published retention, retained volume and sustained intake rate

Core · target · **partial**

**Requirement.** A buyer knows how long Spool keeps data, how much it keeps and how fast it accepts it, and no other limit stops the core job:
- **Retention.** Errors with their events and attachment metadata, sessions and release-health aggregates are kept at least 90 days by default on every plan, as on Sentry Team and Business; GOV-002 publishes each data type's window (none below 30 days) and longer windows as USD plan choices, and an owner may shorten one project's window with GOV-002's preview. Expiry runs automatically at least daily. It removes data older than the window under ERR-009's cutoff, occurrence tombstone, deduplication horizon and coverage-gap rules, records the gap in packets, reports and FIND-002 denominators, and never refuses or delays new intake. A GOV-002 legal hold pauses expiry for the held project only.
TEAM-004 commit retention is inherited here: automatic expiry, scheduled cutoffs and plan windows run the same cutoff as the owner retention door, removing author and message from commits received before it and from the alert copies that carried them, while SHA, link and resolution stay.

- **Retained volume.** BILL-001 sells volume as errors accepted per month in USD tiers, the smallest including at least 50,000 errors a month (Sentry Team's figure), with pay-as-you-go or a raised budget above the included volume. A project keeps every accepted event for its full retention window, however many there are. There is no per-project or per-installation retained-event count, and no project is refused because of how many events it holds.
- **Volume refusal reasons.** The only volume refusals are the buyer's monthly budget or cap (`over_budget`), BILL-001 spike protection against the project's own baseline (`spike_protected`), an admin-set DSN key rate limit (`key_rate_limited`) and intake above the sustained rate below (`server_rate_limited`). Each returns 429 with `Retry-After` and `X-Sentry-Rate-Limits` naming the limited data category and scope, and is counted under its reason in project outcomes, BILL-001 usage, capability diagnostics and the MIG-001 dual run. Non-volume refusals (SDK-006 filters, SDK-009's stricter rule, SDK-011 limits, invalid items) are counted separately.
- **Sustained intake rate.** Each project accepts at least 6,000 events a minute sustained, with bursts to 10,000 in any one minute, and an organization at least 30,000 events a minute across its projects, without refusal, on native, Sentry SDK and OTLP (CTX-001) intake alike. Events accepted at that rate are searchable in FIND-001 within 60 seconds. Above it, refusals are `server_rate_limited` and counted, never silently dropped.
- **Obligations at volume.** Clauses once tied to the current cap are restated against this volume. A project holding 150,000 retained events (three months of the smallest tier) or more is archived, exported and restored whole by streaming (ERR-009, API-001). Project erasure completes within 15 minutes for 150,000 retained events and at no less than 10,000 events a minute above that (BASE-DATA-003), and end-user erasure within 300 seconds in such a project (SDK-008). FIND-001 search and FIND-002 counts cover every retained event.

Before this capability ships, every new human/service action, denial, export and notification inherits AUDIT-001: safe permanent actor/subject aliases, time, action and truthful outcome; permissioned organization cursor history/export; append-preserving portability and erasure that removes attribution links without relabeling old facts.

**Acceptance.**
1. With unmodified Sentry browser (Next.js) and Python (Django) SDKs and only the DSN changed, send 60,000 errors to one project over a simulated month, including a burst of 5,000 in one minute, once with spike protection off and once at its default.
2. Confirm none is refused for retained capacity or a fixed per-minute budget, that any refusal with spike protection on is counted only as `spike_protected`, and that every accepted event is searchable within 60 seconds and counted.
3. Continue past 160,000 retained events and confirm new errors, including a brand-new crash, are still accepted.
4. Send more than 10,000 in one minute and confirm `server_rate_limited` 429s with `Retry-After` and counted outcomes.
5. Advance the clock past the 90-day window and confirm the oldest events expire automatically with a named gap while new events are accepted.
6. Set a monthly budget below the volume and confirm refusals start only at that budget, as `over_budget`.
7. Archive and export the 160,000-event project, restore it into an empty destination and reconcile counts, then erase one user within 300 seconds and the project within 16 minutes.

**Evidence.** `src/domain/retention.ts`; `src/domain/admission.ts`; `tests/agent-handoff.mjs`; `tests/project-erasure-cap.mjs`
**Gap.** An owner-run retention cutoff with occurrence tombstones, deduplication horizon and named retention gaps exists, and over-limit intake returns 429 with `Retry-After` and a counted outcome. Today `src/domain/admission.ts` and `migrations/core/0008_occurrence_identity.sql` refuse every new event once a project retains 10,000 (`retained_event_budget`) and above 120 a minute (`minute_budget`), and `src/domain/archive.ts` refuses a project archive above 10,000 events. Bounded daily expiry now uses applyRetention with occurrence/checkpoint tombstones, named gaps, scheduled retention service audit, held-project skips and an idempotent/resumable cursor; Settings reports the latest run. `tests/agent-handoff.mjs` [GOV-003] proves intake during a run, 50-row batches, remainder resume, hold and same-day no-op through the native scheduled clock seam. Plan volume, the published sustained rate, streaming archives, the 160,000-event run, automatic artifact/session-aggregate expiry and the named volume reasons remain absent.

#### BILL-001 — Predictable USD usage and ingestion budgets

Core · target · **partial**

**Requirement.** A US software team sees accepted, filtered (per SDK-006 filter), invalid, server-rate-limited (only above GOV-003's published sustained rate), key-rate-limited, spike-protected, client-discarded (from Sentry SDK `client_report` items and Spool SDK reports, by reason and data category, per SDK-007), refused for a missing or unregistered release (only on projects that chose SDK-009's registered-sequence-only rule), refused under SDK-011 (unsupported encoding, oversized request, oversized or invalid item, by item type and reason) and over-budget volume separately from billable events, sessions, replay, artifacts and retention. Publish USD tiers by errors accepted a month (the smallest including at least 50,000 errors, as Sentry Team does) with pay-as-you-go or a raised budget above the included volume, plus overage, project budgets and forecasts with owner-controlled caps and warning destinations. No volume is refused because of a project's retained event count or under a fixed per-minute budget; GOV-003 lists the only volume refusals. Automatic spike protection, on by default and owner-adjustable, caps a sudden volume surge above the project's recent baseline so it does not consume quota, records the dropped count and notifies the budget destination. An admin can set a rate limit on an individual DSN client key (events per minute or hour); exceeding it returns 429 with `Retry-After` and `X-Sentry-Rate-Limits` for that key only and counts as key-rate-limited. Caps return explicit SDK backpressure and retry guidance; operators can tune sampling with a preview of diagnostic loss. Commercial checkout, invoices and applicable US sales-tax handling use Stripe or an authorized billing partner.

**Acceptance.**
1. Run representative volume through a project budget, reconcile usage and displayed USD forecast, trigger warning/cap outcomes and a spike-protection cap, confirm filtered events consume no quota, send Sentry SDK client reports and reconcile discarded counts by reason and category, exceed one DSN key's rate limit while a second key keeps ingesting, send an envelope with one oversized item and confirm it is counted as refused under SDK-011 without consuming quota, adjust sampling, set a monthly budget below a month's volume and confirm refusals start only at that budget as `over_budget` with nothing refused for retained count, and complete a buyer-controlled billing sandbox invoice with tax and cancellation handling.
2. Current evidence: `src/domain/admission.ts`; `src/domain/sentry/client-reports.ts`; `src/ui/workbench/CaptureReceipts.tsx`; `tests/client-report-flow.mjs`; `docs/CLIENT-REPORTS.md`; `src/domain/filters/` Settings and capture receipts separate accepted, filtered and SDK client-discarded quantities; SDK discards retain reason/category without creating issues, alerts or accepted units, and survive private archive restore.
3. Commercial USD tiers, forecasts, billing, spike protection, key limits and the named volume reasons remain absent.
4. Fixed 120-a-minute and 10,000-retained-event refusals remain GOV-003 gaps.

**Evidence.** `src/domain/admission.ts`; `src/domain/sentry/client-reports.ts`; `src/ui/workbench/CaptureReceipts.tsx`; `tests/client-report-flow.mjs`; `docs/CLIENT-REPORTS.md`; `src/domain/filters/`
**Gap.** Settings and capture receipts separate accepted, filtered and SDK client-discarded quantities; SDK discards retain reason/category without creating issues, alerts or accepted units, and survive private archive restore. Commercial USD tiers, forecasts, billing, spike protection, key limits and the named volume reasons remain absent. Fixed 120-a-minute and 10,000-retained-event refusals remain GOV-003 gaps.

#### UX-001 — Mobile operations and accessible investigation

Core · target · **partial**

**Requirement.** Engineers use the complete triage, search, assignment, release, feedback, alert and repair path on desktop and mobile web with keyboard/screen reader support, stable deep links, touch controls and no horizontal page overflow. Loading, empty, permission-denied, offline/stale, error and success states name what is known. Preserve drafts/focus during refresh and refuse duplicate busy actions. Native application crash SDK coverage is SDK-001/002 and remains required.

**Acceptance.**
1. At 1440 and 390, onboard a realistic team project, capture/map an error, search/assign/comment, follow an alert, approve a repair and inspect all end states with keyboard, screen reader checks and revoked/offline sessions.

**Evidence.** `src/ui/workbench`; `tests/triage-journey.mjs`; `tests/alerts-ui.mjs`; `tests/execution-journey.mjs`
**Gap.** Current single-owner core has responsive/Axe journeys; full target team/mobile workflows are absent.

#### AUDIT-001 — Permanent privacy-safe action audit

Core · target · **done**

**Requirement.** Record actor/service, time, action, subject and outcome for triage, grouping, permissions, exports, retention/erasure, integration writes, notification attempts and agent approvals/steps. Keep append-only, portable, permissioned history without secrets, raw payloads or personal values in permanent subject/actor labels. Erasure anonymizes attribution and retains count-only receipts; denied/stale writes cannot claim completion. Exportable organization audit and admin investigation must cover new team/provider paths.

**Acceptance.**
1. Perform owner/member/agent and denied actions, restart/export/restore, erase an actor/project and inspect retained nonpersonal chronology, correct outcomes and absence of secret/erased identifiers.

**Evidence.** `src/domain/audit/`; `src/ui/workbench/AuditHistory.tsx`; `migrations/core/0051_safe_audit.sql`; `migrations/core/0053_audit_transactions.sql`; `tests/audit-history.mjs` (AUDIT-001); `tests/old-archive.mjs`; `tests/owner-erasure.mjs`
**Gap.** Every Spool writer commits its change and one attributed safe fact in the same D1 transaction: owner, deploy, ingest and run-token batches (and the scheduled deployment-deadline service) open a context holding the actor, action, subject and project aliases, and the operational journal row or an explicit commit inside that batch records the fact, so a denied, stale or aborted batch records none; a journal row written without a context is refused by the schema. Denied, stale and failed attempts keep request observations with truthful outcomes; sign-in and Business import doors are attributed to the owner or service they admitted. Erasure completion commits a service fact in its final erasure batch; webhook and mail notification attempts and private archive and audit exports record `started` before the effect and exactly one outcome after it. Journal rows written before attribution have value-free legacy facts (kind-derived action, original time, unknown actor, fresh unlinkable labels); retention writes its journal row once instead of revising it. Private archives carry the safe chronology as a payload and never the private alias links; restore appends it, with original ids, times, sources, aliases and outcomes, after the destination's own facts in the restore's commit, then records the restore; previous archive formats gain legacy facts. Owner-only fixed-snapshot cursor history and JSON/CSV export; restart; actor/project erasure deletes private links and leaves prior facts unchanged. Base-owned operator-auth and import-kit writes (invitations, roles, Sentry/Business import plan/apply/undo) are attributed by their request observation, not inside the Base transaction. Future TEAM-001, SRC-002/003, TRACK-001, ALERT-002/005, INT-001, SDK-008, GOV-002/003 and AI-001/003 inherit the complete audit in their own text and ACCEPTANCE.

### Deployment integrations

#### INT-001 — Vercel and Netlify deployment connectors

Core · target · **missing**

**Requirement.** Connect Vercel and Netlify projects so preview/production deploys, build identity and commit metadata automatically register in Spool, with environment mapping, artifact-upload guidance, rollback and failed-build visibility. Verify signed callbacks and reconcile missed events through least-privilege read-back. Account/repository disconnect stops work and queued old callbacks cannot recreate erased projects.

Before this capability ships, every new human/service action, denial, export and notification inherits AUDIT-001: safe permanent actor/subject aliases, time, action and truthful outcome; permissioned organization cursor history/export; append-preserving portability and erasure that removes attribution links without relabeling old facts.

**Acceptance.**
1. Deploy preview and production from each provider, upload artifacts, trigger a mapped error, fail/roll back a deployment and replay a callback; inspect one deployment identity and immediate disconnect/erasure fences.
2. Integration actions inherit ALERT-004 before shipping: an accountable owner, due condition, durable state and inspectable attempts, deduplicated follow-up, and reconciliation or authorized resend for uncertain effects.

**Evidence.** None.
**Gap.** No implementation proof yet: vercel and Netlify deployment connectors.

### Push further

#### AI-001 — Controlled coding-agent handoff

Core · push-further · **partial**

**Requirement.** Cursor, GitHub Copilot and Claude can consume the same permissioned CLI/MCP packet, source/release links, gaps and current repair observations. The engineer selects project/repository scope, data fields, model/provider and budget; no telemetry instruction can expand them. Preview external data egress, retain audit, expire/revoke access and distinguish suggestions from confirmed causes. Read-only diagnosis never silently acquires repository write or production authority.

Before this capability ships, every new human/service action, denial, export and notification inherits AUDIT-001: safe permanent actor/subject aliases, time, action and truthful outcome; permissioned organization cursor history/export; append-preserving portability and erasure that removes attribution links without relabeling old facts.

**Acceptance.**
1. In each named agent client, request one issue packet, inspect its untrusted labels and missing coverage, refuse cross-project/mutation/prompt-injection requests, revoke the grant and confirm the next HTTP/CLI/MCP call is denied.
2. SDK-010 source context and frame-local egress inherit previewed field selection here.
3. Current ERR-007 packets exclude source and locals; no agent/model gains them until the reviewed selection and privacy controls ship.

**Evidence.** `packages/agent/src`; `src/domain/agent-access.ts`; `src/domain/packet.ts`; `tests/agent-handoff.mjs`
**Gap.** Generic read-only CLI/MCP is implemented; named client qualification and model-egress controls for automated work are incomplete.

#### AI-002 — Generate and test the smallest reproduction

Core · push-further · **partial**

**Requirement.** An agent combines sanitized occurrence, exact release/build/symbol/source artifacts, breadcrumbs, trace/replay and owner-approved input to construct and minimize a deterministic reproduction. It tests competing causes and records counterexamples, failing input, environment and unsuccessful attempts in an isolated budgeted runner for each supported runtime/mobile target. No production credentials/network access are inherited; the owner approves repository scope, dependency/network policy and cost. Unsupported, not reproduced, failed and reproduced remain distinct.

**Acceptance.**
1. Approve a real captured failure, inspect a minimal failing case and competing-cause experiment, run malicious telemetry/timeout/missing-artifact cases, and repeat against the fixed release; failed setup cannot become not-reproduced success.

**Evidence.** `src/domain/reproducers/classify.ts`; `src/domain/reproducers/sandbox.ts`; `scripts/reproduce/runner.mjs`; `tests/execution-journey.mjs`
**Gap.** Bounded mapped-JavaScript reproductions with supplied calls exist; automatic minimization, cause experiments and non-JS/mobile reproduction do not.

#### AI-003 — Minimal code repair as a tested pull request

Core · push-further · **partial**

**Requirement.** From an approved reproduction and repository grant, an agent prepares the smallest source change and regression case, compares candidates, runs the buyer's relevant tests/type/build/security checks in isolation and opens a draft GitHub PR or GitLab merge request with failing-before/passing-after evidence, changed files, risks and unresolved cases. Configurable trigger policies can start investigation only within preapproved scope/budget. Humans approve provider write, expansion, merge and deployment; no automatic merge/deploy. Prompt content cannot authorize changes or bypass CI.

Before this capability ships, every new human/service action, denial, export and notification inherits AUDIT-001: safe permanent actor/subject aliases, time, action and truthful outcome; permissioned organization cursor history/export; append-preserving portability and erasure that removes attribution links without relabeling old facts.

**Acceptance.**
1. Authorize a scoped repair, observe a real source patch and regression failure-before/pass-after in a buyer repository, open one draft PR/MR, cancel/expire/revoke between steps and inspect durable results without unauthorized writes or duplicate branches.
2. Agent fix steps inherit ALERT-004: an accountable owner, due condition, durable state and inspectable provider attempts; an expired lease or unknown provider response leaves one follow-up and blocks automatic repetition until explicit reconciliation or authorized resend.

**Evidence.** `src/domain/fixes/workflow.ts`; `src/domain/fixes/provider.ts`; `tests/execution-journey.mjs`
**Gap.** Current GitHub double journey opens a data-only artifact PR and observes merge/checks; generated code fixes, real repository acceptance and GitLab are absent.

#### AI-004 — Prove the released repair from live rates

Core · push-further · **partial**

**Requirement.** After human-approved merge/deploy and success criteria, an agent links the fix commit to actual deployed cohorts and exercises the failing customer flow. Compare before/after failure rates against observed comparable traffic, confidence/minimum exposure, adoption, sampling, old releases, capture loss, retention and grouping changes. Require the reproduction to pass and live evidence to support improvement; continue a bounded watch and reopen/escalate recurrence. Quiet or missing telemetry is inconclusive, never success. Show the exact denominator, window, counterexamples and reasons; the engineer may stop or revise criteria without rewriting observations.

**Acceptance.**
1. Deploy a reviewed fix to only part of traffic, generate known healthy and failing flow exposure, introduce old-version errors and capture gaps, then restore coverage and recur; inspect rate comparison, inconclusive/reached/recurred states and one accountable recurrence follow-up.
2. Agent verification steps inherit ALERT-004 before shipping: an accountable owner, due condition, durable state and inspectable attempts, deduplicated overdue follow-up, and explicit reconciliation or authorized resend for unknown effects.

**Evidence.** `src/domain/exposure/proof.ts`; `src/domain/repairs/observation.ts`; `tests/execution-journey.mjs`; `tests/repair-recovery.mjs`
**Gap.** Current proof already compares baseline rates with a confidence bound, affected cohorts, rollout and capture gaps; autonomous production measurement, an ongoing watch and real-account acceptance remain missing.

#### AI-005 — Explain grouping proposals before applying

Core · push-further · **done**

**Requirement.** An agent compares stack, release, route and trace variants, proposes split/merge/rule changes and shows exact affected events, counterexamples, ownership and alert/rate/repair-verification effects. An engineer previews and explicitly applies or rejects; undo preserves immutable originals and prior decisions. Approval, rejection and apply are owner-only until TEAM-001 supplies project roles. Agent proposals are labelled "proposed by agent <alias>". Trace identity is currently unavailable; CTX-001 inherits trace-variant comparison for AI-005 before completion. The model cannot silently rewrite a group, suppress alerting or manufacture better repair results.

**Acceptance.**
1. Give the agent deceptively similar and rebuilt failures, inspect a proposal with counterexamples and rate/alert differences, reject then approve another, undo it and verify preserved originals and grouping-change coverage gaps.

**Evidence.** `src/domain/proposals/`; `migrations/core/0057_grouping_proposals.sql`; `src/ui/workbench/GroupingProposals.tsx`; `packages/agent/`; `tests/operator-flow.mjs`; `tests/operator-ui.mjs`; `tests/agent-handoff.mjs`; `tests/old-archive.mjs`
**Gap.** Bounded inert split/merge/rule advice is labelled proposed by agent with its service alias. Spool computes exact events, inside/outside counterexamples, per-window rates, ownership, rule/open-alert effects and preserved repair recurrence. Owner-only reject/approve, existing explicit apply, correction undo and rule-version rollback preserve originals and prior decisions; stale revisions refuse. Archive projection proves proposed advice has no live effects, private restore is inert, erasure carries the store, and the populated v0.6.0 upgrade preserves every old row. UI states are exercised at 1440/390. Trace identity is named unavailable; CTX-001 inherits AI-005 trace-variant comparison.

#### AI-006 — Prevent related failures from recurring

Core · push-further · **missing**

**Requirement.** An agent mines accepted fixes, rejected hypotheses, production recurrence and approved repository code for shared violated invariants. It proposes reusable regression/property tests, identifies other affected call sites with evidence and counterexamples, and watches later releases for that invariant. Related-code guesses remain hypotheses. Engineers approve every new repository/service scope, test and patch; budgets, stop controls and known false positives stay visible.

**Acceptance.**
1. Accept a repair, introduce a related failure at another authorized call site, inspect the inferred invariant and a failing regression case, reject a false positive, approve a scoped patch and observe later recurrence without automatic expansion.

**Evidence.** None.
**Gap.** No implementation proof yet: prevent related failures from recurring.

#### AI-007 — Agent-runtime failure diagnosis and evaluated improvements

Core · push-further · **missing**

**Requirement.** For applications using LLM agents, correlate approved model/tool spans, latency, token/cost and sanitized failures with the application issue. Owner-configured detectors cluster failed production runs into improvement hypotheses; the agent investigates connected code in a sandbox and compares offline eval cases before suggesting a patch. Keep this scoped to diagnosing application failures; integrate dedicated agent analytics/evaluation systems for their broader job. Model choices, dataset consent, redaction, spend and promotion remain human-controlled.

**Acceptance.**
1. Import/capture authorized failing tool/model runs, cluster a repeated fault with counterexamples, inspect cost/latency and error links, compare baseline/candidate on an approved offline dataset and refuse promotion or external data egress without approval.

**Evidence.** None.
**Gap.** No implementation proof yet: agent-runtime failure diagnosis and evaluated improvements.

## Agent surface

None.

## Later

None.

## Field proof register

No field proof is recorded yet.
