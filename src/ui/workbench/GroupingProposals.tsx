import { plural } from './readable';
import { useRef, useState } from 'react';
import { useLiveRead } from './useLiveRead';
import { GroupingExplanation } from './GroupingExplanation';
import { CorrectionHistory, CorrectionReview } from './OperatorPanel';
import { date, type Request, type Run } from './shared';
import { loadProposalEvidence, proposalAgent, proposalLabels, ProposalSummary, ProposalVariant, proposalText, type ProposalEvidence } from './proposalEvidence';

export function GroupingProposals({ project, request, run, busy, refresh, refreshVersion, onRulePreview }: {
  project: string; request: Request; run: Run; busy: boolean; refresh: () => void; refreshVersion: number; onRulePreview: (preview: any) => void;
}) {
  const [rows, setRows] = useState<any[] | null>(null);
  const rowsLoaded = useRef(false); rowsLoaded.current = rows !== null;
  const [selected, setSelected] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [evidence, setEvidence] = useState<ProposalEvidence | null>(null);
  const root = `/api/projects/${encodeURIComponent(project)}`;
  const endpoint = `${root}/grouping-proposals`;
  const load = async (id?: string) => {
    const [proposals, corrections, detail] = await Promise.all([
      request(endpoint), request(`${root}/corrections`), id ? request(`${endpoint}/${encodeURIComponent(id)}`) : Promise.resolve(null)
    ]);
    const reviewEvidence = detail ? await loadProposalEvidence(root, detail, request) : null;
    setRows(proposals); setHistory(corrections); if (detail) { setSelected(detail); setEvidence(reviewEvidence); setPreview(detail.state === 'approved' && detail.preview?.plan ? detail.preview : null); }
  };
  // Read quietly while the tab is visible and apply in place. A read that began before an action never replaces what the action showed.
  const generation = useRef(0), chosen = useRef<string | null>(null);
  chosen.current = selected?.id ?? null;
  const unchanged = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  useLiveRead(async (signal, background) => {
    const started = generation.current;
    try {
      const [proposals, corrections, detail] = await Promise.all([request(endpoint, 'GET', undefined, { background }), request(`${root}/corrections`), chosen.current ? request(`${endpoint}/${encodeURIComponent(chosen.current)}`, 'GET', undefined, { background }) : Promise.resolve(null)]);
      if (signal.aborted || started !== generation.current) return;
      setRows(current => unchanged(current, proposals) ? current : proposals); setHistory(current => unchanged(current, corrections) ? current : corrections);
      if (detail) setSelected((current: any) => unchanged(current, detail) ? current : detail);
      if (!rowsLoaded.current) setFailure('');
    } catch (error) { if (!signal.aborted && !rowsLoaded.current) setFailure(proposalText((error as Error).message)); }
  }, [endpoint, root, request, refreshVersion]);
  const action = (work: () => Promise<void>) => void run(async () => {
    setFailure(''); setNotice(''); generation.current++;
    try { await work(); generation.current++; } catch (error) {
      generation.current++;
      const failure = error as Error & { status?: number };
      setFailure(`${failure.status === 401 || failure.status === 403 ? 'Denied. Owner authorization is required. ' : failure.status === 409 ? 'Stale. Refresh the proposal before making another decision. ' : ''}${proposalText(failure.message)}`);
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
  const labels = selected ? proposalLabels(selected, evidence) : null;
  return <section className="evidence grouping-proposals" aria-labelledby="grouping-proposals-heading">
    <h2 id="grouping-proposals-heading">Agent grouping proposals</h2>
    <p>Review the agent’s explanation and counterexamples before deciding. Approval opens a preview; applying a correction or saving rules is a separate owner action.</p>
    {failure && <p role="alert">{failure}</p>}
    {rows === null ? <p role="status">{failure ? 'Grouping proposals unavailable.' : 'Loading grouping proposals…'}</p> : !rows.length ? <p>No agent grouping proposals yet.</p> : rows.map((row, index) => <div className="data-row" key={row.id} data-proposal-id={row.id}>
      <span>{row.kind} · <strong>{row.state}</strong> · {proposalAgent(row)}</span>
      <button className="text-button" disabled={busy} aria-label={`Review ${row.kind} proposal ${index + 1}`} onClick={() => action(async () => { await load(row.id); })}>Review proposal</button>
    </div>)}
    {selected && labels && <article className="callout" aria-label="Grouping proposal review" data-proposal-id={selected.id}>
      <h3>{selected.kind} proposal · {selected.state}</h3>
      <p>{proposalAgent(selected)}</p><p>Created {date(selected.created)} · updated {date(selected.updated)}</p>
      <ProposalSummary input={selected.input} labels={labels} />
      <h4>Agent rationale</h4><p>{proposalText(selected.input.rationale)}</p>
      <h4>Agent-cited variants</h4><ol>{selected.input.variants.map((variant: any, index: number) => <li key={index}><ProposalVariant variant={variant} evidence={evidence} /></li>)}</ol>
      {!!evidence?.unavailable && <p role="status">{evidence.unavailable} referenced {plural(evidence.unavailable, 'issue')} {evidence.unavailable === 1 ? 'is' : 'are'} no longer available. The proposal’s recorded evidence remains below.</p>}
      <GroupingExplanation explanation={selected.explanation} evidence={evidence} labels={labels} future={selected.kind === 'rule'} />
      {selected.state === 'proposed' && <div className="button-row">
        <button className="primary-button" disabled={busy} onClick={() => decide('approve')}>Approve proposal and open preview</button>
        <button className="text-button" disabled={busy} onClick={() => decide('reject')}>Reject grouping proposal</button>
      </div>}
      {selected.state === 'approved' && !preview && <><p>Approved proposals require an explicit apply or rules save.</p>{selected.preview && <button className="text-button" disabled={busy} onClick={() => selected.preview.plan ? setPreview(selected.preview) : onRulePreview(selected.preview)}>Open approved preview</button>}</>}
      {selected.state === 'stale' && <p>This proposal no longer matches the recorded issue or rule revisions. Ask the agent for a new proposal using current evidence.</p>}
      {preview && <CorrectionReview preview={preview} labels={labels} busy={busy} onCancel={() => setPreview(null)} onApply={() => action(async () => {
        await request(`${root}/corrections/${encodeURIComponent(preview.id)}/apply`, 'POST', { confirm: true });
        setPreview(null); await load(selected.id); refresh(); setNotice('Reviewed correction applied. Original evidence remains recorded.');
      })} />}
      {history.some(entry => entry.id === selected.correction) && <CorrectionHistory entries={history.filter(entry => entry.id === selected.correction)} labels={labels} busy={busy} onUndo={id => action(async () => {
        await request(`${root}/corrections/${encodeURIComponent(id)}/undo`, 'POST', { confirm: true });
        await load(selected.id); refresh(); setNotice('Correction undone. Original evidence and prior decisions remain recorded.');
      })} />}
    </article>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
