# Getting started

Spool runs on your own computer. Open a terminal (on a Mac, Terminal in Applications → Utilities; on Windows, your WSL2 distribution), copy this line into it and press Enter:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-spool
```

Git is required; rer brings Node and pnpm. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-spool` does the same.

The line installs `rer`, the Run Edit Run command, clones Spool into a `run-spool` folder, installs everything, prepares the local database and a local owner, and starts Spool. It prints `RER_OPEN`: open it in a browser on the same computer to enter signed in as the owner, and keep it private, because it carries this checkout's dev key. This free copy runs only on your computer: it sends no email, and nobody else can open it.

If the installer prints a line that puts `rer` on your PATH, run that line too. To start Spool again later, run the same line from the same folder, or `cd run-spool && rer dev`. `rer dev --stop` stops it.

Next: [Run it on your computer](install.md) covers choosing your owner email and your first project, then [Connect your app](capture.md) sends Spool its first errors.
