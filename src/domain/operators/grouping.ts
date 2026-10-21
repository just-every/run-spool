import { revisionGuards } from '../proposals/lifecycle';
import { Hono } from 'hono';
import { hash, normalize } from '../privacy';
import { admissionBasis, type GroupingRoute } from '../bundle-grouping';
import { authorize, body, s, guard, audit, write, conflict } from './common';
import { correctionHeadlines } from './headlines';
import { shortIdCorrection } from '../short-ids/corrections';
const routes=new Hono<any>();
type Move={event:string;occurrence:string;from:string;to:string};
type Snapshot={id:string;revision:number;count:number;after:number};
type Plan={version:1;project:string;kind:'split'|'merge';moves:Move[];issues:Snapshot[];target:string;fingerprint:string|null};
const revision=(db:D1Database,project:string,item:Snapshot,undo=false)=>guard(db,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=? AND count=?)',project,item.id,item.revision+(undo?1:0),undo?item.after:item.count);
routes.get('/:project/corrections',async c=>{const auth=await authorize(c);if('response' in auth)return auth.response;return c.json((await s(c.env.DB,'SELECT * FROM grouping_corrections WHERE project=? ORDER BY created DESC,id',c.req.param('project')).all()).results.map((row:any)=>({...row,plan:JSON.parse(row.plan)})))});
export async function previewCorrection(db:D1Database,project:string,b:any,id:string=crypto.randomUUID()){

 if(!['split','merge'].includes(b.kind)||typeof b.source!=='string'||!Number.isSafeInteger(b.revision))throw new Error('Invalid correction');
 const source=await s(db,'SELECT * FROM issues WHERE project=? AND id=?',project,b.source).first<any>();
 if(!source)throw new Error('Issue not found');
 if(source.revision!==b.revision)throw new Error('Revision conflict');
 if(!['js-frame-v1','python-frame-v1','go-frame-v1','sentry-chain-v1'].includes(source.algorithm))throw new Error('Imported history cannot be regrouped with live capture');
 const fingerprint=b.kind==='split'?await hash('operator-split:'+id):null,target=b.kind==='split'?await hash(project+':'+fingerprint):b.target;
 if(typeof target!=='string'||target===source.id)throw new Error('Choose a different target');
 const destination=b.kind==='merge'?await s(db,'SELECT * FROM issues WHERE project=? AND id=?',project,target).first<any>():null;
 if(b.kind==='merge'&&(!destination||!['js-frame-v1','python-frame-v1','go-frame-v1','sentry-chain-v1'].includes(destination.algorithm)))throw new Error('Target must be a live capture issue in this project');
 if(b.kind==='merge'&&destination.revision!==b.targetRevision)throw new Error('Target revision conflict');
 const all=(await s(db,'SELECT id,occurrence,issue,historical FROM events WHERE project=? AND issue=? ORDER BY id LIMIT 201',project,source.id).all<any>()).results;
 const selected=b.kind==='split'?b.events:null;
 if(b.kind==='split'&&(!Array.isArray(selected)||!selected.length||selected.length>200||new Set(selected).size!==selected.length||selected.some((v:any)=>typeof v!=='string')))throw new Error('Select 1 to 200 distinct retained event IDs');
 // A split can select a bounded subset even when its source has more than 200 events.
 const rows=b.kind==='split'?(await s(db,'SELECT id,occurrence,issue,historical FROM events WHERE project=? AND issue=? AND id IN (SELECT value FROM json_each(?)) ORDER BY id',project,source.id,JSON.stringify(selected)).all<any>()).results:all;
 if(!rows.length||rows.length>200||rows.some((e:any)=>e.historical)||selected&&rows.length!==selected.length)throw new Error('Correction requires 1 to 200 retained live occurrences');
 const moves=rows.map((e:any)=>({event:e.id,occurrence:e.occurrence,from:source.id,to:target}));
 const issues=[{id:source.id,revision:source.revision,count:source.count,after:source.count-moves.length},...(destination?[{id:destination.id,revision:destination.revision,count:destination.count,after:destination.count+moves.length}]:[])];
 const plan:Plan={version:1,project,kind:b.kind,moves,issues,target,fingerprint};
 return {id,state:'preview',plan,newIssue:destination?null:{id:target,before:0,after:moves.length},behavior:'Stored occurrences only; future capture uses the original algorithm. Apply explicitly.'};
}
routes.post('/:project/corrections/preview',async c=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;
 const db=c.env.DB,project=c.req.param('project'),b=await body(c);
 let preview;try{preview=await previewCorrection(db,project,b)}catch(e){if(/revision conflict/i.test(String(e)))return c.json({error:(e as Error).message},409);throw e}
 const {id,plan}=preview;
 try{await write(c,auth.session,[...plan.issues.map(i=>revision(db,project,i)),s(db,"UPDATE grouping_proposals SET state='stale',correction=NULL,updated=? WHERE project=? AND correction IN (SELECT id FROM grouping_corrections WHERE project=? AND state='preview')",Date.now(),project,project),s(db,"DELETE FROM grouping_corrections WHERE project=? AND state='preview'",project),s(db,"INSERT INTO grouping_corrections VALUES(?,?,?,'preview',?,?,?)",id,project,b.kind,JSON.stringify(plan),Date.now(),Date.now())]);return c.json(preview,201)}catch(e){return conflict(c,e)}
});

