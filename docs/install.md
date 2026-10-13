# Run it on your computer

Spool needs Node 22 or later and git. Install the public rer command with npm (included with Node). rer selects the declared Node 22.20.0 runtime and supplies pnpm 10.12.4 privately, without changing your other installations. You do not need pnpm on PATH.

With rer 0.2.2, `rer install` bootstraps the pinned pnpm itself. You do not need to install pnpm or add it to PATH.

## Install and start

```sh
npm install -g @runeditrun/rer@0.2.2
git clone https://github.com/just-every/run-spool.git spool
cd spool
rer install
rer setup
rer dev
```

- `rer install` installs the locked dependencies.
- `rer setup` asks for your email, prepares the local database and private settings, and makes you the owner. It sends no real email.
- `rer dev` starts Spool and prints a link. Open it in a browser on this computer and you land in Spool, signed in as the owner. Keep that link to yourself: it carries this checkout's private key.

## Your first project

The first time you open Spool it asks you to create a project. Give it a name and a short identifier, such as `web-app`.

Spool then shows the project's **ingest key** once. Copy it now: if you lose it, create a new ingest key in **Settings**. Below it are the install line and a three-line `init` for Spool's SDK, already filled in with this installation's address and that key, and **Send test error**, which sends one real error to the new project. Already using Sentry? The project's **Sentry DSN** is shown there too.

When you choose **Continue to workbench**, Spool opens the project's **Issues**, waiting for your first event. [Connect your app](capture.md) next.

## Stopping and starting

Stop `dev` with Ctrl+C, or with `rer dev --stop` from another terminal. Your owner, projects and events are kept on this computer and are still there the next time you run `rer dev`.

To move Spool to another computer, use **Download private archive** in **Settings**, then restore the file into a fresh copy of Spool on the new one.
