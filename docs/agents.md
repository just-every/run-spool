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

### Access

- `spool.access.read` — scope `spool:evidence`.
- `spool.access.update` — scope `spool:access`.

### Affected

- `spool.affected.read` — scope `spool:evidence`.

### Alerts

- `spool.alerts.destinations` — scope `spool:evidence`.
- `spool.alerts.preview` — scope `spool:alerts`.
- `spool.alerts.read` — scope `spool:evidence`.
- `spool.alerts.test` — scope `spool:alerts`.
- `spool.alerts.update` — scope `spool:alerts`.

### Credentials

- `spool.credentials.list` — scope `spool:evidence`.
- `spool.credentials.read` — scope `spool:evidence`.
- `spool.credentials.update` — scope `spool:credentials`.

### Deployments

- `spool.deployments.read` — scope `spool:evidence`.
- `spool.deployments.record` — scope `spool:deployments`.

### Feedback

- `spool.feedback.read` — scope `spool:evidence`.

### Fixes

- `spool.fixes.advance` — scope `spool:fixes`.
- `spool.fixes.create` — scope `spool:fixes`.
- `spool.fixes.read` — scope `spool:evidence`.

### Followups

- `spool.followups.read` — scope `spool:evidence`.
- `spool.followups.update` — scope `spool:followups`.

### Grouping

- `spool.grouping.apply` — scope `spool:grouping`.
- `spool.grouping.preview` — scope `spool:grouping`.
- `spool.grouping.read` — scope `spool:evidence`.
- `spool.grouping.undo` — scope `spool:grouping`.

### Health

- `spool.health.read` — scope `spool:evidence`.

### Issues

- `spool.issues.export` — scope `spool:evidence`.
- `spool.issues.list` — scope `spool:evidence`.
- `spool.issues.read` — scope `spool:evidence`.
- `spool.issues.search` — scope `spool:evidence`.
- `spool.issues.update` — scope `spool:issues`.

### Notifications

- `spool.notifications.read` — scope `spool:evidence`.

### Occurrences

- `spool.occurrences.list` — scope `spool:evidence`.

### Outcomes

- `spool.outcomes.read` — scope `spool:evidence`.

### Packets

- `spool.packets.read` — scope `spool:evidence`.

### Privacy

- `spool.privacy.continue` — scope `spool:privacy`.
- `spool.privacy.erase` — scope `spool:privacy`.
- `spool.privacy.preview` — scope `spool:evidence`.

### Projects

- `spool.projects.create` — scope `spool:projects`.
- `spool.projects.list` — scope `spool:evidence`.

### Proposals

- `spool.proposals.create` — scope `spool:propose`.
- `spool.proposals.list` — scope `spool:evidence`.
- `spool.proposals.read` — scope `spool:evidence`.

### Releases

- `spool.releases.read` — scope `spool:evidence`.
- `spool.releases.record` — scope `spool:releases`.

### Repairs

- `spool.repairs.check` — scope `spool:repairs`.
- `spool.repairs.read` — scope `spool:evidence`.
- `spool.repairs.record` — scope `spool:repairs`.
- `spool.repairs.record_fact` — scope `spool:repairs`.

### Reproducers

- `spool.reproducers.claim` — scope `spool:reproducers`.
- `spool.reproducers.create` — scope `spool:reproducers`.
- `spool.reproducers.read` — scope `spool:evidence`.
- `spool.reproducers.run` — scope `spool:reproducers`.

### Retention

- `spool.retention.preview` — scope `spool:evidence`.
- `spool.retention.read` — scope `spool:evidence`.
- `spool.retention.update` — scope `spool:retention`.

### Witness

- `spool.witness.read` — scope `spool:evidence`.

## Resource templates

Unavailable. The resource-template inventory is empty (`[]`): the native door does not declare the resources capability.

Currently unavailable capabilities: events, prompts, subscriptions.

<!-- spool:agent-inventory:end -->

## A prompt to start from

> Read the newest open issue in Spool for the project `web-app` and its evidence packet, then find the cause in this repository and propose a fix.

The packet marks every captured value as untrusted data. Errors can contain text written by anyone who uses your application, so your agent should treat it as information, never as instructions.
