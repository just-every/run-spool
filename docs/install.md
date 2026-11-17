# Run it on your computer

Spool runs on macOS, Linux or Windows with WSL2; on WSL2, run everything inside WSL2. Git is required; rer brings Node and pnpm. It supplies this project's pinned Node 22.20.0 runtime and pnpm 10.12.4, so you do not need either on PATH.

## Install and start

One line, as on the [Run page](https://run-spool.com/run), installs rer, clones Spool into `run-spool` and starts it:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-spool
```

Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-spool` does the same. To start it again later, run `cd run-spool && ~/.local/bin/rer dev`. If you see 'command not found', run `~/.local/bin/rer cli path` and paste the line it prints.

Open the private owner link printed in your terminal, and keep it private. On the setup page, enter your name, your email and what to call this installation. You can change these later in Settings: General for the installation name, Members for your name and email.

<details>
<summary>Details</summary>

For separate lifecycle steps, `~/.local/bin/rer install` installs the locked dependencies and `~/.local/bin/rer setup` prepares or preserves the owner and local settings, then stops its temporary app. Run `~/.local/bin/rer dev` afterwards to start Spool. Explicit `~/.local/bin/rer setup` prompts for missing required answers when stdin is a terminal (unless `--json` or `--non-interactive` is set). Piping an email alone is not a setup answer.

To choose your real email before first start, run the same line with `setup` in place of `dev` (interactive `~/.local/bin/rer setup`) instead of going straight to `~/.local/bin/rer dev`. If dev already made a temporary owner, stop dev first and supply `OWNER_EMAIL` through the answers file to replace that temporary address while keeping its data. Saved answers are reused, so an existing address is not prompted again. Keep addresses and secrets out of shell arguments.

For non-interactive setup, work from the Spool checkout and create an ignored private answers file:

```sh
mkdir -p .rer/local
(umask 077; touch .rer/local/setup-answers.json)
chmod 600 .rer/local/setup-answers.json
```

Open that file in your editor and save a JSON object using the installer field name:

```json
{"OWNER_EMAIL":"you@example.com"}
```

Then run:

```sh
~/.local/bin/rer setup --answers .rer/local/setup-answers.json --non-interactive
rer dev
```

The `--answers` path must be relative and contained inside the checkout. Absolute paths, `..` traversal and symlinks are refused; the file must be owned by you, regular, unshared by hard links and readable/writable only by you (`0600`). `.rer/` is already ignored by this checkout. Do not place the file in a shared directory or commit it.

</details>

## Your first project

The first time you open Spool, `/setup` offers project creation or archive restore. For a new project, give it a name and a short identifier, such as `web-app`. If you are moving existing evidence, choose **Restore a private archive** before creating a project.

Spool then shows the project's **ingest key** once. Copy it now: if you lose it, create a new ingest key in **Settings**. Below it are the install line and a three-line `init` for Spool's SDK, already filled in with this installation's address and that key, and **Send test error**, which sends one real error to the new project. Already using Sentry? The project's **Sentry DSN** is shown there too.

With rer dev v2 (using the rer version pinned in [package.json](../package.json)), this ingest key works from your app against local Spool without the private dev gate. A deploy key from Settings also works from your local build without the gate. Allow your browser app's exact origin in Capture; never give the browser the `RER_OPEN` link or its gate. Local read-only agent access still needs the gate, privately extracted from the `rer-dev` fragment as `SPOOL_DEV_KEY`; see [the agent guide](WITH-YOUR-AGENT.md#local-agent-access). Deployed Spool refuses all dev-minted keys; sign in there and create fresh keys. [Key scopes](capture.md#keys-for-anything-outside-this-checkout) explains the boundaries.

Use **Send test error** to check that the key and release receive an error from Spool itself, then choose **Continue to workbench** to open the project's **Issues**. If you sent the test, its issue is already there; otherwise the list waits for your first event. The test does not check your app's browser origin or source maps. [Connect your app](capture.md) next; **Check for events** is on the later **Capture** page.

## Stopping and starting

With terminal (TTY) output, `~/.local/bin/rer dev` stays in the foreground; stop it with Ctrl+C. With non-TTY output, it returns once ready and leaves the server running in the background; stop it with `~/.local/bin/rer dev --stop`. You can also stop it from another terminal. Use `--foreground` or `--detach` to choose explicitly. Your owner, projects and events are kept on this computer and are still there the next time you run `~/.local/bin/rer dev`.

Stop dev before deploying, verifying, resetting or transferring local data.

To move Spool to another computer, use **Download private archive** in **Settings**, then start a fresh copy on the new one. On `/setup`, choose **Restore a private archive**, select the file and choose **Restore into empty installation**. Create new project keys after restore; archives exclude credentials. The browser accepts up to 16 MiB. For a larger archive or CLI restore, follow [the transfer procedure](../OPERATIONS.md#data-movement-and-retention), including `chmod 600` for browser downloads.
