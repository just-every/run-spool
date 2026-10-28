import { useState, type FormEvent } from 'react';
import { Details } from './Details';
import { date, type Request } from './shared';

export const outcomeLabel: Record<string, string> = { reproduced: 'Reproduced by your uploaded source', not_reproduced: 'Not reproduced by your uploaded source', failed: 'Failed' };
const stateLabel: Record<string, string> = { queued: 'Queued, waiting for the runner', claimed: 'Running in the sandbox', expired: 'Expired before a report' };
type Props = { project: string; reproducer: any; releases: any[]; busy: boolean; write: (work: () => Promise<unknown>) => Promise<void>; request: Request; onTicket: (ticket: any) => void };

export function ReproducerCard({ project, reproducer, releases, busy, write, request, onTicket }: Props) {
  const [release, setRelease] = useState(''), [proposal, setProposal] = useState({ run: '', repository: '', base: 'main', flow: '', durationMinutes: '60' });
  const spec = reproducer.spec, path = `/api/projects/${encodeURIComponent(project)}`, label = `reproducer-${reproducer.id}`;
  const reproduced = reproducer.runs.filter((run: any) => run.outcome === 'reproduced');
  function queue(form: FormEvent) { form.preventDefault(); void write(async () => onTicket(await request(`${path}/reproducers/${encodeURIComponent(reproducer.id)}/runs`, 'POST', release ? { release } : {}))); }
  function propose(form: FormEvent) {
    form.preventDefault();
    void write(() => request(`${path}/fixes`, 'POST', { reproducer: reproducer.id, run: proposal.run || reproduced[0]?.id, repository: proposal.repository, base: proposal.base, flow: proposal.flow, durationMinutes: Number(proposal.durationMinutes) }));
  }
  return <article className="reproducer" aria-labelledby={label}>
    <h3 id={label}>Reproducer for event <code>{reproducer.event}</code>: {reproducer.support === 'supported' ? 'supported' : 'unsupported'}</h3>
    <p className="execution-meta">Recorded {date(reproducer.created)}. {reproducer.trust}</p>
    {reproducer.support === 'unsupported' ? <p className="callout">{reproducer.reasonText}</p> : <>
      <dl className="execution-facts">
        <div><dt>Call</dt><dd><code>{spec.call.export}(…)</code> in <code>{spec.event.frame.original.file}</code></dd></div>
        <div><dt>Exact input</dt><dd><code>{JSON.stringify(spec.call.input)}</code></dd></div>
        <div><dt>Captured</dt><dd>{spec.event.type}: {spec.event.message} at {spec.event.frame.original.file}:{spec.event.frame.original.line}</dd></div>
        <div><dt>Sandbox</dt><dd>{spec.environment.runtime} {spec.environment.compatibilityDate}; network {spec.environment.network}, bindings {spec.environment.bindings}, environment {spec.environment.processEnvironment}, files {spec.environment.filesystem}, killed after {spec.environment.wallClockMs / 1000} s</dd></div>
        <div><dt>Source</dt><dd>{spec.source.modules.length} module{spec.source.modules.length === 1 ? '' : 's'} from release {spec.source.release}, build {spec.source.build}</dd></div>
      </dl>
      <form className="form-grid" onSubmit={queue}>
        <label className="form-field">Run against<select value={release} onChange={change => setRelease(change.target.value)}><option value="">Captured release {spec.source.release}</option>{releases.filter(row => row.name !== spec.source.release).map(row => <option key={row.name} value={row.name}>{row.name}</option>)}</select></label>
        <button className="text-button" disabled={busy}>Queue sandbox run</button>
      </form>
    </>}
    {reproducer.runs.map((run: any) => <div key={run.id} className={`callout run ${run.outcome ?? run.state}`}>
      <strong>{run.outcome ? outcomeLabel[run.outcome] : stateLabel[run.state]}</strong> · release {run.release} · queued {date(run.created)}
      {run.preparedBy && <p className="execution-meta">Prepared by {run.preparedBy.label}</p>}
      {run.reason && <p>{run.reason}</p>}
      {run.outcome && run.outcome !== 'failed' && <p className="execution-meta">{run.basis}</p>}
      {!!run.checks.length && <ul className="run-checks">{run.checks.map((check: any) => <li key={check.check}>{check.passed ? '✓' : '✗'} {check.check.replace('_', ' ')}: expected {String(check.expected)}, observed {String(check.observed)}{check.required ? '' : ' (shown, not required)'}</li>)}</ul>}
      {run.tools && <p className="execution-meta">Tools: {run.tools.workerd}, Node {run.tools.node}, {run.tools.runner}</p>}
      {run.observation && <Details title="Sandbox observation"><pre>{JSON.stringify(run.observation, null, 2)}</pre></Details>}
    </div>)}
    {!!reproduced.length && <form className="form-grid" onSubmit={propose} aria-label="Propose a fix branch">
      {reproduced.length > 1 && <label className="form-field">Reproduced run<select value={proposal.run} onChange={change => setProposal({ ...proposal, run: change.target.value })}>{reproduced.map((run: any) => <option key={run.id} value={run.id}>{run.release}, {date(run.finished)}</option>)}</select></label>}
      <label className="form-field">GitHub repository (owner/name)<input required pattern="[A-Za-z0-9-]+/[A-Za-z0-9._-]+" value={proposal.repository} onChange={change => setProposal({ ...proposal, repository: change.target.value })} /></label>
      <label className="form-field">Base branch<input required value={proposal.base} onChange={change => setProposal({ ...proposal, base: change.target.value })} /></label>
      <label className="form-field">Affected flow (as your SDK reports it)<input required value={proposal.flow} onChange={change => setProposal({ ...proposal, flow: change.target.value })} /></label>
      <label className="form-field">Grant lasts (minutes)<input required type="number" min={1} max={10080} value={proposal.durationMinutes} onChange={change => setProposal({ ...proposal, durationMinutes: change.target.value })} /></label>
      <button className="primary-button" disabled={busy}>Propose fix branch</button>
    </form>}
  </article>;
}
