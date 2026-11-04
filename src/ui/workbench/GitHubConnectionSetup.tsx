import { Details } from './Details';
import { GitHubConnectionForm } from './GitHubConnectionForm';
import type { Request, Run } from './shared';

type Connection = { state: 'not_configured' | 'invalid' | 'configured'; reason?: string; appId?: string; installationId?: string; demo?: boolean; canManage?: boolean };
const procedure = 'https://github.com/just-every/run-spool/blob/main/docs/REPRODUCE-AND-FIX.md#2-fix-branch-under-an-exact-expiring-grant';

export function GitHubConnectionSetup({ connection, project, request, run, busy, onSaved }: { connection: Connection; project: string; request: Request; run: Run; busy: boolean; onSaved: () => Promise<void> }) {
  if (connection.state === 'configured' && connection.demo) return <p className="execution-meta">GitHub connection: Demo connection</p>;
  return <div role="group" aria-label="GitHub connection">
    <p className="execution-meta" role="status">GitHub connection: {connection.state === 'configured' ? `configured for App ${connection.appId}, installation ${connection.installationId}. Test repository access below.` : connection.state === 'invalid' ? `invalid (${connection.reason}).` : 'not configured. Fix branches cannot contact GitHub.'}</p>
    <p>Use a GitHub App installed on your repository with <strong>Contents: Read and write</strong>, <strong>Pull requests: Read and write</strong> and <strong>Checks: Read-only</strong>. Supply its numeric <strong>App ID</strong>, numeric <strong>installation ID</strong> and <strong>PEM private key</strong>.</p>
    <p><a href={procedure} target="_blank" rel="noopener noreferrer">GitHub setup guide and exact grant behaviour</a></p>
    {connection.canManage ? <GitHubConnectionForm {...{project,request,run,busy,onSaved}} /> : <p>The installation owner connects and tests the GitHub App here.</p>}
    <Details title="GitHub connection limits" triggerLabel="Show connection limits">
      <p>Connection credentials are kept privately on this installation and excluded from evidence and archives. An operator-provided <code>GITHUB_CONNECTION</code> JSON setting uses <code>appId</code>, <code>installationId</code> and <code>privateKey</code>; a connection entered here takes precedence without a restart.</p>
      <p>A connection test reads the base branch, checks repository access and permissions, and revokes its temporary token. It creates no branch or pull request.</p>
      <p>Review the exact grant before approving: approval with a connection can immediately open the branch and draft pull request. The branch initially contains the reproducer record as data. You supply the code fix. Spool never merges, releases or deploys.</p>
    </Details>
  </div>;
}
