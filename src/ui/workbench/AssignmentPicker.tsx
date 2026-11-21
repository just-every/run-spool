import { useEffect, useRef, useState } from 'react';
import { type Request, type Run } from './shared';

export function AssignmentPicker({project,issue,request,run,busy,refresh,onSaved,readOnly=false}:{readOnly?:boolean;project:string;issue:any;request:Request;run:Run;busy:boolean;refresh:()=>void;onSaved:(revision:number)=>void}) {
 const [members,setMembers]=useState<{id:string;name:string}[]>([]),[selected,setSelected]=useState(''),[current,setCurrent]=useState('Unassigned'),[ready,setReady]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const edited=useRef(false);
 useEffect(()=>{let live=true;setReady(false);
  Promise.all([request(`/api/projects/${encodeURIComponent(project)}/assignment-members`),request(`/api/projects/${encodeURIComponent(project)}/operator-state`)]).then(([directory,state])=>{
   if(!live)return;setMembers(directory.members);const assignment=state.assignments.find((row:any)=>row.issue===issue.id);
   setCurrent(assignment?.label||'Unassigned');if(!edited.current)setSelected(assignment?.member??'');setReady(true);
  }).catch(failure=>{if(live)setError(failure.message)});return()=>{live=false};
 },[project,issue.id,issue.revision,request]);
 return <form className="assignment-picker" onSubmit={event=>{event.preventDefault();void run(async()=>{setError('');setMessage('');try{
  const saved=await request(`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issue.id)}/assignment`,'PATCH',{member:selected||null,revision:issue.revision});
  edited.current=false;onSaved(saved.revision);setMessage('Assignment saved.');refresh();
 }catch(failure){setError((failure as Error).message)}})}}>
  <p className="issue-assignee">Assigned to <strong>{current}</strong></p>
  {!readOnly&&<div className="button-row"><label className="form-field">Assign to<select aria-label="Assign to" disabled={busy||!ready} value={selected} onChange={event=>{edited.current=true;setSelected(event.target.value);setMessage('');setError('')}}><option value="">Unassigned</option>{selected&&!members.some(row=>row.id===selected)&&<option value={selected}>{current}</option>}{members.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label><button className="primary-button" disabled={busy||!ready}>Assign</button></div>}
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </form>;
}
