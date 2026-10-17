import {useEffect,useState} from 'react';
import type {Request,Run} from './shared';
import './inbound-filters.css';

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
 const previewPolicy=()=>void run(async()=>{setFailure('');setStatus('Previewing retained events…');const counts:any={};let after='',scanned=0,next;do{const page=await request(root+'/preview','POST',{policy:draft,after,limit:500});scanned+=page.scanned;for(const [id,row] of Object.entries<any>(page.counts)){counts[id]??={matches:0,unavailable:0};counts[id].matches+=row.matches;counts[id].unavailable+=row.unavailable}next=page.next;after=next??''}while(next);setPreview({counts,scanned,policy:JSON.stringify(draft)});setStatus(`Preview complete · ${scanned} retained events. Existing evidence will stay unchanged.`)});
 if(failure)return <section className="evidence"><h2>Inbound filters and usage</h2><p role="alert">Filters could not be loaded: {failure}</p><button className="text-button" onClick={()=>void run(load)}>Retry filters</button></section>;
 if(!draft||!current)return <section className="evidence"><h2>Inbound filters and usage</h2><p role="status">Loading project filters…</p></section>;
 const total=(reason:string)=>usage.find(row=>row.reason===reason)?.count??0;
 return <section className="evidence inbound-filters" aria-labelledby="inbound-filters-heading">
  <h2 id="inbound-filters-heading">Inbound filters and usage</h2>
  <p>Filter unwanted errors on the server before issues, alerts and accepted usage. Preview your changes against retained events, then save for later intake. No SDK redeploy is needed.</p>
  <p>New-project defaults: {current.defaultOnFilters.map((id:string)=>current.filters.find((f:any)=>f.id===id)?.label).join(', ')}. Each can be turned off.</p>
  <p className="muted">Last 24 hours · {total('accepted')} accepted · {total('filtered')} filtered. Per-filter matches can overlap; filtered events never enter accepted usage.</p>
  <p>{current.patternSyntax}</p>
  {current.filters.map((filter:any)=>{const value=draft.filters[filter.id],list='values' in value;return <fieldset key={filter.id} className="filter-policy"><legend>{filter.label}</legend>
   <label className="checkbox"><input type="checkbox" checked={value.enabled} disabled={busy} onChange={e=>change(filter.id,{enabled:e.target.checked})}/> Enable {filter.label.toLowerCase()}</label>
   <p className="muted">{filter.recentMatches} recent matches{preview?` · Preview: ${preview.counts[filter.id]?.matches??0} matches; ${preview.counts[filter.id]?.unavailable??0} with unavailable evidence`:''}</p>
   {list&&<label className="form-field">{filter.label} · one per line<PatternInput reset={current} value={value.values.join('\n')} disabled={busy} onChange={text=>change(filter.id,{values:text.split('\n').filter(Boolean)})}/></label>}
   {filter.id==='legacy_browsers'&&<label className="form-field">Legacy browser rules · name&lt;=version, one per line<PatternInput reset={current} disabled={busy} placeholder="chrome<=100" value={value.browsers.map((r:any)=>`${r.name}<=${r.maxVersion}`).join('\n')} onChange={text=>change(filter.id,{browsers:text.split('\n').filter(Boolean).map(line=>{const [name,maxVersion='']=line.split('<=');return{name,maxVersion}})})}/><span>Names: {current.browsers.join(', ')}. Matches the named version and older versions.</span></label>}
  </fieldset>})}
  <p className="muted">Preview reports missing transport evidence separately. Client addresses are not retained, so historical IP matches are unavailable. Message patterns use literal text and *; domain patterns use example.com or *.example.com. Existing exact browser origins remain allowed.</p>
  <div className="button-row"><button className="text-button" disabled={busy} onClick={previewPolicy}>Preview retained events</button><button className="primary-button" disabled={busy||!preview||preview.policy!==JSON.stringify(draft)} onClick={()=>void run(async()=>{await request(root,'PUT',{revision:current.revision,policy:draft});await load();setPreview(null);setStatus('Inbound filters saved. Later intake uses this policy.');})}>Save inbound filters</button><button className="text-button" disabled={busy} onClick={()=>void run(async()=>{await load();setPreview(null);setStatus('Filter policy and usage refreshed')})}>Refresh filters and usage</button></div>
  {status&&<p role="status">{status}</p>}
 </section>;
}
