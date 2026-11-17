import { useState } from 'react';
import { Details } from './Details';

type Connection =
  | { state: 'not_configured' }
  | { state: 'invalid'; reason: string }
  | { state: 'configured'; appId: string; installationId: string; demo?: boolean };

const procedure = '/docs/github-connection';

export function GitHubConnectionSetup({ connection, check }: { connection: Connection; check?: () => Promise<{ ok: true } | { ok: false; message: string }> }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState('');
  async function testConnection() {
    if (!check) return;
    setChecking(true);
    setResult('');
    try {
      const result = await check();
      setResult(result.ok ? 'GitHub confirmed access to the App installation.' : result.message);
    } catch {
      setResult('Spool could not check the connection. Reload the page and try again.');
    } finally {
      setChecking(false);
    }
  }
  if (connection.state === 'configured' && connection.demo) return <p className="execution-meta">GitHub connection: Demo connection</p>;
  return <div role="group" aria-label="GitHub connection">
    <p className="execution-meta" role="status">GitHub connection: {connection.state === 'configured'
      ? `configured for App ${connection.appId}, installation ${connection.installationId}.`
      : connection.state === 'invalid' ? `invalid (${connection.reason}). Fix branches cannot contact GitHub until the installation operator corrects the connection secret.`
        : 'not configured. Fix branches cannot contact GitHub.'}</p>
    {connection.state !== 'configured' && <>
      <p>Ask your installation operator to set the optional <code>GITHUB_CONNECTION</code> secret. The <a href={procedure}>GitHub connection guide</a> covers hosted and local setup.</p>
      <p>Approving a grant while disconnected does not contact GitHub; its expiry clock still starts.</p>
    </>}
    {connection.state === 'configured' && check && <>
      <button className="text-button" type="button" disabled={checking} onClick={() => void testConnection()}>Check connection</button>
      <p className="execution-meta" role="status">{checking ? 'Checking the App installation with GitHub…' : result}</p>
    </>}
    <Details title="GitHub connection limits" triggerLabel="Show connection limits">
      <p>The installation operator supplies the App ID, installation ID and private key. Once configured, an installation owner can check App installation access from this page. Repository access is checked when you run an approved grant.</p>
      <p>Review the exact grant before approving. Approval with a connection can immediately open the branch and draft pull request. For an already approved, unexpired grant, choose <strong>Open branch and draft pull request</strong>. Renew an expired grant to continue. Workflow receipts record provider failures.</p>
      <p>The branch initially contains the reproducer record as data. You supply the code fix and control merge, release and deployment.</p>
      <p><a href={procedure}>Operator procedure and exact grant behaviour</a></p>
    </Details>
  </div>;
}
