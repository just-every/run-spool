import { Details } from './Details';

type Connection =
  | { state: 'not_configured' }
  | { state: 'invalid'; reason: string }
  | { state: 'configured'; appId: string; installationId: string; demo?: boolean };

const procedure = 'https://github.com/just-every/run-spool/blob/main/docs/REPRODUCE-AND-FIX.md#2-fix-branch-under-an-exact-expiring-grant';

export function GitHubConnectionSetup({ connection }: { connection: Connection }) {
  if (connection.state === 'configured' && connection.demo) return <p className="execution-meta">GitHub connection: Demo connection</p>;
  return <div role="group" aria-label="GitHub connection">
    <p className="execution-meta" role="status">GitHub connection: {connection.state === 'configured'
      ? `configured for App ${connection.appId}, installation ${connection.installationId}. Credentials are checked with GitHub only when you run an approved step.`
      : connection.state === 'invalid' ? `invalid (${connection.reason}). Fix branches cannot contact GitHub until the installation operator corrects the connection secret.`
        : 'not configured. Fix branches cannot contact GitHub.'}</p>
    {connection.state !== 'configured' && <>
      <p className="callout"><strong>GitHub setup is unavailable on this page.</strong> There is no credential form or connection test.</p>
      <p><strong>Hosted Spool cannot connect GitHub on this install:</strong> its deployment does not support the optional GitHub connection secret. <strong>Local Spool requires operator changes:</strong> someone with access to the Spool checkout must edit its private settings and restart Spool. Creating a GitHub App alone does not connect it.</p>
      <p>Approving a grant while disconnected does not contact GitHub; its expiry clock still starts.</p>
    </>}
    <Details title="GitHub connection limits" triggerLabel="Show connection limits">
      <p><strong>This page cannot add, repair or test a GitHub connection.</strong></p>
      <p><strong>Hosted setup is unavailable.</strong> The current deployment does not declare the optional <code>GITHUB_CONNECTION</code> secret, so rer refuses it as undeclared. Hosted setup needs deployment support for this optional integration. Do not add it through the Cloudflare dashboard: that changes the Worker outside rer’s deployment receipt and can block later rer updates.</p>
      <p><strong>Local setup is an operator task outside this page.</strong> It requires a GitHub App installed on the target repository, its App ID, installation ID and private key, plus access to edit the checkout’s private <code>.dev.vars</code> settings and restart Spool. The operator procedure below describes those manual changes.</p>
      <p><strong>Configured</strong> means Spool accepted the settings’ format; a successful approved step establishes access to GitHub. Review the exact grant before approving: approval with a connection can immediately open the branch and draft pull request. For an already approved, unexpired grant, choose <strong>Open branch and draft pull request</strong>; renew an expired grant to continue. Provider failures appear on this page and in the workflow’s receipts.</p>
      <p>The branch initially contains the reproducer record as data. You supply the code fix. Spool never merges, releases or deploys.</p>
      <p><a href={procedure} target="_blank" rel="noopener noreferrer">Operator procedure and exact grant behaviour</a></p>
    </Details>
  </div>;
}
