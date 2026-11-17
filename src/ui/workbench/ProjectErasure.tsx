import { plural } from './readable';
import { DownloadBackup } from './DownloadBackup';
import { useEffect, useRef, useState } from 'react';
import { Field, type Request, type Run } from './shared';
import { ErasureCounts, ErasureReceipt, KeptOnPurpose } from './ErasureReceipt';
import { erasureTotal } from './erasureLabels';

// Owner-only project erasure (ERASE-001, Base BASE-DATA-003): count-only preview, typed
// confirmation, then a receipt with counts and times. Values never appear here.
export function ProjectErasure({ project, projectName, request, run, busy, onErased }: { project: string; projectName: string; request: Request; run: Run; busy: boolean; onErased: (receipt: any) => void }) {
  const [preview, setPreview] = useState<any>(null), [typed, setTyped] = useState(''), [receipt, setReceipt] = useState<any>(null);
  const [progressError, setProgressError] = useState('');
  useEffect(() => {
    if (!receipt || receipt.phase === 'complete' || progressError) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      request(`/api/erasures/${receipt.id}/resume`, 'POST').then(next => {
        if (!cancelled) setReceipt(next);
      }).catch(error => { if (!cancelled) setProgressError(error instanceof Error ? error.message : 'Erasure could not continue.'); });
    }, 100);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [receipt, request, progressError]);
  // Once the erasure is complete the workbench takes the receipt: the project leaves the switcher and the app moves on.
  const handed = useRef(false);
  useEffect(() => { if (receipt?.phase === 'complete' && !handed.current) { handed.current = true; onErased(receipt); } }, [receipt]);
  if (receipt?.phase === 'complete') return null;
  if (receipt) return <ErasureReceipt receipt={receipt} progressError={progressError} onContinue={() => onErased(receipt)} />;
  return <section className="evidence" aria-labelledby="erasure-title">
    <h2 id="erasure-title">Erase this project</h2>
    <p>Preview what you’ll delete before you confirm.</p>
    <button className="text-button" disabled={busy} onClick={() => void run(async () => { setPreview(await request(`/api/projects/${project}/erasure`)); setTyped(''); })}>Preview erasure</button>
    {preview && <>
      <p role="status">This deletes {projectName}: {preview.deleted.issues??0} {plural(preview.deleted.issues??0,'issue')}, {preview.deleted.events??0} {plural(preview.deleted.events??0,'error')}, {preview.deleted.credentials??0} {plural(preview.deleted.credentials??0,'key')}, {preview.deleted.alert_rules??0} {plural(preview.deleted.alert_rules??0,'alert rule')}. It can’t be undone.</p>
      <DownloadBackup {...{busy,run}} label="Download a backup first"/>
      <details><summary>Details</summary><p>{erasureTotal(preview.deleted)} rows will be deleted.</p>
       <ErasureCounts title="Will be deleted" counts={preview.deleted} />
       <ErasureCounts title="Kept without their project link" counts={preview.redacted} />
       <KeptOnPurpose preview={preview} />
      </details>
      {preview.hold ? <p role="alert">Another erasure is still running. Try again after it completes.</p> : <>
        <Field label={`Type ${project} to confirm`} value={typed} autoComplete="off" spellCheck={false} onChange={event => setTyped(event.target.value)} />
        <button className="danger-button" disabled={busy || typed !== project} onClick={() => void run(async () => {
          // The receipt heading takes focus as it mounts, so focus never passes through an empty frame.
          setReceipt(await request(`/api/projects/${project}/erasure`, 'POST', { confirm: typed, planHash: preview.planHash }));
        })}>Delete project</button>
      </>}
    </>}
  </section>;
}
