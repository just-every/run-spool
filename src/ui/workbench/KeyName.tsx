import { useState } from 'react';
import { Field, type Request, type Run } from './shared';
export function KeyName({project,value,request,run,busy,refresh}:{project:string;value:any;request:Request;run:Run;busy:boolean;refresh:()=>void}) {
 const [name,setName]=useState(value.name??'');
 return <form className="form-grid" onSubmit={event=>{event.preventDefault();void run(async()=>{await request(`/api/projects/${project}/keys/${value.hash}`,'PUT',{name});refresh();});}}>
  <Field label="Key name" value={name} maxLength={100} placeholder="Production site" disabled={busy} onChange={event=>setName(event.target.value)}/>
  <button className="text-button" disabled={busy||name===(value.name??'')}>Save key name</button>
 </form>;
}
