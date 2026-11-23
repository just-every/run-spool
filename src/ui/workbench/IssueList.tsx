import { releaseLabel } from './releaseLabels';
import { ReviewViews } from './ReviewViews';
import { useState } from 'react';
import { BulkTriage, useBulkSelection } from './BulkTriage';
import { useIssueSearch } from './useIssueSearch';
import { Link } from '@tanstack/react-router';
import { Details } from './Details';
import { EmptyCapture } from './EmptyCapture';
import { hrefFor } from './location';
import { attentionLabel, issueAlert, issueStatusLabel, type Alert, type Issue } from './attention';
import { date, stateLabel, states, useDraft } from './shared';
export function IssueList({ project, rows, unseen, loading, failed, onRefresh, onSetup, readOnly = false }: {
  project: string; rows: Issue[]; unseen: (alert?: Alert) => boolean; loading: boolean; failed: boolean; onRefresh: () => void; onSetup: () => void; readOnly?: boolean;
}) {
  const initial = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const [search, setSearch] = useDraft(`${project}.issue-search`, initial.get('q') ?? '');
  const [state, setState] = useDraft(`${project}.issue-state`, initial.get('status') ?? 'all');
  const [release, setRelease] = useDraft(`${project}.issue-release`, initial.get('release') ?? 'all'), [sort, setSort] = useDraft(`${project}.issue-sort`, initial.get('sort') ?? 'priority');
  const [assignee,setAssignee]=useDraft(`${project}.issue-assignee`,initial.get('assignee')??'all');
  const [cursors,setCursors]=useState<string[]>(['']),[copied,setCopied]=useState(false);
  const params=new URLSearchParams({q:search,status:state,release,sort,assignee,cursor:cursors.at(-1)!});
  const query=useIssueSearch(project,params.toString(),rows),result=query.result;
  loading=query.loading;failed=!!query.failed;
  const refusal=query.failed&&!/^(Spool is unavailable|You are offline)/.test(query.failed)?query.failed:'';
  const visible:Issue[]=result?.rows??[],total=result?.total??0;
  const selection=useBulkSelection();
  const reset=()=>{setCursors(['']);selection.clear()};
  const count=(value:string)=>result?.facets.statuses.find((row:any)=>row.value===value)?.count??0;
  const environment=/(?:^|\s)environment:("[^"]*"|\S+)/.exec(search)?.[1]?.replace(/^"|"$/g,'')??'all';
  if (!loading && !failed && !total && !search && state==='all' && release==='all' && assignee==='all') return <EmptyCapture waiting onSetup={onSetup} />;
  return <section className="evidence issue-browser" aria-labelledby="issue-browser-heading" aria-busy={loading}>
    <h2 id="issue-browser-heading" className="visually-hidden">Issues</h2>
    <p className="issue-count-line" role="status">{loading?'Loading issues…':failed?'Issue counts unavailable':`${total} ${total===1?'issue':'issues'}${search||state!=='all'||release!=='all'||assignee!=='all'?' matching your filters':''} · ${count('open')} New or reopened · ${count('acknowledged')} Open · ${count('resolved')} Resolved · ${count('suppressed')} Ignored`}</p>
    <div className="issue-search-bar"><label className="form-field">Search issues<input type="search" value={search} onChange={e=>{setSearch(e.target.value);reset()}}/></label>
    <details className="issue-filter-panel"><summary>Filters</summary><div className="issue-filter-content">
      <div className="issue-filters">
        <label className="form-field">Status<select aria-label="Status" value={state} onChange={e=>{setState(e.target.value);reset()}}><option value="all">All statuses</option>{states.map(value=><option key={value} value={value}>{value==='open'?'New or reopened':stateLabel(value)}</option>)}</select></label>
        <label className="form-field">Assignee<select aria-label="Assignee" value={assignee} onChange={e=>{setAssignee(e.target.value);reset()}}><option value="all">Anyone</option><option value="me">Assigned to me</option></select></label>
        <label className="form-field">Environment<select aria-label="Environment" value={environment} onChange={e=>{const q=search.replace(/(?:^|\s)environment:("[^"]*"|\S+)/g,'').trim();setSearch((q+(e.target.value==='all'?'':` environment:${JSON.stringify(e.target.value)}`)).trim());reset()}}><option value="all">All environments</option>{(result?.facets.environments??[]).map((item:any)=><option key={item.value} value={item.value}>{item.value} ({item.count})</option>)}</select></label>
        <label className="form-field">Release<select aria-label="Release" value={release} onChange={e=>{setRelease(e.target.value);reset()}}><option value="all">All releases</option>{(result?.facets.releases??[]).map((item:any)=><option key={item.value} value={item.value}>{releaseLabel(item.value)} ({item.count})</option>)}</select></label>
        <label className="form-field">Sort<select aria-label="Sort" value={sort} onChange={e=>{setSort(e.target.value);reset()}}><option value="priority">Highest priority</option><option value="latest">Latest received</option><option value="occurrences">Most occurrences</option></select></label>
      </div>
      <p className="status-legend">New and reopened issues await acknowledgment. Open issues have been acknowledged. Resolved issues follow your reopening rule. Ignored issues still collect events under an archive condition.</p>
      {!readOnly&&<ReviewViews project={project} query={{q:search,status:state,release,sort,assignee}} onChoose={view=>{setSearch(view.q);setState(view.status);setRelease(view.release);setSort(view.sort);setAssignee(view.assignee??'all');reset()}}/>}
      <div className="issue-search-actions"><button className="text-button" onClick={async()=>{const url=new URL(location.href);const shared=new URLSearchParams(params);shared.delete('cursor');url.search=shared.toString();await navigator.clipboard.writeText(url.href);setCopied(true)}}>{copied?'Search link copied':'Copy search link'}</button><a className="text-button" href={`/api/projects/${encodeURIComponent(project)}/issue-export?${params}&format=json`}>Export JSON</a><a className="text-button" href={`/api/projects/${encodeURIComponent(project)}/issue-export?${params}&format=csv`}>Export CSV</a></div>
      {!readOnly&&!!visible.length&&<><button className="text-button" disabled={query.refreshing} onClick={()=>selection.select(visible)}>Select this page</button><BulkTriage project={project} selected={selection.selected} refreshing={query.refreshing} clear={selection.clear} onApplied={onRefresh}/></>}
      <Details title="Issue list and viewing"><p>New maps to an unacknowledged issue; Open maps to an acknowledged issue. Ignored maps to suppression. These labels do not change capture or resolution.</p><p>{result?.reviewPending??0} pending review · {visible.filter(row=>unseen(issueAlert(row))).length} not viewed on this page.</p><button className="text-button" onClick={()=>{setSearch(/(^|\s)review:pending(?=\s|$)/.test(search)?search:(search+' review:pending').trim());reset()}}>Show pending review</button><p>Search, facets and ordering cover every retained issue in this project. Combine words or fields: priority:high environment:production error.type:TypeError function:checkout after:2026-01-01. A short ID or alias finds its issue in any case. Quote values containing spaces. Other keys match retained tags; user identity fields are unavailable. Occurrence counts include all retained events of each matching issue.</p><p>Priority sorts high, medium, then low. Within each priority, active regressions sort before new issues, followed by latest receipt. Pending review means a new or regressed issue since your latest review. Mark reviewed through the selection preview; it changes no triage state or occurrence. Saved queries are private to your workspace; links require sign-in. Viewing is stored in this browser and counts only this page. Opening evidence marks its latest alert viewed; it does not acknowledge or resolve the issue.</p><p>Exports contain the same query’s issue aggregates, to 10,000 issues; larger exports are refused.</p></Details>
    </div></details></div>
    {loading?<p role="status">Loading issues…</p>:failed?refusal?<p role="alert">{refusal} <button className="text-button" onClick={()=>{setSearch('');reset()}}>Clear search</button></p>:<p role="alert">Issue search is unavailable. <button className="text-button" onClick={onRefresh}>Retry search</button></p>:<>
      {visible.length?<div className="table-region"><table className="issue-table"><thead><tr><th scope="col">Issue</th><th scope="col">Status</th><th scope="col">Assignee</th><th scope="col">Release</th><th scope="col">Priority</th><th scope="col">Occurrences</th><th scope="col">Last received</th></tr></thead><tbody>{visible.map(row=>{const alert=issueAlert(row);return <tr key={row.id} className={unseen(alert)?'unseen-issue':undefined}><th scope="row">{!readOnly&&<label className="issue-select"><input type="checkbox" disabled={query.refreshing} aria-label={`Select ${row.title}`} checked={selection.selected.some(item=>item.id===row.id)} onChange={()=>selection.toggle(row)}/><span className="visually-hidden">Select</span></label>}{row.short_id&&<code className="short-id" title="Short ID">{row.short_id}</code>}<Link className="issue-open" to={hrefFor(project,'issues',row.id) as any}>{row.title}</Link>{alert?.kind!=='new_issue'&&alert&&<span className={`attention-badge ${alert.kind}`}>{attentionLabel(alert)}</span>}</th><td data-label="Status"><span className={`state-chip ${row.state}`}>{issueStatusLabel(row.state, alert)}</span></td><td data-label="Assignee">{row.assignee||'Unassigned'}</td><td data-label="Release">{row.last_release==null?'No retained events':releaseLabel(row.last_release)}</td><td data-label="Priority"><span className={`priority-chip ${row.priority}`}>{stateLabel(row.priority)}</span></td><td data-label="Occurrences">{row.count}</td><td data-label="Last received">{date(row.last_seen)}</td></tr>})}</tbody></table></div>:<div className="issue-filter-empty"><p>No issues match these filters.</p><button className="text-button" onClick={()=>{setSearch('');setState('all');setRelease('all');setAssignee('all');reset()}}>Clear filters</button></div>}
      {(cursors.length>1||result?.next)&&<nav className="pagination" aria-label="Issue pages"><button className="text-button" disabled={cursors.length===1} onClick={()=>{selection.clear();setCursors(values=>values.slice(0,-1))}}>Previous</button><span>Page {cursors.length} · {total} issues</span><button className="text-button" disabled={!result?.next} onClick={()=>{selection.clear();setCursors(values=>[...values,result.next])}}>Next</button></nav>}
    </>}
  </section>;
}
