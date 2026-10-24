import {canonical,hash} from '../privacy';
import {latestReviewAlert} from './model';
import {s,guard,audit,write,conflict} from '../operators/common';
import {ownerIssue} from '../stored-text';
export async function reviewBulk(c:any,session:any,input:any){
 const project=c.req.param('project'),db=c.env.DB;
 if(Object.keys(input).some(k=>!['action','issues','apply','preview'].includes(k))||!Array.isArray(input.issues)||!input.issues.length||input.issues.length>100||typeof input.apply!=='boolean')throw new Error('Select 1 to 100 issues for review');
 const seen=new Set(),rows:any[]=[];
 for(const selected of input.issues){
  if(!selected||Object.keys(selected).sort().join()!=='id,revision'||typeof selected.id!=='string'||selected.id.length>100||seen.has(selected.id)||!Number.isSafeInteger(selected.revision)||selected.revision<1)throw new Error('Unique issue IDs and revisions required');seen.add(selected.id);
  const row=await s(db,`SELECT i.*,${latestReviewAlert('i')} alert,(SELECT generation FROM review_stamps WHERE project=i.project AND issue=i.id) stamp,(SELECT alert FROM review_stamps WHERE project=i.project AND issue=i.id) reviewed_alert FROM issues i WHERE project=? AND id=?`,project,selected.id).first();
  if(!row||row.revision!==selected.revision)return c.json({error:'Selection changed; preview again'},409);rows.push(row);
 }
 rows.sort((a,b)=>a.id.localeCompare(b.id));const snapshot=rows.map(({id,revision,count,last_seen,state,alert,stamp})=>({id,revision,count,last_seen,state,alert,stamp})),preview=await hash(canonical({project,action:'reviewed',issues:snapshot}));
 if(!input.apply)return c.json({preview,state:'reviewed',issues:rows.map(row=>({id:row.id,title:ownerIssue(row).title,state:row.state,revision:row.revision,count:row.count,pending:!!row.alert&&row.alert!==row.reviewed_alert}))});
 if(input.preview!==preview)return c.json({error:'Review preview changed; preview again'},409);
 try{
  const jobs=rows.map(row=>guard(db,`EXISTS(SELECT 1 FROM issues i WHERE project=? AND id=? AND revision=? AND count=? AND last_seen=? AND state=? AND ${latestReviewAlert('i')} IS ? AND (SELECT generation FROM review_stamps WHERE project=i.project AND issue=i.id) IS ?)`,project,row.id,row.revision,row.count,row.last_seen,row.state,row.alert,row.stamp));
  const changed=rows.filter(row=>row.alert&&row.alert!==row.reviewed_alert);
  for(const row of changed)jobs.push(s(db,'INSERT INTO review_stamps VALUES(?,?,?,?,?) ON CONFLICT(project,issue) DO UPDATE SET generation=excluded.generation,alert=excluded.alert,reviewed=excluded.reviewed',project,row.id,crypto.randomUUID(),row.alert,Date.now()));
  if(changed.length)jobs.push(audit(db,project,'issues_reviewed',{count:changed.length}));await write(c,session,jobs);return c.json({changed:changed.length,state:'reviewed'});
 }catch(error){return conflict(c,error)}
}
