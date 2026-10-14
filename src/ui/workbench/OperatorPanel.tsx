import { useEffect, useState } from 'react';
import { Details } from './Details';
import { Field, type Request, type Run } from './shared';

type CorrectionPreview = {
  id: string;
  plan: {
    issues: Array<{ id: string; revision: number; count: number; after: number }>;
    moves: Array<{ event: string; occurrence: string; from: string; to: string }>;
  };
  newIssue: { id: string; before: number; after: number } | null;
};

function CorrectionReview({ preview, busy, onApply, onCancel }: { preview: CorrectionPreview; busy: boolean; onApply: () => void; onCancel: () => void }) {
  const moves = preview.plan.moves;
  return <div className="callout correction-review">
    <h3>Review exact moves</h3>
    <p>Nothing has moved yet. Apply this preview explicitly.</p>
    <strong>Issue counts before and after</strong>
    <ul>
      {preview.plan.issues.map((issue: any) => <li key={issue.id}><code>{issue.id}</code>: {issue.count} → {issue.after} events</li>)}
      {preview.newIssue && <li><code>{preview.newIssue.id}</code> (new issue): {preview.newIssue.before} → {preview.newIssue.after} events</li>}
    </ul>
    <strong>Exact event moves ({moves.length})</strong>
    <ol>
      {moves.map((move: any) => <li key={`${move.event}:${move.occurrence}`}>
        <code>{move.event}</code> (occurrence <code>{move.occurrence}</code>): <code>{move.from}</code> → <code>{move.to}</code>
      </li>)}
    </ol>
    <button className="primary-button" disabled={busy} onClick={onApply}>Apply reviewed correction</button>
    <button className="text-button" onClick={onCancel}>Cancel review</button>
  </div>;
}

function CorrectionHistory({ entries, issueId, busy, onUndo }: { entries: any[]; issueId: string; busy: boolean; onUndo: (id: string) => void }) {
  const relevant = entries.filter(entry => entry.plan.issues.some((item: any) => item.id === issueId) || entry.plan.target === issueId);
  return <>
    <h3>Correction history</h3>
    {relevant.map(entry => <Details key={entry.id} title={`${entry.kind} · ${entry.state}`} triggerLabel={`${entry.kind} · ${entry.state}`}>
      <pre>{JSON.stringify(entry, null, 2)}</pre>
      {entry.state === 'applied' && <button className="text-button" disabled={busy} onClick={() => onUndo(entry.id)}>Undo this correction</button>}
    </Details>)}
    <p>Undo refuses after newer issue work, capture or retention; it never restores deleted occurrences. History is bounded to 50 records per project.</p>
  </>;
}

