# Hand it to your coding agent

A coding agent, such as Claude Code or Codex, can read Spool's evidence directly instead of you copying and pasting it. Give it a read-only agent key.

## Create a key

1. Open **Settings** for the project.
2. Under **Project keys**, choose **Create read-only agent key**.
3. Copy the key when Spool shows it. It is shown once.

An agent key works for one project only. Revoke it from **Settings** whenever you like.

## Keys for anything outside this checkout

While Spool runs as `pnpm run dev`, it opens signed in with this checkout's private key, and every key you create then works only on requests that carry that private key. To create keys that an agent outside this checkout can use, start Spool with `pnpm run dev -- --login` instead. It prints a sign-in link: open it, choose the newest message in the local outbox and follow its one-use link. Keys you create in that session work anywhere.

## What the agent can read

With the key in an `Authorization: Bearer` header, the agent can make `GET` requests for its own project:

- `/api/projects/<project>/issues` lists the issues, newest regressions and new issues first.
- `/api/projects/<project>/issues/<issue>/packet` returns an issue's evidence packet: its latest 10 occurrences with mapped stack frames, and capture receipts.
- `/api/projects/<project>/alerts` and `/api/projects/<project>/outcomes` return the project's alerts and capture receipts.

Everything else is refused. The key cannot resolve issues, change settings, upload maps, create keys or read another project.

## A prompt to start from

> Read the newest open issue in Spool for the project `web-app` and its evidence packet, then find the cause in this repository and propose a fix.

The packet marks every captured value as untrusted data. Errors can contain text written by anyone who uses your application, so your agent should treat it as information, never as instructions.
