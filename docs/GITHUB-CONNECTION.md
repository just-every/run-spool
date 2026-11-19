# GitHub connection for fix branches

In an issue, open **Reproduce and fix → Fix branches → Manage GitHub connection in Settings**. The installation owner can connect a GitHub App on local or hosted Spool.

1. [Register a private GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app). Turn off webhooks. Give it repository permissions **Contents: Read and write**, **Pull requests: Read and write**, and **Checks: Read-only**. Protect the base branch with GitHub repository rules.
2. Copy the numeric **App ID** from the App settings. Under **Private keys**, choose **Generate a private key** and keep the downloaded PEM file private.
3. Under **Install App**, install it on the target repository. Open its configuration in **Installed GitHub Apps**. Copy the number after `/installations/` in the address as the **Installation ID**.
4. Pick **Set up connection** in Spool. Enter both IDs, select the PEM file and choose **Connect GitHub**. Then choose **Test connection** to verify the key, installation and permissions. Testing reads the installation in GitHub and creates no branch or pull request.
5. If the test fails, correct the permissions or installation in GitHub, or use **Replace connection** to provide different IDs and a fresh PEM file. Retest before approving a grant. The saved private key is encrypted on this installation and excluded from archives.

Return to the issue to review the exact grant. Approval starts its expiry clock and can open a branch and draft pull request immediately. For an approved and unexpired grant, choose **Open branch and draft pull request**. Renew an expired grant before trying again. Each step checks its repository scope and records the provider result. The initial branch contains the reproducer record as data. You supply the code fix, then merge and deploy it through your own workflow.
