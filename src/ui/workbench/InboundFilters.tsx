import {useEffect,useState} from 'react';
import type {Request,Run} from './shared';
import './inbound-filters.css';
import {SectionHead} from './SectionHead';
import {useAutoPreview} from './useAutoPreview';

function PatternInput({value,reset,disabled,placeholder,onChange}:{value:string;reset:unknown;disabled:boolean;placeholder?:string;onChange:(text:string)=>void}){
 const [text,setText]=useState(value);
 useEffect(()=>setText(value),[reset]);
 return <textarea value={text} rows={3} disabled={disabled} placeholder={placeholder} onChange={e=>{setText(e.target.value);onChange(e.target.value)}}/>;
}

export function InboundFilters({project,request,run,busy}:{project:string;request:Request;run:Run;busy:boolean}) {
 const [current,setCurrent]=useState<any>(null),[draft,setDraft]=useState<any>(null),[preview,setPreview]=useState<any>(null),[usage,setUsage]=useState<any[]>([]),[status,setStatus]=useState(''),[failure,setFailure]=useState('');
 const root=`/api/projects/${encodeURIComponent(project)}/inbound-filters`;
 const load=async()=>{const [policy,outcomes]=await Promise.all([request(root),request(`/api/projects/${encodeURIComponent(project)}/outcomes`)]);setCurrent(policy);setDraft(structuredClone(policy.policy));setUsage(outcomes.rows);setFailure('')};
 useEffect(()=>{let alive=true;setCurrent(null);setDraft(null);setPreview(null);Promise.all([request(root),request(`/api/projects/${encodeURIComponent(project)}/outcomes`)]).then(([policy,outcomes])=>{if(alive){setCurrent(policy);setDraft(structuredClone(policy.policy));setUsage(outcomes.rows);setFailure('')}}).catch(e=>{if(alive)setFailure(e.message)});return()=>{alive=false}},[root,request,project]);
 const change=(id:string,patch:any)=>{setDraft((value:any)=>({...value,filters:{...value.filters,[id]:{...value.filters[id],...patch}}}));setPreview(null);setStatus('Unsaved filter changes')};
 // Filters refuse later events, so a change previews itself against retained events and asks once, under the filters.
 const changed=!!current&&!!draft&&JSON.stringify(draft)!==JSON.stringify(current.policy);
 const auto=useAutoPreview(draft,changed,async policy=>{const counts:any={};let after='',scanned=0,next;do{const page=await request(root+'/preview','POST',{policy,after,limit:500});scanned+=page.scanned;for(const [id,row] of Object.entries<any>(page.counts)){counts[id]??={matches:0,unavailable:0};counts[id].matches+=row.matches;counts[id].unavailable+=row.unavailable}next=page.next;after=next??''}while(next);return {counts,scanned,policy:JSON.stringify(policy)}},600);
 useEffect(()=>{if(auto.preview)setStatus(`Preview complete · ${auto.preview.scanned} retained events. Existing evidence will stay unchanged.`)},[auto.preview]);
 useEffect(()=>{setPreview(auto.preview)},[auto.preview]);
 if(failure)return <section className="evidence"><h2>Inbound filters and usage</h2><p role="alert">Filters could not be loaded: {failure}</p><button className="text-button" onClick={()=>void run(load)}>Retry filters</button></section>;
 if(!draft||!current)return <section className="evidence"><h2>Inbound filters and usage</h2><p role="status">Loading project filters…</p></section>;
 const total=(reason:string)=>usage.find(row=>row.reason===reason)?.count??0;
 return <section className="evidence inbound-filters" aria-labelledby="inbound-filters-heading">
  <SectionHead id="inbound-filters-heading" title="Inbound filters and usage" about={<><p>Filter unwanted errors on the server before issues, alerts and accepted usage. A change previews itself against retained events; save it for later intake. No SDK redeploy is needed.</p><p>New-project defaults: {current.defaultOnFilters.map((id:string)=>current.filters.find((f:any)=>f.id===id)?.label).join(', ')}. Each can be turned off.</p><p>{current.patternSyntax}</p><p>Preview reports missing transport evidence separately. Client addresses are not retained, so historical IP matches are unavailable. Message patterns use literal text and *; domain patterns use example.com or *.example.com. Existing exact browser origins remain allowed. Per-filter matches can overlap; filtered events never enter accepted usage.</p><h3>Filters by accepted category and unavailable fields</h3>{Object.entries<string>(current.categoryFilterCoverage).map(([category,description])=><p key={category}><strong>{category}</strong>: {description}</p>)}</>}><button className="text-button" disabled={busy} onClick={()=>void run(async()=>{await load();setPreview(null);setStatus('Filter policy and usage refreshed')})}>Refresh filters and usage</button></SectionHead>
  <p className="meta">Last 24 hours · {total('accepted')} accepted · {total('filtered')} filtered</p>
  {current.filters.map((filter:any)=>{const value=draft.filters[filter.id],list='values' in value;return <fieldset key={filter.id} className="filter-policy"><legend>{filter.label}</legend>
   <label className="checkbox"><input type="checkbox" checked={value.enabled} disabled={busy} onChange={e=>change(filter.id,{enabled:e.target.checked})}/> Enable {filter.label.toLowerCase()}</label>
   <p className="muted">{filter.recentMatches} recent matches{preview?` · Preview: ${preview.counts[filter.id]?.matches??0} matches; ${preview.counts[filter.id]?.unavailable??0} with unavailable evidence`:''}</p>
   {list&&<label className="form-field">{filter.label} · one per line<PatternInput reset={current} value={value.values.join('\n')} disabled={busy} onChange={text=>change(filter.id,{values:text.split('\n').filter(Boolean)})}/></label>}
   {filter.id==='legacy_browsers'&&<label className="form-field">Legacy browser rules · name&lt;=version, one per line<PatternInput reset={current} disabled={busy} placeholder="chrome<=100" value={value.browsers.map((r:any)=>`${r.name}<=${r.maxVersion}`).join('\n')} onChange={text=>change(filter.id,{browsers:text.split('\n').filter(Boolean).map(line=>{const [name,maxVersion='']=line.split('<=');return{name,maxVersion}})})}/><span>Names: {current.browsers.join(', ')}. Matches the named version and older versions.</span></label>}
  </fieldset>})}
  {changed&&<div className="confirm-line">{auto.pending&&<p role="status">Previewing retained events…</p>}{auto.error&&<p role="alert">{auto.error}</p>}{preview&&preview.policy===JSON.stringify(draft)&&<button className="primary-button" disabled={busy} onClick={()=>void run(async()=>{await request(root,'PUT',{revision:current.revision,policy:draft});await load();setPreview(null);auto.clear();setStatus('Inbound filters saved. Later intake uses this policy.');})}>Save inbound filters</button>}</div>}
  {status&&<p role="status">{status}</p>}
 </section>;
}
