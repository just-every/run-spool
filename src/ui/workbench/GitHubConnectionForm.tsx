import { useState, type FormEvent } from 'react';
import { Field, type Request, type Run } from './shared';

export function GitHubConnectionForm({ project, request, run, busy, onSaved }: { project: string; request: Request; run: Run; busy: boolean; onSaved: () => Promise<void> }) {
  const [appId, setAppId] = useState(''), [installationId, setInstallationId] = useState(''), [privateKey, setPrivateKey] = useState('');
  const [repository, setRepository] = useState(''), [branch, setBranch] = useState('main');
  const [problem, setProblem] = useState(''), [notice, setNotice] = useState('');
  const path = `/api/projects/${encodeURIComponent(project)}/github-connection`;
  const act = (work: () => Promise<void>) => void run(async () => {
    setProblem(''); setNotice('');
    try { await work(); } catch (error) { setProblem((error as Error).message); }
  });
  function connect(event: FormEvent) {
    event.preventDefault();
    act(async () => {
      await request(path, 'PUT', { appId, installationId, privateKey });
      setPrivateKey(''); await onSaved(); setNotice('GitHub App connected. Test repository access before approving a fix grant.');
    });
  }
  return <>
    <details><summary>Connect or replace GitHub App</summary>
      <form className="form-grid" onSubmit={connect}>
        <Field label="App ID" required inputMode="numeric" pattern="[0-9]+" value={appId} onChange={event => setAppId(event.target.value)} />
        <Field label="Installation ID" required inputMode="numeric" pattern="[0-9]+" value={installationId} onChange={event => setInstallationId(event.target.value)} />
        <label className="form-field">PEM private key<textarea required autoComplete="off" data-secret value={privateKey} maxLength={12000} rows={4} onChange={event => setPrivateKey(event.target.value)} /></label>
        <button className="primary-button" disabled={busy}>Connect GitHub App</button>
      </form>
    </details>
    <form className="form-grid" onSubmit={event => { event.preventDefault(); act(async () => { const result = await request(path + '/test', 'POST', {repository,branch}); setNotice(result.message); }); }}>
      <Field label="Repository to test (owner/name)" required value={repository} onChange={event => setRepository(event.target.value)} />
      <Field label="Base branch to test" required value={branch} onChange={event => setBranch(event.target.value)} />
      <button className="text-button" disabled={busy}>Test GitHub connection</button>
    </form>
    {problem && <p role="alert">{problem}</p>}
    {notice && <p role="status">{notice}</p>}
  </>;
}
