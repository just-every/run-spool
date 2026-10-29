# Spool's agent door

Spool serves its triage engineer at `/mcp`. Discovery is `server/discover`, with
canonical OAuth resource metadata at `/.well-known/oauth-protected-resource/mcp`.
The supported protocol versions are `2026-07-28` and `2025-11-25`. March 2025
batching is refused. `/agents` shows company policy, agent activity and decisions;
`/agents/approvals/{id}` shows an exact pending or completed action.

This adoption declares the mandatory tools, policy, pause, audit and idempotency
capabilities. Events, resources, prompts and subscriptions remain partial and are
not offered through MCP: discovery identifies them as refused, their lists are
empty, and calls return `capability_not_declared`. Native read tools still return
the supported records. Resource adapters and internal event collection remain
in place without exposing these optional public doors. Multi-sponsor, mail-edge,
resource-refresh, timed, dual-host, queued and native-owner lifecycle families
remain unscoped; this declaration makes no completion claim for them.

A Business access token names a durable Business person, an agent, consent and
scopes. Signed Business settings at `/api/rer/business-settings` bind the owner
and existing native teammates by ID. A token's email never chooses its sponsor.
Team invitations and project grants use Spool's native team lifecycle. Roster
sync does not grant project access or turn an existing native member into an
organization administrator. An inactive, removed or unmapped person cannot act.

The company chooses autonomous, review, approval or blocked for each class.
An unanswered, expired or paused policy authorizes no action. There is no product
preset that turns a caller's confirmation or imported text into approval. Native
project roles, current grants, revisions, recipient controls and repository
consent still apply. Approvals bind `revision` and `summary_sha256`; concurrent
native changes can make an otherwise approved action stale.

## Supported triage work

Read a sanitized issue, bounded packet, capture-loss/traffic context and native
outcomes. Create an inert split, merge or rule proposal. Submission does not
apply grouping, alter alerts or change capture. The separate grouping preview,
apply and undo actions retain native occurrence and revision fences.
`spool.grouping.read` reads the current native correction catalogue, so a client
can select a current preview instead of assuming an older preview still exists.

Record a JavaScript reproducer for a mapped occurrence and request its bounded,
single-use native runner handoff. Source bytes stay out of ordinary resources.
Only the isolated workerd runner gets the selected modules, with no inherited
production environment, network or filesystem. Queued, unsupported, expired,
not reproduced, reproduced and failed remain distinct. An agent-originated run
retains its sponsor and consent and invokes the shared door again when claimed;
Pause, revocation or native narrowing can stop it before execution. A different
agent or consent cannot take over its queued run or erasure continuation; a
current person retains native completion authority.

An existing GitHub App connection and a person's exact native repository grant
are required for the fix workflow. `spool.fixes.advance` requests native
`repository_grant` proof. The person approves the saved grant on the issue's
native workflow card and shares its non-secret `proofReference`. The client
retries using `params._meta["com.runeditrun/native-proof"]`. The reference is
bound to the originating agent, sponsor and consent, the current native
approval, and expiry. Company approval is separate from this native consent.

The GitHub executor adds `.spool/reproducers/{id}.json` as data to a bounded fix
branch and draft pull request. It does not generate a tested source repair,
merge, deploy or execute GitLab operations. Each provider step retains the
native lease, receipts, uncertain-outcome custody and token revocation. Agent
preparation, native repository consent and company approvers are named separately.
Archives retain named consent history, while live proof references are excluded;
restoring history does not restore provider authority.
An absent connection is visibly unavailable.

Recognized archives from before agent attribution retain their original schema,
inventory and checksum checks. Restore adds only the historical person-owned
defaults: repairs are recorded by `owner`, and grouping proposals have no agent
preparer. It does not create consent, credentials or permission to resume work.

Repair links, notes, checks and merge/deploy facts are attributed claims. They do
not replace independent capture, release, cohort, recurrence or exposure evidence.
Quiet or lost telemetry remains inconclusive. `spool.repairs.read` can select a
repair by native ID within its issue and returns its current revision;
`spool.access.read` can similarly select a native member before a narrowed grant
update. Missing selected IDs return `not_found` under the same native authority. Recording an observed deployment
records a native release manifest; it does not perform a deployment or notify a
provider.

The registry also includes native alert, follow-up, member, credential-retirement,
retention and project-erasure operations. Their saved native preview, consent,
visibility, revision and outbox restrictions still apply. Enabling a notification
rule is not evidence that a notice was delivered. Erasure is irreversible and
uses the native count-only preview and plan hash. Retention is not project
erasure. Native configured schedules and provider receipts must be inspected
separately from the agent's configuration action. Final admission and attribution
for standing alert, follow-up and retention workers remain unqualified pending
the shared queued-consent continuation. Agent attempts to enable an alert rule,
set a follow-up destination or update retention therefore refuse with
`native_worker_admission_unavailable` before saving settings. Agent disabling
and native person controls remain available. These required tool/class journeys
remain declared and cannot pass conformance until final worker admission is wired.

## Compatibility and limits

The `spool-agent` CLI and stdio MCP package retain the four historical evidence
aliases and inert proposal submission. Their schemas and effects come from the
shared production registry. Existing exact-project API aliases use that same
door. Canonical list results use an `items` array inside an object; compatibility
clients retain their historical responses. Pagination cursors are opaque and
valid only for their original query and order; compatibility aliases preserve
native validation status codes. Raw proposal aliases require an
`Idempotency-Key` header. A project key cannot apply grouping, perform provider work, manage access
or read another project. Dev-minted keys still require the private local gate
and are refused by the deployed entry. A failed Business JWT never falls back
to a project key.

Native tools contain bounded projections and mark outside text untrusted.
Packets never grant raw identity, source-map bytes, source bytes or credentials.
Private reads are policy decisions. Native person and agent changes retain
internal resource events; their public event and subscription doors are not yet
offered by this Core declaration.

Spool exposes no money-moving, payment, merge, deployment or general shell tool.
Provider cost is not money moved. Base provider spend caps are not enforced:
local cap saves are refused and adopted Business caps are marked `not_enforced`.
Native quotas, sandbox restrictions and provider consent remain authoritative.
The registry's capacity limits are request capacities, not a spend guarantee.

`agent-surface.json` is generated from the runtime catalogue and native
journey. Regenerate it with `pnpm agent-surface:generate`; check it with
`pnpm agent-surface:check`. `pnpm test:agent-door` exercises the emitted
production Worker, signed identity/settings, scoped clients, native people,
reviewer Undo and the specialist path. The seed pins the published rer 0.2.89
CLI; the door, settings and actor runtime carry matching recorded source.
Normal `rer verify` runs the installed shared conformance harness. The seed's
existing suite selector can limit local application checks to touched flows;
it does not disable the shared harness or change its failure exit.

The verifier declares a disposable GitHub App binding generator and an isolated
provider network edge, plus fresh native projects, captures, sandbox observations,
member targets and exact-project clients for each policy phase. Only the paid
network edge is substituted; native authorization, persistence and consent run
in the real Worker. Provider fixture keys are generated per run and never saved.

The published declaration check accepts the existing owner-account sender binding.
Native audit target checks now follow the cursor beyond the first 200 rows.
Remaining dated dependencies in `tests/agent-door/pending.mjs` include the
catalogue acknowledgement limit, fresh-key injection probes, native runner event
identity, held erasure custody, standing-worker admission and refused approval
execution accounting. Standing-worker admission also requires seed integration;
the Core declaration does not qualify it or excuse its required native journeys. These are pending assertions,
never passing results or completed shared duties. Spend caps remain unenforced.
