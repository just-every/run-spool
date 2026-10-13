import { Link } from '@tanstack/react-router';
import { Details } from './Details';
import { EmptyCapture } from './EmptyCapture';
import { hrefFor } from './location';
import { attentionLabel, issueAlert, type Alert, type Issue } from './attention';
import { date, stateLabel, states, useDraft } from './shared';
export function IssueList({ project, rows, unseen, loading, failed, onRefresh, onSetup }: {
  project: string; rows: Issue[]; unseen: (alert?: Alert) => boolean; loading: boolean; failed: boolean; onRefresh: () => void; onSetup: () => void;
}) {
  const [search, setSearch] = useDraft(`${project}.issue-search`, '');
  const [state, setState] = useDraft(`${project}.issue-state`, 'all');
  const [release, setRelease] = useDraft(`${project}.issue-release`, 'all'), [sort, setSort] = useDraft(`${project}.issue-sort`, 'priority');
  const [page, setPage] = useDraft(`${project}.issue-page`, 0);
  const needle = search.trim().toLocaleLowerCase();
  const priority = (issue: Issue) => { const alert = issueAlert(issue); return alert ? (unseen(alert) ? 4 : 0) + (alert.kind === 'regression' ? 2 : 1) : 0; };
  const filtered = rows.filter(row => (state === 'all' || row.state === state) && (release === 'all' || row.releases?.includes(release)) && (!needle || row.title.toLocaleLowerCase().includes(needle) || row.id.includes(needle)))
    .sort((a, b) => (sort === 'priority' ? priority(b) - priority(a) : sort === 'occurrences' ? b.count - a.count : 0) || b.last_seen - a.last_seen);
  const lastPage = Math.max(0, Math.ceil(filtered.length / 25) - 1), currentPage = Math.min(page, lastPage), visible = filtered.slice(currentPage * 25, currentPage * 25 + 25);
  if (!loading && !failed && !rows.length) return <EmptyCapture waiting onSetup={onSetup} onRefresh={onRefresh} />;
  return <section className="evidence issue-browser" aria-labelledby="issue-browser-heading">
    <div className="issue-browser-heading"><h2 id="issue-browser-heading" className="visually-hidden">Issues</h2><button className="text-button" disabled={loading} onClick={onRefresh}>Refresh issues</button></div>
    <div className="issue-counts"><div><span>Unseen in this list</span><strong>{loading ? '…' : failed ? '—' : rows.filter(row => unseen(issueAlert(row))).length}</strong></div><div><span>Open</span><strong>{loading ? '…' : failed ? '—' : rows.filter(row => row.state === 'open').length}</strong></div><div><span>Resolved</span><strong>{loading ? '…' : failed ? '—' : rows.filter(row => row.state === 'resolved').length}</strong></div></div>
    <div className="issue-filters"><label className="form-field">Search issues<input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label><label className="form-field">Status<select value={state} onChange={e => { setState(e.target.value); setPage(0); }}><option value="all">All statuses</option>{states.map(value => <option key={value} value={value}>{stateLabel(value)}</option>)}</select></label><label className="form-field">Release<select value={release} onChange={e => { setRelease(e.target.value); setPage(0); }}><option value="all">All releases</option>{[...new Set(rows.flatMap(row => row.releases ?? []))].map(name => <option key={name}>{name}</option>)}</select></label><label className="form-field">Sort<select value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}><option value="priority">Priority first</option><option value="latest">Latest received</option><option value="occurrences">Most occurrences</option></select></label></div>
    {loading ? <p role="status">Loading issues…</p> : failed ? <p role="alert">Issues could not be loaded. Refresh to try again.</p> : <>
      <div className="list-summary"><p role="status">{filtered.length} {filtered.length === 1 ? 'issue' : 'issues'}{search || state !== 'all' || release !== 'all' ? ' matching your filters' : ''}</p><Details title="Issue list and viewing"><p>This list loads up to 100 groups, selecting active regressions first, then active new issues, then other groups, with the most recently received first within each priority. Search, filters and sorting apply to these loaded groups. The unseen count covers the loaded groups before filters or pagination, not the whole project. Occurrence counts include only retained events.</p><p>With Priority first selected, unseen new issues and regressions appear first within the loaded groups. Opening an issue and loading its evidence marks its latest alert as viewed in this browser. Merely opening this list does not. Viewing is stored in this browser when storage is available; otherwise it lasts for this session. It does not acknowledge or resolve the issue.</p><p>A regression means a resolved issue returned in a later registered release. Its badge uses the release recorded when that event was accepted, even if an older release arrives later.</p></Details></div>
      {rows.length === 100 && <p className="muted">Showing 100 groups selected by active attention priority, then latest received. More groups may exist; the unseen count covers only this loaded list.</p>}
      {visible.length ? <div className="table-region"><table className="issue-table"><thead><tr><th scope="col">Issue</th><th scope="col">Release</th><th scope="col">Status</th><th scope="col">Occurrences</th><th scope="col">Last received</th></tr></thead><tbody>{visible.map(row => {
        const alert = issueAlert(row);
        return <tr key={row.id} className={unseen(alert) ? 'unseen-issue' : undefined}><th scope="row"><Link className="issue-open" to={hrefFor(project, 'issues', row.id) as any}>{row.title}</Link>{alert && <span className={`attention-badge ${alert.kind}`}>{attentionLabel(alert)}</span>}{unseen(alert) && <span className="unseen-label">Unseen</span>}</th><td data-label="Release">{row.last_release ?? 'No retained events'}</td><td data-label="Status"><span className={`state-chip ${row.state}`}>{stateLabel(row.state)}</span></td><td data-label="Occurrences">{row.count}</td><td data-label="Last received">{date(row.last_seen)}</td></tr>;
      })}</tbody></table></div> : <div className="issue-filter-empty"><p>No issues match these filters.</p><button className="text-button" onClick={() => { setSearch(''); setState('all'); setRelease('all'); setPage(0); }}>Clear filters</button></div>}
      {lastPage > 0 && <nav className="pagination" aria-label="Issue pages"><button className="text-button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {lastPage + 1}</span><button className="text-button" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}
    </>}
  </section>;
}
