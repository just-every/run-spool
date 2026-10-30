import { useEffect, useRef, useState } from 'react';
import { Details } from './Details';
import { useLiveRead } from './useLiveRead';
import { date, Field, type Request, type Run } from './shared';

export type CorrectionPreview = {
  id: string;
  plan: {
    issues: Array<{ id: string; revision: number; count: number; after: number }>;
    moves: Array<{ event: string; occurrence: string; from: string; to: string }>;
  };
  newIssue: { id: string; before: number; after: number } | null;
};

export function CorrectionReview({ preview, busy, onApply, onCancel }: { preview: CorrectionPreview; busy: boolean; onApply: () => void; onCancel: () => void }) {
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

export function CorrectionHistory({ entries, issueId, busy, onUndo }: { entries: any[]; issueId?: string; busy: boolean; onUndo: (id: string) => void }) {
  const relevant = entries.filter(entry => !issueId || entry.plan.issues.some((item: any) => item.id === issueId) || entry.plan.target === issueId);
  return <>
    <h3>Correction history</h3>
    {relevant.map(entry => <Details key={entry.id} title={`${entry.kind} · ${entry.state}`} triggerLabel={`${entry.kind} · ${entry.state}`}>
      <pre>{JSON.stringify(entry, null, 2)}</pre>
      {entry.state === 'applied' && <button className="text-button" disabled={busy} onClick={() => onUndo(entry.id)}>Undo this correction</button>}
    </Details>)}
    <p>Undo refuses after newer issue work, capture or retention; it never restores deleted occurrences. History is bounded to 50 records per project.</p>
  </>;
}

export function OperatorPanel({ project, packet, busy, request, run, refresh, initial, manageProject = true, readOnly = false }: { manageProject?: boolean; readOnly?: boolean; initial?: Promise<any[]>; project: string; packet: any; busy: boolean; request: Request; run: Run; refresh: () => void }) {
  const [state, setState] = useState<any>(null);
  const [assignmentRevision, setAssignmentRevision] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [label, setLabel] = useState('');
  const [assignment, setAssignment] = useState<any>(null);
  const [assignmentKind, setAssignmentKind] = useState('member');
  const [member, setMember] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [preview, setPreview] = useState<CorrectionPreview | null>(null);
  const [failure, setFailure] = useState('');
  const [field, setField] = useState('fingerprint');
  const [mode, setMode] = useState('exact');
  const [value, setValue] = useState('');
  const issue = packet.issue;
  const root = `/api/projects/${encodeURIComponent(project)}`;

  const waitingForPacket = assignmentRevision !== null && issue.revision < assignmentRevision;
  const ready = !!state && !waitingForPacket;
  const labelEdited = useRef(false);
  const consumedInitial = useRef<Promise<any[]> | undefined>(undefined);
  useEffect(() => { labelEdited.current = false; setState(null); setAssignment(null); setAssignmentRevision(null); setPreview(null); setSelected([]); setFailure(''); }, [root, issue.id]);
  useLiveRead(async (signal, background) => {
    if (waitingForPacket) return;
    try {
      const prefetched = !background && initial && initial !== consumedInitial.current;
      consumedInitial.current = initial;
      const [[operatorState, corrections], assigned] = await Promise.all([manageProject ? (prefetched ? initial! : Promise.all([request(`${root}/operator-state`), request(`${root}/corrections`)])) : Promise.resolve([{policies:[],audit:[]},[]]), request(`${root}/issues/${issue.id}/assignment`)]);
      if (signal.aborted) return;
      setState(operatorState); setHistory(corrections); setAssignment(assigned); setFailure('');
      if (!labelEdited.current) {
        setAssignmentKind(assigned.current.kind === 'label' || !assigned.members.length ? 'label' : 'member');
        setMember(assigned.current.member ?? '');
        setLabel(assigned.current.kind === 'label' ? assigned.current.label : '');
      }
      if (!state) setValue(packet.events?.[0]?.originalGrouping?.fingerprint ?? issue.fingerprint);
    } catch (error) { if (!signal.aborted) setFailure((error as Error).message); }
  }, [root, issue.id, issue.revision, assignmentRevision, request, initial, manageProject], { live: !initial });

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
      setSelected([]);
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
    {!readOnly && <form className="form-grid" onSubmit={event => {
      event.preventDefault();
      void run(async () => {
        const saved = await request(`${root}/issues/${issue.id}/assignment`, 'PATCH', { revision: issue.revision, ...(assignmentKind === 'member' ? { member } : { label: label.trim() || null }) });
        setAssignmentRevision(saved.revision);
        labelEdited.current = false;
        setState(null);
        refresh();
      });
    }}>
      <label className="form-field">Assignment type<select aria-label="Assignment type" disabled={busy || !ready} value={assignmentKind} onChange={event => { labelEdited.current = true; setAssignmentKind(event.target.value); }}><option value="member">Project member</option><option value="label">Operator label</option></select></label>
      {assignmentKind === 'member' ? <label className="form-field">Assigned member<select aria-label="Assigned member" disabled={busy || !ready} value={member} onChange={event => { labelEdited.current = true; setMember(event.target.value); }} required>
        <option value="">Choose an active project member</option>
        {assignment?.members.map((person: any) => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select></label> : <Field label="Assigned to" disabled={busy || !ready} maxLength={80} value={label} onChange={event => { labelEdited.current = true; setLabel(event.target.value); }} /> }
      <button className="primary-button" disabled={busy || !ready || assignmentKind === 'member' && !member}>Save assignment</button>
      <button type="button" className="text-button" disabled={busy || !ready} onClick={() => void run(async () => {
        const saved = await request(`${root}/issues/${issue.id}/assignment`, 'PATCH', { revision: issue.revision, label: null });
        setAssignmentRevision(saved.revision);
        labelEdited.current = false;
        setState(null);
        refresh();
      })}>Unassign</button>
    </form>}
    <p aria-live="polite" style={{ overflowWrap: 'anywhere' }}>Current assignment: {assignment ? assignmentDescription(assignment.current) : 'Loading…'}</p>
    <p>Assign an active project member who can triage, or retain an operator label. Assignment grants no access and sends no notification.</p>
    <Details title="Assignment history" triggerLabel="Assignment history">
      {assignment?.history.length ? <ol style={{ overflowWrap: 'anywhere' }}>{assignment.history.map((entry: any) => <li key={entry.id}>{assignmentDescription(entry.target)} · {date(entry.created)} · {entry.actor.kind} <code>{entry.actor.label}</code></li>)}</ol> : <p>No recorded assignment changes. Earlier operator labels retain their original audit history.</p>}
      {assignment?.next && <button type="button" className="text-button" disabled={busy} onClick={() => void run(async () => {
        const earlier = await request(`${root}/issues/${issue.id}/assignment?before=${assignment.next}`);
        setAssignment((current: any) => ({ ...current, history: [...current.history, ...earlier.history], next: earlier.next }));
      })}>Load earlier assignments</button>}
    </Details>

    {manageProject && <div className="operator-controls" role="group" aria-label="Operator controls">
      <Details title="Correct grouping" triggerLabel="Correct grouping">
        <p>Corrections move only the reviewed events. Future events keep their original grouping. Retries stay with this issue. Imported history is excluded. A new preview replaces the previous unapplied preview.</p>
        <fieldset>
          <legend>Occurrences to split into a new issue</legend>
          {packet.events.filter((event: any) => !event.historical).map((event: any) => <label className="form-field" key={event.id}>
            <input type="checkbox" disabled={busy || !ready} checked={selected.includes(event.id)} onChange={change => setSelected(change.target.checked ? [...selected, event.id] : selected.filter(id => id !== event.id))} />
            <code>{event.id}</code>
          </label>)}
        </fieldset>
        <button className="text-button" disabled={busy || !ready || !selected.length} onClick={() => void createPreview('split')}>Preview selected-event split</button>
        <Field label="Merge into issue ID" disabled={busy || !ready} value={target} onChange={event => setTarget(event.target.value)} />
        <button className="text-button" disabled={busy || !ready || !target} onClick={() => void createPreview('merge')}>Preview issue merge</button>
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
          <label className="form-field">Match field<select disabled={busy || !ready} value={field} onChange={event => {
            setField(event.target.value);
            if (event.target.value === 'fingerprint') {
              setMode('exact');
              setValue(packet.events?.[0]?.originalGrouping?.fingerprint ?? issue.fingerprint);
            }
          }}><option value="fingerprint">Original fingerprint</option><option value="release">Release</option><option value="message">Sanitized message</option></select></label>
          <label className="form-field">Match mode<select value={mode} disabled={busy || !ready || field === 'fingerprint'} onChange={event => setMode(event.target.value)}><option value="exact">Exact</option><option value="substring">Substring</option></select></label>
          <Field label="Match value" disabled={busy || !ready} value={value} required maxLength={160} onChange={event => setValue(event.target.value)} />
          <button className="primary-button" disabled={busy || !ready}>Add suppression policy</button>
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
        {state ? <OperatorAudit rows={state.audit} issue={issue} /> : <p role="status">Loading changes…</p>}
      </Details>
    </div>}
  </section>;
}

function OperatorAudit({ rows, issue }: { rows: any[]; issue: any }) {
  if (!rows.length) return <p>No changes yet</p>;
  return <ul>{rows.map(row => {
    const detail = typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail;
    const related = detail.issue === issue.id ? issue.short_id ?? 'this issue' : 'another issue';
    const label = row.kind === 'issue_assigned' ? detail.label ? `Assigned ${related} to ${detail.label}` : `Unassigned ${related}`
      : row.kind === 'suppression_changed' ? `${detail.enabled ? 'Enabled' : 'Disabled'} suppression: ${detail.field === 'fingerprint' ? 'fingerprint' : detail.field === 'release' ? 'release' : 'message'} ${detail.mode === 'exact' ? 'matches' : 'contains'} “${detail.value}”`
      : row.kind === 'grouping_applied' ? 'Applied a grouping correction'
      : row.kind === 'grouping_undone' ? 'Undid a grouping correction'
      : `Recorded deployment of ${detail.release} in ${detail.environment}`;
    return <li key={row.id}>{label} · {date(row.created)}</li>;
  })}</ul>;
}

function assignmentDescription(target: any): string {
  return target.kind === 'member' ? `${target.name} · ${target.alias}` : target.kind === 'label' ? `Operator label: ${target.label}` : 'Unassigned';
}
