import { useEffect, useState, type FormEvent } from 'react';
import { hrefFor } from './location';
import { Field, type Request } from './shared';

type Connection =
  | { state: 'not_configured' }
  | { state: 'invalid'; reason: string; source?: 'saved' | 'environment' }
  | { state: 'configured'; appId: string; installationId: string; demo?: boolean; source?: 'saved' | 'environment' };

const endpoint = '/api/operator/github-connection';
export const githubConnectionSection = 'github-connection';

function status(connection: Connection) {
  if (connection.state === 'invalid') return connection.reason;
  if (connection.state === 'not_configured') return 'GitHub connection: Not configured.';
  return connection.demo ? 'GitHub connection: Demo connection' : 'GitHub connection: Configured.';
}

export function FixBranchConnection({ connection, project, canConfigure }: { connection: Connection; project: string; canConfigure: boolean }) {
  const demo = connection.state === 'configured' && connection.demo;
  return <div role="group" aria-label="GitHub connection">
    <p className="execution-meta">{status(connection)}</p>
    {!demo && (canConfigure
      ? <a className="inline-link" href={hrefFor(project, 'settings') + '#' + githubConnectionSection}>Manage GitHub connection in Settings</a>
      : connection.state !== 'configured' && <p>Ask the installation owner to configure GitHub in Settings.</p>)}
    {connection.state !== 'configured' && <p>Approval starts the grant’s expiry clock. GitHub steps wait for a connection.</p>}
  </div>;
}

export function GitHubConnectionSetup({ request, active }: { request: Request; active: boolean }) {
  const [connection, setConnection] = useState<Connection>();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!active) return;
    let open = true;
    void request(endpoint).then(value => { if (open) setConnection(value); }, () => { if (open) setProblem('GitHub connection status could not be loaded.'); });
    return () => { open = false; };
  }, [active, request]);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setNotice('');
    setProblem('');
    try { await action(); }
    catch (error) { setProblem((error as Error).message); }
    finally { setBusy(false); }
  }

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pem = form.get('privateKey');
    if (!(pem instanceof File) || !pem.size || pem.size > 8192) {
      setProblem('Choose the GitHub App’s PEM private key file (up to 8 KiB).');
      return;
    }
    void act(async () => {
      setConnection(await request(endpoint, 'PUT', {
        appId: String(form.get('appId') ?? '').trim(),
        installationId: String(form.get('installationId') ?? '').trim(),
        privateKey: await pem.text(),
      }));
      setEditing(false);
      setNotice('Connection saved. Test it to verify access with GitHub.');
    });
  }

  const demo = connection?.state === 'configured' && connection.demo;
  const configured = connection?.state === 'configured';
  return <section className="evidence" id={githubConnectionSection} aria-labelledby="github-connection-heading">
    <h2 id="github-connection-heading">GitHub connection</h2>
    {connection ? <p>{status(connection)}</p> : !problem && <p role="status">Loading GitHub connection…</p>}
    {connection && !demo && <>
      {configured && <p>App {connection.appId} · Installation {connection.installationId}{connection.source === 'environment' && ' · Supplied by the runtime'}</p>}
      <div className="button-row">
        {!editing && <button className="text-button" disabled={busy} onClick={() => { setEditing(true); setNotice(''); setProblem(''); }}>{configured ? 'Replace connection' : connection.state === 'invalid' ? 'Repair connection' : 'Set up connection'}</button>}
        {configured && <button className="text-button" disabled={busy || editing} onClick={() => void act(async () => {
          await request(endpoint + '/test', 'POST');
          setNotice('GitHub accepted the App key and confirmed the installation and its permissions.');
        })}>Test connection</button>}
        {!editing && connection.state !== 'not_configured' && connection.source === 'saved' && <button className="text-button" disabled={busy} onClick={() => void act(async () => {
          setConnection(await request(endpoint, 'DELETE'));
          setNotice('Saved connection removed.');
        })}>Remove saved connection</button>}
      </div>
      {editing && <form className="form-grid" onSubmit={connect}>
        <ol className="form-more">
          <li><a className="inline-link" href="https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app" target="_blank" rel="noreferrer">Register a private GitHub App</a>. Turn off webhooks. Set repository permissions to <strong>Contents: Read and write</strong>, <strong>Pull requests: Read and write</strong> and <strong>Checks: Read-only</strong>.</li>
          <li>In the App’s settings, copy its App ID and choose <strong>Generate a private key</strong> to download the PEM file.</li>
          <li>Under <strong>Install App</strong>, install it on the target repository. Open its configuration under <strong>Installed GitHub Apps</strong> and copy the number after <code>/installations/</code> in the address.</li>
        </ol>
        <Field label="App ID" name="appId" required inputMode="numeric" pattern="[0-9]{1,20}" defaultValue={configured ? connection.appId : ''} disabled={busy} />
        <Field label="Installation ID" name="installationId" required inputMode="numeric" pattern="[0-9]{1,20}" defaultValue={configured ? connection.installationId : ''} disabled={busy} />
        <Field label="GitHub App private key (.pem)" name="privateKey" type="file" accept=".pem" required disabled={busy} />
        <div className="button-row form-more"><button className="primary-button" disabled={busy}>{configured ? 'Save replacement' : 'Connect GitHub'}</button><button type="button" className="text-button" disabled={busy} onClick={() => { setEditing(false); setProblem(''); }}>Cancel</button></div>
      </form>}
      <p><a className="inline-link" href="/docs/github-connection">GitHub connection guide</a></p>
    </>}
    {notice && <p role="status">{notice}</p>}
    {problem && <p role="alert">{problem}</p>}
  </section>;
}
