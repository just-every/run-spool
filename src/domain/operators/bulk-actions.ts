import {canonical, hash} from '../privacy';
import {canWrite, mentions, mentionFence, activity} from '../discussion/model';
import {ownerIssue} from '../stored-text';
import {s, guard, audit, write, conflict} from './common';
import {previewCorrection, applyCorrection, type Plan} from './grouping';

/** Assignment uses the existing safe member alias, never a copied identity.
 * Restoring a label cannot restore membership, grants or notification delivery. */
export async function bulkAction(c:any,session:any,input:any) {
 if(!canWrite(session))return c.json({error:'Project not found'},404);
 const project=c.req.param('project'),db=c.env.DB,merge=input.action==='merge';
 const allowed=merge?['action','issues','target','apply','preview']:['action','issues','member','apply','preview'];
 if(Object.keys(input).some(key=>!allowed.includes(key))||!Array.isArray(input.issues)||input.issues.length<(merge?2:1)||input.issues.length>100||typeof input.apply!=='boolean')throw new Error('Select current issues and preview the action');
 const seen=new Set<string>(),rows:any[]=[];
 for(const selected of input.issues){
  if(!selected||Object.keys(selected).sort().join()!=='id,revision'||typeof selected.id!=='string'||selected.id.length>100||!Number.isSafeInteger(selected.revision)||selected.revision<1||seen.has(selected.id))throw new Error('Unique issue IDs and revisions required');
  seen.add(selected.id);
  const row=await s(db,'SELECT * FROM issues WHERE project=? AND id=?',project,selected.id).first<any>();
  if(!row||row.revision!==selected.revision)return c.json({error:'Selection changed; refresh and preview again'},409);
  rows.push(row);
 }
 rows.sort((a,b)=>a.id.localeCompare(b.id));
 if(merge){
  const target=rows.find(row=>row.id===input.target);
  if(!target)throw new Error('Choose a target from the selection');
  if(input.apply){
   if(typeof input.preview!=='string')throw new Error('Preview the merge first');
   const saved=await s(db,"SELECT plan FROM grouping_corrections WHERE project=? AND id=? AND kind='merge' AND state='preview'",project,input.preview).first<{plan:string}>();
   if(!saved)return c.json({error:'Merge preview changed; preview again'},409);
   const plan:Plan=JSON.parse(saved.plan);
   if(plan.target!==target.id||canonical(plan.issues.map(({id,revision})=>({id,revision})).sort((a,b)=>a.id.localeCompare(b.id)))!==canonical(rows.map(({id,revision})=>({id,revision}))))return c.json({error:'Merge selection changed; preview again'},409);
   const response=await applyCorrection(c,session,project,input.preview,'apply',{confirm:true});
   if(!response.ok)return response;
   return c.json({changed:rows.length,state:'merged',correction:input.preview});
  }
  const previews=await Promise.all(rows.filter(row=>row!==target).map(source=>previewCorrection(db,project,{kind:'merge',source:source.id,revision:source.revision,target:target.id,targetRevision:target.revision})));
  const moves=previews.flatMap(preview=>preview.plan.moves);
  if(moves.length>200)throw new Error('Merge at most 200 retained events at once');
  const plan:Plan={version:1,project,kind:'merge',moves,issues:rows.map(row=>({id:row.id,revision:row.revision,count:row.count,after:row===target?row.count+moves.length:row.count-moves.filter(move=>move.from===row.id).length})),target:target.id,fingerprint:null};
  const id=crypto.randomUUID(),time=Date.now();
  try{
   await write(c,session,[...rows.map(row=>guard(db,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=? AND count=?)',project,row.id,row.revision,row.count)),
    s(db,"UPDATE grouping_proposals SET state='stale',correction=NULL,updated=? WHERE project=? AND correction IN (SELECT id FROM grouping_corrections WHERE project=? AND state='preview')",time,project,project),
    s(db,"DELETE FROM grouping_corrections WHERE project=? AND state='preview'",project),
    s(db,"INSERT INTO grouping_corrections VALUES(?,?,'merge','preview',?,?,?)",id,project,JSON.stringify(plan),time,time)]);
   return c.json({preview:id,state:'merged',issues:rows.map(row=>({id:row.id,title:ownerIssue(row).title,state:row.state})),target:ownerIssue(target).title,plan});
  }catch(error){return conflict(c,error)}
 }
 if(input.member!==null&&(typeof input.member!=='string'||!/^@?[A-Za-z0-9][A-Za-z0-9._+\-]*$/.test(input.member)||input.member.length>80))throw new Error('Use an accessible project member handle or clear the assignment');
 const candidates=input.member===null?[]:await mentions(db,project,'@'+input.member.replace(/^@/,''));
 if(input.member!==null&&candidates.length!==1)return c.json({error:'Choose an active project member'},400);
 const member=candidates[0],label=member?.alias??null;
 const preview=await hash(canonical({project,action:'assign',issues:rows.map(({id,revision})=>({id,revision})),member:member?{id:member.id,version:member.version,label}:null}));
 if(!input.apply)return c.json({preview,state:'assigned',issues:rows.map(row=>({id:row.id,title:ownerIssue(row).title,state:row.state})),member:input.member});
 if(input.preview!==preview)return c.json({error:'Assignment preview changed; preview again'},409);
 const time=Date.now();
 try{
  await write(c,session,[...rows.map(row=>guard(db,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=?)',project,row.id,row.revision)),...member?[mentionFence(db,project,member)]:[],
   ...rows.flatMap(row=>[s(db,'UPDATE issues SET revision=revision+1 WHERE project=? AND id=?',project,row.id),
    s(db,'INSERT INTO issue_assignments VALUES(?,?,?,?) ON CONFLICT(issue) DO UPDATE SET label=excluded.label,updated=excluded.updated',project,row.id,label,time),
    audit(db,project,'issue_assigned',{issue:row.id,label,revision:row.revision+1}),activity(db,project,row.id,'assignment',{assignee:label},time)])]);
  return c.json({changed:rows.length,state:'assigned'});
 }catch(error){return conflict(c,error)}
}