export function OperatorPanel({ project, packet, busy, request, run, refresh }: { project: string; packet: any; busy: boolean; request: Request; run: Run; refresh: () => void }) {
  const [state, setState] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [preview, setPreview] = useState<CorrectionPreview | null>(null);
  const [failure, setFailure] = useState('');
  const [field, setField] = useState('fingerprint');
  const [mode, setMode] = useState('exact');
  const [value, setValue] = useState('');
  const issue = packet.issue;
  const root = `/api/projects/${encodeURIComponent(project)}`;

  useEffect(() => {
    let alive = true;
    setState(null);
    setPreview(null);
    setSelected([]);
    setFailure('');
    Promise.all([request(`${root}/operator-state`), request(`${root}/corrections`)])
      .then(([operatorState, corrections]) => {
        if (alive) {
          setState(operatorState);
          setHistory(corrections);
          setLabel(operatorState.assignments.find((assignment: any) => assignment.issue === issue.id)?.label ?? '');
          setValue(packet.events?.[0]?.originalGrouping?.fingerprint ?? issue.fingerprint);
        }
      })
      .catch(error => { if (alive) setFailure(error.message); });
    return () => { alive = false; };
  }, [root, issue.id, issue.revision, request]);

  const createPreview = (kind: string) => run(async () => {
    let destination: any;
    if (kind === 'merge') {
      const response = await request(`${root}/issues/${encodeURIComponent(target)}/packet`);
      destination = response.issue;
    }
    setPreview(await request(`${root}/corrections/preview`, 'POST', {
      kind,
      source: issue.id,
      revision: issue.revision,
      ...(kind === 'split' ? { events: selected } : { target, targetRevision: destination.revision })
    }));
  });

  const applyPreview = () => {
    const previewId = preview?.id;
    if (!previewId) return;
    return run(async () => {
      await request(`${root}/corrections/${previewId}/apply`, 'POST', { confirm: true });
      setPreview(null);
      refresh();
    });
  };

  const undoCorrection = (id: string) => {
    void run(async () => {
      await request(`${root}/corrections/${id}/undo`, 'POST', { confirm: true });
      refresh();
    });
  };

  return <section className="evidence">
    <h2>Operator decisions</h2>
    {failure && <p role="alert">{failure}</p>}
    <form className="form-grid" onSubmit={event => {
      event.preventDefault();
      void run(async () => {
        await request(`${root}/issues/${issue.id}/assignment`, 'PATCH', { revision: issue.revision, label: label.trim() || null });
        refresh();
      });
    }}>
      <Field label="Assigned operator label" maxLength={80} value={label} onChange={event => setLabel(event.target.value)} />
      <button className="primary-button" disabled={busy || !state}>Save assignment</button>
      <button type="button" className="text-button" disabled={busy || !state} onClick={() => void run(async () => {
        await request(`${root}/issues/${issue.id}/assignment`, 'PATCH', { revision: issue.revision, label: null });
        refresh();
      })}>Unassign</button>
    </form>
    <p>A label records responsibility; it does not create an account, grant access or send a notification.</p>

    <div className="operator-controls" role="group" aria-label="Operator controls">
      <Details title="Correct grouping" triggerLabel="Correct grouping">
        <p>Corrections move only the reviewed retained occurrences. Future capture uses the original algorithm. Retries stay with the current issue. Imported history is excluded. New previews replace the project's earlier unapplied preview.</p>
        <fieldset>
          <legend>Occurrences to split into a new issue</legend>
          {packet.events.filter((event: any) => !event.historical).map((event: any) => <label className="form-field" key={event.id}>
            <input type="checkbox" checked={selected.includes(event.id)} onChange={change => setSelected(change.target.checked ? [...selected, event.id] : selected.filter(id => id !== event.id))} />
            <code>{event.id}</code>
          </label>)}
        </fieldset>
        <button className="text-button" disabled={busy || !selected.length} onClick={() => void createPreview('split')}>Preview selected-event split</button>
        <Field label="Merge into issue ID" value={target} onChange={event => setTarget(event.target.value)} />
        <button className="text-button" disabled={busy || !target} onClick={() => void createPreview('merge')}>Preview issue merge</button>
        {preview && <CorrectionReview preview={preview} busy={busy} onApply={applyPreview} onCancel={() => setPreview(null)} />}
        <CorrectionHistory entries={history} issueId={issue.id} busy={busy} onUndo={undoCorrection} />
      </Details>

      <Details title="Suppression policies" triggerLabel="Suppression policies">
        <p>Matching accepted events remain retained and counted, with a receipt explaining suppression. They create no new or regression alert and never contribute to spike windows, even after a policy is disabled. Manual issue suppression remains separate.</p>
        <form className="form-grid" onSubmit={event => {
          event.preventDefault();
          void run(async () => {
            await request(`${root}/suppression-policies`, 'POST', { field, mode, value, enabled: true });
            setState(await request(`${root}/operator-state`));
          });
        }}>
          <label className="form-field">Match field<select value={field} onChange={event => {
            setField(event.target.value);
            if (event.target.value === 'fingerprint') {
              setMode('exact');
              setValue(packet.events?.[0]?.originalGrouping?.fingerprint ?? issue.fingerprint);
            }
          }}><option value="fingerprint">Original fingerprint</option><option value="release">Release</option><option value="message">Sanitized message</option></select></label>
          <label className="form-field">Match mode<select value={mode} disabled={field === 'fingerprint'} onChange={event => setMode(event.target.value)}><option value="exact">Exact</option><option value="substring">Substring</option></select></label>
          <Field label="Match value" value={value} required maxLength={160} onChange={event => setValue(event.target.value)} />
          <button className="primary-button" disabled={busy}>Add suppression policy</button>
        </form>
        {state?.policies.map((policy: any) => <div className="callout" key={policy.id}>
          <p>{policy.enabled ? 'Enabled' : 'Disabled'} · {policy.field} · {policy.mode} · <code>{policy.value}</code> · revision {policy.revision}</p>
          <button className="text-button" disabled={busy} onClick={() => void run(async () => {
            await request(`${root}/suppression-policies/${policy.id}`, 'PATCH', { ...policy, enabled: !policy.enabled });
            setState(await request(`${root}/operator-state`));
          })}>{policy.enabled ? 'Disable' : 'Enable'} policy</button>
        </div>)}
        <Details title="Suppression receipts for shown occurrences" triggerLabel="Suppression receipts">
          <pre>{JSON.stringify(packet.events.map((event: any) => ({ event: event.id, suppression: event.suppression })), null, 2)}</pre>
        </Details>
      </Details>

      <Details title="Operator audit" triggerLabel="Operator audit">
        <pre>{JSON.stringify(state?.audit ?? [], null, 2)}</pre>
      </Details>
    </div>
  </section>;
}
