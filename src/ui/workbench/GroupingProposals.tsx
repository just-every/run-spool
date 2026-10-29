import { useEffect, useState } from 'react';
import { SectionHead } from './SectionHead';
import { GroupingExplanation } from './GroupingExplanation';
import { CorrectionHistory, CorrectionReview } from './OperatorPanel';
import { date, type Request, type Run } from './shared';

export function GroupingProposals({ project, request, run, busy, refresh, refreshVersion, onRulePreview }: {
  project: string; request: Request; run: Run; busy: boolean; refresh: () => void; refreshVersion: number; onRulePreview: (preview: any) => void;
}) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const root = `/api/projects/${encodeURIComponent(project)}`;
  const endpoint = `${root}/grouping-proposals`;
  const load = async (id?: string) => {
    const [proposals, corrections, detail] = await Promise.all([
      request(endpoint), request(`${root}/corrections`), id ? request(`${endpoint}/${encodeURIComponent(id)}`) : Promise.resolve(null)
    ]);
    setRows(proposals); setHistory(corrections); if (detail) { setSelected(detail); setPreview(detail.state === 'approved' && detail.preview?.plan ? detail.preview : null); }
  };
  useEffect(() => {
    let alive = true;
    Promise.all([request(endpoint), request(`${root}/corrections`), selected ? request(`${endpoint}/${encodeURIComponent(selected.id)}`) : Promise.resolve(null)])
      .then(([proposals, corrections, detail]) => { if (alive) { setRows(proposals); setHistory(corrections); if (detail) setSelected(detail); } })
      .catch(error => { if (alive) setFailure(error.message); });
    return () => { alive = false; };
  }, [endpoint, root, request, refreshVersion]);
  const action = (work: () => Promise<void>) => void run(async () => {
    setFailure(''); setNotice('');
    try { await work(); } catch (error) {
      const failure = error as Error & { status?: number };
      setFailure(`${failure.status === 401 || failure.status === 403 ? 'Denied. Owner authorization is required. ' : failure.status === 409 ? 'Stale. Refresh the proposal before making another decision. ' : ''}${failure.message}`);
      if (failure.status === 409) { setPreview(null); await load(selected?.id); }
    }
  });
  const decide = (decision: 'approve' | 'reject') => action(async () => {
    const result = await request(`${endpoint}/${encodeURIComponent(selected.id)}/${decision}`, 'POST', {});
    setSelected(result); setPreview(null); await load(result.id);
    if (decision === 'approve') {
      if (result.preview?.plan) setPreview(result.preview);
      else if (result.preview) onRulePreview(result.preview);
      setNotice('Proposal approved. Review the preview and explicitly apply the correction or save the rules.');
    } else setNotice('Proposal rejected. No grouping changed.');
  });
  return <section className="evidence grouping-proposals" aria-labelledby="grouping-proposals-heading">
    <SectionHead id="grouping-proposals-heading" title="Agent grouping proposals" about={<p>Review the agent’s explanation and counterexamples before deciding. Approval opens a preview; applying a correction or saving rules is a separate owner action.</p>}><button className="text-button" disabled={busy} onClick={() => action(async () => { await load(selected?.id); setNotice('Grouping proposals refreshed.'); })}>Refresh grouping proposals</button></SectionHead>
    {failure && <p role="alert">{failure}</p>}
    {rows === null ? <p role="status">{failure ? 'Grouping proposals unavailable.' : 'Loading grouping proposals…'}</p> : !rows.length ? <p>No agent grouping proposals yet.</p> : rows.map(row => <div className="data-row" key={row.id}>
      <span>{row.kind} · <strong>{row.state}</strong> · {row.label}</span>
      <button className="text-button" disabled={busy} aria-label={`Review grouping proposal ${row.id}`} onClick={() => action(async () => { await load(row.id); })}>Review proposal</button>
    </div>)}
    {selected && <article className="callout" aria-label="Grouping proposal review">
      <h3>{selected.kind} proposal · {selected.state}</h3>
      <p>{selected.label}</p><p>Proposal <code>{selected.id}</code> · created {date(selected.created)} · updated {date(selected.updated)}</p>
      <h4>Agent rationale</h4><p>{selected.input.rationale}</p>
      <h4>Agent-cited variants</h4><pre className="proposal-input">{JSON.stringify(selected.input.variants, null, 2)}</pre>
      <GroupingExplanation explanation={selected.explanation} />
      {selected.state === 'proposed' && <div className="button-row">
        <button className="primary-button" disabled={busy} onClick={() => decide('approve')}>Approve proposal and open preview</button>
        <button className="text-button" disabled={busy} onClick={() => decide('reject')}>Reject grouping proposal</button>
      </div>}
      {selected.state === 'approved' && !preview && <><p>Approved proposals require an explicit apply or rules save.</p>{selected.preview && <button className="text-button" disabled={busy} onClick={() => selected.preview.plan ? setPreview(selected.preview) : onRulePreview(selected.preview)}>Open approved preview</button>}</>}
      {selected.state === 'stale' && <p>This proposal no longer matches the recorded issue or rule revisions. Ask the agent for a new proposal using current evidence.</p>}
      {preview && <CorrectionReview preview={preview} busy={busy} onCancel={() => setPreview(null)} onApply={() => action(async () => {
        await request(`${root}/corrections/${encodeURIComponent(preview.id)}/apply`, 'POST', { confirm: true });
        setPreview(null); await load(selected.id); refresh(); setNotice('Reviewed correction applied. Original evidence remains recorded.');
      })} />}
      {history.some(entry => entry.id === selected.correction) && <CorrectionHistory entries={history.filter(entry => entry.id === selected.correction)} busy={busy} onUndo={id => action(async () => {
        await request(`${root}/corrections/${encodeURIComponent(id)}/undo`, 'POST', { confirm: true });
        await load(selected.id); refresh(); setNotice('Correction undone. Original evidence and prior decisions remain recorded.');
      })} />}
    </article>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
