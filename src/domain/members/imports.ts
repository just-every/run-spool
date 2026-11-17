import { Hono } from 'hono';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import { ownerBatch } from '../owner-authority';
import { auditCommit } from '../audit/context';
import { jsonBody } from '../owner-router';
import { fields, version, check } from './input';
import { invite } from './mutations';
import { s } from './model';
import { ownershipPreview } from './import-model';

// Mounted behind memberRoutes' session, same-origin and administrator checks.
// Private originals and source role review remain installation-owner only.
export const importedMembers=new Hono<any>();
importedMembers.use('*',async(c,next)=>{
 if(c.get('teamSession').operator.role!=='owner')return c.json({error:'Project not found'},404);
 await next();
});
importedMembers.get('/',async c=>{
 const rows=(await s(c.env.DB,'SELECT * FROM spool_import_proposals ORDER BY created,id').all()).results;
 return c.json({proposals:rows.map((row:any)=>({...row,payload:JSON.parse(row.payload)}))});
});
importedMembers.post('/:id/preview',async c=>{
 const input=await jsonBody(c.req.raw,32768);fields(input,['version','samples']);const expected=version(input.version);
 if(!Array.isArray(input.samples)||input.samples.length>50||input.samples.some((row:any)=>!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(key=>!['path','url','tags.environment'].includes(key))||Object.values(row).some(value=>typeof value!=='string'||value.length>500)))throw new AuthError('Invalid ownership samples',400);
 const row=await s(c.env.DB,"SELECT * FROM spool_import_proposals WHERE id=? AND kind='ownership' AND version=?",c.req.param('id'),expected).first<any>();
 if(!row)return c.json({error:'Ownership proposal changed'},409);
 const payload=JSON.parse(row.payload),preview=ownershipPreview(payload,input.samples);
 const related=(await s(c.env.DB,"SELECT p.kind,p.payload FROM spool_import_proposals p JOIN sentry_import_targets m ON m.kind='import-proposal' AND m.id=p.id JOIN sentry_import_targets own ON own.kind='import-proposal' AND own.id=? WHERE json_extract(m.source,'$.organization')=json_extract(own.source,'$.organization')",row.id).all<any>()).results;
 const members=related.filter(row=>row.kind==='member').map(row=>JSON.parse(row.payload));
 const teams=related.filter(row=>row.kind==='team').map(row=>JSON.parse(row.payload));
 return c.json({...preview,rules:preview.rules.map((rule:any)=>({...rule,owners:rule.owners?.map((owner:any)=>({...owner,resolved:owner.type==='user'?members.some(member=>member.sourceUserId===owner.id):owner.type==='team'&&teams.some(team=>team.sourceId===owner.id)}))})),
  requirement:'Disabled proposal only. A linked repository revision and native ownership authority are required before live routing; no provider consent or notification is imported.'});
});
importedMembers.post('/:id/invite',async c=>{
 const input=await jsonBody(c.req.raw,2048);fields(input,['version']);const expected=version(input.version),db=c.env.DB,session=c.get('teamSession');
 const organization=await s(db,'SELECT id FROM spool_organizations LIMIT 1').first<any>();
 if(!organization)return c.json({error:'Create an organization before authorizing invitations'},409);
 const row=await s(db,"SELECT * FROM spool_import_proposals WHERE id=? AND kind='member' AND state='pending' AND version=?",c.req.param('id'),expected).first<any>();
 if(!row)return c.json({error:'Roster proposal changed'},409);
 const payload=JSON.parse(row.payload);
 // This is a separate explicit human authorization, never called by import.
 // Reservation changes the target before mail can be attempted, fencing undo
 // and catch-up even if the native sender or the final receipt fails.
 await ownerBatch(db,session,[check(db,"EXISTS(SELECT 1 FROM spool_import_proposals WHERE id=? AND state='pending' AND version=?)",row.id,expected),
  ...payload.grants.map((grant:any)=>s(db,"INSERT INTO spool_project_teams(project,organization,team) SELECT id,?,'Imported project' FROM projects WHERE id=? ON CONFLICT(project) DO NOTHING",organization.id,grant.project)),
  s(db,"UPDATE spool_import_proposals SET state='inviting',version=version+1 WHERE id=?",row.id),auditCommit(db)]);
 const result=await invite(c.req.raw,c.env,session,organization.id,{email:payload.email,name:payload.name,role:payload.role,grants:payload.grants});
 await ownerBatch(db,session,[s(db,"UPDATE spool_import_proposals SET state='invited',version=version+1 WHERE id=? AND state='inviting'",row.id),auditCommit(db)]);
 return c.json({...result,proposal:row.id},202);
});
