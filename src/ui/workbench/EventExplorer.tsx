import {useEffect, useState} from 'react';
import {api} from './client';
import {date} from './shared';
import './event-explorer.css';

export function EventExplorer({project,issue,refresh,onSelect}:{project:string;issue:string;refresh:unknown;onSelect:(event:any)=>void}) {
 const [q,setQ]=useState(''),[order,setOrder]=useState('newest'),[cursors,setCursors]=useState(['']);
 const [list,setList]=useState<any>(null),[selected,setSelected]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[reading,setReading]=useState(false);
 const [target,setTarget]=useState<any>(()=>{const p=new URLSearchParams(typeof window==='undefined'?'':window.location.search);return p.get('event')&&p.get('occurrence')?{id:p.get('event'),occurrence:p.get('occurrence')}:null});
 const root=`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issue)}/events`;
 useEffect(()=>{let alive=true;setLoading(true);setError('');const timer=setTimeout(()=>{
  api(`${root}?${new URLSearchParams({q,order,cursor:cursors.at(-1)!})}`).then(value=>{if(alive){setList({...value,query:q});setLoading(false)}}).catch(e=>{if(alive){setError(e.message);setLoading(false)}});
 },180);return()=>{alive=false;clearTimeout(timer)}},[root,q,order,cursors,refresh]);
 useEffect(()=>{
  if(!list||list.query!==q)return;const pick=target??list.recommended;
  if(!pick){setSelected(null);setReading(false);setError('');return}
  let alive=true;setReading(true);
  api(`${root}/${encodeURIComponent(pick.id)}?${new URLSearchParams({q,occurrence:pick.occurrence})}`).then(value=>{if(alive){setSelected(value);onSelect(value);setReading(false);setError('');const url=new URL(location.href);url.searchParams.set('event',value.id);url.searchParams.set('occurrence',value.occurrence);history.replaceState(history.state,'',url)}}).catch(e=>{if(alive){setError(e.message);setReading(false)}});
  return()=>{alive=false};
 },[root,list,target,q,onSelect]);
 const choose=(value:any)=>{setError('');setTarget(value)};
 const filter=(value:string)=>{setQ(value);setCursors(['']);setTarget(null)};
 const keys=[...new Set<string>((list?.tags.rows??[]).map((r:any)=>r.key))];
 return <section className="evidence event-explorer" aria-labelledby="all-events-title">
  <h2 id="all-events-title">All Events</h2>
  <p>Inspect an exact retained occurrence. Event filters match the same occurrence; tag percentages cover every retained event in this issue.</p>
  <div className="event-filters"><label className="form-field">Search events<input type="search" placeholder="tenant:acme environment:production" value={q} onChange={e=>filter(e.target.value)}/></label><label className="form-field">Event order<select value={order} onChange={e=>{setOrder(e.target.value);setCursors([''])}}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div>
  {error&&<p role="alert">Events could not be loaded: {error}. <button className="text-button" onClick={()=>{setTarget(null);setCursors([...cursors])}}>Retry events</button></p>}
  {loading?<p role="status">Loading retained events…</p>:<>
   <p role="status">{list?.total??0} matching retained events{reading?' · Loading selected event…':''}</p>
   {!!list?.total&&<>
    <nav className="event-navigation" aria-label="Select occurrence">{[['Oldest',list.oldest],['Latest',list.latest],['Recommended',list.recommended],['Previous event',selected?.previous],['Next event',selected?.next]].map(([label,value]:any)=><button key={label} className="text-button" disabled={reading||!value} onClick={()=>choose(value)}>{label}</button>)}</nav>
    <p className="muted">{list.recommendation}</p>
    <details className="event-page"><summary>Browse {list.rows.length} events on this page</summary><div className="table-region"><table className="event-table"><thead><tr><th scope="col">Received</th><th scope="col">Release / environment</th><th scope="col">Event</th></tr></thead><tbody>{list.rows.map((row:any)=><tr key={row.occurrence} aria-selected={selected?.occurrence===row.occurrence}><th scope="row"><button className="text-button" disabled={reading} onClick={()=>choose(row)}>{date(row.received)}</button>{selected?.occurrence===row.occurrence&&<span className="selected-event-label">Selected</span>}</th><td data-label="Release / environment">{row.release} · {row.environment}</td><td data-label="Event"><code>{row.id}</code><p>{row.type}: {row.message}</p></td></tr>)}</tbody></table></div>
    {(cursors.length>1||list.next)&&<nav className="pagination" aria-label="Event pages"><button className="text-button" disabled={cursors.length===1} onClick={()=>setCursors(values=>values.slice(0,-1))}>Previous page</button><span>Page {cursors.length}</span><button className="text-button" disabled={!list.next} onClick={()=>setCursors(values=>[...values,list.next])}>Next page</button></nav>}</details>
   </>}
   {list&&!list.total&&<p>No retained events match this query. <button className="text-button" onClick={()=>filter('')}>Clear event filters</button></p>}
  </>}
  {keys.length>0&&<details className="event-tags-summary"><summary>Issue tag summary · {list.tags.events} retained events</summary>{keys.map(key=>{const rows=list.tags.rows.filter((r:any)=>r.key===key),top=rows.slice(0,10),other=rows.slice(10).reduce((n:number,r:any)=>n+r.count,0);return <div key={key}><h3>{key}</h3><ul>{top.map((row:any)=><li key={row.value}><code>{row.value}</code> — {row.count} ({row.percent.toFixed(1)}%)</li>)}{!!other&&<li>Other — {other} ({(100*other/list.tags.events).toFixed(1)}%)</li>}</ul></div>})}{!list.tags.complete&&<p>Tag summary reached its 1,000-value bound. Narrow the investigation to inspect additional values.</p>}</details>}
 </section>;
}
