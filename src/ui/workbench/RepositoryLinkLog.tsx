import { Details } from './Details';
import { useEffect, useState } from 'react';
import { date, type Request } from './shared';

const labels: Record<string, string> = { unknown: 'Unknown short ID', other_project: 'Another project', inaccessible: 'Imported history' };
// TEAM-004: citations that linked nothing, each with its reason. Nothing here changed an issue.
export function RepositoryLinkLog({ project, request, releases }: { project: string; request: Request; releases: unknown }) {
 const [log, setLog] = useState<any>(null), [failed, setFailed] = useState('');
 useEffect(() => {
  let alive = true; setFailed('');
  request(`/api/projects/${encodeURIComponent(project)}/commits/link-log`).then(value => { if (alive) setLog(value); }).catch(error => { if (alive) setFailed(error.message); });
  return () => { alive = false; };
 }, [project, request, releases]);
 return <section className="evidence" id="repository-link-log" aria-labelledby="repository-link-log-title"><h2 id="repository-link-log-title">Repository link log</h2>
  <Details title="Commit links"><p>Fixes, Resolves or Closes followed by a short ID links a commit to an issue in this project. Unmatched references are listed here.</p></Details>
  {failed ? <p role="alert">Repository link log unavailable: {failed}</p> : !log ? <p role="status">Loading repository link log…</p> : !log.rows.length ? <p>No unlinked citations.</p>
   : <div className="table-region"><table className="data-table link-log"><thead><tr><th scope="col">Citation</th><th scope="col">Commit</th><th scope="col">Reason</th><th scope="col">Logged</th></tr></thead><tbody>{log.rows.map((row: any) => <tr className="data-row" key={row.sha + row.citation}>
    <th scope="row"><q>{row.citation}</q></th><td data-label="Commit"><code title={row.sha}>{row.sha.slice(0, 12)}</code></td><td data-label="Reason"><strong>{labels[row.reason]}</strong><p className="muted">{log.reasons[row.reason]}</p></td><td data-label="Logged">{date(row.created)}</td></tr>)}</tbody></table></div>}
 </section>;
}
