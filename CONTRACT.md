# Spool target product contract

Spool is an application error tracking and crash reporting product for a US development team replacing Sentry, Datadog Error Tracking, Rollbar or Bugsnag (SmartBear). It serves the complete error-to-repair job: capture web/server/mobile failures, understand impact with source and execution context, route accountable team work, and establish whether a released repair held. PostHog Error Tracking, GlitchTip and Better Stack Error Tracking set the emerging-product comparison; the agent clauses go further through reproduction, tested source repair and live exposure-based verification.

## Product target

| | |
| --- | --- |
| Category | Application error tracking and crash reporting |
| Incumbents a buyer switches from | Sentry, Datadog Error Tracking, Rollbar, Bugsnag (SmartBear) |
| Up-and-comers it must also beat | PostHog Error Tracking, GlitchTip, Better Stack Error Tracking |
| First buyer | A US application business with several engineers, a web/server/mobile application, GitHub or GitLab, a delivery tracker and existing error monitoring, moving its error capture, triage and repair work off its current incumbent; prices, budgets and invoices in USD, with US hosting, time zone, privacy and sales-tax expectations |

The primary journey: a US development team points its existing error capture at Spool, sees each failure grouped with its original source line, impact and release, routes and triages it with its team, hands the evidence to a coding agent and learns whether the released repair held.

## How to read this contract

- This follows the RER contract standard. This is the product being built toward: a clause is an obligation, not a claim that it ships today. Core is what a buyer switching from the named incumbents uses in the first week, plus the push-further work; the Agent surface is reported on its own line.
- Done means every acceptance point passes through Spool's own doors (public ingest, the UI, the HTTP API, the CLI and MCP, provider sandboxes or official-schema edges, and seeded runs) in a recorded Verify run. Local results and provider doubles qualify only their tested boundary and never become hosted, device or commercial acceptance; partial names a working subset and missing has no implementation proof.
- Real-world proof Spool cannot produce in its own repository (physical devices, buyer accounts and exports, vendor tenants, named agent clients, a human screen-reader pass and a VPAT) is in the Field proof register; it never blocks done.
- Door rules D-1 to D-6 are stated once below; a clause that lists them proves them at its own door. Until TEAM-001 ships, D-4 says who acts for the team roles a clause names.
- ACCEPTANCE.md and docs/CLAIMS.md are generated from this file. Rulings are in RULINGS.md, history in CHANGELOG.md, and mechanism, adopted defaults and the coverage and id maps in docs/.

## Door rules

- **D-1.** Audit for new actions. Every new human or service action, denial, export and notification a clause adds records its AUDIT-001 fact before that clause ships: safe permanent actor and subject aliases, time, action and truthful outcome; permissioned organization cursor history and export; and append-preserving portability and erasure that removes attribution links without relabelling old facts.
- **D-2.** Intake category filters. Before any additional intake category ships, it inherits SDK-006: Origin/Referer and every applicable available transport and category filter run before acceptance, unavailable fields are named, and filtered and client-discard accounting stays truthful.
- **D-3.** Durable follow-up. Every new integration, tracker, deployment-connector and agent action inherits ALERT-004 before it ships: an accountable owner, a due condition, durable queued, running, blocked, failed, uncertain, completed and canceled state, inspectable attempts, one deduplicated follow-up, and explicit reconciliation or authorized resend for an uncertain effect.
- **D-4.** Interim owner authority. Until TEAM-001's organization and project roles ship, the installation owner holds every maintainer, member, team, deployment and alternate-operator authority a clause names; TEAM-001 then enforces each of those roles without granting authority outside the member's project or team.
- **D-5.** The SDK qualification run. A runtime clause runs one unmodified Sentry SDK program at a pinned SDK version twice, in a push Verify job or a named scheduled workflow: once against a reference collector and once against Spool, with only the DSN changed, using default integrations plus the options the Sentry setup wizard enables for that platform (sessions, tracing, logs, replay for browser and mobile, the feedback widget or feedback API, and attachments); where an SDK version lacks an option, the evidence names that version and option. Q1 handled: a captured exception is a persisted occurrence, read through the public API and UI. Q2 unhandled: an uncaught failure or crash is persisted as unhandled. Q3 flush and restart: after a flush and a process or app restart, the same failure groups into the same issue without a duplicate occurrence. Q4 item reconciliation: every item the reference collector received has exactly one Spool outcome under SDK-007, persisted or counted by category and reason in capability diagnostics, and nothing is silently dropped. Q5 release: the release and dist (or "none") equal what the SDK sent, and the release is auto-created under SDK-009. Q6 discards: client-report discards appear in BILL-001 usage. Q7 refusal: refused or undeliverable events create nothing. Constructed envelopes qualify conversion only.
- **D-6.** New stores join erasure and archives. Every new table or object store a clause adds is declared in the ERASE-001 project and installation-owner erasure cascades and in the ERR-009 archive rules before that clause is accepted, and a store that holds personal data names its retained-scope exceptions.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | OPS-001, GOV-001 | not run |
| BASE-ACCESS-002 | Sessions | ERR-004 | not run |
| BASE-ACCESS-003 | Public endpoints | ERR-004 | not run |
| BASE-ACCESS-004 | Server-side authorisation | ERR-004, TEAM-001 | not run |
| BASE-INPUT-001 | Validation | ERR-001 | not run |
| BASE-INPUT-002 | HTML | none | not run |
| BASE-INPUT-003 | Uploads | ERR-005, SRC-004, API-001 | not run |
| BASE-SECRET-001 | No leakage | ERR-003 | not run |
| BASE-SECRET-002 | Startup | none | not run |
| BASE-DATA-001 | Export and import | ERR-009, OPS-001, API-001 | not run |
| BASE-DATA-002 | Retention | GOV-002, GOV-003 | not run |
| BASE-DATA-003 | Erasure | ERASE-001, SDK-027, AUDIT-001 | not run |
| BASE-DATA-004 | Outbound flows | AI-001 | not run |
| BASE-DATA-005 | Independence | none | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | none | not run |
| BASE-PUBLIC-001 | Privacy | SDK-004 | not run |
| BASE-PUBLIC-002 | Origins | SDK-006 | not run |
| BASE-PUBLIC-003 | Accessibility | UX-001 | not run |
| BASE-OPS-001 | Health | none | not run |
| BASE-OPS-002 | Migrations | none | not run |
| BASE-OPS-003 | Idempotency | ALERT-004, REL-001 | not run |
| BASE-OPS-004 | Failure is visible | ALERT-004 | not run |
| BASE-OPS-005 | Audit | AUDIT-001 | not run |
| BASE-ROLE-001 | Roles through every door | TEAM-001, SDK-026, GOV-001 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | AUDIT-001 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | ERR-009 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | GOV-001 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | GOV-001 | not run |
| BASE-INSTALL-001 | Free self-host and removal | OPS-001 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | ALERT-003 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | UX-001 | not run |
| BASE-DOCS-001 | On-site docs from one contract | none | not run |
| BASE-AGENT-001 | One MCP door per seed | SURFACE-001 | not run |
| BASE-AGENT-002 | The seed's jobs are tools | SURFACE-001 | not run |
| BASE-AGENT-003 | Records are resources | ERR-007, SURFACE-001 | not run |
| BASE-AGENT-004 | Business identity and short-lived tokens | ERR-004, AI-001 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role | ERR-004, AI-001 | not run |
| BASE-AGENT-006 | Every action declares its risk class | SURFACE-002, SURFACE-003, SURFACE-004 | not run |
| BASE-AGENT-007 | The company's policy decides | AI-003, AI-005, SURFACE-005 | not run |
| BASE-AGENT-008 | Truthful attribution | AI-005, SURFACE-004 | not run |
| BASE-AGENT-009 | Every agent action is audited | AUDIT-001 | not run |
| BASE-AGENT-010 | Agents can follow changes | SURFACE-001 | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | AI-002 | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | SURFACE-001 | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-005 | not run |

## Published clauses

- `ERR-001`: *Tier:* Core · *Cites:* BASE-INPUT-001
- `ERR-002`: *Tier:* Core
- `ERR-003`: *Tier:* Core · *Cites:* BASE-SECRET-001
- `ERR-004`: *Tier:* Core · *Cites:* BASE-ACCESS-002, BASE-ACCESS-003, BASE-ACCESS-004, BASE-AGENT-004, BASE-AGENT-005
- `ERR-005`: *Tier:* Core · *Cites:* BASE-INPUT-003
- `ERR-006`: *Tier:* Core
- `ERR-007`: *Tier:* Core · *Cites:* BASE-AGENT-003
- `ERR-008`: *Tier:* Core · *Rules:* D-4
- `ERR-009`: *Tier:* Core · *Cites:* BASE-DATA-001, BASE-BACKUP-001 · *Rules:* D-6
- `ERR-010`: *Tier:* Core · *Rules:* D-5 · *Register:* R-1, R-20
- `OPS-001`: *Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-INSTALL-001, BASE-DATA-001 · *Register:* R-20
- `ERASE-001`: *Tier:* Core · *From:* BASE-DATA-003 · *Cites:* BASE-DATA-003 · *Rules:* D-6

### Evidence core

#### ERR-001 — Bounded admission

**Requirement.** Native version-1 JavaScript, Python and Go exception envelopes require active exact-project ingest credentials, registered release/build identity and bounded fields. Invalid, oversized, volume-limited and conflicting retries have explicit outcomes. Each project admits at most 120 outcomes a minute (`minute_budget`) and retains at most 10,000 events (`retained_event_budget`); over-limit intake returns 429 with `Retry-After` and a counted outcome. GOV-003 carries the target that replaces both limits with its named volume reasons and published sustained rate. Artifact URLs in envelopes are never fetched. Sentry error intake follows SDK-009's default acceptance with no release or an automatically created release/dist; only SDK-028's opt-in registered-sequence-only policy requires registration. Native version-1 intake keeps the registered release/build prerequisite. The broader SDK target is SDK-001, and runtime SDK compatibility is SDK-001 and SDK-012 to SDK-019.

**Acceptance.** Through public ingest:
1. A valid native envelope is accepted, with its outcome.
2. Invalid, oversize, foreign-project and conflicting-retry envelopes each get their explicit refusal outcome, and the stored rows are unchanged.
3. Exceeding the per-minute limit returns 429 with `Retry-After` and a counted reason, with no partial rows.
4. Exceeding the retained-event limit returns 429 with `Retry-After` and a counted reason, with no partial rows.

#### ERR-002 — Atomic acceptance

**Requirement.** Accepted means a sanitized occurrence, its group aggregate and its local new/regression alert commit atomically. Retry identity is project plus event ID and SHA-256 of canonical original accepted JSON before scrubbing: identical retry never increments, changed raw content conflicts even if its sanitized result matches. Raw bytes are not retained. Group algorithm version and basis remain inspectable.

**Acceptance.** Through public ingest:
1. An event ingested twice yields one occurrence and one aggregate increment.
2. It raises one local alert.
3. The same event ID with a changed raw secret is an explicit conflict, with no partial rows.

#### ERR-003 — Scrub before storage

**Requirement.** Apply the native allowlist, bounded text, query/fragment removal and sensitive-text scrubbing before persistence. Native envelopes contain no headers, cookies, request bodies or personal user identity; the `user` interface that unmodified Sentry SDKs send is governed by SDK-008's project identity policy instead. An optional random installation identifier supports bounded exposure measurement; it is never a name or address. Telemetry, source and notes are untrusted data and cannot authorize execution. The event fields SDK-010 keeps from unmodified Sentry SDKs (frame local variables, SDK-sent source context lines, exception values, tags, contexts, request, extra and thread stacks) pass through these scrubbers and SDK-003's server-side rules before storage, and default secret names are masked inside frame variables. Default protection persists when SDK-003 and CTX-002 introduce opt-in context; those captures require their own field policies and previews. Redaction does not promise removal of arbitrary semantic personal data.

**Acceptance.** Privacy canaries ingested through public ingest:
1. are absent from stored events;
2. are absent from issue views;
3. are absent from evidence packets;
4. are absent from archives;
5. are absent from alert delivery content;
6. while the ordinary diagnostic content beside them survives.

#### ERR-004 — Separated authority

**Requirement.** Every private API/document checks the current owner session or its exact ingest, deploy or read-only project grant itself. Cookie writes enforce same origin. Revocation and identity fencing take effect on the next request; confidential maps are never public. Ingest cannot read, deploy can only register releases/upload artifacts and record deployment starts/callbacks, and read-only agent grants cannot mutate. TEAM-001 extends this model to collaborative membership without broadening existing credentials.

**Acceptance.** Each private transport:
1. refuses an anonymous call;
2. refuses a wrong-scope grant;
3. refuses a foreign-project grant;
4. refuses a revoked grant on the next request;
5. refuses an identity-fenced grant;
6. leaves state unchanged after every denied write;
7. and a direct map URL reveals no private bytes.

#### ERR-005 — Source map identity

**Requirement.** Private flat Source Map V3 lookup matches project, release, build, debug ID and SHA-256 before presenting original coordinates. Missing, invalid or mismatched maps retain generated frames and a reason. Late uploads never rewrite immutable admission snapshots; current lookup is labeled separately. Lines are one-based, columns zero-based. SRC-004 carries indexed maps, `sourceRoot`, published capacity and opt-in source fetching; outside that opt-in, Spool never fetches a remote URL. SDK-010 rich stacks retain up to 1,000 frames per exception; SRC-004 and this clause inherit expanded mapped lookup without discarding retained SDK stack evidence. Broader artifact processing is SRC-001 and SDK-002.

**Acceptance.** A minified exception from a second origin:
1. captured before its matching map is uploaded keeps generated frames with a reason;
2. captured after the upload shows its original coordinates;
3. keeps its earlier admission diagnostics unchanged after the late upload, with current lookup labelled separately;
4. keeps generated frames with a reason when the uploaded map does not match;
5. and its evidence packet excludes the confidential source.

#### ERR-006 — Audited triage and regression

**Requirement.** Revision-checked open, acknowledged, resolved and suppressed changes are audited. An issue resolved in its current release reopens as a regression on a recurrence in a later release; delayed older-release events cannot invent one. For native version-1 events the order is the registered sequence, never guessed semver; Sentry events follow the project's stated rule in SDK-028, including releases later enriched by registration. SDK-009 carries resolve in the next or a named release and plain Resolve, and plain Resolve regresses on the next accepted event in any release; TEAM-004 inherits resolution from a commit's release, and TEAM-003 carries same-release recurrence policies, bulk actions and collaborative triage. Recognized JavaScript bundle hash suffixes do not split grouping; native anchors and reported frames stay immutable. Corrections retain exact occurrence provenance and reversible fenced apply/undo.

**Acceptance.**
1. A captured issue resolved in its current release reopens as a regression when its fingerprint arrives in a newer release.
2. A later event from an older release does not reopen it.
3. Split and merge previews through the owner HTTP door and the issue view move nothing.
4. Split and merge apply and undo through the owner HTTP door and the issue view.
5. A stale revision is refused.
6. Original membership stays inspectable after apply and undo.

#### ERR-007 — Sanitized evidence packet

**Requirement.** A compatible v1 packet exposes issue/lifecycle/grouping, retained release sequence and per-event release/build/environment, generated/original coordinates, immutable diagnostics beside current lookup, links and coded coverage gaps. UTF-8 JSON is bounded to 256 KiB and ten events, removing oldest events first and naming included/available counts even if none fit. It excludes source snippets, sourcesContent and artifact bytes. It carries the latest computed repair observation and newest three owner-recorded repairs, with omitted history named. CLI and stdio MCP keep exact-project read authority and untrusted/no-execution labels; they cause no model egress.

**Acceptance.**
1. The same packet reads through HTTP, the CLI and the official MCP transport, with equal projections.
2. At the size boundary the oldest events are removed first and the included and available counts are named.
3. At the retention, import and loss boundaries the packet carries each coded coverage gap.
4. The packet carries no secrets.
5. It carries no source bytes.
6. Reading it performs no write.
7. A cross-project read is refused.

#### ERR-008 — Loss counters and repair observation

**Requirement.** Expose windowed accepted/rejected/budget outcomes, SDK-reported discards by category and reason, and unknown pre-transport loss. Reported discarded errors are a loss input and prevent a quiet feed from proving a repair; other discarded categories do not imply lost errors. Only the owner records revision-checked repair links, scrubbed notes, checks, approval/merge/deploy facts and an exercised-flow record. Links are HTTPS origin/path text and never fetched. Manual repair writes send no notifications or external work. Compute recur/reasoned inconclusive/no-recurrence-after-exercise from stored release sequence, maps, events, exercise and loss; list older-release events separately. Missing exercise, capture, map, exposure or retention yields inconclusive. Never label a quiet feed fixed. Repair recurrence counts retained native admission membership, current membership and exact occurrence membership during the repair's lifetime, even after further corrections or undo; any applied or undone correction involving the issue leaves a `grouping_changed` coverage gap, so without retained recurrence its observation is inconclusive. AI-004 adds rate-based live proof.

**Acceptance.**
1. The owner records a repair through the HTTP door.
2. Every project-grant write to repairs is denied, with the rows unchanged.
3. A deployed repair with no events reads inconclusive, with a named reason.
4. A healthy exercised window reads no recurrence after exercise.
5. An older-release event is listed separately and does not count as recurrence.
6. A loss case reads inconclusive.
7. A recurrence reads recurred.
8. Manual repair records send no notification and start no external work.

#### ERR-009 — Archive, restore and retention

**Requirement.** Versioned private archives carry stored source bytes, checksums, migration identity, triage, maps, repairs/checks, operator corrections and inert agent grouping proposals (including server-computed review snapshots), reproduction/fix/exposure history, sanitized Sentry evidence, feedback, capture/grouping/release policies and erasure journal. HTTP/CLI and legacy v1/v2 decoding share semantic validation. Source and maps are portable; run tokens, step leases, owner sessions, project grants, alert destination records/credentials and dispatch queues never travel; retained alert rules restore disabled and delivery history is historical. Restored schedules and quiet hours are disabled, restored snoozes and scheduled mail are historical and never send, and raw recipient receipts and passing-test authority do not travel. Older archives restore newly introduced collections empty under versioned rules. An archive holds at most 10,000 events per project and refuses more with `Archive event budget`; GOV-003 carries streaming archives of any retained volume, SRC-004 the artifact capacity and GOV-002 scheduled policies. Manual cutoff retention removes private derived content, keeps repair snapshots with coverage gaps and exposes the deduplication horizon. Imported history creates no active grant, dispatch or current repair proof.

**Acceptance.**
1. A populated installation exports through the browser and through `rer`.
2. Each archive restores into an independent empty destination, and the retained records compare equal.
3. Restored work is inert: no active grant, dispatch or current repair proof.
4. A tampered archive is refused before any mutation.
5. A conflicting archive is refused before any mutation.
6. An import into a nonempty target is refused before any mutation.
7. After a manual retention cutoff, repair snapshots keep their coverage gaps.

#### ERR-010 — Release gates

**Requirement.** A release must exercise real capture, symbolication, privacy, permissions, persistence and independent restore through the shipped app. Fresh setup has no demo rows. Private flows are accessible and responsive with explicit empty, failure and unavailable states. Source presence, local providers or a green build cannot substitute for hosted, mobile, integration or real-account acceptance; physical-device and buyer-account qualification are register rows. UX-001 and each connector clause specify the expanded product gates.

**Acceptance.**
1. The named implemented journeys run on the emitted Worker.
2. Their end states are inspected at 1440 and 390.
3. Each supported runtime passes its qualification run (D-5) and each configured provider its sandbox or official-schema journey.

#### OPS-001 — Base commands and native admission

**Requirement.** The public rer command contract uses declared Node/pnpm pins and one setup manifest for terminal/browser. Setup claims or preserves the owner and private settings, stops its temporary app and leaves empty product data; rer dev uses real assets/HMR and private local identity. Local dev grants never authorize deployed entry. Reset is confirmed/contained and preserves source, exports and deployment receipts. Deployment dry-run makes no provider request. Managed signed first-owner admission precedes auth dispatch; editor config independently checks the owner and has short expiry/exact-origin CSP. Actual owner-account deployment and provider acceptance are separate gates.

**Acceptance.** In a fresh checkout and an independent destination:
1. Public `rer install`, `rer setup` and `rer dev` complete.
2. `rer export` and `rer import` move the installation into the independent destination.
3. `rer reset` completes.
4. The deployment dry run completes without a provider request.
5. Setup preserves an existing setup.
6. Setup rejects an unsafe answer path.
7. A reused managed claim is rejected.
8. Anonymous and project-grant editor access is denied.

#### ERASE-001 — Project and installation-owner erasure

**Requirement.** The owner erases one project, or their own personal data, with a count-only preview, a typed confirmation bound to the exact current plan, resumable destructive steps and a completion receipt with per-table counts and times and no personal values. Project erasure cascades from the project root through every declared store, withdraws a Sentry-imported project's import-kit custody and original export artifacts in the same batch, leaves portability tombstones and stale-write fences, runs one erasure at a time and never reuses an erased project's identifier; GOV-003 carries erasure within 15 minutes for 150,000 retained events. Owner self-erasure first transfers authority to a verified successor, so exactly one active owner remains; it refuses unsupported/ambiguous attribution, retained import custody and identifiers inside structural keys rather than damaging other people's data, and replaces only exact whole-token identifiers in captured data. Every owner write admitted before the handoff and completed after it is refused with `409 authority_changed`. Archives exported before an erasure are refused by the installation's restore fence, including archives holding only child rows, and by a fresh destination that first receives the post-erasure archive or a later journal. Team membership extends these permissions while keeping owner-only destructive confirmation and a verified authority successor. The preview and receipt name each retained scope exception and the external copies outside the local fence (docs/PROJECT-ERASURE.md, docs/OWNER-ERASURE.md).

**Acceptance.** Through public setup, dev, HTTP, export and import:
1. Project erasure removes the canaries planted in every declared store.
2. The preview and the receipt carry counts and times only, with no personal values.
3. Wrong-scope, cross-origin and stale requests are refused and change nothing.
4. Owner self-erasure hands authority to a verified successor first, leaving exactly one active owner.
5. An interrupted erasure resumes to completion.
6. A pre-erasure archive is refused in the same installation and in a fresh destination that first received the post-erasure archive.

## Target clauses

### Teams and triage

#### TEAM-001 — Organizations, members and project permissions

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-ACCESS-004 · *Rules:* D-1, D-4

**Requirement.** A US development team creates an organization, invites multiple simultaneous members, organizes projects by team, and grants owner/admin, billing (usage, budgets and invoices only), project maintainer, member and read-only access with least privilege. Removal revokes keys and linked service authority; service accounts have explicit project scopes. Owner transfer remains available without restricting the organization to one active contributor. Before project role doors ship, enforce project-maintainer authority for SDK-006 inbound filter and GROUP-001 grouping-policy management, replacing the current owner proxy without granting authority outside the member's project/team scope. Team roles preserve ALERT-004's accountable alternate operator, visible broken-destination and overdue follow-up and nonrecursive deduplication, and carry ALERT-003's team digests and team snooze: buyer-timezone daily/weekly error digests, required snooze expiry, one durable resumption notice, counted/listed suppressed alerts, and loss/backlog visible through maintenance and quiet hours.

**Acceptance.**
1. Two teammates and an external read-only collaborator are invited and hold access to disjoint projects.
2. Members triage concurrently.
3. Removal revokes the member's keys and linked service authority.

#### TEAM-002 — Accountable assignment and ownership rules

*Tier:* Core · *Rules:* D-4

**Requirement.** Assign issues to real members/teams, import GitHub/GitLab CODEOWNERS at the exact linked revision, and define service/path/environment fallback ownership. Preview precedence and unmatched cases, route notifications to the assigned team, and notify assignees of due or unowned work. Work is due when an assigned issue stays unacknowledged past the project's acknowledgment window (set by a maintainer, default 24 hours), when a snooze, suppression or resolve-in-next-release deadline expires, or when a linked delivery ticket's due date passes; unowned work is an issue with no assignee after the project's unowned window. A due notice goes to the assignee, then to the owning team and the ALERT-004 alternate if still unacknowledged. Assignment history survives member departure without conferring access. Rules can be tested and disabled by a maintainer.

**Acceptance.**
1. With a connected repository whose ownership rules overlap, matched and unmatched errors each get an accountable assignee and destination.
2. An assigned issue past its acknowledgment window sends one due notice to the assignee.
3. An unassigned issue past its unowned window sends one unowned notice to the team.
4. After the owner is removed, reassignment and assignment history stay inspectable without leaked access.

#### TEAM-003 — Collaborative lifecycle and bulk triage

*Tier:* Core · *Rules:* D-1, D-4

