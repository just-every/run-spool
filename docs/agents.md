# Hand it to your coding agent

A coding agent, such as Claude Code or Codex, can read Spool's evidence directly instead of you copying and pasting it. Give it an agent key for one project’s evidence and inert grouping proposals; owner-only review and explicit apply control changes.

## Create a key

1. Open **Settings** for the project.
2. Under **Project keys**, choose **Create agent key**.
3. Copy the key when Spool shows it. It is shown once.

An agent key works for one project only. Revoke it from **Settings** whenever you like.

## Local agent access

In local `rer dev`, a dev-minted agent key also requires this checkout's private gate. In the printed `RER_OPEN` link, privately copy the fragment value after `rer-dev=` and before any `&`, then enter it at this hidden Bash prompt:

```sh
read -r -s -p 'Private rer-dev fragment value: ' SPOOL_DEV_KEY; printf '\n'
export SPOOL_DEV_KEY
```

Do not paste the whole URL or put the value in a command argument. The trusted local agent CLI sends the gate only to loopback as `x-rer-dev-key`; the separate agent key still limits reads to one project. The [CLI and MCP guide](WITH-YOUR-AGENT.md#local-agent-access) shows the commands and configuration.

Run the CLI using its absolute path inside the Spool checkout, even when your terminal or agent is working in your application's repository. Never give the gate to a browser app or put it in source control: it can also open the owner persona. With rer dev v2 (using the rer version pinned in [package.json](../package.json)), local ingest and deploy keys do not need this gate. Dev-minted keys of every scope are refused by deployed Spool; create fresh keys after signing in there. Archives exclude all project grants.

## What the agent can read

With the key in an `Authorization: Bearer` header, the agent can make `GET` requests for its own project:

- `/api/projects/<project>/issues` lists the issues, newest regressions and new issues first.
- `/api/projects/<project>/issues/<issue>/packet` returns an issue's evidence packet: its latest 10 occurrences with mapped stack frames, and capture receipts.
- `/api/projects/<project>/alerts` and `/api/projects/<project>/outcomes` return the project's alerts and capture receipts.

Everything else is refused. The key cannot resolve issues, change settings, upload maps, create keys or read another project.

<!-- spool:agent-inventory -->

## Offered MCP tools

This inventory is generated from the native catalogue and capability declaration. It describes the native MCP door after company setup with an authorized sponsor token. A project agent key retains its limited evidence and inert-proposal scopes. Each call still checks the current person, project authority and company policy.

Specialist: **triage engineer**. Read issue packets and capture-loss context, propose inert grouping advice, inspect isolated reproductions and record repair claims separately from observed outcomes. Native repository consent and company policy govern draft data pull requests; they never merge or deploy.

Classes below are the complete possible native classes, not policy dispositions. Standard fixed classifications use measure one. Conditional classifications and their public-door proof journeys are named beside the affected tool. Caller-supplied class, approval and count flags do not grant authority.

### Access

- `spool.access.read` — scope `spool:evidence`; classes `standard`.
- `spool.access.update` — scope `spool:access`; classes `access`.
  Access measure is one. Direction is widens when the native role rank increases or a project grant is added or raised; otherwise it is narrows. Self-escalation is refused independently of company policy. Proof: [classificationContract](../tests/agent-door/classification.mjs).

### Affected

- `spool.affected.read` — scope `spool:evidence`; classes `standard`.

### Alerts

- `spool.alerts.destinations` — scope `spool:evidence`; classes `standard`.
- `spool.alerts.preview` — scope `spool:alerts`; classes `standard`.
- `spool.alerts.read` — scope `spool:evidence`; classes `standard`.
- `spool.alerts.test` — scope `spool:alerts`; classes `external`.
  External measure is one with a known counterparty. The provider is derived from the saved destination: email, slack or signed webhook. The step is destination test. Proof: [classificationContract](../tests/agent-door/classification.mjs).
- `spool.alerts.update` — scope `spool:alerts`; classes `standard`, `live`.
  A disabled rule remaining disabled is standard. Enabling a rule, or changing a previously enabled rule, is live. The service fact is the current project. Proof: [classificationContract](../tests/agent-door/classification.mjs).

### Credentials

- `spool.credentials.list` — scope `spool:evidence`; classes `standard`.
- `spool.credentials.read` — scope `spool:evidence`; classes `standard`.
- `spool.credentials.update` — scope `spool:credentials`; classes `access`, `security`.
  Revocation computes access with direction narrows and security with setting project credential revocation. Each measure is one. Later widening cannot revive the retired key. Proof: [classificationContract](../tests/agent-door/classification.mjs).

### Deployments

- `spool.deployments.read` — scope `spool:evidence`; classes `standard`.
- `spool.deployments.record` — scope `spool:deployments`; classes `standard`.

### Feedback

- `spool.feedback.read` — scope `spool:evidence`; classes `standard`.

### Fixes

- `spool.fixes.advance` — scope `spool:fixes`; classes `external`.
  External measure is one with a known GitHub counterparty and step draft data pull request. Current native repository consent is required separately from company policy. Proof: [specialistFlow](../tests/agent-door/specialist.mjs).
- `spool.fixes.create` — scope `spool:fixes`; classes `standard`.
- `spool.fixes.read` — scope `spool:evidence`; classes `standard`.

### Followups

- `spool.followups.read` — scope `spool:evidence`; classes `standard`.
- `spool.followups.update` — scope `spool:followups`; classes `standard`, `live`.
  An absent destination remaining absent is standard. Setting or removing an existing destination is live. The service fact is the current project. Proof: [classificationContract](../tests/agent-door/classification.mjs).

### Grouping

- `spool.grouping.apply` — scope `spool:grouping`; classes `standard`.
- `spool.grouping.preview` — scope `spool:grouping`; classes `standard`.
- `spool.grouping.read` — scope `spool:evidence`; classes `standard`.
- `spool.grouping.undo` — scope `spool:grouping`; classes `standard`.

### Health

- `spool.health.read` — scope `spool:evidence`; classes `standard`.

### Issues

- `spool.issues.export` — scope `spool:evidence`; classes `standard`.
- `spool.issues.list` — scope `spool:evidence`; classes `standard`.
- `spool.issues.read` — scope `spool:evidence`; classes `standard`.
- `spool.issues.search` — scope `spool:evidence`; classes `standard`.
- `spool.issues.update` — scope `spool:issues`; classes `standard`, `live`.
  Acknowledgement and resolution are standard. Entering or leaving suppression is live. The service fact is the current project. Proof: [classificationContract](../tests/agent-door/classification.mjs).

### Notifications

- `spool.notifications.read` — scope `spool:evidence`; classes `standard`.

### Occurrences

- `spool.occurrences.list` — scope `spool:evidence`; classes `standard`.

### Outcomes

- `spool.outcomes.read` — scope `spool:evidence`; classes `standard`.

### Packets

- `spool.packets.read` — scope `spool:evidence`; classes `standard`.

### Privacy

- `spool.privacy.continue` — scope `spool:privacy`; classes `destructive`.
- `spool.privacy.erase` — scope `spool:privacy`; classes `destructive`.
- `spool.privacy.preview` — scope `spool:evidence`; classes `standard`.

### Projects

- `spool.projects.create` — scope `spool:projects`; classes `standard`.
- `spool.projects.list` — scope `spool:evidence`; classes `standard`.

### Proposals

- `spool.proposals.create` — scope `spool:propose`; classes `standard`.
- `spool.proposals.list` — scope `spool:evidence`; classes `standard`.
- `spool.proposals.read` — scope `spool:evidence`; classes `standard`.

### Releases

- `spool.releases.read` — scope `spool:evidence`; classes `standard`.
- `spool.releases.record` — scope `spool:releases`; classes `standard`.

### Repairs

- `spool.repairs.check` — scope `spool:repairs`; classes `standard`.
- `spool.repairs.read` — scope `spool:evidence`; classes `standard`.
- `spool.repairs.record` — scope `spool:repairs`; classes `standard`.
- `spool.repairs.record_fact` — scope `spool:repairs`; classes `standard`.

### Reproducers

- `spool.reproducers.claim` — scope `spool:reproducers`; classes `standard`.
- `spool.reproducers.create` — scope `spool:reproducers`; classes `standard`.
- `spool.reproducers.read` — scope `spool:evidence`; classes `standard`.
- `spool.reproducers.run` — scope `spool:reproducers`; classes `standard`.

### Retention

- `spool.retention.preview` — scope `spool:evidence`; classes `standard`.
- `spool.retention.read` — scope `spool:evidence`; classes `standard`.
- `spool.retention.update` — scope `spool:retention`; classes `standard`, `destructive`.
  Unchanged or longer windows are standard. Any shortened window is destructive, even for an empty inventory. Its measure is the native preview count, never a caller-supplied count. Proof: [retentionClasses](../tests/agent-door/retention-classes.mjs).

### Witness

- `spool.witness.read` — scope `spool:evidence`; classes `standard`.

## Resource templates

Unavailable. The resource-template inventory is empty (`[]`): the native door does not declare the resources capability.

Currently unavailable capabilities: events, prompts, subscriptions.

## Capacity and errors

Requests per minute per agent: `600`. Maximum request body bytes: `1048576`. A rate refusal returns HTTP 429 with Retry-After; an oversized body returns HTTP 413. These limits protect transport capacity. Provider-spend caps are not enforced.

Transport refusals include HTTP 401 with an OAuth resource-metadata challenge for missing or invalid authority, HTTP 403 for insufficient scope or a foreign origin, and HeaderMismatch or UnsupportedProtocolVersion for incompatible transport metadata.

Tool failures expose a stable code in result error metadata. Common codes are `policy_unset`, `policy_unavailable`, `policy_blocked`, `agents_paused`, `approval_required`, `approval_rejected`, `approval_expired`, `approval_evidence_changed`, `native_proof_required`, `self_escalation`, `idempotency_key_required`, `idempotency_conflict`, `revision_conflict`, `invalid_arguments`, `not_found`, `insufficient_scope`, `subject_erased`, `call_in_progress`, `decision_busy` and `output_invalid`. Native services can return additional refusal codes. A missing resource, prompt, event or subscription capability returns `capability_not_declared`.

Follow the returned native person URL for setup, consent, approvals or review. An approval flag cannot complete a person step. Retry a mutation with the same idempotency key and arguments; changed arguments conflict. Never treat a recorded repair claim as an independently observed fix.

<!-- spool:agent-inventory:end -->

## A prompt to start from

> Read the newest open issue in Spool for the project `web-app` and its evidence packet, then find the cause in this repository and propose a fix.

The packet marks every captured value as untrusted data. Errors can contain text written by anyone who uses your application, so your agent should treat it as information, never as instructions.
