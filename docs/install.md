# Run it on your computer

Spool needs Node 22 or later and git, on macOS, Linux or Windows with WSL2. rer supplies the declared Node 22.20.0 runtime and pnpm 10.12.4; you do not need pnpm on PATH.

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

`rer dev` installs everything, asks for your owner email when needed, prepares the local database and prints `RER_OPEN`. Open that link in a browser on this computer to enter signed in as the owner. Keep it private: it carries this checkout's dev key. Local sign-in sends no real email.

For separate lifecycle steps, `rer install` installs the locked dependencies and `rer setup` prepares or preserves the owner and local settings. They are also available independently; the first start above handles them for you.

## Your first project

The first time you open Spool, `/setup` offers project creation or archive restore. For a new project, give it a name and a short identifier, such as `web-app`. If you are moving existing evidence, choose **Restore a private archive** before creating a project.

Spool then shows the project's **ingest key** once. Copy it now: if you lose it, create a new ingest key in **Settings**. Below it are the install line and a three-line `init` for Spool's SDK, already filled in with this installation's address and that key, and **Send test error**, which sends one real error to the new project. Already using Sentry? The project's **Sentry DSN** is shown there too.

For an app or build outside this checkout, [create ordinary keys through local sign-in](capture.md#keys-for-anything-outside-this-checkout) before connecting it. Keys created by the default dev persona require this checkout's dev gate.

When you choose **Continue to workbench**, Spool opens the project's **Issues**, waiting for your first event. [Connect your app](capture.md) next.

## Stopping and starting

Stop `dev` with Ctrl+C, or with `rer dev --stop` from another terminal. Your owner, projects and events are kept on this computer and are still there the next time you run `rer dev`.

To move Spool to another computer, use **Download private archive** in **Settings**, then start a fresh copy on the new one. On `/setup`, choose **Restore a private archive**, select the file and choose **Restore into empty installation**. Create new project keys after restore; archives exclude credentials. The browser accepts up to 16 MiB. For a larger archive or CLI restore, follow [the transfer procedure](../OPERATIONS.md#data-movement-and-retention), including `chmod 600` for browser downloads.
