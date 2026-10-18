# Run it on your computer

Spool needs **Node 22 or later** and git, on macOS, Linux or Windows with WSL2. Install Node from [nodejs.org](https://nodejs.org/en/download) if needed, reopen your terminal and check `node --version`; or skip that and run `curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-spool`, which brings its own Node. On WSL2, install Node and git inside WSL2. Node must be on PATH before rer can start; rer then supplies this project's pinned Node 22.20.0 runtime and pnpm 10.12.4. You do not need pnpm on PATH.

## Install and start

One line, as on the [Run page](https://run-spool.com/run), installs rer, gets Spool and starts it:

```sh
npx -y @runeditrun/rer dev just-every/run-spool
```

To start it again later, run `cd run-spool && rer dev`.

These instructions describe `main`, which may be ahead of the latest tagged Spool release, `v0.3.0`. For that release, replace the clone command with `git clone --branch v0.3.0 https://github.com/just-every/run-spool.git spool` and follow the instructions shipped with the tag.

`rer dev` installs everything, prepares the local database and prints `RER_OPEN`. First start chooses `owner@run-spool.test` for the `run-spool` folder above without asking for an email; it does this with piped input too. Another folder name produces `owner@<sanitized-folder-name>.test`. An existing installation keeps its owner. Open `RER_OPEN` in a browser on this computer to enter signed in as the owner. Keep it private: it carries this checkout's dev key. Local sign-in sends no real email.

For separate lifecycle steps, `rer install` installs the locked dependencies and `rer setup` prepares or preserves the owner and local settings, then stops its temporary app. Run `rer dev` afterwards to start Spool. Explicit `rer setup` prompts for missing required answers when stdin is a terminal (unless `--json` or `--non-interactive` is set). Piping an email alone is not a setup answer.

To choose your real email before first start, run `npx -y @runeditrun/rer setup just-every/run-spool` (interactive `rer setup`) instead of going straight to `rer dev`. If dev already made a temporary owner, stop dev first and supply `OWNER_EMAIL` through the answers file to replace that temporary address while keeping its data. Saved answers are reused, so an existing address is not prompted again. Keep addresses and secrets out of shell arguments.

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
rer setup --answers .rer/local/setup-answers.json --non-interactive
rer dev
```

The `--answers` path must be relative and contained inside the checkout. Absolute paths, `..` traversal and symlinks are refused; the file must be owned by you, regular, unshared by hard links and readable/writable only by you (`0600`). `.rer/` is already ignored by this checkout. Do not place the file in a shared directory or commit it.

## Your first project

The first time you open Spool, `/setup` offers project creation or archive restore. For a new project, give it a name and a short identifier, such as `web-app`. If you are moving existing evidence, choose **Restore a private archive** before creating a project.

Spool then shows the project's **ingest key** once. Copy it now: if you lose it, create a new ingest key in **Settings**. Below it are the install line and a three-line `init` for Spool's SDK, already filled in with this installation's address and that key, and **Send test error**, which sends one real error to the new project. Already using Sentry? The project's **Sentry DSN** is shown there too.

With rer dev v2 (pinned rer 0.2.25), this ingest key works from your app against local Spool without the private dev gate. A deploy key from Settings also works from your local build without the gate. Allow your browser app's exact origin in Capture; never give the browser the `RER_OPEN` link or its gate. Local read-only agent access still needs the gate, privately extracted from the `rer-dev` fragment as `SPOOL_DEV_KEY`; see [the agent guide](WITH-YOUR-AGENT.md#local-agent-access). Deployed Spool refuses all dev-minted keys; sign in there and create fresh keys. [Key scopes](capture.md#keys-for-anything-outside-this-checkout) explains the boundaries.

Use **Send test error** to check that the key and release receive an error from Spool itself, then choose **Continue to workbench** to open the project's **Issues**. If you sent the test, its issue is already there; otherwise the list waits for your first event. The test does not check your app's browser origin or source maps. [Connect your app](capture.md) next; **Check for events** is on the later **Capture** page.

## Stopping and starting

With terminal (TTY) output, `rer dev` stays in the foreground; stop it with Ctrl+C. With non-TTY output, it returns once ready and leaves the server running in the background; stop it with `rer dev --stop`. You can also stop it from another terminal. Use `--foreground` or `--detach` to choose explicitly. Your owner, projects and events are kept on this computer and are still there the next time you run `rer dev`.

Stop dev before deploying, verifying, resetting or transferring local data.

To move Spool to another computer, use **Download private archive** in **Settings**, then start a fresh copy on the new one. On `/setup`, choose **Restore a private archive**, select the file and choose **Restore into empty installation**. Create new project keys after restore; archives exclude credentials. The browser accepts up to 16 MiB. For a larger archive or CLI restore, follow [the transfer procedure](../OPERATIONS.md#data-movement-and-retention), including `chmod 600` for browser downloads.