**Requirement.** Teams comment, mention, subscribe (delivery per TEAM-005) and inspect an issue activity timeline; bulk assign, acknowledge, resolve, merge or suppress a selected search result with a preview. Resolution may be plain (Resolve with no release: the next accepted event in any release, or with no release, regresses it, as in Sentry, under SDK-009), in the current release, in the next release, in a named release, or from a commit/PR citation (TEAM-004). The recurrence policy is stated in project settings, with this default: after a release resolution, a same-release repeat does not reopen the issue but is counted on it as "recurred in resolved release" and shown on its timeline; a maintainer can set the project to reopen same-release repeats instead, previewed and audited. Old-release repeats remain separately visible and cannot fabricate newer-release regression; an event with no release after a release resolution follows SDK-009. Suppression (archive) supports reason, forever, expiry/count/affected-user threshold, until escalating (unarchive when volume exceeds the issue's forecast from its own history, with the forecast shown) and snooze, with due follow-up and an audit trail. Every issue has a priority (high, medium or low), set automatically when it opens from its level and history (fatal and error high, warning medium, info and debug low; escalation or regression raises it) and editable by a member. A manual edit sticks against later automatic changes, appears with its actor in the timeline and is audited, and FIND-001 filters, ALERT-001 conditions and TEAM-005 settings can use it. Concurrent edits refuse stale decisions.

**Acceptance.**
1. Two members discuss searched issues (comment, mention and subscribe) and bulk-triage them after a preview.
2. Resolved for the next release, a same-release repeat is counted as recurred in resolved release without reopening, and reopens once the project policy is switched.
3. A new-release repeat regresses the issue, and an old-release repeat stays separately visible without regressing it.
4. A plain-resolved issue regresses on the next same-release event.
5. An expiring suppression, and an archived-until-escalating issue pushed past its shown forecast, each raise one accountable follow-up.
6. A stale concurrent decision is refused.
7. A new fatal error opens as high priority and a warning as medium.
8. A priority set to low by hand stays low after a later escalation, with its actor shown.

#### TEAM-004 — Issue short IDs and resolution from commits and pull requests

*Tier:* Core · *Rules:* D-6

**Requirement.** Every issue has a stable human-readable short ID per project (for example `CHECKOUT-1A3`), never reused or reassigned, shown in the UI, alerts, packets, exports and search; it survives merge as an alias of the surviving issue, split keeps the original's ID and gives the split-out issue the next number, guarded undo restores the recorded mapping, and an erased project's prefix stays retired. Lists, issue view, search, JSON/CSV exports, packets, the agent CLI/MCP, alert email and webhook bodies and digests carry it, and packets, issue links and citations accept any short ID or alias in any case. A commit message or a GitHub PR / GitLab MR title or description containing `Fixes`, `Resolves` or `Closes` followed by a short ID (case-insensitive) links that commit or PR to the issue as soon as Spool receives it, through the deploy-key release or deployment door or SRC-002's provider pushes, visible on the issue timeline; repeats are idempotent. When a release includes the commit, or the merged PR's merge commit, whether the release was registered through REL-001 or SRC-003, or auto-created under SDK-009 and given commits by a later registration or by SDK-009's commit-SHA association, the issue resolves in that release, under SDK-009's named resolution and the project's ordering rule (SDK-028), with commit, PR and author recorded, raising the issue revision so stale decisions are refused. A later occurrence in a newer release reopens it as a regression under ERR-006; an occurrence in an older release cannot. Commits arrive as a bare full SHA or with a message and author, the author kept as sent and the message scrubbed. Citations of unknown, other-project or inaccessible short IDs change nothing and appear in the owner's repository link log with the literal citation, SHA and reason (`unknown`, `other_project`, or `inaccessible` for imported history that a deploy key cannot change). An auto-created release named by a commit's full SHA includes that commit as soon as Spool holds it, so it resolves the cited issue when it orders before the release that delivers the commit; one that orders after it, as one created later always does, is associated with the commit while the earlier resolution and its older-release protection stand. Commit author and message are personal data shown on owner surfaces only; packets, the agent CLI/MCP, alert email/webhook bodies and exports add them only after the owner turns on the audited, revision-fenced per-project sharing choice (default off), and digests never carry them. A retention cutoff removes author and message from commits received before it and from the alert copies that carried them; project erasure removes every short ID, prefix, commit, link and log row; installation-owner erasure replaces the owner's whole-token identifiers in commit authors and messages; private archives carry all of it and restore inert, re-running no resolution and sending nothing. GitHub pull request and GitLab merge request citations, connected-repository full-SHA association and `sentry-cli releases set-commits` commits are inherited obligations of SRC-002 and SRC-003, which carry their real provider receipts; none is claimed here.

**Acceptance.**
1. A commit that cites an issue's short ID, registered in a release through the release API, links to the issue at once on its timeline.
2. The issue resolves in that release, with the commit and its author recorded.
3. A later occurrence of its fingerprint in a newer release reopens it as a regression.
4. An occurrence in an older release does not reopen it.
5. A citation of another project's short ID changes nothing and is logged with its reason.
6. With an auto-created release named by the commit's full SHA and no CI registration, the cited issue resolves in that release.

#### TEAM-005 — Per-member notification settings and issue subscriptions

*Tier:* Core · *Rules:* D-4

**Requirement.** Each member chooses, per project and per notification type, what reaches them and on which personal channel (email, Slack direct message, Microsoft Teams chat). The types are workflow (resolution, regression, assignment, comment, mention), issue alert, deploy and weekly report. A member is subscribed to an issue by being assigned directly or through a team, commenting, being mentioned, bookmarking it or pressing subscribe; the issue shows why, and an explicit unsubscribe overrides automatic subscription until the member subscribes again. Workflow notifications go to subscribers other than the actor. Deploy notifications go to members whose commits are in the release. The weekly report is opt-in per member. A member can opt out of a project's personal alert email without disabling the rule for others; only an admin can make a rule's delivery mandatory, and the member's settings show it. Every message carries a settings and one-click unsubscribe link that applies before the next message. ALERT-003's personal digests arrive with member notifications: each member's daily/weekly schedules, timezone, channel selection and unsubscribe controls preserve one digest per calendar period and loss/backlog reporting.

**Acceptance.**
1. Two members save different per-project and per-type settings.
2. An assignment, comment, mention, resolution, regression, issue alert, a deploy containing one member's commit and the weekly report each reach exactly the members and channels they chose.
3. Unsubscribing through a message link stops the next qualifying message to that member, while the other member is unaffected.

### Capture and release health

#### SDK-001 — Multi-language SDKs and DSN-compatible intake: browser JavaScript and Node.js

*Tier:* Core · *Rules:* D-5

**Requirement.** Developers capture automatic unhandled and manual exceptions using maintained Sentry SDKs. The SDK-001 runtimes are browser JavaScript, Node.js, Python, Go, Java/JVM, Ruby, PHP, .NET, iOS, Android, React Native, Flutter, Electron, Unity, Rust, Elixir and Kotlin Multiplatform. Any clause that says "SDK-001 runtimes" means this whole set. Existing standard Sentry SDK applications repoint their DSN without rewriting capture code. Every envelope item they send, not only errors, is accepted and routed to the clause that uses it as listed in SDK-007 (sessions, transactions and spans, profiles, replays, feedback, attachments, client reports, logs and metrics). Events with no `release`, an SDK-inferred release or a release CI never registered are accepted under SDK-009. SDK-007's versioned capability diagnostics identify each unsupported item type and loss until full support lands; unsupported behavior stays an engineering gap. This clause qualifies browser JavaScript and Node.js through the qualification run (D-5); SDK-012 to SDK-019 qualify the server runtimes, Electron, Unity, iOS, Android, React Native, Flutter and Kotlin Multiplatform, SDK-020 to SDK-024 carry guided setup, tunnels, the first-party ingest subdomain, the loader script and check-ins, and SDK-025 the persisted session, trace, replay, log, attachment and widget outcomes for every runtime.

**Acceptance.**
1. `@sentry/browser` passes Q1 to Q7 of the qualification run in Chromium at 1440 and 390, with the feedback widget and replay enabled.
2. Its build-plugin source maps resolve the original line.
3. `@sentry/node` passes Q1 to Q7 of the qualification run.
4. Unmodified Node intake with no release and with an inferred-SHA release is accepted, including a release-less alert.
5. Release-scoped figures count the no-release events.

#### SDK-002 — Native crashes and symbolication

*Tier:* Core · *Rules:* D-2 · *Register:* R-1

**Requirement.** Collect iOS/macOS native crashes, Android crashes and ANRs, hybrid React Native/Flutter failures, Electron/desktop native crashes as Crashpad/Breakpad minidumps, and their device/OS/app version context under privacy controls. CI uploads dSYM, ELF/native debug symbols, ProGuard/R8 mappings and Flutter split-debug information, at their real build sizes under SRC-004's published debug-file capacity (up to 2 GiB per file, no file count limit), through Spool's CLI or, unmodified, the Sentry Android Gradle plugin, the Xcode build-phase upload script, `fastlane-plugin-sentry`, `@sentry/react-native` and `sentry_dart_plugin` paths listed in SRC-003. Match UUID/build/architecture before symbolication, show original frames and inline context with explicit missing/mismatch diagnostics, and preserve offline crash delivery across app restart. ANR and app-hang events keep every thread's stack with its crashed/current flags and state (SDK-010). Minidumps, Apple crash reports, screenshots and view hierarchies are accepted up to SDK-011's published limits, never refused under a smaller request bound. Heavy symbolication runs in isolated bounded workers. Physical-device runs are register row R-1.

**Acceptance.**
1. Signed test iOS, Android, React Native and Flutter apps crash and hang on simulators and emulators, then relaunch offline and online.
2. Matching and mismatched symbols upload from CI through the unmodified Gradle plugin, Xcode build phase, Fastlane action and Dart plugin.
3. Each crash shows one deobfuscated issue without duplicate sessions, and the mismatched upload shows its explicit diagnostic.
4. An Electron app's crash minidump is symbolicated.
5. A 40 MiB dSYM and the next release's ProGuard mapping both symbolicate.

#### SDK-003 — Automatic breadcrumbs and private context

*Tier:* Core · *Rules:* D-1

**Requirement.** Opt into bounded console, network, DOM interaction, navigation and server-operation breadcrumbs with category switches, sampling, per-field allow/deny rules and client-side before-send hooks. Default SDK capture excludes secrets and request bodies; user identity follows SDK-008's per-field project identity policy, and adding approved request properties requires explicit project policy, preview and erasure coverage. Capture ordering and truncation are visible so investigation never implies a complete user history. Server-side rules also run on every item SDK-007 accepts from unmodified Sentry SDKs (message and `logentry` params, exception values, stack frame local variables and SDK-sent source context lines kept under SDK-010, thread stacks, tags, extra, contexts, breadcrumbs, request, user fields kept under SDK-008, span and log attributes, and attachment metadata) before storage, with no SDK redeploy. A rule's field selector can address any of these, including one frame variable by name or every frame variable (Sentry's `$frame.vars.<name>` and `$frame.vars.**`), a request header, an `extra` key, a context key, the exception value and the log entry, and MIG-001 imports Sentry advanced scrubbing rules with those selectors unchanged: a maintainer adds organization or project additional sensitive fields and safe fields, and custom rules that apply a built-in pattern (credit card, IP address, email, password, auth token, US Social Security number) or a custom regex to a field selector with remove, mask, hash or replace. Each rule is previewed against retained events, audited and applies to later intake only; organization rules apply to every project and cannot be weakened by a project. SDK-010 inherits project custom server scrubbing rules here: its opt-in request capture previews and scrubs cookies, bodies and environment before storage, and until that policy exists those fields are excluded with `request_policy_excluded` notes. Query strings retain diagnostic parameters after decoded secret-name masking and ERR-003 text scrubbing, with named trimming.

**Acceptance.**
1. Each instrumentation category toggles in browser and server setup.
2. A failure with secret-bearing URLs and forms shows its occurrence timeline with before-send filtering and visible truncation, and its stored and forwarded projections keep the secrets out.
3. An organization sensitive field, a project safe field and a custom regex mask rule are added in the app and previewed.
4. Canaries that an unmodified Sentry SDK event, span and log carry in tags, extra, contexts and message text are removed or masked in storage, issue views, packets and exports, while safe fields survive.
5. From an unmodified Python SDK with default `include_local_variables`, the frame locals `password` and `api_key` are masked by default.
6. A `$frame.vars.order_note` mask rule masks `order_note`, and the ordinary local survives in issue detail.

#### SDK-004 — User feedback attached to failures

*Tier:* Core · *Cites:* BASE-PUBLIC-001 · *Rules:* D-6

**Requirement.** An accessible, localizable feedback widget lets the affected user submit a description and optional contact/screenshot against an event or independently. It asks consent, strips sensitive metadata, supports attachment review and abuse controls, and connects duplicate reports to the issue without publishing identity. Submissions from the unmodified Sentry feedback widget, `captureFeedback`, the crash-report modal and legacy `user_report` items arrive through SDK-007 and get the same attachment, consent, abuse and erasure handling. The assigned team can reply through approved email with delivery state; withdrawal/erasure removes feedback and attachments across exports.

**Acceptance.**
1. An end user reports a browser or mobile failure with an optional screenshot and contact.
2. A teammate triages the report and replies through approved email, with its delivery state.
3. An anonymous abuse attempt is bounded.
4. Withdrawal removes the canaries from the issue, storage and export.
5. Feedback from an unmodified Sentry feedback widget, `captureFeedback` and a legacy `user_report` each attaches to its issue.
6. Spool's widget opened in Spanish shows Spanish visible labels and accessible names.

#### SDK-005 — Crash-free sessions and release health

*Tier:* Core · *Rules:* D-2

**Requirement.** Ingest sessions from unmodified Sentry SDK `session` and `sessions` items (SDK-007) and from Spool SDKs, including sessions whose release CI never registered, which auto-create it under SDK-009, honoring each SDK's session mode (per page load or navigation in the browser, per app start and foreground on mobile, request aggregates on servers) and status (ok, exited, errored, crashed, abnormal). Publish sessions, crash-free users/sessions (users counted from each session's `did` and the event user key under SDK-008's one definition), affected users, version adoption, crash/ANR rates and trends by environment, app version, device and OS, with explicit exposure denominators, sampling and capture loss. Define session boundaries; session identity follows SDK-008's project policy. Compare rollouts and rollbacks against comparable cohorts: a partly adopted release is compared with the previous release over the same window, environment, device and OS mix, with its adoption share and confidence shown, and a rollback shows the restored release's rates beside the rolled-back one's; healthy sessions must be observed rather than inferred from absent exceptions. Export reports with their denominator and uncertainty. SDK-009 session release identity is inherited here: sessions accept no release, auto-create and enrich a release/dist with first-seen environment and SDK metadata, and enforce the same optional strict ordering policy (SDK-028); release-scoped session figures exclude and count release-less sessions.

**Acceptance.**
1. Known healthy and crashing sessions across two app versions and devices, through unmodified Sentry browser, mobile and server SDKs with default release health and through Spool SDKs, with varied sampling and offline delivery, reconcile adoption and crash-free session and user rates against the sessions each SDK submitted, with visible gaps.
2. A new version rolled out to about 20% of devices with a higher crash rate shows both releases' crash-free session and user rates over the same window, with its adoption share and confidence.
3. After a rollback, the rolled-back release stops gaining sessions and the comparison shows the restored release's rates beside it.

#### SDK-006 — Ingest-time inbound filters and allowed domains

*Tier:* Core · *Cites:* BASE-PUBLIC-002 · *Rules:* D-4

**Requirement.** A project maintainer turns on server-side inbound filters in the app, with no SDK redeploy: browser-extension errors, legacy browsers (by named browser and version), localhost and loopback, known web crawlers (maintained user-agent list), React hydration errors, ChunkLoadError and failed dynamic imports, client IP addresses and CIDR ranges, error-message patterns, specific releases and environments, and allowed `Origin`/`Referer` domains (exact and `*.domain` wildcard) for browser DSNs. Filters run at intake, before grouping, alert evaluation and billable usage: a matching event creates no issue, occurrence, alert or billable unit and is counted per filter as `filtered` in BILL-001 usage. Each filter shows its recent match count and a preview against retained events before it is enabled; changes are audited and apply to later intake only. A browser event whose `Origin` or `Referer` is not an allowed domain is refused with an explicit status and no CORS grant, protecting a public browser DSN from abuse. New projects name their default-on filters at creation, and each can be turned off. Error-specific rules apply to errors only. Every accepted category checks Origin/Referer and available transport fields (trusted client IP, user agent/browser and localhost); feedback also checks supplied release/environment. Client reports lack error, release and environment fields: these are named unavailable, and a filtered report contributes no claimed SDK-discard quantities. Historical preview covers retained errors, naming non-retained IP and missing fields unavailable. Settings names each category's coverage. Every additional intake category applies the applicable filters before it ships (D-2), and BILL-001 carries these counters into commercial usage. Origin/Referer refusal counters count refused transport requests; item filters count matched category items. Neither counter is a claimed SDK-discard quantity.

**Acceptance.**
1. Each named filter is enabled in the app.
2. Matching events sent through an unmodified Sentry SDK and through native ingest create no issue, alert or billable usage.
3. They appear per filter as filtered in usage.
4. Non-matching events are accepted.
5. A browser event from a non-allowed `Origin` is refused without a CORS grant.
6. A browser event from a non-allowed `Referer` is refused without a CORS grant.
7. After a filter is disabled, later matching events are accepted.

#### SDK-007 — Sentry envelope item coverage from unmodified SDKs

*Tier:* Core · *Rules:* D-2

**Requirement.** When a team changes only the DSN, Spool accepts every item its unmodified Sentry SDKs send (browser/Next.js, Node, Python, iOS, Android, React Native and the other SDK-001 runtimes) at the `/envelope/` and legacy `/store/` endpoints and at Sentry's dedicated `/minidump/`, `/unreal/` and `/security/` endpoints, and routes each item type to the clause that uses it, as the table below lists. Diagnosed-unsupported: `statsd` and `metric_meta` (Sentry's superseded statsd-format metrics), the item types Sentry reserves and forbids SDKs to write in envelopes (`security`, `unreal_report`, `form_data`), and any unknown type. Neither these nor an accepted type whose target clause has not shipped are ever silently dropped: each is counted per item type and reason in project outcomes and in the capability diagnostics shown in setup and usage, with the SDK name and version that sent it. Every endpoint accepts the content encodings and item sizes SDK-011 publishes, and an item over its limit is refused alone under SDK-011 while the rest of the envelope is accepted. Every accepted type obeys SDK-006 filters and BILL-001 budgets per data category; only GOV-003's named volume reasons rate-limit an item, and limits return `X-Sentry-Rate-Limits` naming the limited category, so the SDK backs off only that category. MIG-001's dual run compares counts per item type.

| Item type | Routed to |
| --- | --- |
| `event` (errors and default events, including ANR and app-hang `threads`) | ERR-002 atomic acceptance, keeping and showing the whole event as SDK-010 lists it (every exception in the chain and exception groups, full frames with source context and local variables, tags, contexts, request, extra and message events), under SDK-009's release rules (accepted with no release, or with an unregistered release that is created automatically; ERR-001's registration precondition does not apply unless the project chose registered sequence only), SDK-001 and SDK-002; the event's `user` interface and the identity data `sendDefaultPii` adds pass through SDK-008's identity policy before storage. |
| `session` (per-session updates) and `sessions` (server-mode aggregates) | SDK-005 crash-free session and user rates, adoption and release health, with each session's `did` under SDK-008; an unregistered session release is created automatically under SDK-009, and a session with no release, which Sentry also refuses, is counted as invalid with that reason. |
| `transaction` and `span` (including standalone and v2 span items), with the envelope's dynamic sampling context | CTX-001: the trace waterfall beside every error that shares its `trace_id`, with sampled-out spans labeled. |
| `profile` and `profile_chunk` | CTX-001: the profile of the transaction or span that contains the error. |
| `replay_event`, `replay_recording` and `replay_video` | CTX-002, under its consent, masking, sampling, retention, role-scoped playback and erasure rules; server-side masking is reapplied to recording payloads. |
| `feedback` (Sentry feedback widget, `captureFeedback`, crash-report modal) and legacy `user_report` | SDK-004, attached to the associated event and issue or kept standalone. |
| `attachment` (`event.attachment` files including screenshots, `event.view_hierarchy`, `event.minidump`, `event.applecrashreport`, and Unreal context and log types) | API-001 storage and role-checked viewing, and SDK-002 native crash processing, under ERR-003/SDK-003 scrubbing and SDK-011's published per-item limits. |
| `client_report` (client-side discards by reason and data category) | BILL-001 client-discarded volume and the ERR-008/SDK-005 loss inputs. |
| `log` (Sentry Logs, `Sentry.logger` and console capture) | CTX-001 structured logs correlated to the error by trace and span. |
| `trace_metric` (Sentry's trace-connected metrics) | CTX-001 metric points on the trace beside the error. |
| `check_in` | SDK-024, forwarded to Uptime. |
| `/security/` CSP violation reports; `/minidump/` and `/unreal/` crash uploads | Issues grouped by directive and blocked URI, under SDK-006 filters; SDK-002 crash events. |

**Acceptance.** For the browser (Next.js), Node, Python, iOS, Android and React Native Sentry SDKs with only the DSN changed and sessions, tracing, profiling, logs, metrics, replay (browser and mobile), the feedback widget and screenshot and view-hierarchy attachments enabled:
1. With each SDK's default transport compression (the Python SDK with `brotli` installed), no envelope is refused for its encoding or size.
2. SDK-005 crash-free session and user rates reconcile with the sessions each SDK sent.
3. Each error's issue detail shows its full exception chain, tags and contexts, and its Sentry-SDK trace waterfall, profile, logs and replay at the error time.
4. Widget feedback attaches to the issue, and the screenshot opens for a permitted member and is refused for an unpermitted one.
5. Client-report discards appear in BILL-001 usage.
6. A CSP report and an Electron minidump each become an issue.
7. A `statsd` item and an unknown item type each appear in capability diagnostics with their count and no silent drop.
8. With a replay-category budget exhausted, `X-Sentry-Rate-Limits` names only that category while errors are still accepted.

#### SDK-008 — Sentry user identity policy and affected users

*Tier:* Core · *Rules:* D-1, D-4

**Requirement.** Each project has an identity policy for the `user` interface that unmodified Sentry SDKs send through `Sentry.setUser` and framework integrations: `id`, `email`, `username`, `ip_address` (with `{{auto}}` resolved at intake to the connecting client address, or to the client address forwarded by an SDK-021 tunnel the project trusts, never from an untrusted forwarded header), `name`, `geo`, `segment` and custom user data, each session's `did`, and the identity data `sendDefaultPii` adds (framework-populated user fields and the request's client address). For each field a maintainer chooses keep as sent, hash (a keyed per-project hash, so equal values still count and match as one user and the raw value is never stored; the key travels only inside the private ERR-009 archive) or drop (never stored, and `{{auto}}` never resolved). Project creation shows the policy and states its default: keep every field as sent, as Sentry does, except where an organization floor or a MIG-001-imported Sentry setting ("prevent storing of IP addresses", data scrubbing of user fields) requires hash or drop. Cookies, authorization headers and request bodies that `sendDefaultPii` adds stay under ERR-003 and SDK-003 scrubbing; keep never retains them. Every policy change is previewed against retained events (events, users and saved searches affected), audited under AUDIT-001 and applies to later intake; retained values can be converted only toward a stricter choice (keep to hash to drop), with a preview. Organization policy sets a floor that projects cannot weaken, and SDK-003 server-side rules run on kept values after the policy. A forwarded client address is trusted only once an installation explicitly configures and authenticates a trusted ingress or tunnel boundary: only that boundary may overwrite and validate the forwarded chain, only the resulting trustworthy client address populates `{{auto}}`, untrusted input is ignored, and the actual peer stays labelled as the proxy or peer, not the end user (RL-101). An event's user key is the first present of `user.id`, `user.email`, `user.username` and `user.ip_address` after the policy (a hashed value counts as itself; a dropped field is skipped), the same precedence as Sentry's `user` tag so MIG-001 counts reconcile; Spool SDK events use their random installation identifier (ERR-003). Every affected-user figure uses this one definition: the issue stream's Users column and sort, issue detail, FIND-003 reports and widgets, SDK-005 crash-free users, ALERT-001 user conditions, AI-004 cohorts and MIG-001 comparisons. Each figure also shows how many events had no user key; when no event in scope has one, it shows unavailable with the reason (the policy drops identity, or the SDK sent none), never 0. SDK-010 user identity and opt-in request capture inherit this policy: user id, email and IP for users affected, and request cookies, bodies and environment, remain subject to field policy and preview before capture; until SDK-003 and this policy apply, user is excluded with `identity_policy_unavailable` and those request fields with `request_policy_excluded`, and no identity capture is implied by event fidelity. SDK-026 carries user search and identity visibility, and SDK-027 end-user erasure.

**Acceptance.** With unmodified Sentry browser and Python SDKs and only the DSN changed, errors reach one issue from three identified users (`setUser` with id, with email only and with username only) and from two anonymous visitors whose browser SDK sends `ip_address: "{{auto}}"`:
1. Under keep, the issue stream's Users column and issue detail show 5 affected users, matching Sentry's count in the MIG-001 dual run.
2. Changing the policy to hash shows its preview and audit entry, and the counts stay 5.
3. Under hash, no raw email or IP exists in storage, issue views, packets, exports or the archive.
4. Under drop, no identity is stored and the Users column shows unavailable with its reason, never 0.
5. Project creation shows the policy and states its default.

#### SDK-026 — User search, facets and identity visibility

*Tier:* Core · *From:* SDK-008 · *Cites:* BASE-ROLE-001 · *Rules:* D-4

**Requirement.** FIND-001 accepts `user.id`, `user.email`, `user.username` and `user.ip` (exact values, and CIDR ranges for `user.ip`) as search keys and facets with counts. A hashed field matches only its hashed token, so a raw-value search finds nothing; a dropped field is unsearchable and the search says so. Raw identity values are visible, searchable and exportable only to roles the project grants identity access (owner, admin, maintainer and member by default); read-only collaborators and service grants see counts and hashed tokens unless granted. ERR-007 packets, AI-001 egress, alert and chat deliveries and ALERT-005 unfurls carry counts only, never raw identity.

**Acceptance.** With the five users of SDK-008's journey:
1. Under keep, `user.email:<one of them>` finds exactly that user's issues, and the user facet lists the five keys with counts.
2. A read-only collaborator sees the count but no values.
3. Under hash, a raw email search finds nothing.
4. A search on a dropped field says the field is unsearchable.
5. Packets, agent egress, alert and chat deliveries and unfurls carry counts only.

#### SDK-027 — End-user erasure

*Tier:* Core · *From:* SDK-008 · *Cites:* BASE-DATA-003 · *Rules:* D-1, D-4

**Requirement.** A maintainer enters one user's id, email, username or IP address, and a count-only preview lists the matching events, sessions, feedback, attachments, replays and search entries (a hashed field is matched by hashing the supplied value). On typed confirmation Spool removes that user's identity values from events, sessions, search indexes and facets, SDK-004 feedback contact, CTX-002 replays and attachment metadata, or deletes the user's events when the maintainer chooses. Later exports and archives omit the values, and the receipt has counts and times only. AUDIT-001 records the action without the value. The erasure joins the ERASE-001 journal and restore fence, so a restore reapplies it and an older archive that still holds the value is refused. It completes within 300 seconds in a project holding GOV-003's 150,000-event published volume.

**Acceptance.**
1. Erasing one user by email shows a count-only preview naming the matching records.
2. Afterwards the value is gone from search, facets, issue views, exports and the next archive.
3. The receipt and the audit carry no value.
4. Restoring an older archive that still holds the value is refused.
5. The erasure completes within 300 seconds in a project holding 150,000 events.

#### SDK-009 — Release identity from unmodified Sentry SDKs: no release, automatic releases and plain Resolve

*Tier:* Core · *Rules:* D-4

