import {useEffect,useState} from 'react';
import {api} from './client';

export function ResolutionPicker({project,value,release,disabled,onChange,label='Resolution'}:{project:string;value:string;release:string;disabled:boolean;onChange:(mode:string,release:string)=>void;label?:string}){
 const [releases,setReleases]=useState<string[]>([]),[error,setError]=useState('');
 useEffect(()=>{let live=true;if(value==='named')api(`/api/projects/${encodeURIComponent(project)}/releases`).then(rows=>{if(live){setReleases(rows.map((row:any)=>row.name));setError('')}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[project,value]);
 return <><label className="form-field">{label}<select aria-label={label} value={value} disabled={disabled} onChange={e=>onChange(e.target.value,'')}><option value="plain">Plain · next accepted event</option><option value="current">In current release</option><option value="next">In next release</option><option value="named">In a named release</option></select></label>{value==='named'&&<label className="form-field">{label} release<select aria-label={`${label} release`} value={release} disabled={disabled} onChange={e=>onChange(value,e.target.value)}><option value="">Choose a release</option>{releases.map(name=><option key={name} value={name}>{name}</option>)}</select></label>}{error&&<p role="alert">Release choices unavailable: {error}</p>}</>;
}
