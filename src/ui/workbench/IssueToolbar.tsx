import { useState } from 'react';
import { Details } from './Details';
import { Icon } from './icons';
import { Popover } from './Popover';
import { ReviewViews } from './ReviewViews';
import { IconButton } from './Tip';
import { stateLabel, states } from './shared';

export type IssueQuery = { search: string; pending: boolean; state: string; release: string; sort: string };
export const issueViews = [['unresolved', 'Unresolved'], ['all', 'All'], ['resolved', 'Resolved'], ['suppressed', 'Suppressed']] as const;
const sorts = [['priority', 'Highest priority'], ['latest', 'Latest received'], ['occurrences', 'Most occurrences']] as const;
const pendingToken = /(^|\s)review:pending(?=\s|$)/g;
/** The search text and the Pending review filter travel as one query string, as saved views and links store it. */
export const queryText = ({ search, pending }: Pick<IssueQuery, 'search' | 'pending'>) => [search.replace(pendingToken, ' ').replace(/\s+/g, ' ').trim(), pending ? 'review:pending' : ''].filter(Boolean).join(' ');
export const fromQueryText = (q: string) => ({ search: q.replace(pendingToken, ' ').replace(/\s+/g, ' ').trim(), pending: new RegExp(pendingToken.source).test(q) });

type Props = { project: string; query: IssueQuery; result: any; readOnly: boolean; exportQuery: string; onChange: (next: Partial<IssueQuery>) => void; onRefresh: () => void };
export function IssueToolbar({ project, query, result, readOnly, exportQuery, onChange, onRefresh }: Props) {
  const [copied, setCopied] = useState(false);
  const views = result?.facets?.views, releases: any[] = result?.facets?.releases ?? [], environments: any[] = result?.facets?.environments ?? [];
  const chips = [
    ...(issueViews.some(([value]) => value === query.state) ? [] : [{ key: 'state', text: `Status: ${stateLabel(query.state)}`, clear: { state: 'unresolved' } }]),
    ...(query.release === 'all' ? [] : [{ key: 'release', text: `Release: ${query.release || 'none'}`, clear: { release: 'all' } }]),
    ...(query.pending ? [{ key: 'pending', text: 'Pending review', clear: { pending: false } }] : []),
  ];
  return <div className="issue-toolbar">
    <div className="toolbar-start">
      <div className="segmented" role="group" aria-label="Issue views">{issueViews.map(([value, label]) => <button key={value} type="button" className="segment" aria-pressed={query.state === value} onClick={() => onChange({ state: value })}>{label}<span className="count">{views ? views[value] : '…'}</span></button>)}</div>
      {chips.length > 0 && <div className="chips" role="group" aria-label="Applied filters">{chips.map(chip => <span className="chip" key={chip.key}>{chip.text}<IconButton icon="close" label={`Remove ${chip.text}`} onClick={() => onChange(chip.clear)} /></span>)}</div>}
    </div>
    <div className="toolbar-end">
      <label className="search-field"><Icon name="search" /><input type="search" aria-label="Search issues" placeholder="Search" value={query.search} onChange={event => onChange({ search: event.target.value })} /></label>
      <Popover label="Filter" icon="filter" count={chips.length}>{() => <>
        <label className="form-field">Status<select value={query.state} onChange={event => onChange({ state: event.target.value })}>{issueViews.map(([value, label]) => <option key={value} value={value}>{value === 'all' ? 'All statuses' : label}</option>)}{states.filter(value => !issueViews.some(([view]) => view === value)).map(value => <option key={value} value={value}>{stateLabel(value)}</option>)}</select></label>
        <label className="form-field">Release<select value={query.release} onChange={event => onChange({ release: event.target.value })}><option value="all">All releases</option>{releases.map(item => <option key={item.value} value={item.value}>{item.value || 'none'} ({item.count})</option>)}</select></label>
        <label className="check-row"><input type="checkbox" checked={query.pending} onChange={event => onChange({ pending: event.target.checked })} /> Pending review <span className="mono">{result?.reviewPending ?? '…'}</span></label>
        {chips.length > 0 && <button type="button" className="text-button" onClick={() => onChange({ state: 'unresolved', release: 'all', pending: false })}>Reset filters</button>}
      </>}</Popover>
      <Popover label="Sort" icon="sort" align="end">{close => <div className="menu-list" role="group" aria-label="Sort issues">{sorts.map(([value, label]) => <button key={value} type="button" className="menu-item" aria-pressed={query.sort === value} onClick={() => { onChange({ sort: value }); close(); }}>{label}{query.sort === value && <Icon name="check" />}</button>)}</div>}</Popover>
      <Popover label="Display" icon="display" align="end">{() => <>
        {!readOnly && <ReviewViews project={project} query={{ q: queryText(query), status: query.state, release: query.release, sort: query.sort }} onChoose={view => onChange({ ...fromQueryText(view.q), state: view.status, release: view.release, sort: view.sort })} />}
        <hr />
        <div className="menu-list">
          <button type="button" className="menu-item" onClick={async () => { const url = new URL(location.href); url.search = exportQuery; await navigator.clipboard.writeText(url.href); setCopied(true); }}>{copied ? 'Search link copied' : 'Copy search link'}</button>
          <a className="menu-item" href={`/api/projects/${encodeURIComponent(project)}/issue-export?${exportQuery}&format=json`}>Export JSON</a>
          <a className="menu-item" href={`/api/projects/${encodeURIComponent(project)}/issue-export?${exportQuery}&format=csv`}>Export CSV</a>
          <button type="button" className="menu-item" onClick={onRefresh}>Refresh issues</button>
        </div>
        <hr />
        <p className="meta">Environments: {environments.map(item => `${item.value} (${item.count})`).join(' · ') || 'no matching retained events'}</p>
        <Details title="Issue list and viewing" triggerLabel="About this list"><p>Search, facets and ordering cover every retained issue in this project. Combine words or fields: priority:high environment:production error.type:TypeError function:checkout after:2026-01-01. A short ID or alias such as CHECKOUT-1A3 finds its issue in any case. Quote values containing spaces. Other keys match retained tags; user identity fields are unavailable. Occurrence counts include all retained events of each matching issue.</p><p>Unresolved shows open and acknowledged issues. Priority sorts high, medium, then low. Within each priority, active regressions sort before new issues, followed by latest receipt. Pending review means a new or regressed issue since its latest owner review. Mark reviewed through the selection preview; it changes no triage state or occurrence. Saved queries are private to this owner workspace; links require sign-in. Unseen is stored in this browser and counts only this page. Opening evidence marks its latest alert viewed; it does not acknowledge or resolve the issue.</p><p>Exports contain the same query's issue aggregates, to 10,000 issues; larger exports are explicitly refused. Use the paginated API for larger queries.</p></Details>
      </>}</Popover>
    </div>
  </div>;
}
