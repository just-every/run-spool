import { useEffect, useRef, useState } from 'react';
import { Field, type Request, type Run } from './shared';
import { ErasureCounts, ErasureReceipt, KeptOnPurpose } from './ErasureReceipt';
import { erasureTotal } from './erasureLabels';

// Owner-only project erasure (ERASE-001, Base BASE-DATA-003): count-only preview, typed
// confirmation, then a receipt with counts and times. Values never appear here.
export function ProjectErasure({ project, request, run, busy, onErased }: { project: string; request: Request; run: Run; busy: boolean; onErased: (receipt: any) => void }) {
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
    <p>Erasure permanently deletes this project and everything recorded for it: occurrences, issues, releases, source maps, keys, origins, alerts and their delivery history, repairs, reproducers, fix workflows, exposure reports and Sentry import records. It cannot be undone.</p>
    <button className="text-button" disabled={busy} onClick={() => void run(async () => { setPreview(await request(`/api/projects/${project}/erasure`)); setTyped(''); })}>Preview erasure</button>
    {preview && <>
      <p role="status">{erasureTotal(preview.deleted)} rows will be deleted.</p>
      <ErasureCounts title="Will be deleted" counts={preview.deleted} />
      <ErasureCounts title="Kept without their project link" counts={preview.redacted} />
      <KeptOnPurpose preview={preview} />
      {preview.hold ? <p role="alert">Another erasure is still running. Try again after it completes.</p> : <>
        <Field label={`Type ${project} to confirm`} value={typed} autoComplete="off" spellCheck={false} onChange={event => setTyped(event.target.value)} />
        <button className="danger-button" disabled={busy || typed !== project} onClick={() => void run(async () => {
          // The receipt heading takes focus as it mounts, so focus never passes through an empty frame.
          setReceipt(await request(`/api/projects/${project}/erasure`, 'POST', { confirm: typed, planHash: preview.planHash }));
        })}>Erase project</button>
      </>}
    </>}
  </section>;
}
