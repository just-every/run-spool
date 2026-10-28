import { useEffect, useState } from 'react';
import { api } from './client';
import { date, stateLabel } from './shared';
import { hrefFor } from './location';
import { initialReportsWindow, reportWindowNumbers, ReportsWindow } from './ReportsWindow';

export type ReportQuery = { q: string; status: string; release: string; sort: string };
export const emptyReportQuery: ReportQuery = { q: '', status: 'all', release: 'all', sort: 'latest' };
export function ReportsEventRows({ rows, project }: { rows: any[]; project?: string }) {
  return <div className="table-region"><table className="data-table reports-table"><thead><tr><th scope="col">Received / event</th><th scope="col">Release / build</th><th scope="col">Environment</th><th scope="col">Type / message</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.project ?? project}:${row.occurrence}`}><th scope="row"><a className="inline-link" href={hrefFor(row.project || project || '', 'issues', row.issue)}>{date(row.received)}</a><p><code>{row.id}</code></p></th><td data-label="Release / build">{row.release || 'No release'}<p>{row.build || 'No build'}</p></td><td data-label="Environment">{row.environment || 'No environment'}</td><td data-label="Type / message">{row.type}<p>{row.message}</p></td></tr>)}</tbody></table></div>;
}
export function ReportsQueryTable({ project, configure, onSaved }: { project: string; configure: boolean; onSaved?: () => void }) {
  const [draft, setDraft] = useState(emptyReportQuery), [query, setQuery] = useState(emptyReportQuery);
  const [window, setWindow] = useState(initialReportsWindow), [appliedWindow, setAppliedWindow] = useState(initialReportsWindow);
  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [saving, setSaving] = useState(false), [loading, setLoading] = useState(true);
  const [views, setViews] = useState<any[]>([]), [selected, setSelected] = useState(''), [revision, setRevision] = useState(0);
  const root = `/api/projects/${encodeURIComponent(project)}`, params = JSON.stringify({ project, query, from: reportWindowNumbers(appliedWindow).from, to: reportWindowNumbers(appliedWindow).to });
  useEffect(() => { let active = true; setLoading(true); setData(null); setError(''); api('/api/reporting/table-preview', 'POST', JSON.parse(params)).then(value => { if (active) setData(value); }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [root, params, revision]);
  useEffect(() => { let active = true; api(`${root}/review/views`).then(value => { if (active) setViews(value.views); }).catch(failure => { if (active) setError(failure.message); }); return () => { active = false; }; }, [root, revision]);
  function choose(value: ReportQuery) { setDraft(value); setQuery(value); setAppliedWindow(window); setNotice(''); }
  async function save() {
    setSaving(true); setError(''); setNotice('');
    try { const saved = await api(`${root}/review/views`, 'POST', draft); choose(draft); setSelected(saved.id); setRevision(value => value + 1); setNotice('Query saved. Choose it when configuring a query table in Settings.'); onSaved?.(); }
    catch (failure) { setError((failure as Error).message); } finally { setSaving(false); }
  }
  return <section className="evidence reports" aria-labelledby="reports-query-title"><h2 id="reports-query-title">Query table</h2><p>Search retained events and save the query for a shared table. Every filter matches the same occurrence; user identity and source content stay outside the table.</p>
    <form onSubmit={event => { event.preventDefault(); choose(draft); setRevision(value => value + 1); }}><div className="reports-filters"><label className="form-field reports-wide">Event query<input type="search" placeholder="environment:production level:error" value={draft.q} onChange={event => setDraft({ ...draft, q: event.target.value })} /></label><label className="form-field">Status<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>{['all', 'open', 'acknowledged', 'resolved', 'suppressed'].map(value => <option key={value} value={value}>{value === 'all' ? 'All statuses' : stateLabel(value)}</option>)}</select></label><label className="form-field">Release<input value={draft.release === 'all' ? '' : draft.release} placeholder="All releases" onChange={event => setDraft({ ...draft, release: event.target.value || 'all' })} /></label><label className="form-field">Order<select value={draft.sort} onChange={event => setDraft({ ...draft, sort: event.target.value })}><option value="latest">Latest received</option><option value="priority">Pending review first</option><option value="occurrences">Largest issue first</option></select></label><ReportsWindow withTimeZone={false} value={window} onChange={setWindow} /></div><div className="button-row"><button className="primary-button">Run query</button>{configure && <button type="button" className="text-button" disabled={saving || views.length >= 25} onClick={() => void save()}>Save query ({views.length}/25)</button>}</div></form>
    <label className="form-field">Saved query<select value={selected} onChange={event => { setSelected(event.target.value); const view = views.find(row => row.id === event.target.value); if (view) choose(view.query); }}><option value="">Choose a saved query</option>{views.map(view => <option key={view.id} value={view.id}>{view.query.q || 'All issues'} · {stateLabel(view.query.status)} · {view.query.sort}</option>)}</select></label>
    {error && <p role="alert">{error} <button className="text-button" onClick={() => setRevision(value => value + 1)}>Refresh query</button></p>}{notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading query results…</p> : data && <><p role="status">{data.total} matching events · showing up to {data.bounds.limit}</p>{data.rows.length ? <ReportsEventRows rows={data.rows} project={project} /> : <p>No retained events match this query.</p>}<p className="muted">{data.definition}</p>{!data.bounds.complete && <p className="callout">This preview reached the {data.bounds.limit}-row cap. Narrow the query or window to inspect more results. Configure a saved query table in Settings to export up to 10,000 matching events.</p>}</>}
  </section>;
}
