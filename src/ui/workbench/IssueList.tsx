import { useState } from 'react';
import { useIssueSearch } from './useIssueSearch';
import { Link } from '@tanstack/react-router';
import { Details } from './Details';
import { EmptyCapture } from './EmptyCapture';
import { hrefFor } from './location';
import { attentionLabel, issueAlert, type Alert, type Issue } from './attention';
import { date, stateLabel, states, useDraft } from './shared';
export function IssueList({ project, rows, unseen, loading, failed, onRefresh, onSetup }: {
  project: string; rows: Issue[]; unseen: (alert?: Alert) => boolean; loading: boolean; failed: boolean; onRefresh: () => void; onSetup: () => void;
}) {
  const initial = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const [search, setSearch] = useDraft(`${project}.issue-search`, initial.get('q') ?? '');
  const [state, setState] = useDraft(`${project}.issue-state`, initial.get('status') ?? 'all');
  const [release, setRelease] = useDraft(`${project}.issue-release`, initial.get('release') ?? 'all'), [sort, setSort] = useDraft(`${project}.issue-sort`, initial.get('sort') ?? 'priority');
  const [cursors,setCursors]=useState<string[]>(['']),[copied,setCopied]=useState(false);
  const params=new URLSearchParams({q:search,status:state,release,sort,cursor:cursors.at(-1)!});
  const query=useIssueSearch(project,params.toString(),rows),result=query.result;
  loading=query.loading;failed=!!query.failed;
  const visible:Issue[]=result?.rows??[],total=result?.total??0;
  const reset=()=>setCursors(['']);
  if (!loading && !failed && !total && !search && state==='all' && release==='all') return <EmptyCapture waiting onSetup={onSetup} onRefresh={onRefresh} />;
  return <section className="evidence issue-browser" aria-labelledby="issue-browser-heading">
    <div className="issue-browser-heading"><h2 id="issue-browser-heading" className="visually-hidden">Issues</h2><button className="text-button" disabled={loading} onClick={onRefresh}>Refresh issues</button></div>
    <div className="issue-counts"><div><span>Unseen on this page</span><strong>{loading ? '…' : failed ? '—' : visible.filter(row => unseen(issueAlert(row))).length}</strong></div><div><span>Open</span><strong>{loading ? '…' : failed ? '—' : result?.facets.statuses.find((r:any)=>r.value==='open')?.count ?? 0}</strong></div><div><span>Resolved</span><strong>{loading ? '…' : failed ? '—' : result?.facets.statuses.find((r:any)=>r.value==='resolved')?.count ?? 0}</strong></div></div>
    <div className="issue-filters"><label className="form-field">Search issues<input type="search" value={search} onChange={e => { setSearch(e.target.value); reset(); }} /></label><label className="form-field">Status<select value={state} onChange={e => { setState(e.target.value); reset(); }}><option value="all">All statuses</option>{states.map(value => <option key={value} value={value}>{stateLabel(value)}</option>)}</select></label><label className="form-field">Release<select value={release} onChange={e => { setRelease(e.target.value); reset(); }}><option value="all">All releases</option>{(result?.facets.releases??[]).map((item:any) => <option key={item.value} value={item.value}>{item.value} ({item.count})</option>)}</select></label><label className="form-field">Sort<select value={sort} onChange={e => { setSort(e.target.value); reset(); }}><option value="priority">Active attention first</option><option value="latest">Latest received</option><option value="occurrences">Most occurrences</option></select></label></div>
    {loading ? <p role="status">Loading issues…</p> : failed ? <p role="alert">Search could not be loaded: {query.failed}. Refresh to try again.</p> : <>
      <div className="list-summary"><p role="status">{total} {total === 1 ? 'issue' : 'issues'}{search || state !== 'all' || release !== 'all' ? ' matching your filters' : ''}</p><Details title="Issue list and viewing"><p>Search, facets and ordering cover every retained issue in this project. Combine words or fields: environment:production error.type:TypeError function:checkout after:2026-01-01. Quote values containing spaces. Unknown fields are refused. Occurrence counts include all retained events of each matching issue.</p><p>Active attention sorts regressions, then new issues. Unseen is stored in this browser and counts only this page. Opening evidence marks its latest alert viewed; it does not acknowledge or resolve the issue.</p><p>Exports contain the same query's issue aggregates, to 10,000 issues; larger exports are explicitly refused. Use the paginated API for larger queries.</p></Details></div>
      <div className="issue-search-actions"><button className="text-button" onClick={async()=>{const url=new URL(location.href);params.delete('cursor');url.search=params.toString();await navigator.clipboard.writeText(url.href);setCopied(true)}}>{copied?'Search link copied':'Copy search link'}</button> <a className="text-button" href={`/api/projects/${encodeURIComponent(project)}/issue-export?${params}&format=json`}>Export JSON</a> <a className="text-button" href={`/api/projects/${encodeURIComponent(project)}/issue-export?${params}&format=csv`}>Export CSV</a></div>
      <p className="muted">Environments: {(result?.facets.environments??[]).map((item:any)=>`${item.value} (${item.count})`).join(' · ') || 'No matching retained events'}</p>
      {visible.length ? <div className="table-region"><table className="issue-table"><thead><tr><th scope="col">Issue</th><th scope="col">Release</th><th scope="col">Status</th><th scope="col">Occurrences</th><th scope="col">Last received</th></tr></thead><tbody>{visible.map(row => {
        const alert = issueAlert(row);
        return <tr key={row.id} className={unseen(alert) ? 'unseen-issue' : undefined}><th scope="row"><Link className="issue-open" to={hrefFor(project, 'issues', row.id) as any}>{row.title}</Link>{alert && <span className={`attention-badge ${alert.kind}`}>{attentionLabel(alert)}</span>}{unseen(alert) && <span className="unseen-label">Unseen</span>}</th><td data-label="Release">{row.last_release ?? 'No retained events'}</td><td data-label="Status"><span className={`state-chip ${row.state}`}>{stateLabel(row.state)}</span></td><td data-label="Occurrences">{row.count}</td><td data-label="Last received">{date(row.last_seen)}</td></tr>;
      })}</tbody></table></div> : <div className="issue-filter-empty"><p>No issues match these filters.</p><button className="text-button" onClick={() => { setSearch(''); setState('all'); setRelease('all'); reset(); }}>Clear filters</button></div>}
      {(cursors.length>1||result?.next) && <nav className="pagination" aria-label="Issue pages"><button className="text-button" disabled={cursors.length===1} onClick={()=>setCursors(values=>values.slice(0,-1))}>Previous</button><span>Page {cursors.length} · {total} issues</span><button className="text-button" disabled={!result?.next} onClick={()=>setCursors(values=>[...values,result.next])}>Next</button></nav>}
    </>}
  </section>;
}
