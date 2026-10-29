import {useEffect,useState} from 'react';
import {api} from './client';

export function ResolutionPicker({project,value,release,disabled,onChange,label='Resolution',bare=false}:{project:string;value:string;release:string;disabled:boolean;onChange:(mode:string,release:string)=>void;label?:string;bare?:boolean}){
 const [releases,setReleases]=useState<string[]>([]),[error,setError]=useState('');
 useEffect(()=>{let live=true;if(value==='named')api(`/api/projects/${encodeURIComponent(project)}/releases`).then(rows=>{if(live){setReleases(rows.map((row:any)=>row.name));setError('')}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[project,value]);
 const mode=<select className={bare?'value-select':undefined} aria-label={label} value={value} disabled={disabled} onChange={e=>onChange(e.target.value,'')}><option value="plain">Reopens on next event</option><option value="current">In current release</option><option value="next">In next release</option><option value="named">In a named release</option></select>;
 const named=value==='named'&&<select className={bare?'value-select':undefined} aria-label={`${label} release`} value={release} disabled={disabled} onChange={e=>onChange(value,e.target.value)}><option value="">Choose a release</option>{releases.map(name=><option key={name} value={name}>{name}</option>)}</select>;
 if(bare)return <>{mode}{named}{error&&<p role="alert">Release choices unavailable: {error}</p>}</>;
 return <><label className="form-field">{label}{mode}</label>{named&&<label className="form-field">{label} release{named}</label>}{error&&<p role="alert">Release choices unavailable: {error}</p>}</>;
}
