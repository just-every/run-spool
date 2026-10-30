import { useEffect, useState, type FormEvent } from 'react';
import { Details } from './Details';
import { Fold } from './Fold';
import { date, Field, type Request, type Run } from './shared';
import './RepairPanel.css';

const verdicts: Record<string, string> = { recurred: 'Recurred', inconclusive: 'Inconclusive', no_recurrence_after_exercise: 'No recurrence after the flow was exercised' };
const outcomes: Record<string, string> = { passed: 'Passed', failed: 'Failed', not_run: 'Not run' };
const base = (project: string) => `/api/projects/${encodeURIComponent(project)}/repairs`;
type Props = { initial?: Promise<any[]>; project: string; issue: any; busy: boolean; request: Request; run: Run; refresh: () => void };

/** Owner-recorded repairs and their computed recovery verdict. Spool never opens a recorded link. */
export function RepairPanel({ project, issue, busy, request, run, refresh, initial }: Props) {
  const [repairs, setRepairs] = useState<any[] | null>(null), [releases, setReleases] = useState<any[]>([]), [failed, setFailed] = useState(false);
  const [link, setLink] = useState(''), [note, setNote] = useState('');
  const live = ['js-frame-v1','python-frame-v1','go-frame-v1','sentry-chain-v1'].includes(issue.algorithm);
  async function load(prepared?: Promise<any[]>) {
    try {
      const [list, registered] = await (prepared ?? Promise.all([request(`${base(project)}?issue=${encodeURIComponent(issue.id)}`), request(`/api/projects/${encodeURIComponent(project)}/releases`)]));
      setRepairs(list.repairs); setReleases(registered); setFailed(false);
    } catch { setFailed(true); }
  }
  // Each evidence refresh delivers a new issue object, so the verdict is recomputed with it.
  useEffect(() => { if (live) void load(initial); }, [project, issue, live, initial]);
  const write = (work: () => Promise<unknown>) => run(async () => { try { await work(); } finally { refresh(); } });
  function record(event: FormEvent) {
    event.preventDefault();
    void write(async () => { await request(base(project), 'POST', { issue: issue.id, link, note }); setLink(''); setNote(''); });
  }
  if (!live) return <Fold title="Repairs" className="repairs" meta="Recorded on live issues only"><p>Imported history cannot recur in live capture, so repairs are recorded on live issues only.</p></Fold>;
  return <Fold title="Repairs" className="repairs" meta={failed ? 'Repair history unavailable' : !repairs ? 'Loading repairs…' : repairs.length ? `${repairs.length} ${repairs.length === 1 ? 'repair' : 'repairs'} recorded` : 'No repairs recorded'}>
    {failed && <p role="alert">Repair history could not be loaded. <button className="text-button" onClick={() => void load()}>Retry</button></p>}
    {repairs && !repairs.length && <p>A repair is a change someone proposed for this issue: a link to its branch or pull request and a short note. You record each step yourself: approved, merged, deployed in a registered release, and that the affected flow was exercised. Spool never opens the link, merges or deploys; it measures whether the failure came back from captured events.</p>}
    <form className="form-grid" onSubmit={record}>
      <Field label="Branch or pull request link (https)" type="url" required pattern="https://.*" maxLength={2048} value={link} onChange={event => setLink(event.target.value)} />
      <Field label="Note" maxLength={1000} value={note} onChange={event => setNote(event.target.value)} />
      <button className="primary-button" disabled={busy}>Record repair</button>
    </form>
    {repairs?.map(repair => <RepairRecord key={repair.id} {...{ project, repair, releases, busy, write, request }} />)}
  </Fold>;
}

