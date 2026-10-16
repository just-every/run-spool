import { Details } from './Details';

type Connection =
  | { state: 'not_configured' }
  | { state: 'invalid'; reason: string }
  | { state: 'configured'; appId: string; installationId: string; demo?: boolean };

const procedure = 'https://github.com/just-every/run-spool/blob/main/docs/REPRODUCE-AND-FIX.md#2-fix-branch-under-an-exact-expiring-grant';
const connectionShape = '{"appId":"YOUR_APP_ID","installationId":"YOUR_INSTALLATION_ID","privateKey":"-----BEGIN RSA PRIVATE KEY-----\\nYOUR_KEY_CONTENT\\n-----END RSA PRIVATE KEY-----\\n"}';

export function GitHubConnectionSetup({ connection }: { connection: Connection }) {
  if (connection.state === 'configured' && connection.demo) return <p className="execution-meta">GitHub connection: Demo connection</p>;
  return <div>
    <p className="execution-meta" role="status">GitHub connection: {connection.state === 'configured'
      ? `configured for App ${connection.appId}, installation ${connection.installationId}. Credentials are checked with GitHub only when you run an approved step.`
      : connection.state === 'invalid' ? `invalid (${connection.reason}). The installation operator must correct the connection secret.`
        : 'not configured. The installation operator must set up the connection before an approved grant can run.'}</p>
    {connection.state !== 'configured' && <p>Spool has no GitHub connection form. Local setup requires the installation operator’s private settings; hosted setup currently needs additional deployment support. The steps and limitation are below. Approving a grant while disconnected does not contact GitHub; its expiry clock still starts.</p>}
    <Details title="GitHub operator setup" triggerLabel="Show GitHub setup steps">
      <p>You need permission to manage a GitHub App, install it on the target repository, and edit this Spool installation’s private settings. If someone else hosts Spool for you, send them these steps.</p>
      <ol className="grant">
        <li>Create or use your own GitHub App. Give it repository permissions <strong>Contents: Read and write</strong>, <strong>Pull requests: Read and write</strong>, and <strong>Checks: Read-only</strong>. Install it on the repository named in the fix grant. Protect the base branch with repository rules: GitHub’s Contents permission cannot be restricted to the fix branch.</li>
        <li>From the GitHub App’s settings, record its numeric <strong>App ID</strong> and generate and download a PEM private key. From the installed app’s configuration URL, record the numeric <strong>installation ID</strong> (the number after <code>/installations/</code>). These are two different IDs.</li>
        <li>Build one JSON value with the fields below, replacing every placeholder. Encode the PEM line breaks as <code>{'\\n'}</code> inside the JSON string; keep the real key private.
          <pre>{connectionShape}</pre>
        </li>
        <li><strong>Local Spool:</strong> stop it with <code>rer dev --stop</code>. In the Spool checkout’s ignored <code>.dev.vars</code> file, add <code>GITHUB_CONNECTION=</code> followed by that JSON value wrapped in single quotes. Preserve the other settings, keep the file private (mode <code>0600</code>), and restart with <code>rer dev</code>.</li>
        <li><strong>Hosted Spool: setup is currently unavailable.</strong> The current <code>deploy.json</code> does not declare <code>GITHUB_CONNECTION</code>, so <code>rer deploy --set-secret GITHUB_CONNECTION</code> refuses it as an undeclared secret. Adding it as a required secret would require GitHub credentials from every installation, including those that do not use fix branches. Hosted setup needs deployment support for this optional integration before an operator can connect it through rer. Do not add it through the Cloudflare dashboard: that changes the Worker outside rer’s deployment receipt and can block later rer updates.</li>
        <li>Reload this issue page. <strong>Configured</strong> means Spool accepted the settings’ format; a successful approved step establishes access to GitHub. Review the exact grant before approving: approval with a connection can immediately open the branch and draft pull request. For an already approved, unexpired grant, choose <strong>Open branch and draft pull request</strong>; renew an expired grant to continue. Provider failures appear on this page and in the workflow’s receipts.</li>
      </ol>
      <p>The branch initially contains the reproducer record as data. You supply the code fix. Spool never merges, releases or deploys.</p>
      <p><a href={procedure} target="_blank" rel="noopener noreferrer">Operator procedure and exact grant behaviour</a></p>
    </Details>
  </div>;
}
