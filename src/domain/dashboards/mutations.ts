import {projectTeamGrantGuard} from '../members/resolver';
import type {OwnerSession} from '../owner-authority';
import {ownerBatch} from '../owner-authority';
import {auditCommit} from '../audit';
import {fail,fields,itemInput,revision,shares,type ItemInput} from './input';
import {savedTableQuery} from './tables';
import {canEdit,guard,itemRevisionGuard,projectGuards,s,type ItemSnapshot,type ProjectSnapshot} from './authority';

function writable(session:OwnerSession,projects:Map<string,ProjectSnapshot>,ids:string[]){
 const selected=ids.map(id=>projects.get(id));
 if(selected.some(project=>!project||!['owner','admin','maintainer'].includes(project.role)))fail('Project not found',404);
 return selected as ProjectSnapshot[];
}
async function definitionStatements(db:D1Database,id:string,input:ItemInput){
 const result:D1PreparedStatement[]=[];
 for(const project of new Set(input.widgets.map(widget=>widget.project)))result.push(s(db,'INSERT INTO spool_reporting_projects(item,project) VALUES(?,?)',id,project));
 for(const [position,widget] of input.widgets.entries()){
  if(input.kind==='dashboard'){
   const group=(widget.config as any).groupBy;
   if(group?.startsWith('tag:')){
    const sql="EXISTS(SELECT 1 FROM events e,json_each(e.payload,'$.sentry.tags') tag WHERE e.project=? AND tag.key=?)";
    if(!await s(db,'SELECT 1 WHERE '+sql,widget.project,group.slice(4)).first())fail('reporting_tag_unavailable: choose a retained tag key',400);
    result.push(guard(db,sql,widget.project,group.slice(4)));
   }
  }
  if(input.kind==='table'){
   const view=await savedTableQuery(db,widget.project,widget.viewId!);
   result.push(guard(db,'EXISTS(SELECT 1 FROM review_views WHERE project=? AND id=? AND generation=? AND query=?)',widget.project,widget.viewId,view.generation,view.serialized));
  }
  result.push(s(db,'INSERT INTO spool_reporting_widgets(item,id,project,position,name,config,view_id) VALUES(?,?,?,?,?,?,?)',id,widget.id,widget.project,position,widget.name,JSON.stringify(widget.config),widget.viewId));
 }
 return result;
}
export async function saveItem(db:D1Database,session:OwnerSession,projects:Map<string,ProjectSnapshot>,body:any,current?:ItemSnapshot){
 const input=itemInput(body,!!current),time=Date.now(),id=current?.row.id??crypto.randomUUID();
 if(current&&(!canEdit(session,current,projects)||input.kind!==current.row.kind))fail('Reporting item not found',404);
 if(current&&revision(body.revision)!==current.row.revision)fail('Reporting revision changed',409);
 const selected=writable(session,projects,[...new Set([...current?.projects??[],...input.widgets.map(widget=>widget.project)])]);
 const organization=current?current.row.organization:session.membership?.organization??(await s(db,'SELECT id FROM spool_organizations ORDER BY created LIMIT 1').first<{id:string}>())?.id??null;
 if(organization!==null&&selected.some(project=>project.organization!==organization))fail('Project not found',404);
 const checks=projectGuards(db,session,selected,true),definitions=await definitionStatements(db,id,input);
 const jobs:D1PreparedStatement[]=[...checks];
 if(organization!==null)jobs.push(guard(db,'EXISTS(SELECT 1 FROM spool_organizations WHERE id=?)',organization));
 if(current)jobs.push(itemRevisionGuard(db,current.row),s(db,'UPDATE spool_reporting_items SET name=?,revision=revision+1,updated=? WHERE id=? AND revision=?',input.name,time,id,current.row.revision),s(db,'DELETE FROM spool_reporting_widgets WHERE item=?',id),s(db,'DELETE FROM spool_reporting_projects WHERE item=?',id));
 else jobs.push(s(db,'INSERT INTO spool_reporting_items(id,organization,kind,name,author,revision,created,updated) VALUES(?,?,?,?,?,1,?,?)',id,organization,input.kind,input.name,session.operator.id,time,time));
 try{await ownerBatch(db,session,[...jobs,...definitions,...projectGuards(db,session,selected,true),auditCommit(db)])}
 catch(error){
  if(/reporting_item_capacity/.test(String(error)))fail('reporting_item_limit: at most 25 named items of this kind per organization',409);
  if(/reporting_widget_capacity/.test(String(error)))fail('reporting_widget_limit: at most 12 widgets per item',409);
  throw error;
 }
 return id;
}
export async function shareItem(db:D1Database,session:OwnerSession,projects:Map<string,ProjectSnapshot>,snapshot:ItemSnapshot,body:any){
 fields(body,['revision','shares']);
 if(!canEdit(session,snapshot,projects))fail('Reporting item not found',404);
 if(revision(body.revision)!==snapshot.row.revision)fail('Reporting revision changed',409);
 const grants=shares(body.shares),organization=snapshot.row.organization??(await s(db,'SELECT id FROM spool_organizations ORDER BY created LIMIT 1').first<{id:string}>())?.id??null;
 if(grants.length&&organization===null)fail('Create an organization before sharing this item',409);
 const selected=writable(session,projects,snapshot.projects),jobs=[...projectGuards(db,session,selected,true),itemRevisionGuard(db,snapshot.row)];
 if(organization!==null){
  if(selected.some(project=>project.organization!==organization))fail('Project not found',404);
  jobs.push(guard(db,'EXISTS(SELECT 1 FROM spool_organizations WHERE id=?)',organization));
 }
 for(const grant of grants)if(grant.kind==='team')jobs.push(projectTeamGrantGuard(db,snapshot.projects,organization,grant.target));
 jobs.push(s(db,'DELETE FROM spool_reporting_shares WHERE item=?',snapshot.row.id));
 for(const grant of grants)jobs.push(s(db,'INSERT INTO spool_reporting_shares(item,id,kind,target,active,created) VALUES(?,?,?,?,1,?)',snapshot.row.id,crypto.randomUUID(),grant.kind,grant.target,Date.now()));
 jobs.push(s(db,'UPDATE spool_reporting_items SET organization=?,revision=revision+1,updated=? WHERE id=?',organization,Date.now(),snapshot.row.id),...projectGuards(db,session,selected,true),auditCommit(db));
 try{await ownerBatch(db,session,jobs)}catch(error){
  if(/reporting_item_capacity/.test(String(error)))fail('reporting_item_limit: at most 25 named items of this kind per organization',409);
  throw error;
 }
}
export async function deleteItem(db:D1Database,session:OwnerSession,projects:Map<string,ProjectSnapshot>,snapshot:ItemSnapshot,body:any){
 fields(body,['revision']);
 if(!canEdit(session,snapshot,projects))fail('Reporting item not found',404);
 if(revision(body.revision)!==snapshot.row.revision)fail('Reporting revision changed',409);
 const selected=writable(session,projects,snapshot.projects);
 await ownerBatch(db,session,[...projectGuards(db,session,selected,true),itemRevisionGuard(db,snapshot.row),s(db,'DELETE FROM spool_reporting_items WHERE id=?',snapshot.row.id),...projectGuards(db,session,selected,true),auditCommit(db)]);
}