function RepairRecord({ project, repair, releases, busy, write, request }: { project: string; repair: any; releases: any[]; busy: boolean; write: (work: () => Promise<unknown>) => Promise<void>; request: Request }) {
  const [release, setRelease] = useState(''), [exercise, setExercise] = useState('');
  const [check, setCheck] = useState({ name: '', outcome: 'passed', note: '' });
  const path = `${base(project)}/${encodeURIComponent(repair.id)}`, facts = repair.facts, o = repair.observation;
  const fact = (name: string, extra = {}, done = () => {}) => write(async () => { await request(`${path}/facts`, 'POST', { fact: name, revision: repair.revision, ...extra }); done(); });
  const label = `repair-${repair.id}`;
  return <article className="repair" aria-labelledby={label}>
    <h3 id={label}><a href={repair.link} target="_blank" rel="noopener noreferrer">{repair.link}</a></h3>
    <p className="repair-meta">Recorded by the owner {date(repair.created)}. The link is shown as text you can open; Spool never fetches it.</p>
    {repair.note && <p>{repair.note}</p>}
    <div className={`callout verdict ${o.verdict}`}><strong>Verdict: {verdicts[o.verdict] ?? o.verdict}</strong>
      <ul>{o.reasons.map((reason: any) => <li key={reason.code}>{reason.reason}</li>)}</ul>
      {!!o.evidence.recurrence.count && <p>Recurring events: {o.evidence.recurrence.events.map((event: any) => `${event.id} (release ${event.release})`).join(', ')}{o.evidence.recurrence.count > o.evidence.recurrence.events.length ? ` and ${o.evidence.recurrence.count - o.evidence.recurrence.events.length} more` : ''}.</p>}
      {!!o.evidence.olderReleaseEvents.count && <p>Not counted: {o.evidence.olderReleaseEvents.count} event{o.evidence.olderReleaseEvents.count === 1 ? '' : 's'} from releases older than {o.evidence.release?.name} ({o.evidence.olderReleaseEvents.events.map((event: any) => event.id).join(', ')}).</p>}
      <p>{o.limits}</p>
    </div>
    <dl className="repair-facts">
      <div><dt>Proposed</dt><dd>{date(facts.proposed)}</dd></div>
      <div><dt>Approved</dt><dd>{facts.approved ? date(facts.approved) : <button className="text-button" disabled={busy} onClick={() => void fact('approved')}>Mark approved</button>}</dd></div>
      <div><dt>Merged</dt><dd>{facts.merged ? date(facts.merged) : <button className="text-button" disabled={busy} onClick={() => void fact('merged')}>Mark merged</button>}</dd></div>
      <div><dt>Deployed</dt><dd>{facts.deployed ? `${facts.deployed.release} (sequence ${facts.deployed.sequence}), ${date(facts.deployed.at)}` : 'Not recorded'}</dd></div>
      <div><dt>Flow exercised</dt><dd>{facts.exercised ? `${date(facts.exercised.at)}: ${facts.exercised.note}` : 'Not recorded'}</dd></div>
    </dl>
    <form className="form-grid" onSubmit={event => { event.preventDefault(); void fact('deployed', { release }); }}>
      <label className="form-field">Deployed in release<select required value={release} onChange={event => setRelease(event.target.value)}><option value="">Choose a registered release</option>{releases.map(row => <option key={row.name} value={row.name}>{row.name} (sequence {row.seq})</option>)}</select></label>
      <button className="text-button" disabled={busy}>{facts.deployed ? 'Change deployed release' : 'Mark deployed'}</button>
    </form>
    {facts.deployed && <form className="form-grid" onSubmit={event => { event.preventDefault(); void fact('exercised', { note: exercise }, () => setExercise('')); }}>
      <Field label={`How the flow was exercised in ${facts.deployed.release}`} required maxLength={1000} value={exercise} onChange={event => setExercise(event.target.value)} />
      <button className="text-button" disabled={busy}>Record flow exercised in this release</button>
    </form>}
    <h4>Checks</h4>
    {repair.checks.length ? <ul className="repair-checks">{repair.checks.map((row: any) => <li key={row.id}><strong>{row.name}</strong>: {outcomes[row.outcome]}{row.note ? `. ${row.note}` : ''}</li>)}</ul> : <p>No checks recorded.</p>}
    <form className="form-grid" onSubmit={event => { event.preventDefault(); void write(async () => { await request(`${path}/checks`, 'POST', { revision: repair.revision, ...check }); setCheck({ name: '', outcome: 'passed', note: '' }); }); }}>
      <Field label="Check name" required maxLength={80} value={check.name} onChange={event => setCheck({ ...check, name: event.target.value })} />
      <label className="form-field">Outcome<select value={check.outcome} onChange={event => setCheck({ ...check, outcome: event.target.value })}>{Object.entries(outcomes).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
      <Field label="Check note" maxLength={300} value={check.note} onChange={event => setCheck({ ...check, note: event.target.value })} />
      <button className="text-button" disabled={busy}>Add check</button>
    </form>
    <Details title="Evidence snapshot" triggerLabel="Evidence snapshot"><p>Issue revision {repair.snapshot.issueRevision}, release sequence {repair.snapshot.releaseSequence} when the repair was recorded.</p><ul>{repair.snapshot.events.map((event: any) => <li key={event.id}><code>{event.id}</code>{event.state === 'removed_by_retention' ? ' (removed by retention)' : ''}</li>)}</ul></Details>
  </article>;
}
