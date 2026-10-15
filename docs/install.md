# Run it on your computer

Spool needs **Node 22 or later** and git, on macOS, Linux or Windows with WSL2. Install Node from [nodejs.org](https://nodejs.org/en/download) if needed, reopen your terminal and check `node --version`. On WSL2, install Node and git inside WSL2. Node must be on PATH before rer can start; rer then supplies this project's pinned Node 22.20.0 runtime and pnpm 10.12.4. You do not need pnpm on PATH.

## Install and start

Install rer once per computer:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
```

Or use npm (included with Node):

```sh
npm install -g @runeditrun/rer
```

Get Spool and start it, as on the [Run page](https://run-spool.com/run):

```sh
git clone https://github.com/just-every/run-spool.git spool
cd spool && rer dev
```

`rer dev` installs everything, prepares the local database and prints `RER_OPEN`. First start chooses `owner@spool.test` for the `spool` folder above without asking for an email; it does this with piped input too. Another folder name produces `owner@<sanitized-folder-name>.test`. An existing installation keeps its owner. Open `RER_OPEN` in a browser on this computer to enter signed in as the owner. Keep it private: it carries this checkout's dev key. Local sign-in sends no real email.

For separate lifecycle steps, `rer install` installs the locked dependencies and `rer setup` prepares or preserves the owner and local settings, then stops its temporary app. Run `rer dev` afterwards to start Spool. Explicit `rer setup` prompts for missing required answers when stdin is a terminal (unless `--json` or `--non-interactive` is set); with non-TTY input, supply a private JSON answers file using `rer setup --answers <file> --non-interactive`. Piping an email alone is not a setup answer.

To choose your real email before first start, use `rer install` and interactive `rer setup` instead of going straight to `rer dev`. If dev already made a temporary owner, stop dev first and supply `OWNER_EMAIL` through the answers file to replace that temporary address while keeping its data. Saved answers are reused, so an existing address is not prompted again. Keep addresses and secrets out of shell arguments.

## Your first project

The first time you open Spool, `/setup` offers project creation or archive restore. For a new project, give it a name and a short identifier, such as `web-app`. If you are moving existing evidence, choose **Restore a private archive** before creating a project.

Spool then shows the project's **ingest key** once. Copy it now: if you lose it, create a new ingest key in **Settings**. Below it are the install line and a three-line `init` for Spool's SDK, already filled in with this installation's address and that key, and **Send test error**, which sends one real error to the new project. Already using Sentry? The project's **Sentry DSN** is shown there too.

For an app or build outside this checkout, [create ordinary keys through local sign-in](capture.md#keys-for-anything-outside-this-checkout) before connecting it. Keys created by the default dev persona require this checkout's dev gate.

When you choose **Continue to workbench**, Spool opens the project's **Issues**, waiting for your first event. [Connect your app](capture.md) next.

## Stopping and starting

With terminal (TTY) output, `rer dev` stays in the foreground; stop it with Ctrl+C. With non-TTY output, it returns once ready and leaves the server running in the background; stop it with `rer dev --stop`. You can also stop it from another terminal. Use `--foreground` or `--detach` to choose explicitly. Your owner, projects and events are kept on this computer and are still there the next time you run `rer dev`.

To move Spool to another computer, use **Download private archive** in **Settings**, then start a fresh copy on the new one. On `/setup`, choose **Restore a private archive**, select the file and choose **Restore into empty installation**. Create new project keys after restore; archives exclude credentials. The browser accepts up to 16 MiB. For a larger archive or CLI restore, follow [the transfer procedure](../OPERATIONS.md#data-movement-and-retention), including `chmod 600` for browser downloads.
