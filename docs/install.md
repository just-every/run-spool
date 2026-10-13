# Run it on your computer

Spool needs Node 22 and pnpm. Its commands pick the exact Node version the project declares (22.20.0) and download it if it is missing, without touching your other Node installations.

## Three commands

From a checkout of the repository:

```sh
pnpm install
pnpm run setup
pnpm run dev
```

- `pnpm install` installs the locked dependencies.
- `pnpm run setup` asks for your email, prepares the local database and private settings, and makes you the owner. It sends no email.
- `pnpm run dev` starts Spool and prints a link. Open it in a browser on this computer and you land in Spool, signed in as the owner. Keep that link to yourself: it carries this checkout's private key.

## Your first project

The first time you open Spool it asks you to create a project. Give it a name and a short identifier, such as `web-app`.

Spool then shows the project's **ingest key** once. Copy it now: if you lose it, create a new ingest key in **Settings**. Below it are the install line and a three-line `init` for Spool's SDK, already filled in with this installation's address and that key, and **Send test error**, which sends one real error to the new project. Already using Sentry? The project's **Sentry DSN** is shown there too.

When you choose **Continue to workbench**, Spool opens the project's **Issues**, waiting for your first event. [Connect your app](capture.md) next.

## Stopping and starting

Stop `dev` with Ctrl+C, or with `pnpm run dev -- --stop` from another terminal. Your owner, projects and events are kept on this computer and are still there the next time you run `pnpm run dev`.

To move Spool to another computer, use **Download private archive** in **Settings**, then restore the file into a fresh copy of Spool on the new one.
