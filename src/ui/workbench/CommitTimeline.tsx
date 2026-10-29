import { useEffect, useState } from 'react';
import { Fold } from './Fold';
import { date, type Request } from './shared';

// TEAM-004: commits that cite this issue, the release each resolved it in and any later
// regression. Author and message are shown here, to the owner, whatever the sharing choice.
export function CommitTimeline({ project, issue, shortId, refresh, request }: { project: string; issue: string; shortId?: string | null; refresh: unknown; request: Request }) {
 const [timeline, setTimeline] = useState<any>(null), [failed, setFailed] = useState('');
 useEffect(() => {
  let alive = true; setFailed('');
  request(`/api/projects/${encodeURIComponent(project)}/commits/issues/${encodeURIComponent(issue)}`).then(value => { if (alive) setTimeline(value); }).catch(error => { if (alive) setFailed(error.message); });
  return () => { alive = false; };
 }, [project, issue, refresh, request]);
 const links = timeline?.links.length ?? 0;
 return <Fold title="Commits and resolution" className="commit-timeline" meta={failed ? 'Commit timeline unavailable' : !timeline ? 'Loading commit timeline…' : links ? `${links} linked ${links === 1 ? 'commit' : 'commits'}` : 'No commit cites this issue yet'}>
  {failed ? <p role="alert">Commit timeline unavailable: {failed}</p> : !timeline ? <p role="status">Loading commit timeline…</p> : !timeline.links.length
   ? <p>No commit cites this issue yet. A commit message with <code>Fixes {shortId ?? 'SHORT-ID'}</code> (or Resolves or Closes) links here as soon as a deploy key registers the release that includes it.</p>
   : <ol className="timeline">{timeline.links.map((link: any) => <li key={link.sha}>
    <p><strong>Linked</strong> · {date(link.linked)} · commit <code title={link.sha}>{link.sha.slice(0, 12)}</code> · <q>{link.citation}</q></p>
    {link.expired !== null ? <p className="metadata">Author and message removed by retention.</p> : <>{link.author && <p className="metadata">Author: {[link.author.name, link.author.email && `<${link.author.email}>`].filter(Boolean).join(' ')}</p>}{link.message && <p className="commit-message">{link.message.split('\n')[0]}</p>}</>}
    {link.release && <p><strong>Resolved in {link.release}</strong> · {date(link.resolved)} · by this commit{link.current ? ' · current resolution' : ''} · PR: {link.pr ?? 'none recorded'}</p>}
    {link.regressed && <p><strong>Regressed</strong> in {link.regressed.release || 'no release'} · {date(link.regressed.at)}</p>}
   </li>)}</ol>}
  <p className="muted">Author and message stay on owner screens. Packets, agent reads, alerts and exports carry the short ID and commit SHA, and add author and message only when the project’s commit sharing setting is on.</p>
 </Fold>;
}
