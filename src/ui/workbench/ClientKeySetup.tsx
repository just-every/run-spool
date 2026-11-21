import { NewKeyDialog } from './NewKeyDialog';
import { Field } from './shared';
import { useState } from 'react';
import { CodeBlock, SdkSetup, SendTestError, SentryIntake } from './SdkSetup';
import type { Request, Run } from './shared';

/** Native issuance is the only way back from a lost, hash-only credential. */
export function ClientKeySetup({ project, endpoint, release, build, request, run, busy, onIssued, onReceived, initialKey = '', initialDsn }: {
  project: string; endpoint: string; release: string; build: string; request: Request; run: Run; busy: boolean;
  onReceived?: () => void; onIssued?: (key: string) => void; initialKey?: string; initialDsn?: string;
}) {
  const [grant, setGrant] = useState<{ key: string; dsn?: string } | null>(initialKey ? { key: initialKey, dsn: initialDsn } : null);
  const [name,setName]=useState('');
  return <div className="client-key-setup">
    {!grant ? <><p>Saved keys cannot be recovered: Spool stores their hashes. Create a new ingest key to copy it and test capture here. Existing keys keep working until you revoke them in Settings.</p><Field label="Key name" value={name} maxLength={100} placeholder="Production site" disabled={busy} onChange={event=>setName(event.target.value)}/><button className="primary-button" disabled={busy} onClick={() => void run(async () => {
      const created = await request(`/api/projects/${encodeURIComponent(project)}/keys`, 'POST', { kind: 'ingest', name });
      setGrant(created); setName(''); onIssued?.(created.key);
    })}>Create ingest key</button><SdkSetup {...{ endpoint, project, release, build }} ingestKey="YOUR_INGEST_KEY" /><SentryIntake /></> : <NewKeyDialog onDismiss={()=>{setGrant(null);onIssued?.('');}}>
      <div className="secret-key" data-secret="ingest-key"><CodeBlock label="Ingest key" code={grant.key} /></div>
      <SdkSetup {...{ endpoint, project, release, build }} ingestKey={grant.key} />
      <SentryIntake dsn={grant.dsn} />
      <SendTestError {...{ project, release, build, request, onReceived }} ingestKey={grant.key} />
    </NewKeyDialog>}
  </div>;
}
