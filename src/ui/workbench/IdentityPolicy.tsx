import {useEffect,useState} from 'react';
import {SectionHead} from './SectionHead';
import {useAutoPreview} from './useAutoPreview';
import type {Request,Run} from './shared';
const fields=['id','email','username','ip_address'];
/** A stricter identity choice converts retained values and cannot be undone, so a change previews itself and asks
 * once, under the fields. */
export function IdentityPolicy({project,request,run,busy}:{project:string;request:Request;run:Run;busy:boolean}){
 const [current,setCurrent]=useState<any>(null),[draft,setDraft]=useState<any>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');const root=`/api/projects/${encodeURIComponent(project)}/identity-policy`;
 useEffect(()=>{let live=true;request(root).then(v=>{if(live){setCurrent(v);setDraft(v.policy)}}).catch(e=>live&&setError(e.message));return()=>{live=false}},[root,request]);
 const changed=!!current&&!!draft&&JSON.stringify(draft)!==JSON.stringify(current.policy);
 const auto=useAutoPreview(draft,changed,policy=>request(root+'/preview','POST',{policy})),preview=auto.preview;
 const act=(work:()=>Promise<void>)=>void run(async()=>{setError('');try{await work()}catch(e){setError((e as Error).message)}});
 return <section className="evidence" aria-label="User identity policy"><SectionHead title="User identity policy" about={<><p>These four Sentry user fields default to drop. Keep retains the selected identity in this installation for owner reads and private archives. Hash retains only a keyed project hash. Other user fields remain dropped. Existing values convert only toward stricter storage; a later keep choice cannot recover dropped values.</p>{current&&<p>{current.address} Session DID stays keyed-hash-only under SDK-005; field-specific session policy, user search, member roles and end-user erasure remain unavailable. Agent packets and read-only grants receive counts only.</p>}</>}/>{error&&<p role="alert">{error}</p>}{!draft?<p>Loading identity policy…</p>:<><div className="form-grid">{fields.map(f=><label className="form-field" key={f}>User {f}<select aria-label={'User '+f} disabled={busy} value={draft[f]} onChange={e=>{setDraft({...draft,[f]:e.target.value});setNotice('')}}>{['drop','hash','keep'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>)}</div>
  {changed&&<div className="confirm-line">{auto.pending&&<p role="status">Previewing the conversion…</p>}{auto.error&&<p role="alert">{auto.error}</p>}{preview&&<><div className="callout"><h3>Identity conversion preview</h3><p>{preview.events} retained Sentry events · {preview.records} identity records · {preview.converted} converted · affected users after: {preview.affectedUsers??'unavailable'} · {preview.unattributed} unattributed.</p><p>{preview.savedSearches}</p><ul>{fields.map(f=><li key={f}>{f}: {preview.fields[f]} records become stricter</li>)}</ul></div><button className="primary-button" disabled={busy} onClick={()=>act(async()=>{const result=await request(root,'PUT',{policy:draft,revision:current.revision,token:preview.token});setCurrent({...current,...result});setDraft(result.policy);setNotice('Identity policy saved. Stricter conversion completed; later intake uses this policy.')})}>Save identity policy</button></>}</div>}
  {notice&&<p role="status">{notice}</p>}</>}
 </section>;
}
