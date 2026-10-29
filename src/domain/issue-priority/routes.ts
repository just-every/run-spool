import {Hono} from 'hono';
import {authorize,body,s,guard,write,conflict} from '../operators/common';
import {auditCommit,currentAuditScope} from '../audit';
import {priorities,prioritySql} from './model';
import {memberStateSql} from '../lifecycle/member-state';

const routes=new Hono<any>();
const versionSql=`json_array(${memberStateSql('i')},
 (SELECT manual FROM issue_priorities p WHERE p.project=i.project AND p.issue=i.id),
 (SELECT COUNT(*) FROM issue_activity a WHERE a.project=i.project AND a.issue=i.id AND a.kind='priority'))`;
const snapshot=(db:D1Database,project:string,issue:string)=>s(db,`SELECT i.revision,${prioritySql('i')} priority,${versionSql} version FROM issues i WHERE i.project=? AND i.id=?`,project,issue).first<any>();
routes.get('/:project/issues/:issue/priority',async c=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;
 const row=await snapshot(c.env.DB,c.req.param('project'),c.req.param('issue'));
 c.header('Cache-Control','no-store');
 return row?c.json(row):c.json({error:'Issue not found'},404);
});
routes.put('/:project/issues/:issue/priority',async c=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;
 const project=c.req.param('project'),issue=c.req.param('issue'),b=await body(c);
 if(!b||Object.keys(b).sort().join()!=='priority,version'||!priorities.includes(b.priority)||typeof b.version!=='string'||b.version.length>2048)throw new Error('Invalid priority');
 const row=await snapshot(c.env.DB,project,issue);
 if(!row)return c.json({error:'Issue not found'},404);
 if(row.version!==b.version)return c.json({error:'Revision conflict'},409);
 const actor=currentAuditScope().actor;
 try{
  await write(c,auth.session,[
   guard(c.env.DB,`EXISTS(SELECT 1 FROM issues i WHERE i.project=? AND i.id=? AND ${versionSql}=?)`,project,issue,b.version),
   s(c.env.DB,'UPDATE issue_priorities SET manual=? WHERE project=? AND issue=?',b.priority,project,issue),
   s(c.env.DB,'UPDATE issues SET revision=revision+1 WHERE project=? AND id=?',project,issue),
   s(c.env.DB,'INSERT INTO issue_activity VALUES(?,?,?,?,?,?,?,?)',crypto.randomUUID(),project,issue,'priority',actor.kind,actor.label,JSON.stringify({priority:b.priority,manual:true}),Date.now()),auditCommit(c.env.DB)
  ]);
  return c.json(await snapshot(c.env.DB,project,issue));
 }catch(error){return conflict(c,error)}
});
export default routes;
