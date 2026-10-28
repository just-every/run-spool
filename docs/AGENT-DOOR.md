# Spool's agent door

Spool serves its triage engineer at `/mcp`. Discovery is `server/discover`, with
canonical OAuth resource metadata at `/.well-known/oauth-protected-resource/mcp`.
The supported protocol versions are `2026-07-28` and `2025-11-25`. March 2025
batching is refused. `/agents` shows company policy, agent activity and decisions;
`/agents/approvals/{id}` shows an exact pending or completed action.

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

Record a JavaScript reproducer for a mapped occurrence and request its bounded,
single-use native runner handoff. Source bytes stay out of ordinary resources.
Only the isolated workerd runner gets the selected modules, with no inherited
production environment, network or filesystem. Queued, unsupported, expired,
not reproduced, reproduced and failed remain distinct. An agent-originated run
retains its sponsor and consent and invokes the shared door again when claimed;
Pause, revocation or native narrowing can stop it before execution.

An existing GitHub App connection and a person's exact native repository grant
are required for the fix workflow. `spool.fixes.advance` requests native
`repository_grant` proof. The person approves the saved grant on the issue's
native workflow card and shares its non-secret `proofReference`. The client
retries using `params._meta["com.runeditrun/native-proof"]`. The reference is
bound to that workflow's originating agent and sponsor, current native approval
and expiry. Company approval is separate from this native consent.

The GitHub executor adds `.spool/reproducers/{id}.json` as data to a bounded fix
branch and draft pull request. It does not generate a tested source repair,
merge, deploy or execute GitLab operations. Each provider step retains the
native lease, receipts, uncertain-outcome custody and token revocation. Agent
preparation, native repository consent and company approvers are named separately.
An absent connection is visibly unavailable.

Repair links, notes, checks and merge/deploy facts are attributed claims. They do
not replace independent capture, release, cohort, recurrence or exposure evidence.
Quiet or lost telemetry remains inconclusive. Recording an observed deployment
records a native release manifest; it does not perform a deployment or notify a
provider.

The registry also includes native alert, follow-up, member, credential-retirement,
retention and project-erasure operations. Their saved native preview, consent,
visibility, revision and outbox restrictions still apply. Enabling a notification
rule is not evidence that a notice was delivered. Erasure is irreversible and
uses the native count-only preview and plan hash. Retention is not project
erasure. Native configured schedules and provider receipts must be inspected
separately from the agent's configuration action.

## Compatibility and limits

The `spool-agent` CLI and stdio MCP package retain the four historical evidence
aliases and inert proposal submission. Their schemas and effects come from the
shared production registry. Existing exact-project API aliases use that same
door. A project key cannot apply grouping, perform provider work, manage access
or read another project. Dev-minted keys still require the private local gate
and are refused by the deployed entry. A failed Business JWT never falls back
to a project key.

Resources contain bounded native projections and mark outside text untrusted.
Packets never grant raw identity, source-map bytes, source bytes or credentials.
Private reads are policy decisions. Native person changes emit the same retained
resource events as agent changes, with current access filtering at delivery.

Spool exposes no money-moving, payment, merge, deployment or general shell tool.
Provider cost is not money moved. Base provider spend caps are not enforced:
local cap saves are refused and adopted Business caps are marked `not_enforced`.
Native quotas, sandbox restrictions and provider consent remain authoritative.
The registry's capacity limits are request capacities, not a spend guarantee.

`agent-surface.json` is generated from the runtime catalogue and the native
journey. Regenerate it with `pnpm agent-surface:generate`; check it with
`pnpm agent-surface:check`. `pnpm test:agent-door` exercises the emitted production
Worker, signed identity/settings, native people and the specialist path. Normal
`rer verify` also owns the declared Base conformance journey when its CLI contains
the matching harness. Pending Base/contract assertions are named in
`tests/agent-door/pending.mjs`; copying the module is not a conformance pass.