routes.post('/:project/corrections/:id/:action',async c=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;const b=await body(c);if(b.confirm!==true)throw new Error('Explicit confirmation required');
 const db=c.env.DB,project=c.req.param('project'),id=c.req.param('id'),action=c.req.param('action'),undo=action==='undo';if(!['apply','undo'].includes(action))return c.notFound();
 const row=await s(db,'SELECT * FROM grouping_corrections WHERE project=? AND id=?',project,id).first<any>();if(!row)return c.json({error:'Preview not found'},404);
 if(row.state!==(undo?'applied':'preview'))return c.json({error:'Correction state conflict'},409);
 const p:Plan=JSON.parse(row.plan),jobs=[guard(db,'EXISTS(SELECT 1 FROM grouping_corrections WHERE project=? AND id=? AND state=?)',project,id,row.state),...p.issues.map(i=>revision(db,project,i,undo))];
 const proposal=await s(db,"SELECT revisions FROM grouping_proposals WHERE project=? AND correction=? AND state=?",project,id,undo?'applied':'approved').first<any>();
 if(proposal)jobs.push(...revisionGuards(db,project,JSON.parse(proposal.revisions).map((r:any)=>({...r,revision:r.revision+(undo&&(p.issues.some(i=>i.id===r.id)||p.kind==='split'&&p.target===r.id)?1:0)}))));
 if(p.kind==='split'){
  if(undo)jobs.push(guard(db,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=1 AND count=?)',project,p.target,p.moves.length));
  else jobs.push(s(db,"INSERT INTO issues(id,project,fingerprint,algorithm,title,state,revision,count,first_seen,last_seen,latest_release_seq) SELECT ?,project,?,algorithm,title,'open',0,0,first_seen,last_seen,latest_release_seq FROM issues WHERE project=? AND id=?",p.target,p.fingerprint,project,p.issues[0].id));
 }
 const originalBasis=new Map<string,string>();
 if(!undo){
  const routes=(await s(db,'SELECT * FROM grouping_routes WHERE project=?',project).all<GroupingRoute>()).results;
  const bases=await Promise.all(p.moves.map(async move=>{
   const event=await s(db,'SELECT e.payload,i.id,i.fingerprint FROM events e JOIN issues i ON i.id=e.issue WHERE e.project=? AND e.id=? AND e.occurrence=?',project,move.event,move.occurrence).first<any>();
   if(!event)throw new Error('Correction occurrence no longer retained');
   return [move.occurrence,await admissionBasis(normalize(JSON.parse(event.payload)),event,routes)] as const;
  }));
  for(const [occurrence,basis] of bases)originalBasis.set(occurrence,basis);
 }
 for(const move of p.moves){
  jobs.push(guard(db,'EXISTS(SELECT 1 FROM events WHERE project=? AND id=? AND occurrence=? AND issue=? AND historical=0)',project,move.event,move.occurrence,undo?move.to:move.from));
  if(undo)jobs.push(guard(db,"EXISTS(SELECT 1 FROM event_grouping WHERE project=? AND event=? AND occurrence=? AND correction=? AND direction='apply')",project,move.event,move.occurrence,id));
  else jobs.push(s(db,`INSERT INTO event_grouping(project,event,occurrence,original_issue,algorithm,basis,fingerprint,correction,direction) SELECT e.project,e.id,e.occurrence,i.id,i.algorithm,?,i.fingerprint,?,'apply' FROM events e JOIN issues i ON i.id=e.issue WHERE e.project=? AND e.id=? AND e.occurrence=? ON CONFLICT(project,event,occurrence) DO NOTHING`,originalBasis.get(move.occurrence),id,project,move.event,move.occurrence));
  jobs.push(s(db,'UPDATE events SET issue=? WHERE project=? AND id=? AND occurrence=?',undo?move.from:move.to,project,move.event,move.occurrence),s(db,'UPDATE event_grouping SET correction=?,direction=? WHERE project=? AND event=? AND occurrence=?',id,undo?'undo':'apply',project,move.event,move.occurrence));
 }
 const affected=[...p.issues.map(i=>i.id),...(p.kind==='split'?[p.target]:[])],headlines=await correctionHeadlines(db,project,affected,p.moves,undo);
 for(const issue of affected)jobs.push(s(db,`UPDATE issues SET title=?,count=(SELECT COUNT(*) FROM events WHERE project=? AND issue=?),first_seen=COALESCE((SELECT MIN(received) FROM events WHERE project=? AND issue=?),first_seen),last_seen=COALESCE((SELECT MAX(received) FROM events WHERE project=? AND issue=?),last_seen),latest_release_seq=MAX(COALESCE(latest_release_seq,0),COALESCE((SELECT MAX(release_seq) FROM events WHERE project=? AND issue=?),0)),revision=revision+1 WHERE project=? AND id=?`,headlines.get(issue),project,issue,project,issue,project,issue,project,issue,project,issue));
 jobs.push(...shortIdCorrection(db,project,id,p,undo,Date.now()));
 jobs.push(s(db,"UPDATE grouping_proposals SET state=?,updated=? WHERE project=? AND correction=? AND state=?",undo?'undone':'applied',Date.now(),project,id,undo?'applied':'approved'));
 jobs.push(s(db,'UPDATE grouping_corrections SET state=?,updated=? WHERE project=? AND id=?',undo?'undone':'applied',Date.now(),project,id),audit(db,project,undo?'grouping_undone':'grouping_applied',{correction:id}));
 try{await write(c,auth.session,jobs);return c.json({id,state:undo?'undone':'applied',moves:p.moves})}catch(e){return conflict(c,e)}
});
export default routes;
