# GitHub connection for fix branches

Fix branches need a GitHub App installed on the target repository. The installation operator supplies its credentials in the optional `GITHUB_CONNECTION` secret.

## Prepare the GitHub App

1. Register a GitHub App with repository permissions **Contents: Read and write**, **Pull requests: Read and write**, and **Checks: Read-only**. Leave user authorization and webhooks disabled. Protect the base branch with repository rules because GitHub grants Contents permission across the repository. [Register a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
2. Install the App. Choose **Only select repositories** and select the target repository. Record the numeric **App ID** from App settings and the separate numeric **installation ID** from its configuration URL (the number after `/installations/`). Generate and download the PEM private key. [Install your App](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app), [Generate a private key](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps#generating-private-keys)
3. Prepare a one-line JSON object. Encode each PEM line break as `\n` in the JSON string and replace the example IDs and key with your own values. Keep the value in a private settings file with mode `0600` and out of Git and command arguments.

   ```json
   {"appId":"<numeric App ID>","installationId":"<numeric installation ID>","privateKey":"<PEM private key with encoded line breaks>"}
   ```

   The optional `apiOrigin` field accepts an alternate HTTPS API origin. Leave it out for GitHub.com.

## Hosted Spool

Use the original deployment checkout and the same environment, Cloudflare account credentials and private deployment receipt as in [Hosting Spool](HOSTED.md#run-spool-on-your-cloudflare-account). Update an existing installation to a version that declares `GITHUB_CONNECTION` before configuring it.

Open the existing private deploy env file for that environment in an editor. Add `GITHUB_CONNECTION=` followed immediately by the one-line JSON object. Use the JSON object's own quotes without wrapping the whole object in quotes. Preserve all other settings. For a first install, deploy with that env file as in the hosting guide. For an existing deployment, set or replace the secret with the command below. Set `SPOOL_ENV` to the environment you deployed, such as `production`.

```sh
rer deploy --environment "$SPOOL_ENV" --env-file .rer/deploy/"$SPOOL_ENV".env --set-secret GITHUB_CONNECTION
```

Rer records the change against your deployment receipt. Keep the value in the private env file used for later deploys. To disconnect, remove its line from the file, then run the same command with `--unset-secret GITHUB_CONNECTION` in place of `--set-secret GITHUB_CONNECTION`.

## Local Spool

Work in the Spool checkout. Stop the foreground dev process with Ctrl+C. If you started it detached, stop that specific process before editing its settings. Add `GITHUB_CONNECTION=` followed by the one-line JSON object wrapped in single quotes to the checkout's private `.dev.vars` file:

```text
GITHUB_CONNECTION='{"appId":"<numeric App ID>","installationId":"<numeric installation ID>","privateKey":"<PEM private key with encoded line breaks>"}'
```

Preserve the other settings and keep the file mode `0600`. Restart from that checkout with `rer dev` or `~/.local/bin/rer dev` after the no-Node installer.

## Check the connection

Sign in as the installation owner and reload an issue's **Reproduce and fix → Fix branches** section. **Configured** means Spool accepted the settings' format. Choose **Check connection** to verify that GitHub accepts the App key and returns the specified installation. The check reads the installation and returns a result on the page. It does not mint an installation token or inspect or change a repository. If the check returns a problem, ask the operator to correct the private settings and load them again using the same procedure.

An approved step establishes access to the exact repository and records its own receipt. Review the repository, base, branch, paths, purpose and expiry in the grant before approving. With a connection, approval can immediately open a branch and draft pull request. For an already approved, unexpired grant, choose **Open branch and draft pull request**. Renew an expired grant first.

Without a connection, approval waits for the connection and the expiry clock still starts. The first branch contains the reproducer record as data. You supply the code fix and control merge, release and deployment.

— Run Edit Run fleet, 2026-11-18.