**Requirement.** In Sentry a `release` is optional and needs no registration first, so Spool accepts Sentry SDK events and sessions with the release identity unmodified SDKs send, on every SDK-001 runtime, without a CI step. An event with no `release` is accepted, grouped and stored with release shown as "none"; it counts in issue totals, the issue stream, FIND-001 search (`!has:release`), ALERT-001 conditions and FIND-003 dashboards, and is excluded only from release-scoped figures (release history, per-release counts, SDK-005 adoption and crash-free rates by release, REL-002 comparison), each of which names how many events had no release. The first event or session carrying a `release` (with or without `dist`) that the project has not seen creates that release, as Sentry does, whether the SDK took it from configuration, `SENTRY_RELEASE`, an inferred git commit SHA (Python, Node), the Apple default `CFBundleIdentifier@CFBundleShortVersionString+CFBundleVersion`, the Android, React Native or Flutter default `package@versionName+versionCode`, or a build plugin's injected value. An absent `dist` is its own identity and never means "latest", and absence and an explicit valid SDK dist value cannot collide. The release records its first-seen time, first environment and the SDK name and version that created it, and is labeled "auto-created" until CI registers commits, artifacts or a deploy for it. Later registration of the same name through REL-001, `sentry-cli releases new/set-commits/finalize/deploys` or a build plugin (SRC-003) enriches that release and removes the label; it never splits it or changes its first-seen time. A name Sentry's release naming rules refuse (empty, `.`, `..`, `latest`, containing a newline, tab, `/` or `\`, or over 200 characters) creates no release: the event is accepted with release "none" and an "invalid release name" processing note counted per reason. When the name is a full commit SHA that exists in a repository linked through SRC-002, the release is associated with that commit, so suspect commits and TEAM-004 resolution work without a CI step. Resolve with no release (plain Resolve), in the issue view, bulk triage (TEAM-003) and chat actions (ALERT-005), regresses the issue on the next accepted event in any release or with no release, as in Sentry, and fires the ALERT-001 regression condition once. Resolve in the current, next or a named release keeps ERR-006's older-release protection under the project's ordering rule (SDK-028): next freezes the latest release at resolution time and regresses strictly later, and named resolution regresses at the chosen existing release or later. An event with no release on an issue resolved in a release cannot be ordered, so it does not reopen the issue; it is counted on the issue as "seen with no release after resolve", shown on its timeline and offered as an ALERT-001 condition. Automatic creation obeys SDK-006 filters (including release patterns and allowed domains for browser DSNs) and BILL-001 key rate limits. A maintainer can limit automatic creation to release names matching a pattern; an event whose release falls outside it is accepted with release "none" and a counted reason, never refused. SDK-005 inherits sessions; SRC-003 sentry-cli and build-plugin enrichment; SRC-002 and TEAM-004 linked full-SHA association; ALERT-001 release-less conditions; SDK-001 and SDK-012 to SDK-019 unmodified runtime and device qualification (SDK-012 the Python journey, and SDK-015 to SDK-018 the Apple, Android, React Native and Flutter release identities); MIG-001 dual-run reconciliation, including the counts of strict-policy refusals; and ALERT-005 chat Resolve. Each inherits these sentences and their acceptance before shipping its capability.

**Acceptance.** With only the DSN changed:
1. Unmodified Node SDK errors with no release and with an inferred-SHA release are accepted and create issues and alerts.
2. The two releases appear as auto-created, with their first-seen time and creating SDK.
3. The release-less events count in issue totals and search, and release-scoped views name them as "no release".
4. A later native registration of one of those releases enriches the same release.
5. A plain-resolved issue that receives the same error in the same release is Regressed, and one regression alert fires.
6. An issue resolved in the next release across two auto-created semver releases (`app@1.2.0`, `app@1.10.0`) and two SHA releases regresses in the stated order, and an older-release event does not regress it.
7. A release-less event on that issue is counted on it without reopening it.
8. An event with an invalid release name is accepted as release "none", with its counted note.

#### SDK-028 — Release ordering rule

*Tier:* Core · *From:* SDK-009 · *Rules:* D-4

**Requirement.** Each project shows its release ordering rule in project settings. One transitive total order governs release lists and exports, resolve in the current or next release, TEAM-004 resolution, regression, `release:latest` and REL-002 comparison. Lists use ascending order (a descending view reverses that same order); "latest" is always its final release, never a separately guessed version or registered sequence. The default, first seen, orders all releases by first-seen time, with registration counting as seen when it precedes intake; equal first-seen times are broken by release name in UTF-8 byte order, and later enrichment never changes first-seen time. The optional semver rule puts every name that parses as a semantic version, including `package@1.2.3+45` and `1.2.3`, first, ranked by semver precedence (major, minor, patch and prerelease; build metadata does not affect precedence), with equal precedence broken by first-seen time and then release name in UTF-8 byte order; every non-semver name (SHA, date or free text) follows the semver releases, ordered by first-seen time and then release name in UTF-8 byte order, and a pair never switches comparison rules based on the other release's name. A maintainer can instead choose registered sequence only, the stricter rule Spool's native intake uses: order by registered sequence, and refuse a Sentry SDK event or session with no release, or with an unregistered release or `dist`, with its named reason (`missing_release_register_required` or `unregistered_release_or_build`) and a pointer to registration, each refusal counted under that reason in project outcomes, BILL-001 usage and the MIG-001 dual run. A rule change is previewed (which resolved issues' regression boundaries move), audited and applies to later events; the first-seen, semver and registered total orders share the same list, latest, preview, current-resolution and regression comparison.

**Acceptance.** With a mixed history first seen in this order: `1.2.0`, `abc123`, `1.10.0`, `1.2.0-rc.1`, `def456`:
1. Under the default first-seen order, every list and export returns that order, and latest is `def456`.
2. Under semver order, every list and export returns `1.2.0-rc.1`, `1.2.0`, `1.10.0`, `abc123`, `def456`, and latest is `def456`.
3. Repeated calls under each setting, and every permutation of the five releases, sort to the same result, and every comparison triple is transitive.
4. Equal first-seen timestamps, and semver names with equal precedence but different build metadata, prove the first-seen and byte-order tie breaks.
5. `release:latest`, release comparisons and regression use the chosen order.
6. Under registered sequence only, chosen with its preview, an unregistered release and a missing release are each refused with the named reason and counted in project outcomes and usage.

#### SDK-010 — Sentry event fidelity: exception chains, frames, local variables, tags, contexts and request

*Tier:* Core

**Requirement.** Every `event` that SDK-007 admits from an unmodified Sentry SDK (through `/envelope/` or `/store/`) keeps the data below, and issue detail, FIND-001 search, GROUP-001 grouping, SDK-003 scrubbing and API-001 export use it. Every admitted field in this list is retained at conversion, subject to the explicit capture-policy exclusions named on the event; any trimming is named on the event and counted in SDK-007 capability diagnostics, never silent; and an event is never refused because it has an exception chain, an exception group, frame variables, many frames or no stack trace. Every `exception.values` entry is kept in SDK order, each with its `type`, `value`, `module`, its own stack trace and its `mechanism` (`type`, `handled`, `synthetic`, `source`, `is_exception_group`, `exception_id`, `parent_id`), covering JavaScript and Next.js `error.cause` chains from the default LinkedErrors integration (five levels), Python `raise … from` and implicit `__context__` chains, Python 3.11+ `ExceptionGroup`/`BaseExceptionGroup` (including `asyncio.TaskGroup` failures) with every child, Java/Kotlin `Caused by` and suppressed exceptions, .NET `InnerException` and `AggregateException`, and Go wrapped errors; exception groups are accepted on every runtime. Issue detail shows each exception with its own frames, marks the root cause and shows exception-group children as a tree under "Related Exceptions", as Sentry does; the issue title follows Sentry's rule (the type and value of the exception Sentry would title the issue with); and FIND-001 searches every exception in the chain (`error.type`, `error.value`, `error.mechanism`, `error.handled`, `error.unhandled`). Each frame keeps `filename`, `abs_path`, `module`, `package`, `function`, `raw_function`, `symbol`, `lineno`, `colno`, `in_app`, `platform`, `pre_context`, `context_line`, `post_context`, `vars`, `instruction_addr`, `symbol_addr`, `image_addr`, `addr_mode` and `trust`, plus the event's `debug_meta` images for SDK-002 symbolication. Spool keeps up to 1,000 frames per stack trace, above every SDK-001 runtime's default capture; beyond that it removes middle frames, keeps the 500 innermost and 500 outermost, and shows "N frames omitted" in their place. Frame variables are kept as sent, within SDK-011's 1 MiB event item limit, to 10 levels of nesting and 16 KiB per value, and a deeper or longer value is cut with a visible mark; the SDK's own `_meta` trimming and filtering remarks are kept and shown. Issue detail shows each frame's SDK-sent source context lines (`pre_context`, `context_line`, `post_context`), labeled as sent by the SDK and kept distinct from ERR-005 mapped source and SRC-002 repository links, and the frame's local variables, expandable by key; a frame whose variables set `__traceback_hide__` to true is hidden from the view and from grouping (GROUP-001). A raw stack trace view shows the whole chain as text in the runtime's own format (Python traceback, JavaScript `Error.stack`, Java `Caused by`), minified or original, with one-click copy, showing only what the viewer's role and the scrubbers allow. Spool keeps `level`, `logger`, `transaction`, `server_name`, `environment`, `dist`, `platform`, `modules` and `fingerprint`; `sdk` (name, version, integrations and packages); `message` and `logentry` (`message`, `params`, `formatted`); `tags`, both SDK automatic tags and custom `setTag` values; `contexts` (browser, os, device, runtime, app, gpu, culture, cloud_resource, trace, response, state, feature flags and custom contexts); `request` (`url`, `method`, `query_string` after ERR-003 query scrubbing, and `headers`, `env`, `cookies` and `data` under SDK-003 rules and SDK-008); `extra`; `threads`, with each thread's stack, `crashed`/`current` flags and state; and every breadcrumb the SDK sends (its default 100), each with type, category, level, timestamp, message and data. Spool derives Sentry's event tags: `level`, `handled`, `mechanism`, `environment`, `release`, `dist`, `transaction`, `url`, `server_name`, `browser`, `browser.name`, `os`, `os.name`, `device`, `device.family`, `runtime`, `runtime.name` and `user` (SDK-008). Each event shows its tags, contexts, request and extra as structured sections, every tag is a FIND-001 search key and facet, and issue detail shows a per-issue tag summary that lists each tag key's top values, with counts and percentages over all the issue's events and an "other" bucket. A `captureMessage` event, or any event with no exception and no stack trace, is accepted as an issue with its level and tags, grouped by its message template (`logentry.message` before parameters, otherwise `message`); a stack trace sent by `attachStacktrace` is shown and used for grouping. GROUP-001 groups over the whole exception chain and exception group. SDK-003 server rules, ERR-003 scrubbers and default secret-name masking run on every kept field, including frame variables, context lines, exception values, request, contexts, extra and thread stacks, before storage. ERR-007 packets gain the chain, frame identities, tags and contexts within their 256 KiB bound and named truncation. SDK-sent context lines and frame variables reach agents or model providers only through AI-001's previewed field selection. User identity, request cookies, bodies and environment are captured only under SDK-008's identity policy and SDK-003's opt-in field policies with previews, and until those apply each is excluded with a named processing note; query strings are retained after decoded secret-name masking and ERR-003 scrubbing, bounded to 16 KiB with a named trimming note. SDK-003 inherits custom server rules, AI-001 previewed agent field selection, SDK-011 transport and item limits, SDK-012 the full unmodified Python and Java default-integration journey, and ERR-005 and SRC-004 the wider map projection; each keeps its own status and acceptance.

**Acceptance.** Through admitted envelopes, with unmodified Node and browser intake:
1. A Python `raise ValueError(...) from KeyError(...)` shows both exceptions in issue detail with their own frames, SDK-sent source context lines and local variables.
2. Its `password` local is masked in storage, issue views, packets and exports, while the ordinary local survives.
3. The same wrapper exception with two different root causes makes two issues and two ALERT-001 new-issue alerts.
4. A Python `ExceptionGroup` with two children and an `asyncio.TaskGroup` failure are each accepted with their children under Related Exceptions, and a Node error with `cause`, a Next.js server error wrapped with `cause` and a Java `Caused by` chain are each shown with the root cause marked.
5. A browser event with `setTag("tenant","acme")` and the SDK's browser and os contexts shows those tags and contexts; the issue's tag summary shows `tenant`, `browser.name` and `os.name` with counts and percentages, and `tenant:acme browser.name:Chrome` finds the issue.
6. A Django error's request shows its URL, method and allowed headers, while the cookie and authorization headers are scrubbed.
7. A bare `captureMessage("quota exceeded for %s", ...)` is accepted as an issue grouped by the template.
8. A 1,200-frame recursion keeps 1,000 frames with "200 frames omitted" shown, and the copied raw stack trace of the Python chain shows both tracebacks with no masked value revealed.

#### SDK-011 — Sentry intake encodings, published size limits and per-item refusal

*Tier:* Core

**Requirement.** Everything an unmodified Sentry SDK sends with its default transport gets through Spool's intake door: SDK-007's `/envelope/`, `/store/`, `/minidump/`, `/unreal/` and `/security/` endpoints, the SDK-021 tunnel handlers and the SDK-022 first-party ingest subdomain. Request bodies are accepted uncompressed or with `Content-Encoding` `gzip`, `deflate`, `br` (Brotli) or `zstd`, and with or without a `Content-Length` (chunked transfer), including the Python SDK, which uses Brotli whenever the `brotli` module is installed. Decompression is streamed and stops at the limits below, so a decompression bomb is refused as too large without exhausting memory, and an encoding outside this list is refused with 415 naming the encoding, counted. Setup, documentation and capability diagnostics publish these limits, each at least equal to Sentry's documented ingest limits: 40 MiB for a compressed request; 200 MiB for an envelope after decompression, including all items; 1 MiB for each event (error or transaction), span, log or metric item; 100 KiB for a check-in item; 4 KiB for a client report item; 50 MiB for a profile item; 10 MiB for a compressed replay item and 100 MiB after decompression; 200 MiB of uncompressed attachments per event, covering attachments, screenshots, view hierarchies, minidumps, Apple crash reports and Unreal crash files, including through `/minidump/` and `/unreal/`; and 100 sessions per envelope and 100 session aggregate buckets per `sessions` item. A maintainer can lower a project's limits, with a preview of affected recent traffic, but cannot raise them above the published figures. Attachment, minidump, profile and replay items stream to the isolated storage named in the boundaries and are never held whole in request memory. An item over its limit, or an item that fails to parse, is refused alone with its reason (`item_too_large` or `invalid_item`, with the item type), and the rest of the envelope is accepted; the response and a `client_report`-compatible outcome name the refused item, and only a request over the compressed-request or decompressed-envelope limit is refused whole, with 413 and the limit named. Each refusal, whether an unsupported encoding, an oversized request, an oversized item or an invalid item, is counted per item type, reason, SDK name and version in project outcomes, SDK-007 capability diagnostics, BILL-001 usage and the MIG-001 dual run, and none of them consumes billable quota. SDK-010 inherits these published event-item and transport limits; retaining an admitted event at conversion never stands in for them.

**Acceptance.** With only the DSN changed:
1. Errors from an unmodified Python SDK with `brotli` installed create the issue.
2. `deflate`, `zstd`, `gzip`, uncompressed and chunked-transfer envelopes are each accepted, and an unsupported encoding gets a counted 415 that names it.
3. A 900 KiB error event is accepted.
4. An iOS and an Android crash with `attachScreenshot` and a 2 MiB view hierarchy, an Electron crash with a 5 MiB minidump through `/minidump/`, and a mobile replay segment near the 10 MiB compressed limit are each stored and viewable by a permitted member.
5. In one envelope holding a 1.5 MiB event item and a valid error, the error is accepted and the oversized item is refused alone with `item_too_large`, counted in project outcomes, capability diagnostics, BILL-001 usage (no quota consumed) and the MIG-001 dual run.
6. A small compressed body that expands past 200 MiB gets a 413 naming the limit, with no memory exhaustion and nothing stored.
7. With one project's attachment limit lowered after its preview, a larger screenshot is refused alone and counted.

#### SDK-012 — Unmodified server-runtime SDKs: Python, Go, Java/JVM, Ruby, PHP, .NET, Rust and Elixir

*Tier:* Core · *Rules:* D-5

**Requirement.** Each server runtime passes the SDK-001 qualification run (D-5) in one push Verify job per runtime with its toolchain. It also carries the runtime journeys SDK-009 and SDK-010 hand down: unmodified Python no-release and inferred-SHA intake, the unmodified Python SDK's default-integration event fidelity, and unmodified Java chains. Persisted session, trace, log and attachment outcomes belong to SDK-025, check-ins to SDK-024, and the Rust SDK's native-style frames without file and line to SDK-002.

**Acceptance.**
1. Python, Go, Java/JVM, Ruby, PHP, .NET, Rust and Elixir each pass Q1 to Q7 of the qualification run.
2. Unmodified Python intake with no release and with an inferred-SHA release is accepted, with a release-less alert and release-scoped no-release counts.
3. The unmodified Python SDK with default integrations keeps a `raise … from` chain.
4. It keeps an `ExceptionGroup`.
5. It keeps default `include_local_variables` frame locals.
6. It keeps the SDK context.
7. It keeps Django request data over a real request.
8. Unmodified Java `Caused by` and suppressed chains are kept.

#### SDK-013 — Unmodified Electron SDK

*Tier:* Core · *Rules:* D-5

**Requirement.** Errors in the `@sentry/electron` main and renderer processes pass the qualification run (D-5) in a packaged app run under a virtual display in a push or scheduled job. Native minidumps and offline native recovery remain SDK-002 and SDK-011, and persisted telemetry SDK-025.

**Acceptance.** In one packaged app under a virtual display:
1. Errors in the main process pass Q1 to Q7.
2. Errors in the renderer process pass Q1 to Q7.

#### SDK-014 — Unmodified Unity SDK

*Tier:* Core · *Rules:* D-5

**Requirement.** A Unity player build with the Sentry Unity SDK passes the qualification run (D-5). The CI job needs an activated Unity license; obtaining one is engineering work recorded here, not a waiver.

**Acceptance.**
1. A Unity player build with the Sentry Unity SDK passes Q1 to Q7.

#### SDK-015 — Unmodified iOS (Apple) SDK

*Tier:* Core · *Rules:* D-5

**Requirement.** A `sentry-cocoa` test app passes the qualification run (D-5) on an iOS simulator or device in a named macOS job, with mobile replay, feedback and screenshot or view-hierarchy attachments, and a crash sent on the next launch. SDK-009 is inherited: the default `CFBundleIdentifier@CFBundleShortVersionString+CFBundleVersion` release is auto-created, with release-less alerts and release-scoped no-release counts. Real-device crash and symbol pipelines stay with SDK-002.

**Acceptance.**
1. A `sentry-cocoa` test app passes Q1 to Q7 on an iOS simulator or device in a named macOS job, with mobile replay, feedback and screenshot or view-hierarchy attachments.
2. A crash is sent on the next launch (Q3).
3. The default `CFBundleIdentifier@CFBundleShortVersionString+CFBundleVersion` release is auto-created, with release-less alerts and release-scoped no-release counts.

#### SDK-016 — Unmodified Android SDK

*Tier:* Core · *Rules:* D-5

**Requirement.** A `sentry-android` test app passes the qualification run (D-5) on an emulator or device in a named job, with mobile replay, feedback and attachments. SDK-009 is inherited: the default `package@versionName+versionCode` release is auto-created, with release-less alerts and release-scoped no-release counts.

**Acceptance.**
1. A `sentry-android` test app passes Q1 to Q7 on an emulator or device in a named job, with mobile replay, feedback and attachments.
2. The default `package@versionName+versionCode` release is auto-created, with release-less alerts and release-scoped no-release counts.

#### SDK-017 — Unmodified React Native SDK

*Tier:* Core · *Rules:* D-5

**Requirement.** A `@sentry/react-native` app passes the qualification run (D-5) on both iOS and Android, for JS-layer and native-layer errors. SDK-009 is inherited: the React Native default release identity, with release-less alerts and release-scoped no-release counts.

**Acceptance.**
1. A `@sentry/react-native` app passes Q1 to Q7 on iOS and on Android, for JS-layer and native-layer errors.
2. The React Native default release identity is auto-created, with release-less alerts and release-scoped no-release counts.

#### SDK-018 — Unmodified Flutter SDK

*Tier:* Core · *Rules:* D-5

**Requirement.** A `sentry_flutter` app passes the qualification run (D-5) on both iOS and Android, for Dart and platform errors. SDK-009 is inherited: the Flutter default release identity, with release-less alerts and release-scoped no-release counts.

**Acceptance.**
1. A `sentry_flutter` app passes Q1 to Q7 on iOS and on Android, for Dart and platform errors.
2. The Flutter default release identity is auto-created, with release-less alerts and release-scoped no-release counts.

#### SDK-019 — Unmodified Kotlin Multiplatform SDK

*Tier:* Core · *Rules:* D-5

**Requirement.** A shared module using `sentry-kotlin-multiplatform` passes the qualification run (D-5) from its JVM/Android and iOS targets.

**Acceptance.**
1. A shared module using `sentry-kotlin-multiplatform` passes Q1 to Q7 from its JVM/Android target and from its iOS target.

#### SDK-020 — Guided setup command and published framework setup

*Tier:* Core

**Requirement.** A guided setup command, comparable to the Sentry setup wizard, detects the framework, installs the SDK, writes the DSN, release and source-map configuration as a reviewable diff, sends a test event, and writes nothing when it refuses. Spool publishes framework setup for React/Next.js, Express, Django/FastAPI, Spring, Rails, Laravel and ASP.NET Core. Setup names Sentry's `tunnelRoute` limitation and its replacement (SDK-021). Source-map configuration is a JavaScript-framework step: Python frameworks have no source maps to configure, and Django setup says so.

**Acceptance.**
1. G1: run on a fresh Next.js app and on a fresh Django app, the applied change equals the reviewed diff.
2. G2: for the Next.js app, the source-map configuration is written and maps a real error.
3. G3: the test event is accepted, and only Spool's receipt counts it.
4. G4: a bad DSN or an unsafe path writes nothing.
5. G5: the seven framework guides are published.

#### SDK-021 — Tunnel handlers and ad-blocker delivery

*Tier:* Core

**Requirement.** Sentry's Next.js `tunnelRoute` rewrite only targets Sentry's hosted ingest, so Spool ships two handlers for the SDK's standard `tunnel` option: a drop-in Next.js tunnel route handler and a generic server tunnel handler (Node and Python). Both check the envelope's DSN header against the project and forward the client address for SDK-008. Under SDK-008's client-address rule (RL-101), Spool uses a tunnel's forwarded client address only once the installation has configured and authenticated that tunnel as a trusted boundary; otherwise the forwarded address is ignored and the event carries the tunnel server's address, labelled as the peer.

**Acceptance.**
1. With a standard ad-blocker list enabled in a browser, a Next.js app deployed with `tunnelRoute` shows the named limitation in setup.
2. Deployed with the Spool tunnel handler, every browser error arrives through the handler.
3. Those errors reconcile in the MIG-001 dual run.
4. A client address forwarded by an untrusted tunnel is ignored and the event carries the tunnel server's address as the peer, while a configured, authenticated trusted tunnel's forwarded address populates `{{auto}}` (RL-101).

#### SDK-022 — First-party ingest subdomain

*Tier:* Core

**Requirement.** Spool serves project ingest on a buyer-owned first-party subdomain (CNAME with managed TLS) that the DSN names. The hosted deployment and the DNS zone are engineering work recorded here.

**Acceptance.**
1. With the subdomain DSN, the SDK-021 ad-blocker deployment delivers every browser error.
2. Those errors reconcile in the MIG-001 dual run.

#### SDK-023 — JavaScript Loader Script per DSN key

*Tier:* Core

**Requirement.** Sites that embed Sentry's Loader Script (`js.sentry-cdn.com/<key>.min.js`) get a Spool loader script per DSN client key, served from Spool or the SDK-022 subdomain. Its SDK version and its tracing, replay and feedback options are set in the key's settings, and lazy loading and `Sentry.onLoad`/`sentryOnLoad` behave as before. MIG-001 carries the real-organization loader-key inventory and replacement listing (RL-1). SDK-009 is inherited: loader events without a release are accepted and counted, and explicit release/dist identity and grouping match the directly bundled browser SDK.

**Acceptance.** With a site's Sentry loader tag replaced by the Spool loader, configured with the same key settings:
1. The SDK loads lazily.
2. `Sentry.onLoad` runs as before.
3. An error is captured.
4. Loader events without a release are accepted and counted.
5. Explicit release/dist identity and grouping match the directly bundled browser SDK.

#### SDK-024 — Cron check-ins routed to Uptime

*Tier:* Core · *Rules:* D-6

**Requirement.** Spool accepts Sentry SDK check-in envelopes (`capture_checkin`, `@monitor`, `Sentry.withMonitor`) at the DSN and forwards them to the buyer's connected Uptime heartbeat, linking the job's errors to it. Without a connection they are counted as unrouted in capability diagnostics, never silently dropped. Scheduled-job and heartbeat monitoring stays Uptime's product.

**Acceptance.**
1. A check-in with a connected Uptime heartbeat is forwarded to it, linking the job's errors.
2. A check-in without a connection is counted as unrouted in capability diagnostics, never silently dropped.

#### SDK-025 — Persisted non-error outcomes for every SDK-001 runtime

*Tier:* Core · *Rules:* D-5

**Requirement.** For each runtime, the session, trace, replay, log, attachment and feedback-widget items from its qualification run are persisted and reconciled through the public UI and API, in the clauses that own them (SDK-004, SDK-005, SDK-007, CTX-001, CTX-002, API-001).

**Acceptance.**
1. As each owning clause ships storage, every runtime family's rerun qualification run reconciles the persisted issue, release, session, trace, replay, feedback, attachment and discard outcomes.

### Investigation and source

#### GROUP-001 — Explainable grouping and durable corrections

*Tier:* Core · *Rules:* D-4

**Requirement.** Group occurrences stably across builds and runtimes, explain the fingerprint/rule version, support SDK fingerprints and project grouping rules, and preview future rule effects against retained events. Bulk split/merge corrections preserve original grouping, alert/repair coverage and undo provenance. New intake follows the chosen versioned rule; historical regrouping is explicit and cannot erase previous failure evidence. Stack trace rules honor the per-frame `in_app` flag and the in-app include/exclude options that unmodified Sentry SDKs send, and let a maintainer mark frames in-app or not in-app (`+app`/`-app`) and include or exclude them from grouping (`+group`/`-group`) by path, module, package, function and platform family (Sentry's `stack.abs_path`, `stack.module`, `stack.package`, `stack.function` and `family` matchers), previewed against retained events and applied to later intake. The issue view collapses frames that are not in-app, and grouping uses in-app frames when any exist; MIG-001 imports Sentry stack trace and fingerprint rules. The default rule groups over the whole exception chain SDK-010 keeps, processing each exception in turn as Sentry's default does, so the same wrapper exception with different root causes makes different issues. An exception group is grouped by its top-level exception and its children. Frames hidden by `__traceback_hide__` are left out of grouping. A message event with no stack groups by its message template. Fingerprint rules can match any exception in the chain (`error.type`, `error.value`), the message, the level, the logger, tags and SDK name, as Sentry's fingerprint matchers do. Each event has a grouping information view showing the rule version, the variant used (exception chain, stack, message or custom fingerprint) and, per exception, which frames and values contributed to the hash and which did not, with the reason (not in-app, hidden by a `-group` rule, or `__traceback_hide__`). Native JavaScript, Python and Go accept opt-in versioned path/function/family stack rules and type/message/family fingerprint rules; absent native module/package/tag/SDK fields are named unavailable, and without a matching rule their native v1 identities remain unchanged. Historical regrouping means an explicit selected-occurrence correction with preview, version, audit, immutable original membership and guarded undo; rule activation applies forward only, and explicit split/merge corrections never automatically become future rules. Policy changes retain repair coverage gaps and never replay alerts or alter loss counters. MIG-001 imports and previews grouping rules before migration completion.

**Acceptance.**
1. Equivalent failures captured across builds group together, and distinct failures stay apart.
2. A custom rule is previewed against retained events and applies to future events and to explicitly selected historical events.
3. After a correction is undone, alert rates, immutable originals and repair gaps stay inspectable.
4. A previewed `stack.module:vendor.* -app` rule and a `-group` rule make later events collapse those frames in the issue view and group by the remaining in-app frames.
5. A frame that an unmodified Sentry SDK sends with `in_app: false` is collapsed.
6. One wrapper exception with two different root causes makes two issues, and each event's grouping information view names the chain variant and marks the contributing and non-contributing frames with reasons.
7. Later events follow a fingerprint rule on `error.type` of the inner exception.
8. A Python frame with `__traceback_hide__` set is hidden and excluded from the hash.

#### FIND-001 — Search, facets and saved investigation views

*Tier:* Core · *Rules:* D-4

**Requirement.** Search the entire authorized retained corpus by time window, message, stack/function, project/team, environment, release (including `release:latest` under the project's SDK-028 ordering rule and `!has:release` for events sent with no release), severity, priority (TEAM-003), status, owner, every tag SDK-010 keeps or derives (SDK automatic tags such as `browser.name`, `os.name`, `device.family`, `runtime.name`, `url`, `transaction`, `server_name`, `handled`, `mechanism` and `level`, and every custom `setTag` key), any exception in the chain (`error.type`, `error.value`, `error.handled`), the `user.id`, `user.email`, `user.username` and `user.ip` keys under SDK-008's identity policy and SDK-026's role scope, and approved event properties. The issue stream shows and sorts by affected users (SDK-008) and by priority. Facets, counts, ordering and cursor pagination reflect the full query. A For Review inbox per project and team lists new, regressed and escalating issues that no member has reviewed yet, with a count; a member marks one or many reviewed, and it leaves the inbox for everyone with an audited actor. Save/share views and deep links without conferring access; exports use the same query and report bounds or refusals rather than silently truncating.

**Acceptance.**
1. With more than the list limit ingested across projects and releases, an older off-page event is found with combined filters, and query counts reconcile with the export.
2. Marking an issue reviewed in the For Review inbox removes it from the inbox for a teammate, with an audited actor.
3. A saved view opens for a permitted teammate and confers no access on a forbidden one.
4. `user.email:<a customer's address>` finds exactly that user's issues with user-facet counts, and a read-only collaborator searching the same sees the values hidden.
5. The stream filters and sorts by priority and by affected users.
6. Over events sent by unmodified Sentry SDKs, `tenant:acme browser.name:Chrome` and `error.type:KeyError` find the matching issues and facet counts, including an issue whose `KeyError` is the inner cause of a wrapper exception.

#### FIND-002 — Issue impact, detail and event navigation

*Tier:* Core

**Requirement.** Issue detail shows every exception in the chain with its own frames and exception-group children under Related Exceptions (SDK-010). It shows the SDK-sent source context lines and local variables of each frame, labeled apart from ERR-005 mapped source and SRC-002 repository links, and the event's tags, contexts, request, extra, threads and breadcrumbs. It has a per-issue tag summary (top values per key, with counts and percentages over all events in the issue) and a raw stack trace view with copy. An All Events list shows every retained event in the issue, filtered by any FIND-001 query (tags, release, environment, user), with oldest, latest, recommended (the most complete recent event), previous and next event navigation; the detail view follows the event chosen. It also shows first/last occurrence, occurrence totals, distinct affected users (SDK-008's one definition, with the count of events that had no user key) and sessions, rate and release history. Release-scoped figures (release history, per-release counts, SDK-005 adoption and crash-free rates by release, REL-002 comparison) exclude events sent with no release and name how many there were (SDK-009); every other figure counts them. FIND-003 carries dashboards and team reports.

