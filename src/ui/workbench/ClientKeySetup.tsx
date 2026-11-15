import { useState } from 'react';
import { CodeBlock, SdkSetup, SendTestError, SentryIntake } from './SdkSetup';
import type { Request, Run } from './shared';

/** Native issuance is the only way back from a lost, hash-only credential. */
export function ClientKeySetup({ project, endpoint, release, build, request, run, busy, onIssued, initialKey = '' }: {
  project: string; endpoint: string; release: string; build: string; request: Request; run: Run; busy: boolean;
  onIssued?: (key: string) => void; initialKey?: string;
}) {
  const [grant, setGrant] = useState<{ key: string; dsn?: string } | null>(initialKey ? { key: initialKey } : null);
  return <div className="client-key-setup">
    {!grant ? <><p>Saved keys cannot be recovered: Spool stores their hashes. Create a new ingest key to copy it and test capture here. Existing keys keep working until you revoke them in Settings.</p><button className="primary-button" disabled={busy} onClick={() => void run(async () => {
      const created = await request(`/api/projects/${encodeURIComponent(project)}/keys`, 'POST', { kind: 'ingest' });
      setGrant(created); onIssued?.(created.key);
    })}>Create ingest key</button></> : <>
      <p>Copy this key now. It stays in this signed-in page’s memory until you dismiss it or reload.</p>
      <div className="secret-key" data-secret="ingest-key"><CodeBlock label="Ingest key" code={grant.key} /></div>
      <SdkSetup {...{ endpoint, project, release, build }} ingestKey={grant.key} />
      <SentryIntake dsn={grant.dsn} />
      <SendTestError {...{ project, release, build, request }} ingestKey={grant.key} />
      <button className="text-button" onClick={() => { setGrant(null); onIssued?.(''); }}>Dismiss ingest key</button>
    </>}
  </div>;
}
