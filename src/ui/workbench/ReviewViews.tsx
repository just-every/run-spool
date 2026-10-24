import {useEffect,useState} from 'react';
import {api} from './client';
type Query={q:string;status:string;release:string;sort:string};
export function ReviewViews({project,query,onChoose}:{project:string;query:Query;onChoose:(query:Query)=>void}){
 const [views,setViews]=useState<any[]>([]),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const path=`/api/projects/${encodeURIComponent(project)}/review/views`;
 async function load(){setViews((await api(path)).views)}
 useEffect(()=>{setSelected('');void load().catch(e=>setError(e.message))},[project]);
 async function act(work:()=>Promise<unknown>){setBusy(true);setError('');try{await work();await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div aria-label="Saved issue views"><div className="issue-search-actions"><label className="form-field">Saved views<select aria-label="Saved views" value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);const view=views.find(v=>v.id===e.target.value);if(view)onChoose(view.query)}}><option value="">Choose a saved query ({views.length}/25)</option>{views.map(v=><option key={v.id} value={v.id}>{[v.query.q||'All issues',v.query.status,v.query.release,v.query.sort].join(' · ')}</option>)}</select></label><button className="text-button" disabled={busy||views.length>=25} onClick={()=>void act(async()=>{const view=await api(path,'POST',query);setSelected(view.id)})}>Save current view</button><button className="text-button" disabled={busy||!selected} onClick={()=>void act(async()=>{await api(path+'/'+selected,'DELETE');setSelected('')})}>Delete saved view</button></div>{error&&<p role="alert">{error}</p>}</div>
}
