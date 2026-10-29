import { useState } from 'react';
import { BulkTriage, useBulkSelection } from './BulkTriage';
import { useIssueSearch } from './useIssueSearch';
import { EmptyCapture } from './EmptyCapture';
import { IssueToolbar, fromQueryText, issueViews, queryText, type IssueQuery } from './IssueToolbar';
import { IssueTable } from './IssueTable';
import type { Alert, Issue } from './attention';
import { useDraft } from './shared';
import './issues.css';

/** The landing list: the title, one toolbar row, then the issues. Filters, sort and display options fold into the
 * toolbar's menus; bulk actions appear only once a row is selected. Unresolved (open and acknowledged) is the default. */
export function IssueList({ project, rows, unseen, onRefresh, onSetup, readOnly = false }: {
  project: string; rows: Issue[]; unseen: (alert?: Alert) => boolean; onRefresh: () => void; onSetup: () => void; readOnly?: boolean;
}) {
  const initial = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search), start = fromQueryText(initial.get('q') ?? '');
  const [search, setSearch] = useDraft(`${project}.issue-search`, start.search), [pending, setPending] = useDraft(`${project}.issue-pending`, start.pending);
  const [state, setState] = useDraft(`${project}.issue-state`, initial.get('status') ?? 'unresolved');
  const [release, setRelease] = useDraft(`${project}.issue-release`, initial.get('release') ?? 'all'), [sort, setSort] = useDraft(`${project}.issue-sort`, initial.get('sort') ?? 'priority');
  const [cursors, setCursors] = useState<string[]>(['']);
  const query: IssueQuery = { search, pending, state, release, sort }, q = queryText(query);
  const params = new URLSearchParams({ q, status: state, release, sort, cursor: cursors.at(-1)! });
  const exportQuery = new URLSearchParams({ q, status: state, release, sort }).toString();
  const found = useIssueSearch(project, params.toString(), rows), result = found.result, loading = found.loading, failed = !!found.failed;
  const visible: Issue[] = result?.rows ?? [], total = result?.total ?? 0;
  const selection = useBulkSelection();
  const narrowed = !!search.trim() || pending || release !== 'all' || !issueViews.some(([value]) => value === state);
  function change(next: Partial<IssueQuery>) {
    if (next.search !== undefined) setSearch(next.search);
    if (next.pending !== undefined) setPending(next.pending);
    if (next.state !== undefined) setState(next.state);
    if (next.release !== undefined) setRelease(next.release);
    if (next.sort !== undefined) setSort(next.sort);
    setCursors(['']); selection.clear();
  }
  if (!loading && !failed && result?.facets?.views?.all === 0 && !q && release === 'all') return <EmptyCapture waiting onSetup={onSetup} />;
  return <section className="issue-browser" aria-labelledby="issue-browser-heading" aria-busy={loading}>
    <h2 id="issue-browser-heading" className="visually-hidden">Issues</h2>
    <IssueToolbar project={project} query={query} result={result} readOnly={readOnly} exportQuery={exportQuery} onChange={change} onRefresh={onRefresh} />
    {!readOnly && <BulkTriage project={project} selected={selection.selected} refreshing={found.refreshing} clear={selection.clear} onApplied={onRefresh} />}
    {loading ? <p role="status" className="list-state">Loading issues…</p> : failed ? <p role="alert" className="list-state">Issue search is unavailable. <button className="text-button" onClick={onRefresh}>Retry search</button></p> : <>
      <p role="status" className="visually-hidden">{total} {total === 1 ? 'issue' : 'issues'}{narrowed ? ' matching your filters' : ''}</p>
      {visible.length ? <IssueTable project={project} rows={visible} unseen={unseen} readOnly={readOnly} selection={selection} refreshing={found.refreshing} />
        : !narrowed && state === 'unresolved' ? <div className="list-state"><p>Nothing unresolved.</p><button className="text-button" onClick={() => change({ state: 'all' })}>Show all issues</button></div>
        : <div className="list-state"><p>No issues match these filters.</p><button className="text-button" onClick={() => change({ search: '', pending: false, state: 'unresolved', release: 'all' })}>Clear filters</button></div>}
      {(cursors.length > 1 || result?.next) && <nav className="pagination" aria-label="Issue pages"><button className="text-button" disabled={cursors.length === 1} onClick={() => { selection.clear(); setCursors(values => values.slice(0, -1)); }}>Previous</button><span className="meta">Page {cursors.length} · {total} issues</span><button className="text-button" disabled={!result?.next} onClick={() => { selection.clear(); setCursors(values => [...values, result.next]); }}>Next</button></nav>}
    </>}
  </section>;
}