**Acceptance.**
1. A multi-release issue over a known event and session set that includes events sent with no release counts them in its totals, while its release-scoped figures exclude and name them.
2. Its totals and affected counts reconcile with the known set.
3. An issue from an unmodified Python SDK chained exception shows the chain, context lines, local variables, tags, contexts, request and tag summary matching the events sent.
4. Its raw stack trace copies.
5. Its All Events list, filtered by `tenant:acme`, steps from the oldest to the latest event, and the detail follows each chosen event.

#### FIND-003 — Trends, dashboards and team reports

*Tier:* Core · *From:* FIND-002 · *Rules:* D-1, D-4, D-6

**Requirement.** Dashboards report error volume, new/regressed/resolved backlog, time to acknowledge/repair, team ownership and release stability with transparent time zones, sampling, retention and dropped-event denominators. Custom dashboards hold widgets that run FIND-001 queries (count, rate, affected users or sessions, grouped by any approved field), and a free-form event query table saves and shares queries. Share permissioned reports and export CSV/JSON.

**Acceptance.** Over a known event and session set that includes events sent with no release:
1. A team report reconciles totals, affected counts and triage durations.
2. The report compares time zones.
3. A custom widget and a saved event query match the same totals.
4. A read-only export omits inaccessible projects.

#### SRC-001 — Build artifacts and CI pipelines

*Tier:* Core

**Requirement.** Automate exact-release/debug-ID artifact publication from Vite, webpack, Rollup and esbuild builds in GitHub Actions and GitLab CI, through Spool's own CLI and plugins and through the unmodified sentry-cli subcommands and Sentry build plugins enumerated in SRC-003. Verify upload checksums, required artifact sets, access and retention before deployment; expose incomplete builds and support safe late artifacts. Source bundles and native symbols are private, separately authorized and portable, with the capacity, map formats, retention and per-file failure reporting SRC-004 publishes; a build's full artifact set is stored for every release.

**Acceptance.**
1. Equivalent minified apps built with each named bundler upload from GitHub Actions and GitLab CI with Spool's CLI and with each SRC-003 path, using deploy-only authority.
2. A real failure from each shows mapped frames.
3. Reads and writes outside artifact scope are denied.
4. A failed or incomplete upload is shown.
5. A second and third release of the same build each have every map stored and used.

#### SRC-002 — GitHub, GitLab and Bitbucket source context

*Tier:* Core · *Rules:* D-1 · *Register:* R-10

**Requirement.** Connect GitHub, GitLab and Bitbucket with explicit repository grants. Link stack frames to exact revision/file/line, ingest releases and included commits, read CODEOWNERS, and show suspect commits with reasons and uncertainty. When an issue first appears in a release that includes a PR/MR, Spool comments once on that PR/MR with the issue link, short ID and suspect reason. Frame paths map to repository paths through per-repository code mappings (a stack root such as `webpack://_N_E/./src/`, `app:///` or `/app/` to a source root and branch), derived automatically from in-app frames that match repository files and editable by maintainers; MIG-001 imports Sentry's code mappings, and an unmapped frame says so rather than linking a guessed path. Handle renames, monorepos and revoked/private repositories without leaking source. GitHub App and GitLab application setup, credential rotation, webhook signature verification and read-back reconciliation are part of delivery. Connected included-commit read-back for REL-001 belongs here; caller-recorded SHAs never claim repository ancestry. SDK-009's full-commit-SHA association is inherited here: an automatically created release whose full SHA exists in a linked repository is associated with that commit without CI registration, enabling suspect commits and TEAM-004 resolution. TEAM-004's provider citations are inherited here: GitHub pull request and GitLab merge request title and description citations, the merged pull request's merge commit as the resolving commit, the pull request recorded on resolution, and connected-repository full-SHA association each pass through TEAM-004's citation parser, repository link log and resolution before SRC-002 ships them, and their real provider receipts are register row R-10.

**Acceptance.**
1. A private repository on each host is connected with an explicit grant.
2. A deployed commit that changes the failing frame shows its source link and suspect explanation.
3. The introducing PR or MR gets exactly one comment.
4. A revoked grant is denied at once, with no stale privileged read.
5. A derived code mapping links a `webpack://` Next.js frame, and an edited mapping links a Django `/app/` frame, to the right file and line.
6. An unmapped frame says it is unmapped.
7. A cited pull request or merge request, a merged pull request's merge commit and a connected full-SHA release each pass TEAM-004's parser, link log and resolution.

#### SRC-003 — sentry-cli and Sentry build-plugin compatibility

*Tier:* Core · *Rules:* D-1

**Requirement.** A team's existing CI keeps working against Spool when only the Sentry URL, organization/project slugs and auth token change. Compatible sentry-cli subcommands: `releases new`, `releases set-commits` (`--auto` and explicit `--commit`), `releases finalize`, `releases deploys new`, `deploys new`, `sourcemaps inject`, `sourcemaps upload` (debug-ID and release/dist), `debug-files upload` (dSYM, ELF/DWARF, Breakpad, ProGuard/R8 mappings and Dart symbols), `debug-files bundle-sources` and `send-event`. Compatible build integrations: `@sentry/webpack-plugin`, `@sentry/vite-plugin`, `@sentry/rollup-plugin`, `@sentry/esbuild-plugin`, `@sentry/nextjs` `withSentryConfig` source-map upload, the Sentry Android Gradle plugin, the Sentry Xcode build-phase upload script, `fastlane-plugin-sentry` (`sentry_create_release`, `sentry_upload_sourcemap`, `sentry_debug_files_upload`, `sentry_finalize_release`, `sentry_create_deploy`), `@sentry/react-native` bundle and Hermes source-map upload (including Expo) and `sentry_dart_plugin`. Spool serves the Sentry API endpoints these clients call (chunk upload and assemble, release, commit, deploy and debug-file routes) under deploy-only project authority with the ERR-005 and SDK-002 identity checks and SRC-004's published capacity: the chunk-upload options these clients read advertise sizes that fit a production build, every map and debug file each release emits is stored, and a failed file is named with its reason in the client's output. An unsupported flag or endpoint fails with an explicit error naming the command, never a silent success. Unmodified CLI/plugin release creation, commit registration, finalization and deploy enrichment for REL-001 belong here, preserving the same release identity and first-seen time. SDK-009 release registration is inherited here: unmodified `sentry-cli releases new/set-commits/finalize/deploys` and Sentry build plugins enrich the existing auto-created release without changing first-seen identity. TEAM-004 commit citations are inherited here: commits that unmodified `sentry-cli releases set-commits` registers (`--auto` and `--commit`) pass through TEAM-004's citation parser, repository link log and resolution, and their real `sentry-cli` receipts are proved here.

**Acceptance.**
1. In GitHub Actions and GitLab CI, each listed sentry-cli subcommand and each listed bundler, Next.js, Gradle, Xcode, Fastlane, React Native and Dart integration runs unmodified except for URL, slugs and token.
2. A real failure from each built app shows its registered release, commits, deploy, maps and symbols, with original frames.
3. Next.js and React Native uploads for three consecutive releases of a production-sized build are never refused for artifact count or for a map within SRC-004's size limit.
4. An unsupported flag fails with a named error.
5. An upload repeated with an ingest or read-only token is refused and stores nothing.
6. An auto-created SDK release registered through `sentry-cli releases new` and `set-commits` stays one release.
7. Commits that `sentry-cli releases set-commits` registers pass TEAM-004's citation parser, link log and resolution.

#### SRC-004 — Published source map and debug-file capacity

*Tier:* Core · *Cites:* BASE-INPUT-003

**Requirement.** Every artifact a production build emits is stored and used, release after release. There is no per-project or per-release limit on the number of source maps, source files, artifact bundles or debug files. Each source map or source file may be up to 190 MiB, Sentry's only stated per-map limit, with any number of `sources` and mappings within that size, and each debug file (dSYM, ELF/DWARF, PDB, Breakpad, ProGuard/R8 mapping, Dart/Flutter symbols, Hermes and React Native bundle maps) may be up to 2 GiB. Spool's chunk-upload options endpoint advertises chunk size, concurrency and maximum file size so that unmodified `sentry-cli` and the SRC-003 plugins upload files of these sizes, and uploads stream through chunked assembly to the isolated storage the boundaries name, never held whole in request memory. Indexed (`sections`) maps, `sourceRoot`, `sourcesContent`, `ignoreList`/`x_google_ignoreList` (those frames are marked not in-app under GROUP-001), debug IDs (`debugId`/`debug_id`) and release/dist artifact names including `~/` URL prefixes are applied under ERR-005's identity checks, not refused. An artifact is kept while any retained event in its release or build uses it, and for at least the project's GOV-003 retention window after its last upload or use; it then expires under GOV-003's rules with a named gap, and an issue whose map has expired shows generated frames with that reason. Artifact storage is metered in USD under BILL-001, and the only capacity refusal is a buyer-set artifact storage cap (`artifact_storage_cap`). A failed upload is named per file and reason (too large, malformed map, identity mismatch, storage cap, authority) in the `sentry-cli`/plugin assemble response and CI output, in Spool's CLI output and in the release's artifact view, and the release is marked incomplete under SRC-001; it is never a bare 429. A project that hosts public maps may opt in (off by default) to fetching minified JavaScript and its `sourceMappingURL` map from named HTTPS origins, optionally sending a project secret header as Sentry's security token does; fetching runs in an isolated worker under these size limits, refuses private-network addresses and redirects to another origin, labels the map as fetched with its URL and fetch time, and keeps fetched maps private under the same retention. MIG-001 imports Sentry's source-fetching and allowed-domain settings, and setup offers the CI upload step as the default path. SDK-010 source lookup inherits the expanded map projection here; retained SDK stacks and this source-map projection are independent, and the capacity journey covers the expanded lookup before claiming it.

**Acceptance.**
1. A production Next.js App Router app (more than 100 chunks, a vendor chunk map over 2 MiB) and a React Native Hermes release upload with unmodified `withSentryConfig` and `@sentry/react-native` for three consecutive releases, and every map is stored.
2. An error in a vendor-chunk frame and an app frame in the third release shows original source.
3. An indexed map, a map with `sourceRoot` and a 50 MiB map each resolve.
4. A 40 MiB dSYM and a ProGuard mapping symbolicate and deobfuscate.
5. No upload is refused for artifact count.
6. With an artifact storage cap set, the next upload names each refused file and the cap in CI output and the release view.
7. Past retention, a release with no retained events has its maps expire with a named gap.
8. A project opted into source fetching from an allowed origin resolves a frame from the fetched map, and a private-network URL is refused.

#### REL-001 — Release and deployment history

*Tier:* Core · *Cites:* BASE-OPS-003 · *Rules:* D-4

**Requirement.** Register builds, commits and per-environment deployment start/success/failure/rollback with actor, timing and included commit range. CI retries are idempotent; abandoned starts become visibly timed out and notify their owner. Releases auto-created from Sentry SDK events (SDK-009) appear in release history labeled auto-created, with first-seen time, first environment and creating SDK; a later registration of the same name through the release API, `sentry-cli` or a build plugin enriches that release with commits, artifacts and deploys and removes the label, never creating a second release. The project's SDK-028 ordering rule governs regression, while deployment history records multiple environments, progressive exposure and rollback without rewriting past event identity. Starts carry the caller's explicit deadline and selected existing email destination; overdue evaluation appends one truthful timeout and one notice attempt (local mail is labeled suppressed), never an inferred deployment failure. Included ranges and exposure remain caller recorded. Restored history is inert. SRC-003 carries the unmodified CLI/plugin registration journey, SRC-002 connected included-commit read-back, and TEAM-001 member deployment authority.

**Acceptance.**
1. Started, completed and failed deployments reported from CI are recorded, with their included commits.
2. Repeated callbacks are idempotent.
3. An abandoned start becomes visibly timed out, with one follow-up to its owner.
4. A production rollback is recorded.
5. Delayed old events keep regression ordering.
6. A release auto-created by a Sentry SDK event and then enriched under the same name through the native release/deployment API stays one release, with its original first-seen time.

#### REL-002 — Suspect change and release comparisons

*Tier:* Core

**Requirement.** Connect first occurrence, reactivation and rate change to the release/deployment window, suspect commit and changed source; compare release cohorts, adoption and loss before attributing impact. Keep correlation distinct from a demonstrated cause and preserve older-release failures during rollout. An engineer can confirm or reject a suspect and record evidence for later agent learning.

**Acceptance.**
1. With two commits deployed while old clients are retained, first and regressed errors and an unrelated spike show candidate reasons and comparable release rates.
2. A false suspect is rejected without changing occurrences.

#### CTX-001 — Error-linked traces, logs and request performance

*Tier:* Core · *Rules:* D-2 · *Register:* R-13

**Requirement.** Capture OpenTelemetry traces/spans, and the `transaction`, `span`, `profile`, `profile_chunk`, `log` and `trace_metric` items unmodified Sentry SDKs send (SDK-007), with error links across browser, backend and jobs, showing the failing request waterfall, latency, dependencies, correlated structured logs, the profile of the failing transaction, trace-connected metrics and approved RUM context (including web vitals) beside the stack. A web vitals view per page and release shows LCP, INP, CLS, FCP and TTFB at p75 with the good/needs-improvement/poor distribution and sample count, and a transaction summary shows p50/p95 duration, failure rate and throughput; these are the views ALERT-001 metric alerts link to. Preserve trace/span IDs through intake, sampling and exports. OTLP and Sentry-SDK telemetry intake follows GOV-003's published sustained rate and named volume reasons. Link or forward context to Datadog and Splunk with permissioned deep links and explicit data/minimization controls. Performance problems found in the same spans open as issues under CTX-004. This is error diagnosis, not ownership of their entire APM/log warehouse. CTX-001 inherits AI-005 trace-variant comparison in grouping proposals: persist permitted trace identity and compare trace variants alongside stack, release and route before this clause is complete.

**Acceptance.**
1. A browser-to-service-to-job failure with propagated trace IDs, instrumented once with OpenTelemetry and once with unmodified Sentry SDKs with tracing, profiling and logs enabled, shows one correlated waterfall, log and profile path for each, with missing-sample labels.
2. The page's web vitals view reconciles p75 LCP and CLS with the sent measurements.
3. Authorized Datadog and Splunk context opens, and revoked export credentials stop forwarding.
4. Grouping proposals compare trace variants alongside stack, release and route.

#### CTX-002 — Privacy-controlled session replay

*Tier:* Core · *Rules:* D-2, D-6

