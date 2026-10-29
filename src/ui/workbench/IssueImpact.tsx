import {useEffect,useState} from 'react';
import {api} from './client';
import {date} from './shared';

export function IssueImpact({project,issue,refresh}:{project:string;issue:string;refresh:unknown}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setData(null);setError('');api(`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issue)}/impact`).then(value=>{if(live)setData(value)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[project,issue,refresh,retry]);
 const percent=(value:number|null)=>value===null?'Unavailable':`${(value*100).toFixed(1)}%`;
 return <section className="evidence" aria-label="Issue impact"><h2>Issue impact</h2>{error?<p role="alert">Impact could not be loaded: {error}. <button className="text-button" onClick={()=>setRetry(retry+1)}>Retry impact</button></p>:!data?<p role="status">Loading issue impact…</p>:<>
  <dl className="issue-facts"><div><dt>Retained events</dt><dd>{data.events}</dd></div><div><dt>First retained</dt><dd>{data.firstSeen===null?'No retained occurrence':date(data.firstSeen)}</dd></div><div><dt>Last retained</dt><dd>{data.lastSeen===null?'No retained occurrence':date(data.lastSeen)}</dd></div><div><dt>Affected users</dt><dd>{data.users.affectedUsers??data.users.reason}</dd></div><div><dt>Without a user key</dt><dd>{data.users.unattributed}</dd></div><div><dt>Events per hour · last 24 hours</dt><dd>{data.rate.perHour.toFixed(2)}</dd></div></dl>
  <details><summary>Impact coverage and sessions</summary><p>{data.coverage}</p>{data.retention.appliedCutoff!==null&&<p>Project retention has removed {data.retention.removedProjectEvents} events before {date(data.retention.appliedCutoff)}. Earlier issue impact is incomplete.</p>}<p>{data.users.definition}</p><p>{data.sessionCoverage}</p></details>
  <details className="issue-release-history"><summary>Release history · {data.releases.rows.length} releases</summary><p>{data.releases.noReleaseEvents} events without a release are excluded from release history and included in every issue total.</p>
   {!data.releases.rows.length&&<p>No retained events have a release.</p>}
   {data.releases.rows.map((row:any)=><div key={row.release}><h3>{row.release}</h3><p>{row.events} issue events · First {date(row.firstSeen)} · Last {date(row.lastSeen)}</p>
    {row.projectHealth.map((health:any)=><p key={health.environment}>Project release health · {health.environment||'No environment'}: {health.sessions} sessions · {percent(health.adoptionShare)} observed session share · {percent(health.crashFreeSessionRate)} crash-free sessions · {percent(health.crashFreeUserRate)} crash-free users</p>)}
    {!row.projectHealth.length&&<p>Project release health unavailable: no retained sessions for this release in the displayed health window.</p>}
   </div>)}
   <p>Project health window: {date(data.projectHealth.window.from)} to {date(data.projectHealth.window.to)}. {data.projectHealth.denominators.releaseLess} session items without a release were refused and are excluded from health denominators.</p><details><summary>Project health denominators</summary><p>{data.projectHealth.method}</p><p>{data.projectHealth.coverage}</p></details>
  </details>
 </>}</section>;
}
