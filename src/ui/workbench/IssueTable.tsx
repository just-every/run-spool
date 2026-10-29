import { Link } from '@tanstack/react-router';
import { hrefFor } from './location';
import { attentionLabel, issueAlert, type Alert, type Issue } from './attention';
import type { useBulkSelection } from './BulkTriage';
import { Tip } from './Tip';
import { relative, shortDate, stateLabel } from './shared';

/** One white panel: key, title and one meta line per issue, then status, occurrences, last received and unseen.
 * At phone width each row stacks and its meta line carries status, occurrences and time instead of the columns. */
export function IssueTable({ project, rows, unseen, readOnly, selection, refreshing }: {
  project: string; rows: Issue[]; unseen: (alert?: Alert) => boolean; readOnly: boolean; selection: ReturnType<typeof useBulkSelection>; refreshing: boolean;
}) {
  const chosen = (row: Issue) => selection.selected.some(item => item.id === row.id);
  const page = rows.length > 0 && rows.every(chosen);
  return <div className="table-region issue-panel"><table className="issue-table">
    <thead><tr>
      {!readOnly && <th scope="col" className="select-cell"><input type="checkbox" aria-label="Select this page" checked={page} disabled={refreshing} onChange={() => page ? selection.clear() : selection.select(rows)} /></th>}
      <th scope="col">Issue</th><th scope="col">Status</th><th scope="col">Occurrences</th><th scope="col">Last received</th><th scope="col" className="unseen-cell"><span className="visually-hidden">Unseen</span></th>
    </tr></thead>
    <tbody>{rows.map(row => {
      const alert = issueAlert(row), received = relative(row.last_seen), release = row.last_release === '' ? 'none' : row.last_release;
      return <tr key={row.id} className={chosen(row) ? 'selected' : undefined}>
        {!readOnly && <td className="select-cell"><label className="issue-select"><input type="checkbox" disabled={refreshing} aria-label={`Select ${row.title}`} checked={chosen(row)} onChange={() => selection.toggle(row)} /></label></td>}
        <th scope="row" className="issue-cell"><div className="issue-tiers">
          {row.short_id && <span className="label issue-key">{row.short_id}</span>}
          <Link className="item-title issue-open" to={hrefFor(project, 'issues', row.id) as any}>{row.title}</Link>
          <p className="meta issue-meta">{alert && <><span className="attention">{attentionLabel(alert)}</span> · </>}<span className="wide-meta">{release ? <code>{release}</code> : 'No retained events'} · {stateLabel(row.priority)} priority</span><span className="phone-meta">{stateLabel(row.state)} · {row.count} {row.count === 1 ? 'occurrence' : 'occurrences'} · {received}</span></p>
        </div></th>
        <td className="status-cell"><span className={`state-chip ${row.state}`}>{stateLabel(row.state)}</span></td>
        <td className="count-cell">{row.count}</td>
        <td className="time-cell"><Tip label={shortDate(row.last_seen)}><time dateTime={new Date(row.last_seen).toISOString()}>{received}</time></Tip></td>
        <td className="unseen-cell">{unseen(alert) && <Tip label="Unseen"><span className="unseen-dot unseen-label" role="img" aria-label="Unseen" tabIndex={0} /></Tip>}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}
