import {useEffect, useId, useState, type ReactNode} from 'react';
import {api} from './client';
import {Icon} from './icons';
import {date, relative} from './shared';
import './event-explorer.css';

/** The issue's events: the query, the matching count and the order on the title line, then the selected event as
 * one row that opens in place to move between events and browse this page of them. */
export function EventExplorer({project,issue,refresh,onSelect,children}:{project:string;issue:string;refresh:unknown;onSelect:(event:any)=>void;children?:ReactNode}) {
 const [q,setQ]=useState(''),[order,setOrder]=useState('newest'),[cursors,setCursors]=useState(['']),[open,setOpen]=useState(false),panel=useId();
 const [list,setList]=useState<any>(null),[selected,setSelected]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[reading,setReading]=useState(false);
 const [target,setTarget]=useState<any>(()=>{const p=new URLSearchParams(typeof window==='undefined'?'':window.location.search);return p.get('event')&&p.get('occurrence')?{id:p.get('event'),occurrence:p.get('occurrence')}:null});
 const root=`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issue)}/events`;
 const listing=!list||list.root!==root||list.query!==q||list.order!==order||list.cursor!==cursors.at(-1)||list.refresh!==refresh;
 useEffect(()=>{let alive=true;if(!list||list.query!==q)setLoading(true);setError('');const timer=setTimeout(()=>{
  api(`${root}?${new URLSearchParams({q,order,cursor:cursors.at(-1)!})}`).then(value=>{if(alive){setList({...value,root,query:q,order,cursor:cursors.at(-1),refresh});setLoading(false)}}).catch(e=>{if(alive){setError(e.message);setLoading(false)}});
 },180);return()=>{alive=false;clearTimeout(timer)}},[root,q,order,cursors,refresh]);
 useEffect(()=>{
  if(listing)return;const pick=target??list.recommended;
  if(!pick){setSelected(null);setReading(false);setError('');return}
  let alive=true;if(!selected||selected.id!==pick.id||selected.occurrence!==pick.occurrence)setReading(true);
  api(`${root}/${encodeURIComponent(pick.id)}?${new URLSearchParams({q,occurrence:pick.occurrence})}`).then(value=>{if(alive){setSelected(value);onSelect(value);setReading(false);setError('');const url=new URL(location.href);url.searchParams.set('event',value.id);url.searchParams.set('occurrence',value.occurrence);history.replaceState(history.state,'',url)}}).catch(e=>{if(alive){setError(e.message);setReading(false)}});
  return()=>{alive=false};
 },[root,list,listing,target,q,onSelect]);
 const choose=(value:any)=>{setError('');setTarget(value)};
 const filter=(value:string)=>{setQ(value);setCursors(['']);setTarget(null)};
 const keys=[...new Set<string>((list?.tags.rows??[]).map((r:any)=>r.key))];
 return <section className="evidence event-explorer" aria-labelledby="all-events-title">
  <div className="events-head">
   <h2 id="all-events-title">Events</h2>
   <label className="search-field event-search"><Icon name="search"/><input type="search" aria-label="Search events" placeholder="tenant:acme environment:production" value={q} onChange={e=>filter(e.target.value)}/></label>
   <p role="status" className="meta events-count">{loading?'Loading events…':`${list?.total??0} matching events`}{reading?' · Loading selected event…':''}</p>
   <select className="select order-select" aria-label="Event order" value={order} onChange={e=>{setOrder(e.target.value);setCursors([''])}}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
  </div>
  {error&&<p role="alert">Events could not be loaded: {error}. <button className="text-button" onClick={()=>{setTarget(null);setCursors([...cursors])}}>Retry events</button></p>}
  {list&&!list.total&&!loading&&<p>No events match this query. <button className="text-button" onClick={()=>filter('')}>Clear event filters</button></p>}
  {selected&&!!list?.total&&<div className={`event-card${open?' open':''}`}>
   <button type="button" className="event-row" aria-expanded={open} aria-controls={panel} onClick={()=>setOpen(value=>!value)}>
    <span className="event-text"><span className="item-title">{selected.event.type}: {selected.event.message}</span><span className="meta metadata" data-event-id={selected.id}>{selected.event.environment} · <code>{selected.event.release||'no release'}</code> · {relative(selected.received)}</span></span>
    <Icon name="right"/>
   </button>
   <div id={panel} className="event-panel" hidden={!open}>
    <nav className="event-navigation" aria-label="Select occurrence">{[['Oldest',list.oldest],['Latest',list.latest],['Recommended',list.recommended],['Previous event',selected?.previous],['Next event',selected?.next]].map(([label,value]:any)=><button key={label} className="text-button" disabled={listing||reading||!value} onClick={()=>choose(value)}>{label}</button>)}</nav>
    <p className="meta">Received {date(selected.received)} · event <code>{selected.id}</code>. {list.recommendation} Filters match one event; tag percentages cover all events in this issue.</p>
    <details className="event-page"><summary>Browse {list.rows.length} events on this page</summary><div className="table-region"><table className="event-table"><thead><tr><th scope="col">Received</th><th scope="col">Release / environment</th><th scope="col">Event</th></tr></thead><tbody>{list.rows.map((row:any)=><tr key={row.occurrence} aria-selected={selected?.occurrence===row.occurrence}><th scope="row"><button className="text-button" disabled={listing||reading} onClick={()=>choose(row)}>{date(row.received)}</button>{selected?.occurrence===row.occurrence&&<span className="selected-event-label">Selected</span>}</th><td data-label="Release / environment">{row.release||'none'} · {row.environment}</td><td data-label="Event"><code>{row.id}</code><p>{row.type}: {row.message}</p></td></tr>)}</tbody></table></div>
    {(cursors.length>1||list.next)&&<nav className="pagination" aria-label="Event pages"><button className="text-button" disabled={listing||cursors.length===1} onClick={()=>setCursors(values=>values.slice(0,-1))}>Previous page</button><span>Page {cursors.length}</span><button className="text-button" disabled={listing||!list.next} onClick={()=>setCursors(values=>[...values,list.next])}>Next page</button></nav>}</details>
    {keys.length>0&&<details className="event-tags-summary"><summary>Issue tag summary · {list.tags.events} events</summary>{keys.map(key=>{const rows=list.tags.rows.filter((r:any)=>r.key===key),top=rows.slice(0,10),other=rows.slice(10).reduce((n:number,r:any)=>n+r.count,0);return <div key={key}><h3>{key}</h3><ul>{top.map((row:any)=><li key={row.value}><code>{row.value}</code> — {row.count} ({row.percent.toFixed(1)}%)</li>)}{!!other&&<li>Other — {other} ({(100*other/list.tags.events).toFixed(1)}%)</li>}</ul></div>})}{!list.tags.complete&&<p>Tag summary reached its 1,000-value bound. Narrow the investigation to inspect additional values.</p>}</details>}
   </div>
  </div>}
  {children}
 </section>;
}
