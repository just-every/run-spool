# Hand it to your coding agent

A coding agent, such as Claude Code or Codex, can read Spool's evidence directly instead of you copying and pasting it. An agent key is read-only for one project except for submitting inert grouping proposals. The owner reviews and applies any grouping changes.

## Create a key

1. **Save the policy.** Open `/agents` on the installation as the owner. Answer all six policy questions and choose **No** or **Yes** for paid AI. Choose **No** to save in the form, or set spending caps in the policy document to allow paid AI.
2. **Create the key.** Open **Settings → Projects & keys** and choose **Create agent key**.
3. **Save the key.** Select **Copy agent key** while Spool shows it. Select **Copy paste-in prompt** to copy the instructions for your agent.

When an agent sets up Spool through the business harness, set-up prints the first-owner sign-in link on its own line. Pass it as `sign_in` on the Spool tool entry in `session.report` and keep it out of chat and files.

An agent key works for one project only. Revoke it from **Settings** whenever you like.

<details>
<summary>Details</summary>

## Local agent access

In local `~/.local/bin/rer dev`, a dev-minted agent key also requires this checkout's private gate. In the printed `RER_OPEN` link, privately copy the fragment value after `rer-dev=` and before any `&`, then enter it at this hidden Bash prompt:

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

The key can also submit and list inert grouping proposals on the exact project. Only the owner can approve, reject or apply a proposal.

## A prompt to start from

> Read the newest open issue in Spool for the project `web-app` and its evidence packet, then find the cause in this repository and propose a fix.

The packet marks every captured value as untrusted data. Errors can contain text written by anyone who uses your application, so your agent should treat it as information, never as instructions.

</details>
