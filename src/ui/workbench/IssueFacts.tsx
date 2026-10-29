import { Fold } from './Fold';
import { date } from './shared';

export function RecentOccurrence({ group, event }: { group: any; event: any }) {
  const language = event?.event.language ?? 'javascript', release = event?.event.release ?? 'Unavailable', environment = event?.event.environment ?? 'Unavailable';
  return <Fold title="Recent occurrence" className="recent-occurrence" meta={`${language} · ${release} · ${environment}`}>
    <dl className="issue-facts"><div><dt>Language</dt><dd>{language}</dd></div><div><dt>Release</dt><dd>{release}</dd></div><div><dt>Environment</dt><dd>{environment}</dd></div><div><dt>Last received</dt><dd>{date(group.last_seen)}</dd></div>{group.client_dropped > 0 && <div><dt>Not sent by the SDK</dt><dd>{group.client_dropped} more at this location (rate cap or repeats)</dd></div>}</dl>
  </Fold>;
}

export function ObservedDeployments({ deployments }: { deployments: any }) {
  const first = deployments?.first, last = deployments?.last;
  return <Fold title="Observed deployments" meta={first || last ? `First ${first ? `${first.release} · ${first.environment}` : 'unknown'} · last ${last ? `${last.release} · ${last.environment}` : 'unknown'}` : 'No retained occurrence'}>
    <p className="meta">First and last events by receipt time. Deployment details are supplied by you or your deploy key.</p>
    {(['first', 'last'] as const).map(key => { const d = deployments?.[key]; return <div key={key}><h3>{key === 'first' ? 'First seen' : 'Last seen'}</h3><p>{d ? `${d.release} · ${d.environment}` : 'No retained occurrence'}</p>{d?.manifest ? <p><a href={d.manifest.repository} rel="noreferrer" target="_blank">Repository</a> · <code>{d.manifest.commit_sha}</code> · {date(d.manifest.deployed_at)}</p> : <p>Deployment and commit unknown for this environment.</p>}</div>; })}
  </Fold>;
}
