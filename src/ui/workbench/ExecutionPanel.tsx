import { useEffect, useState, type FormEvent } from 'react';
import { type Request, type Run } from './shared';
import { ReproducerCard } from './ReproducerCard';
import { FixWorkflowCard } from './FixWorkflowCard';
import { GitHubConnectionSetup } from './GitHubConnectionSetup';
import './ExecutionPanel.css';

type Props = { project: string; issue: any; event: any; busy: boolean; request: Request; run: Run };
const root = (project: string) => `/api/projects/${encodeURIComponent(project)}`;

/** Reproduce a captured failure in the isolated sandbox, carry it through a fix branch, and measure who the fix reached. */
export function ExecutionPanel({ project, issue, event, busy, request, run }: Props) {
  const [reproducers, setReproducers] = useState<any[] | null>(null), [fixes, setFixes] = useState<any>(null), [releases, setReleases] = useState<any[]>([]), [failed, setFailed] = useState(false);
  const [exported, setExported] = useState(''), [input, setInput] = useState('[]'), [ticket, setTicket] = useState<any>(null), [problem, setProblem] = useState('');
  const sample = event?.event?.environment === 'spool-test';
  const live = ['js-frame-v1','python-frame-v1','go-frame-v1'].includes(issue.algorithm);
  async function load() {
    try {
      const query = `?issue=${encodeURIComponent(issue.id)}`;
      const [list, workflows, registered] = await Promise.all([request(`${root(project)}/reproducers${query}`), request(`${root(project)}/fixes${query}`), request(`${root(project)}/releases`)]);
      setReproducers(list.reproducers); setFixes(workflows); setReleases(registered); setFailed(false);
    } catch { setFailed(true); }
  }
  useEffect(() => { if (live) void load(); }, [project, issue, live]);
  // Only this section reloads, so a once-shown run command survives the write.
  const write = (work: () => Promise<unknown>) => run(async () => { setProblem(''); try { await work(); } catch (error) { setProblem(String((error as Error).message)); } finally { await load(); } });
  function record(form: FormEvent) {
    form.preventDefault();
    let args: unknown;
    try { args = JSON.parse(input); } catch { setProblem('Input must be a JSON array of arguments.'); return; }
    void write(() => request(`${root(project)}/reproducers`, 'POST', { event: event.id, ...(exported ? { export: exported } : {}), input: args }));
  }
  if (!live) return <section className="evidence execution"><h2>Reproduce and fix</h2><p>Imported history has no stored map or live capture, so it cannot be reproduced.</p></section>;
  return <section className="evidence execution" aria-labelledby="execution-title">
    <h2 id="execution-title">Reproduce and fix</h2>
    {failed && <p role="alert">Reproducers could not be loaded. <button className="text-button" onClick={() => void load()}>Retry</button></p>}
    {problem && <p role="alert" className="callout">{problem}</p>}
    <p>A reproducer replays the newest occurrence's mapped function with an input you choose, in a separate sandbox process with no network, no secrets and no files. Spool, not the sandbox, decides whether the behaviour matches the captured event.</p>
    {event && sample && <p>This is Spool’s sample error, so there is no mapped function of yours to reproduce. Reproduce a failure from your own app instead.</p>}
    {event && !sample && <form className="form-grid" onSubmit={record}>
      <Field label="Export to call (blank: the mapped function)" value={exported} maxLength={100} onChange={value => setExported(value)} />
      <label className="form-field">Input (JSON array of arguments)<textarea required value={input} maxLength={8192} rows={3} onChange={change => setInput(change.target.value)} /></label>
      <button className="primary-button" disabled={busy}>Record reproducer</button>
      <p className="execution-meta">Replays occurrence <code>{event.id}</code>.</p>
    </form>}
    {ticket && <div className="callout run-ticket" role="status"><strong>Run queued. Run this once in your Spool checkout within 15 minutes; the token is shown only now.</strong><code>{ticket.command}</code><button className="text-button" onClick={() => void navigator.clipboard.writeText(ticket.command)}>Copy command</button></div>}
    {reproducers?.map(reproducer => <ReproducerCard key={reproducer.id} {...{ project, reproducer, releases, busy, write, request }} onTicket={setTicket} />)}
    {fixes && <><h3 className="execution-subtitle">Fix branches</h3>
      <GitHubConnectionSetup connection={fixes.connection} />
      {!fixes.workflows.length && <p>Propose a fix branch from a run Spool confirmed as reproduced.</p>}
      {fixes.workflows.map((workflow: any) => <FixWorkflowCard key={workflow.id} {...{ project, workflow, busy, write, request }} />)}</>}
  </section>;
}

function Field({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  return <label className="form-field">{label}<input value={value} maxLength={maxLength} onChange={change => onChange(change.target.value)} /></label>;
}
