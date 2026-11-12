# GitHub connection for fix branches

Fix branches need a GitHub App installed on the target repository and a connection supplied by the person who operates this Spool installation. Creating a GitHub App alone does not connect Spool. The issue page has no credential form or standalone connection test.

## Local Spool

Use the checkout that runs Spool, not the checkout of the application reporting errors.

1. Create or use a GitHub App with repository permissions **Contents: Read and write**, **Pull requests: Read and write**, and **Checks: Read-only**. Install it on the target repository. Protect the base branch with repository rules: GitHub cannot restrict Contents permission to only the fix branch.
2. Record the numeric **App ID** from the App settings and the separate numeric **installation ID** from its configuration URL (the number after `/installations/`). Generate and download its PEM private key. Keep it private.
3. Stop the Spool dev process with Ctrl+C in its foreground terminal. If you started it detached, stop that specific process before editing its settings.
4. Add `GITHUB_CONNECTION` to the Spool checkout's private `.dev.vars` file. Preserve the other settings and keep the file mode `0600`. Its value is one JSON object, wrapped in single quotes on one line:

   ```text
   GITHUB_CONNECTION='{"appId":"<numeric App ID>","installationId":"<numeric installation ID>","privateKey":"<PEM private key with line breaks encoded as \\n>"}'
   ```

   Replace the placeholders with your own values; encode each actual PEM line break as `\n` in the JSON string. Do not commit the file or paste it into an issue, report or screenshot. The optional `apiOrigin` field is for an alternate HTTPS API origin; normal GitHub needs no override.
5. From that same checkout, restart with `rer dev` (or `~/.local/bin/rer dev` after the no-Node installer). Reload the issue's **Reproduce and fix → Fix branches** section.

**Configured** means only that Spool accepted the settings' format. It does not prove access to GitHub. An invalid connection reports its reason on the issue page; correct the setting, stop, restart and reload again.

## Check access through an approved step

There is no harmless standalone connection test. Review the exact repository, base, branch, paths, purpose and expiry in the grant before approving. With a connection, approval can immediately open a branch and draft pull request. For an already approved, unexpired grant, choose **Open branch and draft pull request**; renew an expired grant first. A successful step establishes access and records its receipt. Failures appear on the issue page and in the workflow receipts.

Without a connection, approval waits for the connection and makes no provider request, but the expiry clock still starts. The first branch contains the reproducer record as data; you supply the code fix. Spool never merges, releases or deploys.

## Hosted Spool

The current hosted deployment does **not support the optional GitHub connection secret**. Its `deploy.json` does not declare `GITHUB_CONNECTION`; `rer deploy --set-secret GITHUB_CONNECTION` refuses it as undeclared. There is no supported hosted credential-entry route today. Use local Spool for this workflow or ask your installation operator for a release with optional integration deployment support.

Do not add the secret through the Cloudflare dashboard: changing the Worker outside rer's deployment receipt can block subsequent updates. Making it a required secret would also force every installation to provide GitHub credentials.