**Requirement.** Attach browser and mobile session replay to the exact error/session/time, with console/network timeline and trace links. Offer first-party capture, which accepts the unmodified Sentry replay format (`replay_event`, `replay_recording` and `replay_video` from `replayIntegration` and the mobile SDKs, linked by the event's `replay_id`, per SDK-007) as well as Spool's own recorder, and link replays recorded elsewhere through the CTX-003 connectors. First-party capture has consent and sampling, default input/text/media masking, exclusion zones, retention and role-scoped playback. Replay segments are accepted up to SDK-011's published replay limits (10 MiB compressed, 100 MiB decompressed per item). Replay never includes production credentials by default; access/export/erasure is audited and missing replay remains explicit.

**Acceptance.**
1. Opted in on a realistic checkout/account flow with Spool's recorder, and separately with an unmodified Sentry `replayIntegration` and mobile replay, an error's preceding path plays from issue detail at the error time.
2. Masked fields stay masked in stored replay and exports.
3. After access is revoked and the session erased, playback and artifacts no longer hold it.

#### CTX-003 — Third-party replay connectors

*Tier:* Core · *Register:* R-14

**Requirement.** Link errors to replays the buyer already records in PostHog Session Replay, LogRocket, FullStory and Datadog RUM Session Replay. Each connector uses a least-privilege buyer API credential and reads the session identifier that provider's browser SDK attaches to the Spool event, or matches by an approved session property and time. Issue detail shows the linked replay at the error timestamp as a permissioned deep link with provider metadata (start, duration, page); Spool never copies replay content. Missing, expired or inaccessible replays carry a reason. Revoking the connector credential or the viewing member's Spool permission stops new links and refuses opening existing ones from Spool; disconnecting removes stored replay references under ERASE-001. Sentry Replay links imported by MIG-001 follow the same model.

**Acceptance.**
1. For each of PostHog, LogRocket, FullStory and Datadog, a session recorded with the provider SDK beside the Spool or Sentry SDK opens as the linked replay from issue detail at the error time.
2. After the connector permission is revoked, the link is refused with a reason.
3. No replay content exists in Spool storage or exports.

#### CTX-004 — Performance issues from transactions and spans

*Tier:* Core

**Requirement.** Spool detects performance problems in the `transaction` and `span` data that unmodified Sentry SDKs and OpenTelemetry send (SDK-007, CTX-001) and opens them as issues in the same issue stream as errors, with the same short IDs, ownership, priority, triage, alerts, tracker links and AI-002/AI-003 handoff. Detectors: N+1 database queries, N+1 API calls, slow database queries, consecutive database queries, consecutive HTTP calls, large HTTP payloads, large render-blocking assets, uncompressed assets, and main-thread file I/O and database work on mobile. Each detector is on by default with a stated threshold (duration, repetition count or size) that a maintainer can change or disable per project, with a preview against retained spans; changes are audited and apply to later intake. Each issue groups by the offending span pattern (normalized query or URL and parent operation) and shows the evidence span tree, the repeated or slow spans, the transaction and release, affected users (SDK-008) and occurrence counts, with a link to the trace waterfall; sampling rates are shown with the counts. Resolution and regression follow ERR-006 and TEAM-003, and detected issues bill against the span data category in BILL-001, not the error category.

**Acceptance.**
1. In a Node or Python service and a Next.js app instrumented once with unmodified Sentry SDKs with tracing on and once with OpenTelemetry, an N+1 query loop, a slow query, consecutive HTTP calls, a large render-blocking script, and a main-thread file read in a React Native app each open one performance issue in the issue stream, with its span evidence, trace link and affected users.
2. Each alerts under ALERT-001 and is assigned under TEAM-002.
3. With one detector's threshold raised above the observed value, later traffic opens no new issue.
4. Deploying a fixed release resolves the issue, and regression behaves as for errors.

### Alerts and delivery

#### ALERT-001 — Filtered rules and real anomaly detection

*Tier:* Core

**Requirement.** Configure new issue, reactivation, regression, frequency/count/rate threshold, seen by more than N users in a window (SDK-008's affected-user definition), percent of sessions affected in a window (SDK-005 denominators) and crash-rate/spike rules by project/team, environment, severity, priority, release and approved payload properties. A user condition on a project whose identity policy leaves no user key, or a session condition without session data, is refused at preview with the reason rather than evaluated against 0. Historical-baseline detection accounts for traffic, seasonality, sampling and missing capture rather than renaming a fixed threshold anomaly detection. Preview the matched history, owner, evaluation window and destination before enabling; deduplicate each rule/window transition. The new issue condition fires for a new root cause under an existing wrapper exception, because GROUP-001 groups over the whole exception chain (SDK-010). The regression condition fires once for every regression ERR-006, TEAM-003 and SDK-009 define, including the first accepted event after a plain Resolve, in any release or with no release. Metric alerts on the transactions and spans Spool ingests under CTX-001 and SDK-007 cover p50/p75/p95/p99 duration, failure rate, throughput, Apdex and the web vitals LCP, INP, CLS, FCP and TTFB, filtered by transaction name, project, environment and release, with warning and critical thresholds or a change-from-baseline comparison, a resolve threshold, and the same preview, deduplication and destinations; MIG-001 imports Sentry metric alert rules. Alerts on host, container or infrastructure metrics stay with the connected APM named in the boundaries. SDK-009's release-less alert conditions are inherited here: new and regression conditions include accepted events with no release, and seen-with-no-release-after-resolve is an available counted condition.

**Acceptance.**
1. Filtered rules created in the app, replayed over normal, burst, seasonal and low-traffic windows with loss, show their baseline and threshold reasons.
2. Exactly one alert fires per qualifying transition, and none outside its filter.
3. A seen-by-more-than-3-users rule and a percent-of-sessions-affected rule each fire from known user and session sets.
4. The user rule is refused at preview on a project whose policy drops identity.
5. Of two plain-resolved issues, one receiving an event in the same release and the other an event with no release, each fires one regression alert.
6. With unmodified Sentry tracing, a transaction's p95 duration and a page's LCP pushed over warning, then critical, then back each fire one alert per transition and a resolve.

#### ALERT-002 — Email, Slack, Teams, Oncall and PagerDuty

*Tier:* Core · *Rules:* D-1, D-3 · *Register:* R-7

**Requirement.** Route actionable error alerts to email, Slack, Microsoft Teams, sibling Oncall and PagerDuty, with project/issue/release links, short ID, ownership, severity and recovery/update semantics, plus the inbound triage actions named in ALERT-005. Use named provider adapters and least-privilege account setup, signed inbound actions, rotation and revocation. Teams choose separate destinations per rule. Discord channels receive formatted alerts through a channel webhook with issue links. Signed HTTP webhooks remain available for custom automation. Mail adapters support configured US providers such as Amazon SES, Resend and SendGrid; provider acknowledgment stays distinct from recipient receipt. ALERT-003's delivery-state and reviewed-test obligations apply to every adapter before shipping: Slack and Teams posted with message identifier; PagerDuty and Oncall triggered, acknowledged and resolved; Discord's channel webhook carries HTTP status and signature observations where supported. Every adapter keeps provider acknowledgment distinct from recipient receipt. A buyer's own workspaces receiving and acting on alerts are register row R-7.

**Acceptance.**
1. Each destination, including a Discord channel webhook, is connected and tested, and a filtered new or regressed issue triggers it.
2. The alert's exact issue link opens the issue.
3. Each ALERT-005 action works for its destination: Slack and Teams resolve, archive and assign; PagerDuty and Oncall acknowledge and resolve sync.
4. Rotating and revoking a destination's credentials stops delivery through the old credentials.
5. Delivery history reconciles without duplicate pages.

#### ALERT-003 — Destination tests, digests and snoozing

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-4, D-6 · *Register:* R-8, R-9

**Requirement.** Test every destination before enabling a rule with distinct test wording and no issue mutation, then show each channel's delivery states separately: email accepted by provider, delivered, bounced or complained (from provider events); Slack and Teams posted with message identifier; PagerDuty and Oncall triggered, acknowledged and resolved; webhook HTTP status and signature receipt. Deliver daily/weekly project and personal error digests in the buyer timezone, with new/regressed/unowned work, usage and failed automation. Snooze by issue/rule/team with an expiry and one resumption notice; maintenance and quiet hours cannot hide event loss or erase backlog. Delivery tests, provider events, digest schedules and the held backlog work as docs/ALERT-DELIVERY.md describes.

**Acceptance.**
1. Each channel is added and tested with distinct test wording, and its named delivery states show separately.
2. A rule is enabled only after its destination's test result is reviewed.
3. A test send leaves the issue evidence unchanged.
4. A US-timezone digest is scheduled and sends one digest for its period.
5. Snoozing through a burst and its expiry sends one resumption notice.
6. Maintenance and quiet hours leave event loss and backlog visible.

#### ALERT-004 — Durable follow-up and visible automation failure

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-004 · *Rules:* D-4

**Requirement.** Every alert, integration action, deployment timeout and agent step has an accountable owner, due condition, durable queued/running/blocked/failed/uncertain/completed/canceled state and inspectable attempts. Restart and repeated evaluation do not duplicate messages or work. Only proven-unaccepted sends may retry; uncertain effects need explicit reconciliation or authorized resend. Broken destination/rule and overdue unacknowledged work notify an alternate operator without recursive alert storms. Restored history remains inert. A project may configure one existing alternate destination, default No alternate. A send pending for five minutes, an open unacknowledged alert after 24 hours, a deployment deadline or an expired fix lease leaves one durable Needs attention row and one permanent AUDIT-001 follow-up fact. Alternate notices have stored source/destination deduplication keys; their own failure never creates another notice. The attention view shows due conditions, source state, attempts and alternate notice outcomes. An authorized resend of an unknown effect is made explicitly: a fix resend advances the fix workflow, by a person in the product or by an agent as a call whose class the company's policy decides, and reconciliation of a known provider mutation requires its recorded result. Follow-up configuration, queues, attempts and step fences are operational stores excluded from archives; the safe audit chronology survives and restored history does not dispatch. ALERT-003 snooze expiry, held backlog, capture loss and digest/resumption send failures use the same durable Needs attention and deduplicated follow-up semantics; snooze, maintenance and quiet hours never erase loss or backlog, and restored digest/snooze history remains inert. Future integration, tracker, deployment-connector and agent actions inherit this obligation (D-3).

**Acceptance.**
1. A send refused before its send boundary retries once, with the same message identity.
2. A send interrupted after its send boundary becomes uncertain and is never repeated automatically.
3. After a restart, work recorded before it continues from its durable state.
4. An expired lease leaves one durable Needs attention row with one follow-up.
5. A revoked (disabled) rule sends nothing further.
6. A lost provider response stays uncertain until explicit reconciliation, and repeated evaluation adds no duplicate follow-up or alternate notice.
7. Restoring an archive replays no work.

#### ALERT-005 — Chat and paging triage actions and link unfurls

*Tier:* Core · *Rules:* D-1, D-4 · *Register:* R-7

**Requirement.** Slack and Microsoft Teams issue alerts carry Resolve (now or in the next release), Archive (forever, until escalating, or for a count or duration) and Assign (to a member or team of that project) controls. Each action checks the clicking chat user's linked Spool member identity and project role; an unlinked or under-privileged user gets a private explanation with an account-link prompt, and the issue does not change. The message updates in place with the new state and actor, and the action appears in the issue timeline and AUDIT-001. Spool issue, event and release links pasted in Slack unfurl into a preview (title, short ID, status, assignee, counts, last seen, release) for linked members with access, and stay bare links otherwise; no event payload is revealed. PagerDuty and Oncall incidents created from Spool sync both ways: acknowledging the incident acknowledges the issue, resolving it resolves the issue, and the reverse, with loop prevention. A linked member can start an AI-002/AI-003 investigation from Slack; the agent's steps carry their classes, which the company's policy decides, within the spend caps it sets. Inbound actions are signature-verified (Slack signing secret, Teams bot authentication, PagerDuty and Oncall webhook signatures), replay-protected and idempotent. SDK-009's plain Resolve is inherited by chat actions here: the next accepted event in any release or none reopens the issue and fires one regression condition.

**Acceptance.**
1. From a Slack alert and a Teams alert, a linked member resolves one issue, archives another until escalating and assigns a third to a team, and the state, timeline, audit and updated message agree.
2. An unlinked user and a read-only member are refused, with no change.
3. A pasted issue link unfurls for an authorized member and not for an unauthorized one.
4. Acknowledging and resolving a PagerDuty and an Oncall incident moves the issue with it, and resolving in Spool resolves the incident.
5. A replayed signed action has one effect, and a forged one is refused.

### Delivery integrations

#### TRACK-001 — Vector, Jira and Linear issue sync

*Tier:* Core · *Rules:* D-1, D-3 · *Register:* R-11

**Requirement.** Create or link a delivery issue in sibling Vector, Jira or Linear with a previewed sanitized diagnostic summary, source/release links and owner. Sync resolution/reopening and external status idempotently with signed callbacks; for Jira also sync assignee and comments both ways, and offer create-ticket as an ALERT-001 rule action, loop prevention and conflict visibility. GitHub/GitLab Issues are optional destinations under the same model. Spool owns error triage; the connected tracker owns the delivery backlog and planning.

**Acceptance.**
1. A ticket created from a Spool issue in each tracker, with the action repeated, leaves one ticket with consistent links.
2. Resolving and reopening on either side syncs to the other.
3. A Jira assignee and comment sync both ways.
4. An alert rule creates a Jira ticket.
5. A stale or forged callback is refused.
6. A conflict is shown rather than silently overwritten.
7. Disconnecting stops synchronization.

### Migration and portability

#### MIG-001 — Sentry organization migration

*Tier:* Core · *Rules:* D-4 · *Register:* R-2

**Requirement.** MIG-001 lists each Sentry loader key with its settings and the replacement script tag (RL-1). Guide a real Sentry buyer through organization/project, member and team roster (as pending invitations with mapped roles), environment, release, issue/event, triage, ownership, alert, saved search, source artifact, attachment, feedback, replay link, dashboard, data scrubbing settings (sensitive and safe fields and advanced rules, mapped to SDK-003), inbound filter (mapped to SDK-006), IP-storage and user identity settings (mapped to SDK-008), JavaScript Loader Script key settings (mapped to the SDK-023 loader), stack trace and fingerprint rules (mapped to GROUP-001), code mappings (mapped to SRC-002), JavaScript source fetching and allowed-domain settings (mapped to SRC-004), retention and quota settings (mapped to GOV-003 and BILL-001), metric alert rules (mapped to ALERT-001) and release names, versions and dates (so SDK-028 ordering continues across cutover) migration using authorized export/API adapters. Preview source-to-target mapping, unsupported items and count/byte reconciliation; retain provenance/private originals, resume safely and undo only unchanged imported records. Repoint standard SDK DSNs for a measured dual-run/cutover that compares Sentry and Spool counts per SDK-007 item type (errors, affected users under SDK-008's definition, sessions and crash-free rates, transactions, replays, feedback, attachments and client reports), so each difference is attributed to a named cause (for example an identity policy that hashes or drops a field, an inbound filter, sampling, tunnel loss, a release refused under SDK-028's registered-sequence-only rule, or an item refused under a project limit lowered below SDK-011's published figures; events with no release, SDK-default releases, every SDK-default content encoding and items within Sentry's documented limits are accepted and are never an unexplained difference; a refusal for retained event count, a fixed per-minute budget or source map count is never an explained difference and fails the dual run under GOV-003 and SRC-004), and it compares sample events field by field (exception chain length, frame count, tags and contexts kept under SDK-010), with retained rollback configuration and a checked rollback procedure. Import history cannot send alerts, grant account authority or prove current health; explicitly reauthorize teams, integrations and secrets. Before migration completion, import and preview the versioned GROUP-001 stack/fingerprint rules with provenance and immutable original membership; import history never activates live effects without explicit approval. SDK-009 migration reconciliation is inherited here: reconcile automatic release/dist identity, release-less counts and named strict-policy refusals in the Sentry dual run and usage, without duplicating releases on later registration. A real buyer's own export, API account and production-volume dual run are register row R-2.

**Acceptance.** From an export in Sentry's documented format and Sentry's API schema:
1. Every named collection is previewed and reconciled by count and bytes, including each loader key with its replacement script tag.
2. Apply runs and resumes after an interruption.
3. Issue, event and artifact samples and the imported scrubbing rules and inbound filters compare with the source.
4. A dual run of unchanged SDKs, including services that send no release, mobile builds with SDK-default releases, a Python service with `brotli` installed and mobile crashes with screenshots, reconciles per-item-type counts, affected users and crash-free rates through a deploy-incident burst, with no deficit attributed to retained capacity or a fixed per-minute budget.
5. Automatic release/dist identity, release-less counts and strict-policy refusals reconcile in the dual run, without duplicate releases on later registration.
6. Cutover completes after the dual run.
7. Unsupported mappings are shown, and guarded undo preserves native edits.

#### MIG-002 — Datadog Error Tracking migration

*Tier:* Core · *Register:* R-3

**Requirement.** Import Datadog Error Tracking issues, events, service/environment/version tags, triage, release and available trace/log links with authorized API/export adapters. Map monitors/notification rules into previewed Spool rules and external destinations; preserve source IDs, timestamps and unsupported fields. Reconcile counts and time windows, retain read-only history, dual-run SDK/OTel intake and switch error monitoring without requiring migration of the full Datadog observability platform. A real buyer project is register row R-3.

**Acceptance.** From a project in Datadog's documented API format:
1. The import runs with its mappings and exceptions reviewed.
2. Sampled issue, event and history records and monitor rules reconcile.
3. One service dual-runs and cuts over, with no imported alert replay and no duplicate native events.

#### MIG-003 — Rollbar migration

*Tier:* Core · *Register:* R-4

**Requirement.** Import Rollbar projects/items/occurrences, environments, deploys, status/assignment, grouping fingerprints, comments, tracker links and notification policies through a documented authorized export/API path. Preserve source identities and private artifacts where obtainable; name unavailable data. Provide dry-run, reconciliation, resumable apply/guarded undo and a SDK cutover guide that preserves diagnostic context and explicitly reports conversion losses. A real buyer project is register row R-4.

**Acceptance.** From a project with resolved and reactivated items in Rollbar's documented export or API format:
1. The migration compares counts, stacks, deploys and rules.
2. An interrupted migration resumes.
3. The replacement capture setup works, and imported history causes no outbound work.

#### MIG-004 — Bugsnag migration

*Tier:* Core · *Register:* R-5

**Requirement.** Import Bugsnag/SmartBear organizations/projects, errors/events, stability and release metadata, app versions/stages, triage, collaborators, source-map/symbol references and integrations available through buyer-authorized APIs/exports. Reconcile event and session denominators separately; missing historical sessions never become a fabricated crash-free rate. Preview mapping and unmigratable artifacts, resume/undo safely and document mobile/web SDK and symbol-upload cutover. A real buyer project is register row R-5.

**Acceptance.** From a web and mobile project in Bugsnag's documented API format:
1. Sampled errors, events and release stability inputs reconcile.
2. Capture and symbol CI repoint, and an original native stack shows.
3. Where the source export lacks historical sessions, the gap is shown rather than a crash-free rate.

#### MIG-005 — Up-and-comer switching paths

*Tier:* Core · *Register:* R-6

**Requirement.** Offer documented, reviewed import/cutover adapters for PostHog Error Tracking, GlitchTip and Better Stack Error Tracking. Preserve available errors, lifecycle, releases, project tags and replay/trace links, with per-source mapping, loss and reconciliation reports. PostHog analytics stays in PostHog or the buyer's chosen analytics product; imported replay links require their original permissions and never imply ownership of external data. Real buyer projects are register row R-6.

**Acceptance.** For each named service, from its documented export format:
1. Representative errors and lifecycle preview and import, and source counts and links reconcile.
2. Capture cuts over.
3. Resumed imports are idempotent, and imported history stays inactive.

#### API-001 — Public APIs, attachments and full export

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-INPUT-003

**Requirement.** Expose versioned, paginated, project-scoped APIs for issues, occurrences, release/session reports, feedback, approved attachments and audit, with documented limits, cursors and compatibility. Export a complete authorized project or search in JSON/CSV and an integrity-checked private archive at any GOV-003 retained volume, streamed rather than refused for the project's event count; preserve attachment identity and erasure provenance. Attachments include the screenshots, view hierarchies, minidumps and crash reports unmodified Sentry SDKs send (SDK-007); each is viewable and downloadable only by members with access to its project, and every view is audited. API/webhook integrations including Sentry integration-platform workflows receive explicit capability mapping; Sentry Web API scripts and Terraform keep working through API-002.

**Acceptance.**
1. A read-only service grant paginates all retained records and attachments, and they reconcile with the UI and the archive.
2. A Sentry-SDK screenshot opens for a permitted member and is refused for an unpermitted one.
3. A foreign scope is refused.
4. A large query exports with its named bounds.
5. The export restores without secrets or active work.
6. A 160,000-event project exports whole in JSON and as a private archive, and its counts reconcile.

#### API-002 — Sentry Web API and Terraform compatibility

*Tier:* Core · *Rules:* D-1

**Requirement.** Scripts and infrastructure-as-code written against Sentry's Web API keep working when only the base URL and auth token change. Spool serves Sentry's `/api/0/` endpoints for organizations, teams, members, projects, project client keys (DSNs, including per-key rate limits), issues (list with Sentry search syntax, get, update, bulk mutate and delete), events, releases, issue alert rules and metric alert rules, with Sentry's cursor `Link` pagination. Sentry-style organization and personal auth tokens map to TEAM-001 roles and are limited to their scopes and projects. The community Terraform provider for Sentry (`jianyuan/sentry`) manages `sentry_team`, `sentry_project`, `sentry_key`, `sentry_issue_alert` and `sentry_metric_alert` unmodified except for base URL and token, and plan, apply and import are idempotent. An unsupported endpoint or field fails with an explicit error naming it, never a silent success; every write is audited under AUDIT-001.

**Acceptance.**
1. A script that lists issues with a Sentry search query, paginates past the first page, assigns one and bulk-resolves several through `/api/0/` leaves the UI matching.
2. `terraform plan`, `apply` and `import` with the `jianyuan/sentry` provider create a team, a project, a key with a rate limit and issue and metric alerts, and a re-plan shows no changes.
3. An unsupported endpoint returns a named error.
4. A write with a read-only token is refused and changes nothing.

### Governance and operation

#### GOV-001 — Enterprise identity and administration

*Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-SIGNIN-001, BASE-SIGNIN-002, BASE-ROLE-001 · *Register:* R-15

**Requirement.** Connect Auth0 and Okta for organization SSO, enforce verified domains and step-up policy, and retain project-grant fencing under the cited Base duties. Preserve a controlled recovery owner without bypassing provider revocation. Members can also sign in with Google (Workspace or personal account) or GitHub as plain login options linked to their member identity; an admin can require one, restrict Google sign-in to verified domains and GitHub sign-in to a named GitHub organization. Managed first-owner admission and editor access reuse native authority rather than adding a parallel identity model. Vendor tenants are register row R-15.

**Acceptance.**
1. Step-up is enforced.
2. The documented owner recovery procedure restores access.
3. One member signs in with Google and another with GitHub.
4. With Google sign-in restricted to the verified domain, an outside Google account is refused.

#### GOV-002 — Retention, residency and data custody

*Tier:* Core · *Cites:* BASE-DATA-002 · *Rules:* D-1, D-6

**Requirement.** Publish US-first hosting/subprocessor and residency options, telemetry/artifact/replay retention windows and deletion timing, none below GOV-003's minimums (errors at least 90 days by default, every data type at least 30 days), with automatic expiry under GOV-003 and artifact retention under SRC-004. Owners configure per-project retention with dry-run, schedules, storage/usage estimates and legal-hold/export controls; longer retention is an explicit USD plan choice. No expiry silently improves historical denominators or deletes independent anonymized audit. Record retention and dedup cutoffs in packets and reports. New storage/worker providers require a declared data-flow and erasure policy.

**Acceptance.**
1. Different retention windows set per project each preview their counts and coverage.
2. One project is held and exported, and the scheduled cutoff leaves it untouched.
3. The scheduled cutoff removes private artifacts and records the historical gaps.
4. The storage cost estimate is shown.
5. Erasure and restore fences hold after the cutoff.
6. Past a project's window, with no manual action, its oldest events expire automatically while new events are still accepted.

#### GOV-003 — Published retention, retained volume and sustained intake rate

*Tier:* Core · *Cites:* BASE-DATA-002 · *Rules:* D-1

**Requirement.** A buyer knows how long Spool keeps data, how much it keeps and how fast it accepts it, and no other limit stops the core job. Errors with their events and attachment metadata, sessions and release-health aggregates are kept at least 90 days by default on every plan, as on Sentry Team and Business; GOV-002 publishes each data type's window (none below 30 days) and longer windows as USD plan choices, and an owner may shorten one project's window with GOV-002's preview. Expiry runs automatically at least daily; it removes data older than the window under ERR-009's cutoff, occurrence tombstone, deduplication horizon and coverage-gap rules, records the gap in packets, reports and FIND-002 denominators, and never refuses or delays new intake, and a GOV-002 legal hold pauses expiry for the held project only. TEAM-004 commit retention is inherited here: automatic expiry, scheduled cutoffs and plan windows run the same cutoff as the owner retention door, removing author and message from commits received before it and from the alert copies that carried them, while SHA, link and resolution stay. BILL-001 and BILL-002 sell volume as errors accepted per month in USD tiers, the smallest including at least 50,000 errors a month (Sentry Team's figure), with pay-as-you-go or a raised budget above the included volume. A project keeps every accepted event for its full retention window, however many there are: there is no per-project or per-installation retained-event count, and no project is refused because of how many events it holds. The only volume refusals are the buyer's monthly budget or cap (`over_budget`), BILL-001 spike protection against the project's own baseline (`spike_protected`), an admin-set DSN key rate limit (`key_rate_limited`) and intake above the sustained rate below (`server_rate_limited`); each returns 429 with `Retry-After` and `X-Sentry-Rate-Limits` naming the limited data category and scope, and is counted under its reason in project outcomes, BILL-001 usage, capability diagnostics and the MIG-001 dual run, while non-volume refusals (SDK-006 filters, SDK-028's stricter rule, SDK-011 limits, invalid items) are counted separately. Each project accepts at least 6,000 events a minute sustained, with bursts to 10,000 in any one minute, and an organization at least 30,000 events a minute across its projects, without refusal, on native, Sentry SDK and OTLP (CTX-001) intake alike; events accepted at that rate are searchable in FIND-001 within 60 seconds, and above it refusals are `server_rate_limited` and counted, never silently dropped. Clauses once tied to the current cap are restated against this volume: a project holding 150,000 retained events (three months of the smallest tier) or more is archived, exported and restored whole by streaming (ERR-009, API-001); project erasure completes within 15 minutes for 150,000 retained events and at no less than 10,000 events a minute above that (ERASE-001), and end-user erasure within 300 seconds in such a project (SDK-027); and FIND-001 search and FIND-002 counts cover every retained event.

**Acceptance.** With unmodified Sentry browser (Next.js) and Python (Django) SDKs and only the DSN changed:
1. 60,000 errors sent to one project over a simulated month, including a burst of 5,000 in one minute, once with spike protection off and once at its default, are never refused for retained capacity or a fixed per-minute budget, and every accepted event is searchable within 60 seconds and counted.
2. With spike protection on, any refusal is counted only as `spike_protected`.
3. Past 160,000 retained events, new errors, including a brand-new crash, are still accepted.
4. More than 10,000 events in one minute get `server_rate_limited` 429s with `Retry-After` and counted outcomes.
5. Past the 90-day window, the oldest events expire automatically with a named gap while new events are accepted.
6. With a monthly budget below the volume, refusals start only at that budget, as `over_budget`.
7. The 160,000-event project is archived and exported, restored into an empty destination, and its counts reconcile.
8. One user is erased within 300 seconds, and the project within 16 minutes.

#### BILL-001 — Predictable USD usage and ingestion budgets

*Tier:* Core

**Requirement.** A US software team sees accepted, filtered (per SDK-006 filter), invalid, server-rate-limited (only above GOV-003's published sustained rate), key-rate-limited, spike-protected, client-discarded (from Sentry SDK `client_report` items and Spool SDK reports, by reason and data category, per SDK-007), refused for a missing or unregistered release (only on projects that chose SDK-028's registered-sequence-only rule), refused under SDK-011 (unsupported encoding, oversized request, oversized or invalid item, by item type and reason) and over-budget volume separately from billable events, sessions, replay, artifacts and retention. Project budgets and forecasts come with owner-controlled caps and warning destinations. No volume is refused because of a project's retained event count or under a fixed per-minute budget; GOV-003 lists the only volume refusals. Automatic spike protection, on by default and owner-adjustable, caps a sudden volume surge above the project's recent baseline so it does not consume quota, records the dropped count and notifies the budget destination. An admin can set a rate limit on an individual DSN client key (events per minute or hour); exceeding it returns 429 with `Retry-After` and `X-Sentry-Rate-Limits` for that key only and counts as key-rate-limited. Caps return explicit SDK backpressure and retry guidance; operators can tune sampling with a preview of diagnostic loss. BILL-002 carries the published USD tiers, checkout, invoices and sales tax.

**Acceptance.**
1. Representative volume through a project budget reconciles usage with the displayed USD forecast.
2. Warning and cap outcomes trigger, and a spike-protection cap records its dropped count and notifies.
3. Filtered events consume no quota.
4. Sentry SDK client reports reconcile discarded counts by reason and category.
5. Exceeding one DSN key's rate limit returns 429 for that key while a second key keeps ingesting.
6. An envelope with one oversized item is counted as refused under SDK-011 without consuming quota.
7. Adjusting sampling previews its diagnostic loss.
8. With a monthly budget below a month's volume, refusals start only at that budget, as `over_budget`, and nothing is refused for retained count.

#### BILL-002 — Published USD plans, checkout and invoices

*Tier:* Core · *From:* BILL-001

**Requirement.** Publish USD tiers by errors accepted a month (the smallest including at least 50,000 errors, as Sentry Team does) with pay-as-you-go or a raised budget above the included volume, plus overage. Commercial checkout, invoices and applicable US sales-tax handling use Stripe or an authorized billing partner.

**Acceptance.**
1. A buyer-controlled billing sandbox completes an invoice with tax and cancellation handling.

#### UX-001 — Mobile operations and accessible investigation

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001, BASE-PUBLIC-003 · *Register:* R-16, R-17

**Requirement.** Engineers use the complete triage, search, assignment, release, feedback, alert and repair path on desktop and mobile web, with stable deep links, touch controls and no horizontal page overflow. Loading, empty, permission-denied, offline/stale, error and success states name what is known. Preserve drafts/focus during refresh and refuse duplicate busy actions. Native application crash SDK coverage is SDK-001/002 and remains required. A human screen-reader pass and a VPAT are register rows R-16 and R-17.

**Acceptance.** At 1440 and 390:
1. A realistic team project is onboarded, an error captured and mapped, searched, assigned and commented on, an alert followed and a repair's approval recorded.
2. Revoked and offline sessions show their named states.

#### AUDIT-001 — Permanent privacy-safe action audit

*Tier:* Core · *Cites:* BASE-OPS-005, BASE-AUDIT-001, BASE-DATA-003, BASE-AGENT-009

**Requirement.** Spool's action history covers triage, grouping, permissions, exports, retention/erasure, integration writes, notification attempts and agent approvals/steps. Keep append-only history portable through Spool archives, with no secrets, raw payloads or personal values in permanent subject/actor labels. Erasure retains count-only receipts and leaves no erased identifier in this history. Organization audit and admin investigation cover new team/provider paths, and each later clause's new actions inherit this record (D-1). docs/AUDIT.md describes how writers commit their facts.

**Acceptance.**
1. It survives export and restore.
2. No secret or erased identifier remains in the history.

### Deployment integrations

#### INT-001 — Vercel and Netlify deployment connectors

*Tier:* Core · *Rules:* D-1, D-3 · *Register:* R-12

**Requirement.** Connect Vercel and Netlify projects so preview/production deploys, build identity and commit metadata automatically register in Spool, with environment mapping, artifact-upload guidance, rollback and failed-build visibility. Verify signed callbacks and reconcile missed events through least-privilege read-back. Account/repository disconnect stops work and queued old callbacks cannot recreate erased projects.

**Acceptance.**
1. Preview and production deploys from each provider register with their build identity and commit metadata, and their artifacts upload.
2. A mapped error links to its deployment.
3. A failed and a rolled-back deployment show as such.
4. A replayed callback leaves one deployment identity.
5. Disconnecting and erasing stop work at once, and a queued old callback cannot recreate the erased project.

### Agent surface

**Specialist: Triage engineer.** It keeps the business's application errors captured, grouped, owned and tied to verified repairs, acting for the person who sponsors it.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company's policy decides every call; this section presets none.

**How Spool computes each class.**
- *standard*: reads of issues, events, packets, outcomes, releases, reports and the audit; triage, assignment, comments, priority, saved views, grouping proposals, grouping corrections and rules (each undone by undo or a rule-version rollback), alert rules and snoozes, release, deployment, repair and suspect records, tracker tickets in the business's own tracker, reproductions in the isolated runner, a draft fix in a private repository, member notification settings, a legal hold or a longer retention window, code mappings, and exports to the person asking. A reversible internal action keeps standard when another class is added. Facts are the item count.
- *external*: anything that reaches or exposes data to someone outside the business: an invitation or identity-visibility grant to a person or service outside the business, a reply to an end user's feedback, an alert or resend to a destination outside the business's own workspaces and domains, a draft fix, merge, comment or tracker ticket in a public repository, a tracker ticket exposed outside the business, trace context forwarded to an outside provider, source-fetch requests to an outside origin and evidence sent to an outside model provider. Facts are the recipient count and the counterparty: *known* for a person, service, reporter, destination, repository, provider or origin already on record, *new* otherwise, *public* for a public repository.
- *money*: a budget, cap, plan or overage change, a raised artifact storage cap and a paid longer retention window. Facts are the USD amount and the payee.
- *commitment*: accepting the billing partner's terms. Facts are the document and the counterparty.
- *accounts*: installing a provider application (a GitHub App, a GitLab application, a Slack, Teams, PagerDuty, Jira or Linear app, a Vercel or Netlify integration) at an outside service. Facts are the provider.
- *gated*: a provider's consent screen in a person's own account, and card entry at the billing partner's hosted checkout. Facts are the provider and the step.
- *access*: organization members, teams, roles, project keys, agent grants, identity-access roles and the verified successor handoff during owner erasure. Facts are the people and whether the change widens or narrows.
- *security*: server-side scrubbing rules, the identity policy, the commit author and message sharing choice, allowed domains, sign-in, SSO, SCIM and MFA settings, replay consent and masking, source-fetch secret headers, project credentials, and provider credential connection, rotation and revocation, including tracker credentials. Facts are the setting.
- *destructive*: project, end-user and owner erasure, irreversible conversion of retained identity from keep to hash or drop or from hash to drop, a shortened event or replay retention window and the cutoff it runs, a removed alert destination and replay references irreversibly removed on disconnect. Facts are the item count.
- *live*: inbound filters, project item limits, DSN key rate limits, event or replay sampling, spike protection, billing budgets or caps that change intake, loader settings, check-in routes, detector thresholds, a release ordering rule that changes intake or regression, promoting an evaluated agent-runtime candidate and merging a fix into the branch the buyer deploys from, including an authorized resend of that merge. Facts are the project and the setting.
- Spool stores no health, ID, bank, card or payroll numbers, because SDK-003 and ERR-003 scrub them before storage, so it declares no sensitive class.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `spool.issues.read` | Read issues, events, evidence packets and affected users | ERR-002, ERR-003, ERR-005, ERR-007, SDK-010, SDK-026, FIND-002, AI-001 | standard | `list_issues`, `get_packet` |
| `spool.outcomes.read` | Read admission outcomes, loss counters and capability diagnostics | ERR-001, ERR-008, SDK-007, SDK-011 | standard | `get_outcomes` |
| `spool.issues.search` | Search, facets, saved views and the For Review inbox | FIND-001 | standard | none |
| `spool.issues.triage` | Resolve, acknowledge, suppress, assign, comment, prioritize, bulk-triage and mark reviewed | ERR-006, TEAM-002, TEAM-003, SDK-009 | standard | none |
| `spool.grouping.propose` | Propose a split, merge or grouping-rule change | AI-005 | standard | `propose_grouping`, `list_grouping_proposals` |
| `spool.grouping.correct` | Preview, apply and undo split and merge corrections and grouping rules | ERR-006, GROUP-001, AI-005 | standard | none |
| `spool.releases.record` | Record releases, commits and deployments, set the release ordering rule and choose commit author and message sharing | REL-001, TEAM-004, SDK-028 | standard (+ live) (+ security) | none |
| `spool.suspects.judge` | Confirm or reject a suspect change with evidence | REL-002 | standard | none |
| `spool.repairs.record` | Record repair links, checks and exercised flows | ERR-008 | standard | none |
| `spool.repairs.verify` | Watch a released repair's live rates | AI-004 | standard | none |
| `spool.reproduce.run` | Build and run a minimal reproduction in the isolated runner | AI-002 | standard | none |
| `spool.fixes.prepare` | Prepare a fix with its regression case and open a draft pull request | AI-003, AI-006 | standard or external | none |
| `spool.fixes.merge` | Merge a prepared fix | AI-003 | live (+ external) | none |
| `spool.runs.diagnose` | Cluster failed agent runs, compare evaluation cases and promote a candidate | AI-007 | standard (+ external) (+ live) | none |
| `spool.feedback.handle` | Triage end-user feedback and reply to the reporter | SDK-004 | standard or external | none |
| `spool.filters.update` | Inbound filters and allowed domains | SDK-006 | live (+ security) | none |
| `spool.scrubbing.update` | Server-side scrubbing rules | SDK-003 | security | none |
| `spool.identity.update` | The identity policy and identity-access roles, including visibility grants outside the business | SDK-008, SDK-026 | security (+ access) (+ destructive) (+ external) | none |
| `spool.limits.update` | Project item limits, DSN key rate limits, sampling and spike protection | SDK-011, BILL-001 | live | none |
| `spool.loader.update` | Loader script settings for a DSN key | SDK-023 | live | none |
| `spool.checkins.route` | Connect a check-in monitor to an Uptime heartbeat | SDK-024 | live | none |
| `spool.erasure.run` | Erase a project, an end user's identity or the owner's personal data | ERASE-001, SDK-027 | destructive (+ access) | none |
| `spool.alerts.rules` | Alert rules, metric alerts, digests and snoozes | ALERT-001, ALERT-003 | standard | none |
| `spool.alerts.destinations` | Add, test and remove alert destinations | ALERT-002, ALERT-003 | standard or external (+ destructive) | none |
| `spool.alerts.connect` | Connect, rotate and revoke chat and paging apps | ALERT-002, ALERT-005 | security (+ accounts) (+ gated) | none |
| `spool.followups.resolve` | Reconcile or resend an uncertain effect | ALERT-004 | standard (+ external) (+ live) | none |
| `spool.notifications.update` | Member notification settings and issue subscriptions | TEAM-005 | standard | none |
| `spool.tracker.sync` | Connect and disconnect trackers, rotate credentials, and create, link and sync tracker tickets | TRACK-001 | standard or external (+ security) (+ accounts) (+ gated) | none |
| `spool.repos.connect` | Connect repositories, edit code mappings and post suspect comments | SRC-002 | standard or security (+ accounts) (+ gated) (+ external) | none |
| `spool.artifacts.manage` | Inspect build artifacts, set the storage cap and source fetching | SRC-001, SRC-004 | standard (+ money) (+ security) (+ external) | none |
| `spool.context.connect` | Connect trace forwarding and replay providers | CTX-001, CTX-003 | security (+ gated) (+ external) (+ destructive) | none |
| `spool.replay.settings` | Replay consent, sampling, masking and retention | CTX-002 | security (+ live) (+ destructive) (+ money) | none |
| `spool.detectors.update` | Performance-issue detector thresholds | CTX-004 | live | none |
| `spool.reports.build` | Dashboards, widgets, saved queries and report exports | FIND-003 | standard | none |
| `spool.records.export` | Export records, attachments and private archives | ERR-009, API-001 | standard | none |
| `spool.retention.update` | Retention windows, legal holds and cutoffs | GOV-002, GOV-003 | standard or destructive (+ money) | none |
| `spool.members.update` | Members, teams, roles, project keys and agent grants, including invitations outside the business | TEAM-001, ERR-004, AI-001 | access (+ security) (+ external) | none |
| `spool.signin.update` | SSO, SCIM, MFA and sign-in options | GOV-001 | security (+ gated) | none |
| `spool.billing.update` | Budgets, caps and plan | BILL-001, BILL-002 | money (+ live) (+ commitment) (+ gated) | none |
| `spool.audit.read` | Search and export the audit | AUDIT-001 | standard | none |
| `spool.deploys.connect` | Connect Vercel and Netlify projects | INT-001 | security (+ accounts) (+ gated) | none |

**Resources.** `spool://projects/{project}/issues/{shortId}`, `spool://projects/{project}/events/{id}`, `spool://projects/{project}/releases/{release}`, `spool://projects/{project}/deployments/{id}`, `spool://projects/{project}/proposals/{id}`, `spool://projects/{project}/repairs/{id}`, `spool://projects/{project}/feedback/{id}`. **Events.** `issue.created`, `issue.regressed`, `issue.resolved`, `alert.fired`, `release.created`, `deployment.recorded`, `proposal.decided`, `repair.verdict`, `followup.due`. **Prompts.** triage new and regressed issues (FIND-001, TEAM-003), explain and correct grouping (GROUP-001, AI-005), reproduce and fix a failure (AI-002, AI-003), verify a released repair (ERR-008, AI-004), prevent related failures (AI-006), diagnose agent runs (AI-007).

**Not tools, and why.** Event capture runs in the buyer's applications and on their devices, which send it to the ingest door with their own project keys (SDK-001, SDK-002, SDK-005, SDK-012, SDK-013, SDK-014, SDK-015, SDK-016, SDK-017, SDK-018, SDK-019, SDK-025). The guided setup command and the tunnel handlers run on the developer's machine and the buyer's server (SDK-020, SDK-021). The sentry-cli and build-plugin endpoints and the Sentry Web API are connectors the buyer's CI and scripts call (SRC-003, API-002). Migration from Sentry, Datadog, Rollbar, Bugsnag and the up-and-comers, and restore into an empty installation, go through the import door (MIG-001, MIG-002, MIG-003, MIG-004, MIG-005). Investigating on desktop and mobile web is a person's own screen (UX-001). The first-party ingest subdomain, the release gates and the Base commands are installation facts (SDK-022, ERR-010, OPS-001).

**Limits.** Intake rates and item sizes (ERR-001, SDK-011, GOV-003) and each door's request rate protect the installation; business limits, thresholds and spend caps, model and runner cost included, are the company's policy.

**Handoffs.** Listens for Uptime heartbeat changes and Vector issue changes. Emits `issue.created`, `issue.regressed` and `followup.due` for the Oncall, Vector and Porthole specialists.

#### SURFACE-001 — The registry equals this table and the Base harness passes

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-001, BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-010, BASE-AGENT-012, BASE-AGENT-013

**Requirement.** Spool's MCP door serves exactly the tools in the table above, with their declared classes, the Core clauses each covers and the not-a-tool reasons, and the Base conformance harness passes on Spool's own fixtures. Each tool the stdio agent package serves under an earlier name reaches the same server action under its new name.

**Acceptance.**
1. `tools/list` names exactly the tools in the table, each with its declared classes and Core clause ids in `_meta`.
2. The Core clause ids with the not-a-tool reasons cover every Core clause in this contract, and none of those reasons is risk.
3. `resources/templates/list` names exactly the resource templates above.
4. `list_issues`, `get_packet`, `get_outcomes`, `list_grouping_proposals` and `propose_grouping` reach the same server actions as `spool.issues.read`, `spool.outcomes.read` and `spool.grouping.propose`.
5. The Base conformance harness passes on Spool's seeded fixtures under both company policies.

#### SURFACE-002 — External and money are computed per call

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006

**Requirement.** Spool's server computes the external and money classes and their facts from the arguments and current records for every call that can carry them, never from a flag or record text.

**Acceptance.**
1. `spool.feedback.handle` is standard for triage and external for a reply, with recipient count and counterparty known for an earlier exchange, new otherwise.
2. `spool.alerts.destinations` is standard inside the business's workspace or domain and external outside it; `spool.followups.resolve` adds external when resending an outside effect, including a public fix.
3. `spool.fixes.prepare`, `spool.fixes.merge` and `spool.repos.connect` add external for public repository writes and comments, with recipient count and counterparty public; a private internal draft stays standard.
4. `spool.tracker.sync` is standard for internal-only tickets and external for outside exposure, with recipient count and counterparty public for public GitHub/GitLab Issues, known for an outside tracker on record, new otherwise.
5. `spool.runs.diagnose` adds external for outside model egress; `spool.context.connect` adds it for outside trace forwarding; `spool.artifacts.manage` adds it for outside source fetching. Each names recipient count and counterparty known for a provider/origin on record, new otherwise.
6. `spool.billing.update` carries money with USD amount and payee; `spool.artifacts.manage` adds it for a raised storage cap and `spool.retention.update` or `spool.replay.settings` for a paid longer window.
7. Record text or arguments claiming an internal recipient or zero cost leave computed classes and facts unchanged.
8. `spool.members.update` adds external for an invitation that grants project access to a person or service outside the business; `spool.identity.update` adds it for an identity-visibility grant that exposes raw identity to one. Each names recipient count and counterparty known for a person or service on record, new otherwise; an internal-only grant adds no external.

#### SURFACE-003 — Live, security, access and destructive are computed per call

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006

**Requirement.** Spool's server computes the live, security, access and destructive additions from the setting a call changes, the direction of an authority change and the items it irreversibly converts or removes.

**Acceptance.**
1. `spool.filters.update` carries live and adds security for allowed-domain changes. `spool.artifacts.manage` adds security for source-fetch secret headers; `spool.tracker.sync` adds it for tracker credential connection, rotation and revocation. Each names the setting.
2. `spool.identity.update` carries security, adds access with direction for identity-visibility changes, and destructive with item count for irreversible retained-value conversion: keep to hash/drop, or hash to drop.
3. `spool.members.update` carries access with people and direction, adding security when handling project credentials. Owner erasure adds access with people and direction for its verified successor handoff.
4. `spool.retention.update` is standard for holds or longer windows, destructive with item count for shorter windows or cutoffs. `spool.context.connect` adds destructive with item count when disconnect irreversibly removes replay references.
5. `spool.alerts.destinations` adds destructive with item count for removal; `spool.erasure.run` carries it with item count for project, end-user or owner erasure.
6. `spool.replay.settings` carries security for consent and masking, adds live for sampling changes and destructive with item count for a shortened replay window or cutoff.
7. `spool.releases.record` adds live for release-ordering changes, including registered-sequence-only refusals, and security for the commit author and message sharing choice; `spool.billing.update` adds live for budgets/caps changing intake. Each names the project and setting.
8. `spool.runs.diagnose` adds live for candidate promotion, naming service and candidate; `spool.followups.resolve` adds live when an authorized resend performs a fix merge, naming the service.

#### SURFACE-004 — Commitment, accounts and gated are computed per call

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Spool marks the steps a provider keeps for a person as gated before they run, and computes accounts and commitment from what a call creates or binds.

**Acceptance.**
1. `spool.alerts.connect` adds accounts when it installs a chat or paging app, and gated at the provider's consent screen in a person's own account, naming the provider and the step.
2. `spool.repos.connect` and `spool.deploys.connect` add accounts only when installing a provider app, naming the provider, and gated at its consent screen, naming the step; editing an internal code mapping stays standard and connecting an existing app handles credentials as security without creating another account.
3. `spool.signin.update` and `spool.context.connect` add gated when the provider shows a consent screen.
4. `spool.billing.update` adds gated at the billing partner's hosted checkout, and commitment, with the counterparty, when it accepts terms.
5. A gated step goes to the named person whatever the policy says.
6. `spool.tracker.sync` adds accounts only when connecting installs a Jira, Linear or GitHub/GitLab provider app, naming the provider. It adds gated at the provider's consent screen for a new or existing app, naming provider and step; an existing app without consent adds neither accounts nor gated, while credential handling stays security.

#### SURFACE-005 — The triage engineer journey under two company policies

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-013

**Requirement.** A stranger agent given only the seed URL runs a seeded week of Spool work through MCP under two company policies, one of them autonomous for every class.

**Acceptance.**
1. The seeded week: triage the new and regressed issues, apply a grouping proposal, record a release and its deployment, reply to one end user's feedback, reproduce one failure, prepare and merge its fix in a public repository, and verify the released repair.
2. Under the policy that makes every class autonomous, the week completes with no approval, nothing refused by policy and an empty review feed.
3. Under the held policy (standard reviewed, every other class Spool declares waiting for approval, which the test person grants), each non-standard call waits with no effect and runs once approved, and the review feed lists the standard calls.
4. Under the held policy with external blocked, the feedback reply, public pull request and public merge are refused, and the remaining internal work completes.
5. Before setup is answered, the first call returns `policy_unset` with the setup link, and setup asks every Spool class with no answer pre-selected.

## Push further

### Agent-assisted repair

#### AI-001 — Controlled coding-agent handoff

*Tier:* Core · *Cites:* BASE-DATA-004, BASE-AGENT-004, BASE-AGENT-005 · *Rules:* D-1 · *Register:* R-18

**Requirement.** Cursor, GitHub Copilot and Claude can consume the same permissioned CLI/MCP packet, source/release links, gaps and current repair observations. The engineer who grants access selects project/repository scope, data fields, model/provider and budget. External data egress shows a preview of what leaves, keeps its audit, and access expires and is revocable; suggestions stay distinct from confirmed causes. Read-only diagnosis never silently acquires repository write or production authority. SDK-010 source context and frame-local egress inherit the previewed field selection here, and no agent or model gains them until that selection and its privacy controls ship. The named agent clients themselves are register row R-18.

**Acceptance.**
1. An agent client requests one issue packet, and its untrusted labels and missing coverage show.
2. Cross-project, mutation and prompt-injection requests are refused.
3. After the grant is revoked, the next HTTP, CLI and MCP call is denied.

#### AI-002 — Generate and test the smallest reproduction

*Tier:* Core · *Cites:* BASE-AGENT-011 · *Register:* R-1

**Requirement.** An agent combines sanitized occurrence, exact release/build/symbol/source artifacts, breadcrumbs, trace/replay and the input its grant allows to construct and minimize a deterministic reproduction. It tests competing causes and records counterexamples, failing input, environment and unsuccessful attempts in an isolated budgeted runner for each supported runtime/mobile target. No production credentials/network access are inherited; repository scope and dependency/network policy come from the agent's grant, which the agent never widens itself, and its cost stays within the company's spend caps. Unsupported, not reproduced, failed and reproduced remain distinct.

**Acceptance.**
1. For a real captured failure chosen for reproduction, the runner yields a minimal failing case and a competing-cause experiment.
2. Malicious telemetry, timeout and missing-artifact cases each end in their named state.
3. Repeated against the fixed release, the failure no longer reproduces.
4. A failed setup never becomes a not-reproduced success.

#### AI-003 — Minimal code repair as a tested pull request

*Tier:* Core · *Cites:* BASE-AGENT-007 · *Rules:* D-1, D-3 · *Register:* R-10

**Requirement.** From a reproduction and a repository grant, an agent prepares the smallest source change and regression case, compares candidates, runs the buyer's relevant tests/type/build/security checks in isolation and opens a draft GitHub PR or GitLab merge request with failing-before/passing-after evidence, changed files, risks and unresolved cases. A trigger rule that starts an investigation stays within the grant's scope and the company's spend caps. Writing to the provider and merging are calls with their classes (a draft branch or pull request is standard, or external in a public repository; a merge is live), which the company's policy decides; the agent never widens its own repository scope, and deployment stays the buyer's own CI/CD. Prompt content cannot authorize changes or bypass CI.

**Acceptance.**
1. A scoped repair yields a real source patch and a regression case that fails before and passes after.
2. One draft PR or MR opens.
3. Cancelling, expiring or revoking between steps leaves durable results, with no unauthorized write and no duplicate branch.

#### AI-004 — Prove the released repair from live rates

*Tier:* Core · *Rules:* D-3 · *Register:* R-19

**Requirement.** Once a fix is merged and deployed and its success criteria are set, an agent links the fix commit to actual deployed cohorts and exercises the failing customer flow. Compare before/after failure rates against observed comparable traffic, confidence/minimum exposure, adoption, sampling, old releases, capture loss, retention and grouping changes. Require the reproduction to pass and live evidence to support improvement; continue a bounded watch and reopen/escalate recurrence. Quiet or missing telemetry is inconclusive, never success. Show the exact denominator, window, counterexamples and reasons; the engineer may stop or revise criteria without rewriting observations. A buyer's live production traffic is register row R-19.

**Acceptance.**
1. With a fix deployed to only part of traffic and known healthy and failing flow exposure generated, the rate comparison shows its denominator, window and counterexamples.
2. Old-version errors and capture gaps make the verdict inconclusive.
3. With coverage restored the criteria are reached, and a later recurrence reads recurred.
4. The recurrence raises one accountable follow-up.

#### AI-005 — Explain grouping proposals before applying

*Tier:* Core · *Cites:* BASE-AGENT-007, BASE-AGENT-008 · *Rules:* D-4

**Requirement.** An agent compares stack, release, route and trace variants, proposes split/merge/rule changes and shows exact affected events, counterexamples, ownership and alert/rate/repair-verification effects. Applying or rejecting a proposal is a grouping correction in the standard class, and the company's policy decides whether an agent's proposal is applied alone or waits for a person to preview it and apply or reject it; undo preserves immutable originals and prior decisions. A person who decides a proposal is the owner until TEAM-001 supplies project roles. Agent proposals are labelled "proposed by agent <alias>". CTX-001 inherits trace-variant comparison for AI-005 before completion. The model cannot silently rewrite a group, suppress alerting or manufacture better repair results.

**Acceptance.** Given deceptively similar and rebuilt failures:
1. The agent's proposal shows exact affected events and counterexamples.
2. It shows the rate and alert differences.
3. After the owner rejects one proposal, nothing changes.
4. After the owner approves another, it applies.
5. Undoing it preserves the immutable originals and leaves a grouping-change coverage gap.

#### AI-006 — Prevent related failures from recurring

*Tier:* Core · *Rules:* D-1

**Requirement.** An agent mines accepted fixes, rejected hypotheses, production recurrence and the repository code its grant covers for shared violated invariants. It proposes reusable regression/property tests, identifies other affected call sites with evidence and counterexamples, and watches later releases for that invariant. Related-code guesses remain hypotheses. A new repository or service scope is a grant a person widens, never the agent itself; adding a test or a patch is a call with its class, which the company's policy decides; budgets, stop controls and known false positives stay visible.

**Acceptance.**
1. After a repair is accepted, a related failure introduced at another authorized call site yields the inferred invariant and a failing regression case.
2. A false positive is rejected and stays visible as known.
3. After a person approves a scoped patch, it lands with the person as approver and the agent as preparer.
4. Later recurrence is observed, and the agent's scope never widens on its own.

#### AI-007 — Agent-runtime failure diagnosis and evaluated improvements

*Tier:* Core

**Requirement.** For applications using LLM agents, correlate the model/tool spans the buyer's capture policy allows, latency, token/cost and sanitized failures with the application issue. Owner-configured detectors cluster failed production runs into improvement hypotheses; the agent investigates connected code in a sandbox and compares offline eval cases before suggesting a patch. Keep this scoped to diagnosing application failures; integrate dedicated agent analytics/evaluation systems for their broader job. Model choices, dataset consent, redaction and spend caps are settings people make, and promoting a candidate is a live call and sending data out an external one, which the company's policy decides.

**Acceptance.**
1. Authorized failing tool and model runs are imported or captured, and a repeated fault clusters with counterexamples.
2. The cluster shows cost, latency and error links.
3. A baseline and a candidate compare on an approved offline dataset.
4. Under the held policy, promotion and external data egress wait with no effect until the test person approves them.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | Native crashes, hangs and offline relaunches on physical iOS and Android devices, with symbols uploaded from a real build pipeline | SDK-002, AI-002, ERR-010 | not run | | |
| R-2 | A real Sentry buyer organization migrated through its own export and API account, including its real loader keys, dual-run at its production volume through a deploy-incident burst and cut over | MIG-001 | not run | | |
| R-3 | A real Datadog Error Tracking buyer project migrated, dual-run and cut over | MIG-002 | not run | | |
| R-4 | A real Rollbar buyer project migrated | MIG-003 | not run | | |
| R-5 | A real Bugsnag web and mobile buyer project migrated | MIG-004 | not run | | |
| R-6 | Real PostHog Error Tracking, GlitchTip and Better Stack Error Tracking buyer projects migrated | MIG-005 | not run | | |
| R-7 | A buyer's own Slack, Microsoft Teams, Discord, PagerDuty and Oncall workspaces receive alerts and run triage actions | ALERT-002, ALERT-005 | not run | | |
| R-8 | One real production email's delivered event, signed with the mail provider's production key, reaches the registered seed test target through the RunEditRun mail-event relay | ALERT-003 | passed | 2026-10-21 | CHANGELOG.md, provider receipt of 21 October 2026 |
| R-9 | Real bounced and complained events from the production mail provider through the owner-held SendGrid Event Webhook | ALERT-003 | not run | | |
| R-10 | A buyer's real GitHub, GitLab and Bitbucket repositories: provider applications, grants, source links, pull-request and merge-request comments and citations, and a real fix pull request | SRC-002, AI-003 | not run | | |
| R-11 | Real Jira and Linear tenants synchronized with Spool | TRACK-001 | not run | | |
| R-12 | Real Vercel and Netlify accounts registering deployments | INT-001 | not run | | |
| R-13 | Real Datadog and Splunk tenants receiving forwarded context | CTX-001 | not run | | |
| R-14 | Real PostHog Session Replay, LogRocket, FullStory and Datadog RUM tenants linked to Spool issues | CTX-003 | not run | | |
| R-15 | Vendor identity-provider tenants (Auth0, Okta) and a buyer's Google Workspace and GitHub organization sign-in | GOV-001 | not run | | |
| R-16 | A human screen-reader pass | UX-001 | not run | | |
| R-17 | A VPAT | UX-001 | not run | | |
| R-18 | The packet and MCP door used from the named agent clients: Cursor, GitHub Copilot and Claude | AI-001 | not run | | |
| R-19 | A repair verified from a buyer's live production traffic | AI-004 | not run | | |
| R-20 | Each configured real provider qualified with a buyer-controlled account on a hosted owner-account deployment | ERR-010, OPS-001 | not run | | |

## Boundaries

- Spool owns error/crash records, release health, error-linked traces/replay, triage and the repair-verification loop. Mobile SDKs, native symbolication, provider applications, billing and heavy sandbox workers are required engineering, not reasons to reduce this scope.
- General work planning remains [Vector](https://github.com/just-every/run-vector), and rotations, SMS/voice escalation and incident response remain [Oncall](https://github.com/just-every/run-oncall) or PagerDuty. TRACK-001 and ALERT-002 connect those products; Spool does not recreate their broader job.
- For monitoring and observability, see RunEditRun’s sibling [Porthole](https://github.com/just-every/run-porthole). Whole-platform infrastructure APM, general log warehousing, product analytics and model-evaluation suites remain connected services such as Datadog, Splunk and PostHog. CTX-001/002 and AI-007 still require the diagnosis context the error buyer needs; these boundaries do not exclude it.
- Scheduled-job and heartbeat monitoring is [Uptime](https://github.com/just-every/run-uptime)'s product; SDK-024 forwards Sentry SDK check-ins to the buyer's connected Uptime heartbeat.
- Cloudflare is the bounded intake/control plane, not a requirement to run native symbolication, replay processing or persistent sandboxes inside request execution. Use declared isolated worker/storage providers with quotas, custody, portability and erasure coverage; SDK-011's attachment, minidump, profile and replay items and SRC-004's source maps and debug files stream there rather than being held in request memory, and the request-size limits SDK-011 publishes still bind. SDK-002, SDK-011, GOV-002 and AI-002 retain the full obligation.
- Production deployment remains the buyer's own CI/CD action, after the buyer's own review; Spool does not deploy. Telemetry and model suggestions authorize nothing. Replay/raw requests/identity are opt-in with preview and redaction; no blanket claim of perfect secret removal or legal compliance is made. Health/payment data requires buyer-approved agreements and controls before capture, rather than an implicit assurance.
- Local deletion cannot remove already downloaded archives, delivered messages or remote-provider copies; show the limits and partner deletion path. ERASE-001 defines the exact offline-journal and backup limits: already downloaded archives, delivered mail, remote provider and identity-provider records, `OWNER_EMAIL` and alert destination configuration (`ALERT_DESTINATIONS`), D1 Time Travel and backups, and raw database imports lie outside the local fence, erasure reports these limits rather than claiming their deletion, and a brand-new store given only an older archive has no later journal and cannot recognize the erasure.
- No unlimited-ingest or complete-capture claim is permitted; GOV-003 and SRC-004 publish the limited figures a buyer buys (retention, retained volume, sustained intake rate and artifact capacity), and no lower undisclosed cap may stand in for them.
- Expanded category clauses supplement the published clauses' bounded guarantees; they do not turn the current single-owner implementation into a scope boundary.
- Incumbent names identify switching obligations, not claims about their current plans or feature availability.

## Homepage claims

| # | Claim | Clauses |
| --- | --- | --- |
| 1 | See exactly what broke: Spool catches your JavaScript errors and points to the exact line in your own source. | ERR-001, ERR-005 |
| 2 | 100% free, open source alternative to Sentry, Bugsnag and Rollbar. | OPS-001, SDK-001, MIG-001, MIG-003, MIG-004 |
| 3 | 100% free: open source under the MIT licence, with every feature on your own computer. | OPS-001 |
| 4 | Hand it to your coding agent: a read-only agent key reads that project's issues and evidence, and changes nothing. | ERR-004, ERR-007 |
| 5 | Know when it comes back: if a resolved issue returns in a later release, Spool opens it again and names that release. | ERR-006 |
| 6 | Your data stays yours: emails, tokens and passwords are scrubbed before anything is saved, and your source maps stay private. | ERR-003, ERR-005 |
| 7 | Take it all with you: export everything to one file and restore it into a fresh copy of Spool, on any computer. | ERR-009 |
| 8 | Try it beside what you have: add Spool's capture helper next to your current error tracker and compare the two. | ERR-001, MIG-001 |
| 9 | Running in three commands: Node 22 and pnpm are all you need; setup asks for your email, then dev prints a link that opens Spool. | OPS-001 |
| 10 | Spool catches an error on a release, maps it to the line in your original source and has its evidence packet ready to download. | ERR-001, ERR-005, ERR-007 |

## Retired clauses

| ID | Now | Reason |
| --- | --- | --- |
| BASE-DATA-003 | merged into ERASE-001 | Spool's own erasure clause carried the id of Base's BASE-DATA-003 duty, and a Base duty id is never a clause id; the clause takes the Spool prefix ERASE and cites the duty it extends. |

## Status

Judged from the code and tests at commit `d0f261508c50ae3a19168bc9adcc5aae8f942bae` (30 October 2026). Replayed the candidate onto current main. Retained its browser and public rer archive equality assertions, inert restored-work custody, fresh-run recovery, erasure replay refusal and retention snapshot assertions. ERR-009 remains partial with main's recorded Gap; this conflict resolution does not promote acceptance. Current main's newer ERR-005 judgment and all other clause rows are retained. Exact-candidate Verify and guarded publication remain landing gates.

Judged from the code and tests at commit `c33c5383417b89fff0812d644883a0bf30fa247e` (29 October 2026). SDK-028 native ordering, every existing release read and export, permutation and tie properties, policy boundaries and exact strict-refusal accounting passed the deployment history journey. The landing candidate adds an explicit whole-release archive preservation assertion; application source is unchanged. Exact-candidate Verify and guarded publication remain landing gates. Other clause judgments and held provider qualifications are retained. Landing replay retains the isolated Node release identity and alert assertions from candidate 86068c95640e979e33852d900ee7a96f6209c0d3. Main's SDK-009 partial judgment and its recorded evidence and gap remain authoritative; these additional assertions do not promote the clause.

Landing replay of candidate `54d2fd9a2b3bb93109abc3b530849c6935f0117a` retains main's partial ERR-006 judgment. Its additional emitted Worker, HTTP and issue-view assertions cover delayed older-release capture, inert split and merge previews, exact reviewed moves, immutable provenance and guarded undo. Application source and acceptance requirements are unchanged; the replay does not promote any clause.

REL-001 landing replay (30 October 2026): retained main's partial Status, Evidence and Gap judgment. The candidate's added CI progress/success/failure, rollback-history and single-release enrichment assertions are preserved in `tests/deployment-history.mjs`; this replay does not adopt its conflicting done promotion. Exact-candidate Verify remains the publication gate.

GROUP-001 landing adds default Python hidden-frame hash stability and an unhidden positive control, including assertions that both differing hidden frame identities survive intake before grouping is compared. The primary source lookup now omits hidden Python frames while preserving original source indices and restoring the same frame when unhidden; `src/ui/workbench/IssueView.tsx` and `tests/grouping-rules-flow.mjs` carry this fix and its proof. Main’s current partial Status, Evidence and Gap are retained; this additional proof does not adopt the candidate’s older done judgment. Exact-candidate Verify and guarded publication remain required.

Judged from the code and tests at commit `de0845c8c6396c9e8e96dad5050608394c933e1b` (29 October 2026): ERR-007 complete client projection equality, private bounded packets and authority checks passed the Agent handoff public journey. The landing candidate adds explicit no-write coverage across all packet readers and second-origin ERR-005 map-identity checks; its exact-SHA Verify remains the publication gate. Existing judgments and prerequisite scopes are retained.

Judged from the code and tests at commit `19bfd316bdfff4664fca43a6f034d8bff8a4a54a` (28 October 2026). TEAM-001 native membership, project roles, removal, scoped services, maintainer policies, audit, member deployment, team notification and inert custody journeys passed. Application source is unchanged; later proof assertions and generated documents are checked on the landing candidate. Other clauses retain their recorded judgments.

Judged from the code and tests at commit `01588d3d4167bf40da7bd9c0bbe5d2e131639fb0` (23 October 2026).

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 7 | 5 | 0 | 12 |
| Target and push further | 9 | 42 | 29 | 80 |
| All | 16 | 47 | 29 | 92 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `ERR-001` | Bounded admission | published | done | `src/domain/admission.ts`; `src/domain/capture.ts`; `migrations/core/0008_occurrence_identity.sql`; `tests/product-runtime.mjs` native admission journey (acceptance 1 to 3: acceptance, explicit refusals, unchanged archive rows and counted minute refusals); `tests/multilingual.mjs` multilingual public journey (acceptance 1 and 2: Python and Go acceptance and state-preserving refusals); `tests/agent-handoff.mjs` agent handoff public journey with `tests/agent-handoff/caps.mjs` capProof (acceptance 4: validated retained corpus, final-slot acceptance, counted capacity refusals, retry guidance and no partial rows) |  |
| `ERR-002` | Atomic acceptance | published | done | `src/domain/admission.ts`; `src/domain/capture.ts`; `tests/product-runtime.mjs` |  |
| `ERR-003` | Scrub before storage | published | done | `src/domain/privacy.ts`; `src/domain/scrub.ts`; `tests/privacy-table.mjs` |  |
| `ERR-004` | Separated authority | published | done | `src/domain/api.ts`; `src/domain/credential-fence.ts`; `src/domain/agent-access.ts`; `tests/agent-handoff.mjs`; `tests/dev-credentials.mjs` |  |
| `ERR-005` | Source map identity | published | partial | `src/domain/artifacts.ts`; `src/domain/packet.ts`; `tests/triage-journey.mjs`; `tests/sentry-sdk.mjs`; `tests/agent-handoff.mjs` Agent handoff public journey, second-origin captures: generated frames before upload, originals after upload, immutable admission snapshot beside current lookup, release and build mismatch refusals, confidential-source exclusion. Independent release-only and build-only mismatches preserve every generated frame with an identity_mismatch reason and no original coordinates; a fresh matching capture proves original file, one-based line and zero-based column. `tests/agent-handoff/packet.mjs` generatedFrames and compatible assertions. | The five browser source-map acceptance outcomes are asserted through the second-origin Agent handoff public journey. Remaining inherited work: expanded SDK-010 mapped lookup beyond the current 30-coordinate bound and SRC-004's recorded capacity, streaming, artifact lifecycle, isolated opt-in source fetching, ignore-list and production-build qualification. Native-device qualification remains held under SDK-002 and SRC-004; commercial qualification still needs BILL-001's pricing ruling. Existing queue scopes and release prerequisites are unchanged. |
| `ERR-006` | Audited triage and regression | published | partial | `src/domain/admission.ts`; `src/domain/operators/grouping.ts`; `tests/product-runtime.mjs` emitted Worker and D1 acceptance (newer-release reopening and strictly older capture after newer resolution); `tests/alerts-native.mjs` native scheduled event delivers a later-release regression with silent local mail once; `tests/operator-flow.mjs` operatorFlow (inert HTTP split and merge previews, fenced apply and undo, stale revisions and immutable originals); `tests/triage-journey.mjs` journey calling `tests/operator-ui.mjs` operatorUi (inert previews, exact split and merge apply and undo, inspectable original membership at 1440 and 390); `tests/operator-archive.mjs` operatorRetentionAndErasure (expired occurrence and erasure fences) | Main's partial judgment is retained during this landing replay. The candidate adds the cited regression, inert-preview and issue-view correction assertions; a fresh acceptance review of that evidence remains separate from conflict resolution. |
| `ERR-007` | Sanitized evidence packet | published | done | `src/domain/packet.ts`; `src/domain/agent-projection.ts`; `packages/agent/bin/spool-agent.mjs`; `tests/agent-handoff.mjs` Agent handoff public journey: complete HTTP, CLI JSON, embedded Markdown JSON and official MCP equality; unchanged archived rows; next-call revocation. `tests/agent-handoff/caps.mjs` capProof: UTF-8 byte boundary, newest-first omission and included and available counts. `tests/agent-handoff.mjs` gaps: retention, import and loss. `tests/agent-handoff/packet.mjs` compatible and noSecrets: secret and confidential-source exclusion. `tests/agent-handoff/scope.mjs` scopeProof: exact-project reads and cross-project refusal. |  |
| `ERR-008` | Loss counters and repair observation | published | done | `src/domain/repairs/observation.ts`; `src/domain/exposure/proof.ts`; `src/domain/sentry/client-reports.ts`; `tests/client-report-flow.mjs`; `tests/repair-recovery.mjs` |  |
| `ERR-009` | Archive, restore and retention | published | partial | `src/domain/archive.ts`; `src/domain/portability.ts`; `src/domain/retention.ts`; `scripts/installer/portability.mjs`; `tests/product-runtime.mjs`; `tests/agent-handoff.mjs`; `tests/old-archive.mjs` Supplementary replayed candidate evidence (status and recorded Gap retain current main's judgment): Acceptance 1: `tests/triage-journey.mjs` journey (Download private archive, verified downloaded rows and private maps at 1440 and 390); `tests/repair-recovery/archive.mjs` archiveProof (public rer export and import equality, credential exclusion and fresh owner setup), invoked by `tests/repair-recovery.mjs`. Supplementary public rer export and import equality assertions remain in `tests/commands.mjs`; qualification here relies on the completed clause journeys. Acceptance 2 and 4 to 6: `tests/product-runtime.mjs` independent empty restore and unchanged-row refusals; `tests/old-archive.mjs` published and current independent restores, mismatched schema, corruption and occupied-target refusals. Acceptance 3: `tests/repair-recovery/archive.mjs` archiveProof (source session and grant refusals, historical repair verification); `tests/execution-journey.mjs` archive (unchanged historical facts, excluded tokens and leases, zero dispatch, refused historical approval and passing-run authority, fresh-run recovery, erasure and replay refusal); `tests/execution/ui.mjs` restoredExecutionPanel and `tests/repair-recovery/ui.mjs` restoredRepairPanel (historical states, Axe and reflow at 1440 and 390). Acceptance 7: `tests/repair-recovery/archive.mjs` archiveProof (all repair and check rows and ordered snapshot identifiers preserved, exact removed_by_retention markers and retained recurrence). D-6: `src/domain/restored-work.ts`, `migrations/core/0084_restored_work.sql`, `src/domain/portability.ts`, `src/domain/erasure/declaration.ts` and `src/domain/erasure/owner-declaration.ts` declare destination-only custody, archive exclusion, project erasure and attribution-free owner retention. | Not asserted in the cited tests: export through the browser download and through `rer export` (asserted in tests/multilingual.mjs and tests/commands.mjs, which this clause does not cite); restored work holding no active grant (only the archive's lack of credentials, sessions and ingest key is asserted), starting no dispatch and holding no current repair proof; and repair snapshots keeping their coverage gaps after a manual cutoff. Asserted: restore into an independent empty destination with every row equal, an archive without credentials, sessions or ingest key, and refusal of tampered, conflicting and nonempty-target imports before mutation. |
| `ERR-010` | Release gates | published | partial | `tests/triage-journey.mjs`; `tests/agent-handoff.mjs`; `tests/repair-recovery.mjs`; `tests/execution-journey.mjs` | Local journeys exist; full target, hosted/provider and native-device acceptance remain open. |
| `OPS-001` | Base commands and native admission | published | partial | `scripts/installer/local.mjs`; `scripts/installer/portability.mjs`; `src/editor`; `tests/commands.mjs`; `tests/owner-claim.mjs`; `tests/dev-credentials.mjs` | Not asserted in the cited tests: refusal of an unsafe answer path, and denial of anonymous and project-grant editor access (asserted in tests/owner-editor.mjs, which this clause does not cite). Asserted: install, setup, dev, export, import and reset, the provider-free dry run, setup preservation and reused-claim refusal. |
| `ERASE-001` | Project and installation-owner erasure | published | done | `src/domain/erasure/declaration.ts`; `src/domain/erasure/owner-declaration.ts`; `src/modules/erasure`; `tests/project-erasure.mjs`; `tests/project-erasure-cap.mjs`; `tests/owner-erasure.mjs` |  |
| `TEAM-001` | Organizations, members and project permissions | target | done | `tests/team-flow.mjs` teamFlow (organization, native invitations, simultaneous roles and transfer); policyAuthority (maintainer-only filters/grouping); concurrentTriage (disjoint projects and revision conflict); revokedAuthority (held-write removal and UI/HTTP/SDK/CLI/MCP/export fences); serviceAuthority (explicit scopes and sponsor removal); memberDeployment (member deployment); teamRiders (timezone digests, expiring snooze, loss/backlog, alternate responsibility and nonrecursive follow-up); inertTeamArchive (inert member/grant/invite/service restore and unchanged safe facts); `tests/team-browser.mjs` browserMembers (invitation, scoped role saves and refusal, services at 1440 and 390), memberBrowser (live member removed to sign-in); `tests/owner-erasure.mjs` native owner custody; `tests/project-erasure.mjs` declared team stores; `tests/old-archive.mjs` populated upgrade; `docs/MEMBERS.md` | |
| `TEAM-002` | Accountable assignment and ownership rules | target | partial | `src/domain/operators/policies.ts`; `tests/operator-flow.mjs` | Current assignment is an operator label; authenticated teammates, CODEOWNERS and assignment notifications are absent. |
| `TEAM-003` | Collaborative lifecycle and bulk triage | target | partial | `src/domain/operators/bulk-triage.ts`; `src/ui/workbench/BulkTriage.tsx`; `tests/bulk-triage-flow.mjs`; `tests/investigation-flow.mjs`; `docs/BULK-TRIAGE.md` SDK-009 supplies plain/current/next/named owner and bulk resolution. | Shared team discussion, member assignment, priority and collaborative recurrence/suppression policies remain absent. |
| `TEAM-004` | Issue short IDs and resolution from commits and pull requests | target | done | `src/domain/short-ids/`; `src/domain/commits/`; `migrations/core/0059_short_ids_commit_citations.sql`; `src/ui/workbench/CommitTimeline.tsx`; `src/ui/workbench/RepositoryLinkLog.tsx`; `src/ui/workbench/CommitSharing.tsx`; `tests/release-identity-flow.mjs`; `tests/operator-flow.mjs`; `tests/agent-handoff.mjs`; `tests/alerts-runtime.mjs`; `tests/alerts/delivery-flow.mjs`; `tests/sentry-import.mjs`; `tests/old-archive.mjs`; `tests/project-erasure.mjs`; `tests/owner-erasure.mjs`; `docs/SHORT-IDS.md`; `docs/retained-verification/team004/` Journey **TEAM-004 short IDs, commit citations, resolution and unknown-ID link log**: stable per-project short IDs in lists, issue view, search, JSON/CSV exports, packets, CLI/MCP, alert email/webhook bodies and digests, kept as aliases through merge, split and guarded undo; deploy-key release and deployment door citations (Fixes, Resolves or Closes, any case) linked at once on the issue timeline; unknown, other-project and imported-history citations logged with reason and changing nothing; idempotent repeats; resolution in the first including release under SDK-009's named resolution and SDK-028's ordering, with newer-release regression, older-release protection and auto-created SHA release association; author/message owner-only by default and shared by the audited owner choice; retention, project and owner erasure; inert byte-identical restore; v0.6.0 upgrade numbering; 1440/390 states. |  |
| `TEAM-005` | Per-member notification settings and issue subscriptions | target | missing |  | No implementation proof yet: per-member notification settings and issue subscriptions. |
| `SDK-001` | Multi-language SDKs and DSN-compatible intake: browser JavaScript and Node.js | target | done | Q1–Q7 Node: `tests/sdk-runtimes.mjs` ([SDK-001] node journey), `tests/runtimes/node.mjs`; Q1–Q7 browser, real widget/replay and build-plugin original line: `tests/sentry-sdk.mjs`, `tests/runtimes/browser.mjs`; lifecycle reports: `tests/client-report-sdk.mjs`; inherited SDK-009 Node identity: `tests/runtimes/node.mjs`; screens: `docs/retained-verification/sdk001/`. |  |
| `SDK-002` | Native crashes and symbolication | target | missing |  | No implementation proof yet: native crashes and symbolication. |
| `SDK-003` | Automatic breadcrumbs and private context | target | partial | `src/domain/capture.ts`; `src/domain/sentry/convert.ts`; `packages/sdk/src/browser.ts`; `tests/privacy-table.mjs` | Supplied breadcrumb messages are stored; full automatic instrumentation and configurable context capture are absent. |
| `SDK-004` | User feedback attached to failures | target | partial | `src/domain/feedback/`; `src/ui/workbench/FeedbackPanel.tsx`; `tests/feedback-flow.mjs`; `tests/sentry-sdk.mjs` ([SDK-004] reportDialogFlow); `tests/report-dialog-flow.mjs`; `src/domain/report-dialog/`; `docs/FEEDBACK.md` | The hosted crash-report modal is qualified through the unmodified browser SDK and queued loader stub at 1440/390, sharing the consented description-only feedback intake, exact occurrence association and withdrawal. Text descriptions from modern Sentry feedback events/items and legacy user_report are scrubbed, retry-safe and linked to an exact retained occurrence or shown as standalone/unavailable-reference reports in the owner inbox. Issue review and withdrawal, archive restore, retention and project/owner erasure cover this store. Contact and attachments are excluded; Spool’s independent localized widget, contact/replies, screenshot review, broader abuse policy and end-user identity erasure remain absent. |
| `SDK-005` | Crash-free sessions and release health | target | partial | `src/domain/sessions/`; `src/domain/identities/key.ts`; `tests/sentry-sdk.mjs` ([SDK-005] sessionFlow); `tests/session-flow.mjs`; `tests/sdk-runtimes.mjs`; `tests/old-archive.mjs`; `tests/owner-erasure.mjs`; `migrations/core/0072_release_sessions.sql`; `docs/SENTRY-SESSIONS.md` Observed individual/aggregate session intake, per-project keyed DID hashes, automatic release identity, bounded owner/exact-project read and JSON health export, explicit denominators, observed adoption and 95% Wilson intervals now exist. Unmodified default Node healthy/crashed and browser healthy/unhandled sessions reconcile against a reference collector with only DSN changed; browser unhandled is preserved separately from process crash. Sessions create no occurrence, issue, alert or accepted-error unit. Origin and available category filters, per-item refusal and named bounds apply; session client-discard protocol tokens remain counted. Populated upgrade, private key/aggregate archive restore and project/owner erasure are proven. Releases and suspect comparisons reflow at 1440/390 without serious Axe findings or icon-only controls. | Mobile session modes, device/OS/version cohorts and ANR rates, comparable adoption cohorts, rollback, trends, the 20% rollout acceptance, runtime-specific health qualification beyond Node/browser, Spool-SDK sessions and full SDK-008 policy/role scope remain absent. Idle-project expiry, aggregate replay deduplication and category backpressure headers remain gaps. Unauthenticated key refusals do not mutate project counters; loader disabled state is not an independently disabled ingest-key policy. The inherited sentence "sessions accept no release" remains unmet: this brief and SDK-007 require release-less sessions counted invalid. Session users use keyed per-project hashes only, a builder default recorded in docs/contract/adopted-defaults.md. |
| `SDK-006` | Ingest-time inbound filters and allowed domains | target | done | `src/domain/filters/`; `src/domain/admission.ts`; `src/domain/origins.ts`; `src/ui/workbench/InboundFilters.tsx`; `tests/inbound-filter-flow.mjs`; `docs/INBOUND-FILTERS.md` |  |
| `SDK-007` | Sentry envelope item coverage from unmodified SDKs | target | partial | `src/domain/sentry/wire.ts`; `src/domain/sentry/routes.ts`; `src/domain/sentry/client-reports.ts`; `src/domain/feedback/`; `tests/sentry-http.mjs`; `tests/client-report-flow.mjs`; `tests/sentry-sdk.mjs` | Errors, text feedback and client_report items are routed after complete envelope framing. SDK-reported discards are counted by bounded reason/category and quantity, separately from accepted events; invalid reports are individually counted while valid companion errors continue. The real Node SDK flush emits reports through its normal transport; automatic browser lifecycle report emission is qualified by the [SDK-001] journey in `tests/sentry-sdk.mjs`. Unsupported categories remain diagnosed. Check-ins are routed under SDK-024. Bounded sessions and release health are routed under SDK-005, with keyed DID hashes and named limitations. Traces, profiles, replay, logs, metrics, dedicated crash/security doors, category backpressure and full runtime qualification remain absent. |
| `SDK-008` | Sentry user identity policy and affected users | target | partial | `src/domain/identities/`; `src/ui/workbench/IdentityPolicy.tsx`; `src/ui/workbench/AffectedUsers.tsx`; `migrations/core/0073_identity_policy.sql`; `tests/sentry-sdk.mjs` ([SDK-008] identityFlow); `tests/identity-flow.mjs`; `tests/execution/exposure.mjs`; `tests/old-archive.mjs`; `tests/owner-erasure.mjs`; `docs/SENTRY-IDENTITY.md` | Four-field id/email/username/ip_address keep/hash/drop policy, count-only preview, stale approval refusal, audited atomic stricter conversion and later intake exist. The owner issue section shows known and unattributed users. Unmodified browser and Python programs reconcile with a reference collector with only DSN changed: three explicit identity types and two literal IPs count 5 known users; two auto-address visitors stay unattributed. Hash preserves the count without raw values in storage, views, packets or archives; drop shows unavailable with its reason. Native random-client counts agree with repair exposure. Migration 0066 preserves populated upgrades, private archive restore and project/installation-owner erasure; a successor chooses a fresh policy above the safe historical revision floor. Settings and issue sections pass 1440/390 overflow and serious Axe checks with no icon-only controls. Remaining: project creation policy display, name/geo/segment/custom/default-PII fields, per-field session DID policy, organization floor (TEAM-001), MIG-001 import/dual run, issue-stream/sort, alert/report/cohort shared figures; the Worker exposes no connecting socket address, so `{{auto}}` remains unavailable and the specified five-user acceptance using two auto visitors is unproven; trusted ingress configuration under RL-101 is absent. The keep-as-sent default awaits a ct ruling; the adopted default (all four fields drop) is in docs/contract/adopted-defaults.md. SDK-005 session DID stays keyed-hash-only. |
| `SDK-026` | User search, facets and identity visibility | target | partial | `src/domain/identities/`; `src/ui/workbench/AffectedUsers.tsx`; `tests/identity-flow.mjs`; `docs/SENTRY-IDENTITY.md` | Exact-project read-only grants and packets receive counts only. User search and facets, saved-search previews and project member identity roles remain absent. |
| `SDK-027` | End-user erasure | target | missing |  | No implementation proof yet: end-user erasure by email remains absent. |
| `SDK-009` | Release identity from unmodified Sentry SDKs: no release, automatic releases and plain Resolve | target | partial | `src/domain/releases/`; `src/domain/sentry/convert.ts`; `src/domain/operators/bulk-triage.ts`; `src/ui/workbench/ResolutionPicker.tsx`; `tests/release-identity-flow.mjs`; `tests/bulk-triage-flow.mjs` Event identity, no-dist separation and upgrade, automatic release enrichment, first-seen/semver/registered total ordering, plain/current/next/named owner and bulk resolution, revision-fenced previews, strict/pattern/name outcomes, archive restore and 1440/390 picker journeys. | Not asserted in the cited tests: the new-issue alert for the unmodified Node SDK's release-less and SHA-release events, and release-scoped views naming release-less events (both asserted in tests/runtimes/node.mjs, which this clause does not cite). Asserted: acceptance, auto-creation with first-seen time and creating SDK, search, enrichment, plain, next and named Resolve, release-less counting without reopening and invalid release names. |
| `SDK-028` | Release ordering rule | target | done | `src/domain/releases/`; `tests/deployment-history.mjs` deployment history journey invokes `tests/release-order-flow.mjs` releaseOrderFlow: acceptance 1 and 2 native and Sentry-compatible lists, unmodified release-list CLI, issue release arrays and filter choices, health and report JSON and CSV exports, ordered private archives and lossless restore; acceptance 3 `tests/release-order-properties.mjs` releaseOrderProperties, all 120 fixed-metadata permutations, repeated sorts and all comparison triples under every setting; acceptance 4 releaseOrderTies, equal-time UTF-8 names, equal-precedence build metadata and legacy first-seen fallback, with production comparator and public SQL agreement; acceptance 5 changedBoundaries, inert preview, audited later-only policy, current and next resolution, comparisons, latest reads and exact regression alerts; acceptance 6 registeredRefusals, named event and session refusals, exact outcomes and usage, unchanged data, revoked grant refusal and registered recovery. `tests/release-identity-flow.mjs` releaseIdentityFlow and sdk009ReleaseResolution cover enrichment, semantic older-release protection, named and next resolution; `tests/sentry-http.mjs` also invokes team004Flow for commit resolution. |  |
| `SDK-010` | Sentry event fidelity: exception chains, frames, local variables, tags, contexts and request | target | partial | `src/domain/sentry/evidence.ts`; `src/domain/sentry/query.ts`; `src/ui/workbench/SentryEvent.tsx`; `tests/fidelity-flow.mjs` (SDK-010). Rich chain/group/frame/local/context evidence, scrubbed query retention, named exclusions, archive/packet privacy and bounded trimming. | Not asserted in the cited test: the `password` local masked in storage and exports; Related Exceptions and an `asyncio.TaskGroup` failure; root-cause marking for Node, Next.js and Java chains; the SDK's browser and os contexts read back; the `browser.name` and `os.name` tag-summary rows; the request URL and allowed headers; and the copied raw stack trace. Asserted: the chained exception's frames, context lines and locals, masking at the owner door and in packets, two root causes with their alerts, exception-group acceptance, the `browser.name` tag, the `tenant` tag summary and tag search, scrubbed request secrets, message-template grouping and the 1,000-frame bound. |
| `SDK-011` | Sentry intake encodings, published size limits and per-item refusal | target | partial | `src/domain/sentry/wire.ts`; `src/domain/sentry/routes.ts`; `tests/sentry-http.mjs`; `tests/sentry-sdk.mjs` | Uncompressed, `gzip` and `deflate` bodies are accepted with bounded decompression. Public-door SDK-011 proof checks deflate issue creation and expanded-size refusal, unsupported encodings named in 415 responses and counted with header/query ingest grants, and malformed event JSON refused as `invalid_item` while a valid companion is admitted without extra accepted units. The whole request remains capped at 256 KiB compressed, 1 MiB expanded and 100 items; `br`/`zstd`, Sentry-equal limits, oversized-item isolation, streamed heavy-item storage and full usage/dual-run reconciliation remain absent. |
| `SDK-012` | Unmodified server-runtime SDKs: Python, Go, Java/JVM, Ruby, PHP, .NET, Rust and Elixir | target | partial | `tests/sdk-runtimes.mjs`; `tests/runtimes/`; `tests/runtimes/screens.mjs`; `tests/runtimes/python.mjs`; `tests/runtimes/java.mjs`; `src/domain/sentry/auth.ts` Push Verify jobs runtime (python), (go), (java), (ruby), (php), (dotnet), (rust) and (elixir) each run one unmodified SDK program against a reference collector and against Spool with only the DSN changed. Q1: "every SDK error event is a persisted occurrence", "handled exception chain persisted" and the handled issue read through the UI at 1440 and 390. Q2: "unhandled failure persisted as unhandled" (sentry-go v0.50.0 marks a recovered panic only with level fatal, client.go line 805, which Spool keeps); in runtime (elixir) a crashed Task is reported by the SDK's logger handler with handled false, and `tests/runtimes/elixir/app.exs` attaches its cart in the process that runs the checkout, because sentry 14.0.0 loses a crash whose caller holds an attachment (the handler passes the caller's context as capture options, lib/sentry/logger_utils.ex line 30; Sentry.Event.create_event/1 refuses :attachments, lib/sentry/event.ex line 196; the handler swallows the error, lib/sentry/logger_handler.ex line 475). Q3: "the restarted process groups into the same issue" with no duplicate occurrence. Q4: "Spool outcomes reconcile with SDK-sent items" with tracing, logs and an attachment from every runtime and sessions from Python, Java, Ruby (request mode), .NET and Rust; sentry-go v0.50.0, sentry/sentry 4.34.0 (PHP) and sentry 14.0.0 (Elixir) offer no sessions. Q5: "release and dist equal what the SDK sent" and "release is created automatically". Q6: client-report discards in project outcomes (BILL-001 usage) from Python, Go, Java, .NET, Rust and Elixir; sentry/sentry 4.34.0 sends none (Client.php lines 354-366 only log a before_send drop) and sentry-ruby 7.1.0 sends none from this process (Sentry.close flushes the report, sentry-ruby.rb line 303, before stopping the worker that records the discard, line 312). Q7: "refused or undeliverable events create nothing". P1: "the release-less event raises one new-issue alert", "release-less alert names no release", "SDK-inferred git SHA is the release", "release-scoped no-release count" and the Releases and Alerts screens at 1440 and 390. P2: the raise-from chain, ExceptionGroup, default local variables, SDK context and "Django request headers are kept". J1: the Caused by chain with a suppressed exception (java verify). | Q6 is unshown for PHP and Ruby: sentry/sentry 4.34.0 and sentry-ruby 7.1.0 send no client report from these programs, so no discard reaches usage. Asserted: Q1 to Q5 and Q7 for all eight runtimes, Q6 for the other six, and the inherited Python and Java journeys. |
| `SDK-013` | Unmodified Electron SDK | target | done | Q1–Q7: `tests/sdk-runtimes.mjs` ([SDK-013] electron journey), `tests/runtimes/electron.mjs`, `tests/runtimes/electron/`; main/renderer handled and unhandled API/UI, relaunch grouping, exact item reconciliation, release/dist, SDK discards and refusal. Screens: `docs/retained-verification/sdk013/`. |  |
| `SDK-014` | Unmodified Unity SDK | target | missing |  | No implementation proof yet. The CI job needs an activated Unity license; obtaining one is engineering work, not a waiver. |
| `SDK-015` | Unmodified iOS (Apple) SDK | target | missing |  | No implementation proof yet. A named macOS job with an iOS simulator or device is engineering work. |
| `SDK-016` | Unmodified Android SDK | target | missing |  | No implementation proof yet. A named job with an Android emulator or device is engineering work. |
| `SDK-017` | Unmodified React Native SDK | target | missing |  | No implementation proof yet. iOS and Android jobs are engineering work. |
| `SDK-018` | Unmodified Flutter SDK | target | missing |  | No implementation proof yet. iOS and Android jobs are engineering work. |
| `SDK-019` | Unmodified Kotlin Multiplatform SDK | target | missing |  | No implementation proof yet. |
| `SDK-020` | Guided setup command and published framework setup | target | partial | G1–G4: `tests/setup-flow.mjs` ([SDK-020] packed setup journey: reviewed/applied patch, real production error before/after map upload, receipt and no-write refusals). G5: `docs/SENTRY-SWITCHING.md` (Framework setup). Screens: `docs/retained-verification/sdk020/`. | Not asserted in the cited tests: G5, the seven framework guides published (they exist only in docs/SENTRY-SWITCHING.md, a GitHub-only engineering note; no cited test reads them). Asserted: G1 to G4. |
| `SDK-021` | Tunnel handlers and ad-blocker delivery | target | partial | `packages/sdk/src/tunnel.ts`; `packages/sdk/src/next.ts`; `packages/tunnel-python/spool_tunnel.py`; `tests/tunnel-flow.mjs`; `docs/SENTRY-SWITCHING.md` | Node, Next.js and Python tunnels with the DSN check, forwarded origin, rate-limit reply and bounded body; the default route blocked and the tunnel delivered under the EasyPrivacy Sentry rules in the Ghostery engine. Tunnels forward `X-Forwarded-For`, but no tunnel is trusted yet, so `{{auto}}` resolves only from the connecting address and events through a tunnel carry the tunnel server's address. Remaining: trusted ingress configuration with positive spoof-refusal proof (RL-101), a real ad-blocker browser extension and the MIG-001 dual run. |
| `SDK-022` | First-party ingest subdomain | target | missing |  | No implementation proof yet. The hosted deployment, the DNS zone and managed TLS are engineering work recorded in the clause. |
| `SDK-023` | JavaScript Loader Script per DSN key | target | done | `tests/sentry-sdk.mjs` ([SDK-023] loaderFlow); `tests/loader-flow.mjs`: lazy call/error capture API/UI, eager and both hooks, force load, key settings/integrations, uniform key refusal, direct-SDK identity/grouping/outcomes and release-less intake; `tests/loader-upgrade.mjs`: populated same-key upgrade; `tests/old-archive.mjs`: released upgrade/restore; public archive/restore/erasure in `tests/loader-flow.mjs`; push verify (sdk) and verify (runtime); screens `docs/retained-verification/sdk023/`. |  |
| `SDK-024` | Cron check-ins routed to Uptime | target | partial | `src/domain/checkins/`; `migrations/core/0069_checkin_routes.sql`; `src/ui/workbench/CheckInRoutes.tsx`; `tests/sentry-sdk.mjs` ([SDK-024] checkInFlow); `tests/checkin-flow.mjs`: connected start/success/failure receipts, unconnected check-in counted unrouted, refusals and failures, trace link, custody and populated upgrade; `tests/sdk-runtimes.mjs` with `tests/runtimes/harness.mjs`: server-runtime check-ins counted unrouted in Q4; `tests/old-archive.mjs`; `docs/CHECK-INS.md` | The receiver in the proof is a recorded double of Uptime's documented heartbeat door at the egress edge: no real Uptime installation received a receipt, and DONE needs Uptime's own heartbeat route (run-uptime main read at `9f50e5050d206551ca4c7e2af8dbbe2cb5b405b5`, not run). Linking: the unmodified Node SDK (`@sentry/core` 11.6.0 `captureCheckIn`, `contexts.trace`) and Python SDK (`sentry-sdk` 2.72.0 `scope.py` `_apply_contexts_to_event`) stamp the check-in and the job's errors with one trace id, which Spool shows on the occurrence (Node proven through the UI and API; Python read from source only); sentry-go v0.50.0 (`interfaces.go` `checkInMarshalJSON`) and sentry-elixir 14.0.0 (`lib/sentry/check_in.ex`, caller-supplied `contexts`) send no trace on a check-in, so their errors have no link. Sentry's duration, monitor config, release, environment and check-in id have no receiving field in Uptime's heartbeat door and are not forwarded; receipts keep arrival order. No real provider call, device, live Uptime installation or consent was used; builder defaults are in docs/contract/adopted-defaults.md. |
| `SDK-025` | Persisted non-error outcomes for every SDK-001 runtime | target | partial | `src/domain/feedback/`; `src/domain/sentry/client-reports.ts`; `tests/sentry-sdk.mjs`; `tests/client-report-flow.mjs`; `tests/sdk-runtimes.mjs` (java and dotnet qualification); `tests/runtimes/feedback-proof.mjs` feedbackProof (SDK-produced quantity, per-occurrence descriptions, exact retained associations, issue reads and rendered feedback) | Feedback text and client-report discards persist for browser/Node (and Java and .NET feedback in the SDK-012 runs); bounded sessions persist under SDK-005 (Node/browser health qualified; other runtime health remains a gap), while traces, replay, logs and attachments are counted as unsupported. |
| `GROUP-001` | Explainable grouping and durable corrections | target | partial | `src/domain/grouping/`; `src/domain/sentry/grouping.ts`; `src/ui/workbench/GroupingRules.tsx`; `tests/grouping-rules-flow.mjs`; `tests/operator-flow.mjs`; `tests/fidelity-flow.mjs`; `docs/GROUPING-RULES.md` | Not asserted in the cited tests: a `__traceback_hide__` frame's exclusion from a frame-based hash (the cited event is grouped by a custom fingerprint rule). Asserted: every other point. |
| `FIND-001` | Search, facets and saved investigation views | target | partial | `src/domain/investigation/search.ts`; `src/domain/investigation/query.ts`; `src/ui/workbench/IssueList.tsx`; `tests/investigation-flow.mjs`; `tests/bulk-triage-flow.mjs`; `docs/INVESTIGATION.md`; `docs/BULK-TRIAGE.md` ;  `src/domain/review/`; `src/domain/investigation/search.ts`; `src/domain/investigation/query.ts`; `tests/bulk-triage-flow.mjs` [FIND-001]; `docs/REVIEW-INBOX.md` | Owner-only review:pending count/filter, atomic previewed review of one/selection and regression reopening; 25 validated saved queries per project, authority-safe links, archive/restore/erasure and 1440/390 proof. Team search, shared views and additional priority remain gaps. |
| `FIND-002` | Issue impact, detail and event navigation | target | partial | `src/domain/investigation/events.ts`; `src/ui/workbench/EventExplorer.tsx`; `src/ui/workbench/SentryEvent.tsx`; `src/ui/workbench/RepositorySource.tsx`; `tests/fidelity-flow.mjs`; `tests/repository-source-flow.mjs` | Owner detail selects exact retained occurrences with cursor pages, combined event queries, navigation, chain/context/raw evidence and all-issue tag counts. Selected source frames link through explicit recorded mappings to exact repository revisions, distinct from SDK context and map coordinates. User and session analytics and provider qualification remain absent; agent packets retain their minimized scope. |
| `FIND-003` | Trends, dashboards and team reports | target | missing |  | No implementation proof yet: custom dashboards, team reports and permissioned report exports remain absent. |
| `SRC-001` | Build artifacts and CI pipelines | target | partial | `packages/sdk/src/sourcemaps/`; `src/domain/source-map-builds.ts`; `tests/sdk-package.mjs` (sourceMapPlugins, [SRC-001]); `tests/source-map-plugins.mjs`; `docs/SOURCE-MAPS.md` | Packed Vite/Rollup/webpack/esbuild plugins share injection/upload, declare required map sets, verify stored checksums, reject incomplete builds before output publication and allow late completion. Release details name missing maps; declarations archive/restore and erase. Required-set declarations are bounded to 2000 names and 256 KiB. Remaining: real GitHub Actions and GitLab CI application jobs, full SRC-003 unmodified CLI/Sentry-plugin matrix, private source bundles/native symbols (SRC-004), deployment access/retention checks beyond exact deploy authority and the artifact set, Next.js and Hermes builds. |
| `SRC-002` | GitHub, GitLab and Bitbucket source context | target | partial | `src/domain/repository-links.ts`; `src/domain/operators/deployments.ts`; `src/ui/workbench/RepositorySource.tsx`; `tests/repository-source-flow.mjs`; `docs/REPOSITORY-SOURCE.md` | Explicit owner/deploy-recorded manifest and path mappings link Python/Go reported coordinates and mapped JavaScript originals to full-SHA GitHub, GitLab and Bitbucket file/line URLs. Missing/unsafe/unmatched evidence is visibly unmapped; links are labeled unverified and no source is fetched. Provider grants, access revocation, automatic mappings, suspect commits, CODEOWNERS, PR comments and real-account qualification remain absent. Existing GitHub draft-PR read-back uses a provider double. TEAM-004 provider citations are inherited here: GitHub PR and GitLab MR title/description citations, merged-PR merge commits, PR recorded on resolution and connected full-SHA association pass TEAM-004's parser, link log and resolution before shipping; no real provider receipt yet. |
| `SRC-003` | sentry-cli and Sentry build-plugin compatibility | target | partial | `src/domain/sentry-cli/`; `src/domain/sentry/convert.ts`; `src/domain/artifacts.ts`; `migrations/core/0060_sentry_cli.sql`; `src/domain/audit/classify.ts`; `tests/sentry-cli-compat.mjs`; `tests/sentry-cli/`; `docs/SENTRY-CLI.md`; `docs/retained-verification/src003/` | The released `sentry-cli` and the Vite, esbuild, Rollup and webpack plugins run unmodified against the emitted Worker under deploy-only authority: release new, set-commits (TEAM-004 citations, link log, resolution), finalize, deploys, debug-ID and release/dist source maps with original frames, `send-event`, per-file refusals in client output, interrupted-upload resume, denials storing nothing, archive, restore and erasure. Not done: native debug files (SDK-002), `--auto` and `--commit` through a connected repository (SRC-002), Android Gradle, Xcode, Dart, the GitHub Actions and GitLab CI matrix, and three production-sized Next.js and React Native releases (SRC-004 capacity; a local Next.js and Expo run was refused file by file). |
| `SRC-004` | Published source map and debug-file capacity | target | partial | `src/domain/artifacts.ts`; `src/domain/source-map-storage.ts`; `migrations/core/0067_artifact_storage.sql`; `tests/sdk-package.mjs` (sourceMapCapacity, [SRC-004]); `tests/sentry-cli-compat.mjs` (chunkFlow, durableFlow); `docs/SOURCE-MAPS.md`; `tests/product-runtime.mjs` (byte-cap concurrency); `tests/repair-recovery/archive.mjs` (historical inventory) | Bounded D1 maps (1 MiB, 1000 sources, bounded expanded-map paths), indexed section offsets, source roots, embedded sources and ignore lists are stored; no lifetime map count, optional owner byte cap, per-file CLI/release refusal and private archive/restore/erasure. Remaining: 190 MiB maps/2 GiB debug files, native symbolication, streamed assembly, use-based expiry and USD pricing, remote source fetching, ignore-list frame classification under GROUP-001, expanded SDK-010 lookup projection, production Next.js App Router/Hermes builds; prepared-map picker remains flat/256 KiB. |
| `REL-001` | Release and deployment history | target | partial | `src/domain/deployments/`; `src/domain/releases/order.ts`; `migrations/core/0049_deployment_history.sql`; `migrations/core/0050_release_order_keys.sql`; `tests/deployment-history.mjs` (REL-001); `tests/release-identity-flow.mjs` | Not asserted in the cited tests: a failed deployment reported from CI read back as failed, and the CI run's progress and success steps read back by state (only their count is asserted). Asserted: the started run with its four steps, included commits, idempotent callbacks, one timeout notice, rollback, delayed older-release ordering and enrichment of an auto-created release. |
| `REL-002` | Suspect change and release comparisons | target | partial | `src/domain/suspects/`; `src/ui/workbench/SuspectChanges.tsx`; `migrations/core/0070_suspect_decisions.sql`; `tests/deployment-history.mjs` ([REL-002] suspectFlow); `tests/suspect-flow.mjs`; `tests/old-archive.mjs`; `tests/owner-erasure.mjs`; `docs/SUSPECT-CHANGES.md` | First retained occurrence and reactivation release/commit candidates name their basis and recorded deployment window as correlation, not demonstrated cause. Owner confirm/reject with bounded scrubbed evidence is audited and leaves occurrences, counts, grouping and status unchanged; private restore and project/owner erasure cover judgments. Same-window per-release occurrence/distinct-issue counts retain older-release failures; `tests/session-flow.mjs` adds observed SDK-005 session rates, denominators, adoption share and Wilson intervals beside them. Remaining: comparable device/OS adoption cohorts beyond SDK-005's observed session rates, rate-change attribution, changed-source matching (receipts have no file lists), agent packet provenance and learning from judgments (AI-006). Builder defaults are in docs/contract/adopted-defaults.md. |
| `CTX-001` | Error-linked traces, logs and request performance | target | partial | `src/domain/otlp/routes.ts`; `src/domain/otlp/convert.ts`; `tests/otlp-flow.mjs` | Only bounded OTLP/HTTP JSON logs are accepted; trace/span identity is not persisted and traces/metrics are refused. Forwarders are absent. OTLP intake shares the 120-a-minute and 10,000-event caps that GOV-003 removes. CTX-001 inherits AI-005 trace-variant comparison; current grouping proposals name trace identity unavailable. |
| `CTX-002` | Privacy-controlled session replay | target | missing |  | No implementation proof yet: privacy-controlled session replay. |
| `CTX-003` | Third-party replay connectors | target | missing |  | No implementation proof yet: third-party replay connectors. |
| `CTX-004` | Performance issues from transactions and spans | target | missing |  | No implementation proof yet: performance issues from transactions and spans. |
| `ALERT-001` | Filtered rules and real anomaly detection | target | partial | `src/domain/alerts/rules.ts`; `src/domain/alerts/spikes.ts`; `tests/alerts-native.mjs` | New/regression and fixed-window count rules exist; historical baselines, crash-rate and rich routing filters are absent. |
| `ALERT-002` | Email, Slack, Teams, Oncall and PagerDuty | target | partial | `src/domain/alerts/slack.server.ts`; `src/domain/alerts/slack-destinations.server.ts`; `tests/alerts-egress.mjs` ([ALERT-002] slackFlow); `tests/alerts-ui.mjs` ([ALERT-002] slackUI); `tests/slack-flow.mjs`; `tests/slack-ui.mjs`; `tests/old-archive.mjs`; `tests/owner-erasure.mjs`; `migrations/core/0071_slack_destinations.sql`; `docs/ALERT-WEBHOOKS.md` Page-managed email and signed generic webhooks remain; native Slack issue alerts now share the durable queue and INTEGRATION_EGRESS, require a reviewed test, retain a posted message identifier separately from recipient receipt, stop on rotation/revocation, expose bounded API/HTTP/timeout/egress failures and exclude tokens from every read/archive. Safe acknowledgments restore inert; migration 0064 preserves populated upgrades, and project/owner erasure removes the new stores. Existing follow-up states account for failed Slack issue alerts; alternate notices use email or signed webhooks. | Page-managed email and signed generic webhooks remain; native Slack issue alerts share the durable queue and INTEGRATION_EGRESS, require a reviewed test, retain a posted message identifier separately from recipient receipt, stop on rotation/revocation, expose bounded API/HTTP/timeout/egress failures and exclude tokens from every read/archive. Remaining: Teams, Oncall and PagerDuty adapters, Discord channel webhooks, chat actions (ALERT-005/TEAM-001), broader recovery/update semantics, Slack as an alternate follow-up destination and real Slack qualification (NOT RUN); the recorded edge double earns no real-Slack claim. Builder defaults are in docs/contract/adopted-defaults.md. |
| `ALERT-003` | Destination tests, digests and snoozing | target | partial | `src/domain/alerts/`; `src/ui/alerts/`; migration `migrations/core/0058_alert_delivery.sql`; `tests/alerts-runtime.mjs`; `tests/alerts-egress.mjs`; `tests/alerts-ui.mjs`; `docs/ALERT-DELIVERY.md` Reviewed tests for every existing channel; provider event timelines, calendar digests and durable snooze/backlog flows; inert portability and declared erasure; 1440/390. Real provider receipt 21 October 2026: one production email (provider HTTP 202 at 02:42:33Z) and its delivered event, signed with SendGrid's production key (fingerprint prefix 09bf2526d0e6), at the registered seed test target at 02:42:48Z; event-ID SHA256 ca9c500bac89bc611799fa37b1fb7e04dec3fe5c96b3ae8ed6aab37c3f36c528, submission-ID hash e8b0883f…2d4d5, marker gr-mailrelay-proof-1-85d6f2dea6f745c1; seed registry restored empty. | Real bounced and complained provider events are unproven: one real production-signed delivered event is recorded (evidence); bounce and complaint stay signed-fixture transitions until real events arrive through the owner-held SendGrid Event Webhook. The relay's 01:33–02:33Z request, HTTP 5xx and forwarding-failure counters are unverified (Workers logs not enabled); no zero-failure claim. |
| `ALERT-004` | Durable follow-up and visible automation failure | target | done | `src/domain/follow-up/`; `src/server.ts`; `src/domain/fixes/workflow.ts`; `src/ui/alerts/NeedsAttention.tsx`; `tests/alerts-runtime.mjs`; `tests/execution-journey.mjs` Durable owner/due/state/attempts, one safe audit fact and Needs attention row per interrupted/failed/overdue source, nonrecursive deduplicated alternate notices, explicit uncertain reconciliation and authorized resend, expired provider-boundary fences, inert archive restore and 1440/390 owner views. |  |
| `ALERT-005` | Chat and paging triage actions and link unfurls | target | missing |  | No implementation proof yet: chat and paging triage actions and link unfurls. |
| `TRACK-001` | Vector, Jira and Linear issue sync | target | partial | `src/domain/repairs/routes.ts`; `src/domain/fixes/workflow.ts`; `tests/repair-recovery.mjs` | Manual repair links and draft PR history exist; tracker creation and status synchronization do not. |
| `MIG-001` | Sentry organization migration | target | partial | `src/domain/sentry-import/source.ts`; `src/domain/sentry-import/mapping.ts`; `src/domain/sentry-import/door.server.ts`; `src/domain/sentry-import/targets.ts`; `scripts/sentry-import.mjs`; `tests/sentry-import.mjs`; `tests/business-import.mjs`; `tests/sentry-sdk.mjs` | The one import door (owner session or signed Business grant) has checked uploads, no-native-write plan, reviewed fingerprint, resumable apply, native reconcile and guarded undo. The synthetic public HTTP journey covers a populated organization, bounded standing-approval issue replacement plus an added issue/event, approval binding, over-allowance/gone-source/native-edit refusals, newest-first exact graph/provenance restoration and large-set reads. Input is limited to 2 MiB and 500 parsed records including the manifest; fixed-query native lists have no compact matchesMany, so the 2 MiB native/custody read and 1,000-statement request limits still apply (named 413 refusal). Business is off by default with owner opt-in or the existing first-owner-claim alternative, permanent key revocation and owner history undo while off. Native archives exclude import custody; complete parseable project bundles withdraw their lineage and archive headers/bytes, while incomplete/unreadable custody and selective owner shared-custody erasure remain open. The signed-in screen has settings/history/undo only; upload/review/apply/reconcile remains CLI/API. Browser/Node DSNs work. Proof is synthetic-only: a real authorized Sentry bundle through the test-install lifecycle with a genuine signed receipt, full collection mapping/reconciliation and the real-account dual run remain unproved. |
| `MIG-002` | Datadog Error Tracking migration | target | missing |  | No implementation proof yet: datadog Error Tracking migration. |
| `MIG-003` | Rollbar migration | target | missing |  | No implementation proof yet: rollbar migration. |
| `MIG-004` | Bugsnag migration | target | missing |  | No implementation proof yet: bugsnag migration. |
| `MIG-005` | Up-and-comer switching paths | target | missing |  | No implementation proof yet: up-and-comer switching paths. |
| `API-001` | Public APIs, attachments and full export | target | partial | `src/domain/investigation/records.ts`; `tests/investigation-flow.mjs` ([API-001] recordReadFlow); `tests/records-flow.mjs`; `docs/INVESTIGATION.md` | Version-1 cursor-paginated occurrence metadata (project and issue) and scrubbed feedback report reads now share exact-project read authority, bounds, ordering and uniform wrong-scope refusal. The public journey reconciles multiple pages with issue detail and inbox totals, then proves withdrawal and erasure. Existing bounded issue JSON/CSV export remains. Gap: attachment storage/viewing audit/downloads (currently counted sentry_unsupported_attachment), release/session record pagination beyond SDK-005’s bounded health report, audit API, streaming exports/archives at GOV-003 volume and the 160,000-event acceptance remain absent. |
| `API-002` | Sentry Web API and Terraform compatibility | target | missing |  | No implementation proof yet: sentry Web API and Terraform compatibility. |
| `GOV-001` | Enterprise identity and administration | target | partial | `src/auth/bindings.ts`; `src/editor`; `tests/owner-claim.mjs`; `tests/owner-editor.mjs` | Native owner auth and linked identity bindings exist; organization SSO/SCIM and named enterprise-provider qualification do not. |
| `GOV-002` | Retention, residency and data custody | target | partial | `src/domain/retention.ts`; `src/domain/privacy.ts`; `tests/agent-handoff.mjs`; `tests/project-erasure.mjs` | Owner-only per-type 30–90-day windows (default 90), dry-run counts/range/coverage, typed shortening, audited legal hold/release and estimated stored bytes exist. Holds pause expiry only, never erasure; policy/hold archive, restore and erase, and packet notes state hold status. `tests/agent-handoff.mjs` and `tests/project-erasure.mjs` [GOV-002], 1440/390 Settings. Gaps: residency, commercial plan windows and session aggregates. |
| `GOV-003` | Published retention, retained volume and sustained intake rate | target | partial | `src/domain/retention.ts`; `src/domain/admission.ts`; `tests/agent-handoff.mjs`; `tests/project-erasure-cap.mjs` | An owner-run retention cutoff with occurrence tombstones, deduplication horizon and named retention gaps exists, and over-limit intake returns 429 with `Retry-After` and a counted outcome. Today `src/domain/admission.ts` and `migrations/core/0008_occurrence_identity.sql` refuse every new event once a project retains 10,000 (`retained_event_budget`) and above 120 a minute (`minute_budget`), and `src/domain/archive.ts` refuses a project archive above 10,000 events. Bounded daily expiry now uses applyRetention with occurrence/checkpoint tombstones, named gaps, scheduled retention service audit, held-project skips and an idempotent/resumable cursor; Settings reports the latest run. `tests/agent-handoff.mjs` [GOV-003] proves intake during a run, 50-row batches, remainder resume, hold and same-day no-op through the native scheduled clock seam. Plan volume, the published sustained rate, streaming archives, the 160,000-event run, automatic artifact/session-aggregate expiry and the named volume reasons remain absent. |
| `BILL-001` | Predictable USD usage and ingestion budgets | target | partial | `src/domain/admission.ts`; `src/domain/sentry/client-reports.ts`; `src/ui/workbench/CaptureReceipts.tsx`; `tests/client-report-flow.mjs`; `docs/CLIENT-REPORTS.md`; `src/domain/filters/` | Settings and capture receipts separate accepted, filtered and SDK client-discarded quantities; SDK discards retain reason/category without creating issues, alerts or accepted units, and survive private archive restore. Forecasts, spike protection, key limits and the named volume reasons remain absent. Fixed 120-a-minute and 10,000-retained-event refusals remain GOV-003 gaps. |
| `BILL-002` | Published USD plans, checkout and invoices | target | missing |  | No implementation proof yet: commercial USD tiers and billing remain absent. |
| `UX-001` | Mobile operations and accessible investigation | target | partial | `src/ui/workbench`; `tests/triage-journey.mjs`; `tests/alerts-ui.mjs`; `tests/execution-journey.mjs` | Current single-owner core has responsive/Axe journeys; full target team/mobile workflows are absent. |
| `AUDIT-001` | Permanent privacy-safe action audit | target | partial | `src/domain/audit/`; `src/ui/workbench/AuditHistory.tsx`; `migrations/core/0051_safe_audit.sql`; `migrations/core/0053_audit_transactions.sql`; `tests/audit-history.mjs` (AUDIT-001); `tests/old-archive.mjs`; `tests/owner-erasure.mjs` | Not asserted in the cited tests: audit coverage for Spool's new member actions (D-1 carries their audit). Asserted: portability through Spool archives and the absence of secrets and erased identifiers in the history. |
| `INT-001` | Vercel and Netlify deployment connectors | target | missing |  | No implementation proof yet: vercel and Netlify deployment connectors. |
| `SURFACE-001` | The registry equals this table and the Base harness passes | target | missing |  | No implementation proof yet: the MCP door, the tool registry with classes and the Base conformance harness are absent; the stdio agent package serves five read and proposal tools without classes. |
| `SURFACE-002` | External and money are computed per call | target | missing |  | No implementation proof yet: no tool computes external or money. |
| `SURFACE-003` | Live, security, access and destructive are computed per call | target | missing |  | No implementation proof yet: no tool computes live, security, access or destructive. |
| `SURFACE-004` | Commitment, accounts and gated are computed per call | target | missing |  | No implementation proof yet: no tool computes commitment, accounts or gated. |
| `SURFACE-005` | The triage engineer journey under two company policies | target | missing |  | No implementation proof yet: the triage engineer journey under two company policies has not run. |
| `AI-001` | Controlled coding-agent handoff | push-further | partial | `packages/agent/src`; `src/domain/agent-access.ts`; `src/domain/packet.ts`; `tests/agent-handoff.mjs` | Generic read-only CLI/MCP is implemented; named client qualification and model-egress controls for automated work are incomplete. |
| `AI-002` | Generate and test the smallest reproduction | push-further | partial | `src/domain/reproducers/classify.ts`; `src/domain/reproducers/sandbox.ts`; `scripts/reproduce/runner.mjs`; `tests/execution-journey.mjs` | Bounded mapped-JavaScript reproductions with supplied calls exist; automatic minimization, cause experiments and non-JS/mobile reproduction do not. |
| `AI-003` | Minimal code repair as a tested pull request | push-further | partial | `src/domain/fixes/workflow.ts`; `src/domain/fixes/provider.ts`; `tests/execution-journey.mjs` | Current GitHub double journey opens a data-only artifact PR and observes merge/checks; generated code fixes, real repository acceptance and GitLab are absent. |
| `AI-004` | Prove the released repair from live rates | push-further | partial | `src/domain/exposure/proof.ts`; `src/domain/repairs/observation.ts`; `tests/execution-journey.mjs`; `tests/repair-recovery.mjs` | Current proof already compares baseline rates with a confidence bound, affected cohorts, rollout and capture gaps; automatic production measurement, an ongoing watch and real-account acceptance remain missing. |
| `AI-005` | Explain grouping proposals before applying | push-further | done | `src/domain/proposals/`; `migrations/core/0057_grouping_proposals.sql`; `src/ui/workbench/GroupingProposals.tsx`; `packages/agent/`; `tests/operator-flow.mjs`; `tests/operator-ui.mjs`; `tests/agent-handoff.mjs`; `tests/old-archive.mjs` |  |
| `AI-006` | Prevent related failures from recurring | push-further | missing |  | No implementation proof yet: prevent related failures from recurring. |
| `AI-007` | Agent-runtime failure diagnosis and evaluated improvements | push-further | missing |  | No implementation proof yet: agent-runtime failure diagnosis and evaluated improvements. |
