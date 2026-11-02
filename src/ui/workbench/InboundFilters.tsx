import {useEffect,useState} from 'react';
import type {Request,Run} from './shared';
import {useSettingDoc} from './useSettingDoc';
import {SaveAnnouncer,SaveFailure,SavedMark} from './SaveMarks';
import './inbound-filters.css';

const lines=(text:string)=>text.split('\n').filter(Boolean).join('\n');
const browserRules=(text:string)=>text.split('\n').filter(Boolean).map(line=>{const [name,maxVersion='']=line.split('<=');return{name,maxVersion}});
const browserText=(rules:{name:string;maxVersion:string}[])=>rules.map(r=>`${r.name}<=${r.maxVersion}`).join('\n');
// A list keeps its typed text (a new line in progress included); it takes a value from outside only when that value differs from what is typed.
function PatternInput({value,disabled,placeholder,normalize,onChange,onBlur}:{value:string;disabled:boolean;placeholder?:string;normalize:(text:string)=>string;onChange:(text:string)=>void;onBlur:()=>void}){
 const [text,setText]=useState(value);
 useEffect(()=>{setText(current=>normalize(current)===value?current:value)},[value]);
 return <textarea value={text} rows={3} disabled={disabled} placeholder={placeholder} onBlur={onBlur} onChange={e=>{setText(e.target.value);onChange(e.target.value)}}/>;
}

// Filters save as you go: a toggle at once, a list on blur or after a pause. Preview stays as an optional check.
export function InboundFilters({project,request,run,busy}:{project:string;request:Request;run:Run;busy:boolean}) {
 const [preview,setPreview]=useState<any>(null),[status,setStatus]=useState(''),[problem,setProblem]=useState('');
 const root=`/api/projects/${encodeURIComponent(project)}/inbound-filters`;
 const doc=useSettingDoc<any,any>({
  key:`filters:${project}`,
  read:async()=>{const [policy,outcomes]=await Promise.all([request(root),request(`/api/projects/${encodeURIComponent(project)}/outcomes`)]);return {policy,usage:outcomes.rows}},
  draftOf:data=>structuredClone(data.policy.policy),
  write:async(data,policy,keepalive)=>{const saved=await request(root,'PUT',{revision:data.policy.revision,policy},{keepalive});return {...data,policy:{...data.policy,revision:saved.revision,policy:saved.policy}}},
 });
 const draft=doc.draft,current=doc.data?.policy,usage:any[]=doc.data?.usage??[];
 const change=(id:string,patch:any,now:boolean)=>{setPreview(null);setStatus('');doc.edit({...draft,filters:{...draft.filters,[id]:{...draft.filters[id],...patch}}},{field:now?id:`${id}:list`,now})};
 const previewPolicy=()=>void run(async()=>{setProblem('');setStatus('Previewing retained events…');const counts:any={};let after='',scanned=0,next;try{do{const page=await request(root+'/preview','POST',{policy:draft,after,limit:500});scanned+=page.scanned;for(const [id,row] of Object.entries<any>(page.counts)){counts[id]??={matches:0,unavailable:0};counts[id].matches+=row.matches;counts[id].unavailable+=row.unavailable}next=page.next;after=next??''}while(next);setPreview({counts,scanned});setStatus(`Preview complete · ${scanned} retained events. Existing evidence will stay unchanged.`)}catch(e){setStatus('');setProblem((e as Error).message)}});
 if(doc.loadError)return <section className="evidence"><h2>Inbound filters and usage</h2><p role="alert">Filters could not be loaded: {doc.loadError}</p><button className="text-button" onClick={doc.reload}>Retry filters</button></section>;
 if(!draft||!current)return <section className="evidence"><h2>Inbound filters and usage</h2><p role="status">Loading project filters…</p></section>;
 const total=(reason:string)=>usage.find(row=>row.reason===reason)?.count??0;
 return <section className="evidence inbound-filters" aria-labelledby="inbound-filters-heading">
  <h2 id="inbound-filters-heading">Inbound filters and usage</h2>
  <p>Filter unwanted errors on the server before issues, alerts and accepted usage. Changes save as you make them and apply to later intake; preview them against retained events first if you like. No SDK redeploy is needed.</p>
  <p>New-project defaults: {current.defaultOnFilters.map((id:string)=>current.filters.find((f:any)=>f.id===id)?.label).join(', ')}. Each can be turned off.</p>
  <p className="muted">Last 24 hours · {total('accepted')} accepted · {total('filtered')} filtered. Per-filter matches can overlap; filtered events never enter accepted usage.</p>
  <p>{current.patternSyntax}</p>
  <details><summary>Filters by accepted category and unavailable fields</summary>{Object.entries<string>(current.categoryFilterCoverage).map(([category,description])=><p key={category}><strong>{category}</strong>: {description}</p>)}</details>
  {current.filters.map((filter:any)=>{const value=draft.filters[filter.id],list='values' in value;return <fieldset key={filter.id} className="filter-policy"><legend>{filter.label}</legend>
   <label className="checkbox"><input type="checkbox" checked={value.enabled} onChange={e=>change(filter.id,{enabled:e.target.checked},true)}/> {filter.toggleLabel}<SavedMark doc={doc} field={filter.id}/></label><SaveFailure doc={doc} field={filter.id}/>
   <p className="muted">{filter.recentMatches} recent matches{preview?` · Preview: ${preview.counts[filter.id]?.matches??0} matches; ${preview.counts[filter.id]?.unavailable??0} with unavailable evidence`:''}</p>
   {list&&<label className="form-field"><span>{filter.label} · one per line<SavedMark doc={doc} field={`${filter.id}:list`}/></span><PatternInput normalize={lines} value={value.values.join('\n')} disabled={busy} onBlur={doc.flush} onChange={text=>change(filter.id,{values:text.split('\n').filter(Boolean)},false)}/></label>}
   {filter.id==='legacy_browsers'&&<label className="form-field"><span>Legacy browser rules · name&lt;=version, one per line<SavedMark doc={doc} field={`${filter.id}:list`}/></span><PatternInput normalize={text=>browserText(browserRules(text))} disabled={busy} placeholder="chrome<=100" value={browserText(value.browsers)} onBlur={doc.flush} onChange={text=>change(filter.id,{browsers:browserRules(text)},false)}/><span>Names: {current.browsers.join(', ')}. Matches the named version and older versions.</span></label>}
   <SaveFailure doc={doc} field={`${filter.id}:list`}/>
  </fieldset>})}
  <p className="muted">Preview reports missing transport evidence separately. Client addresses are not retained, so historical IP matches are unavailable. Message patterns use literal text and *; domain patterns use example.com or *.example.com. Existing exact browser origins remain allowed.</p>
  <div className="button-row"><button className="text-button" disabled={busy} onClick={previewPolicy}>Preview retained events</button></div>
  {problem&&<p role="alert">{problem}</p>}{status&&<p role="status">{status}</p>}<SaveAnnouncer doc={doc}/>
 </section>;
}
