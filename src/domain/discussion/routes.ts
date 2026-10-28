import {activityDetail} from '../lifecycle/activity';
import { Hono } from 'hono';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import { auditCommit, currentAuditScope } from '../audit/context';
import { jsonBody } from '../owner-router';
import { authorize, write, guard, s, conflict } from '../operators/common';
import { resolveIssue } from '../short-ids/lookup';
import { scrub, hash } from '../privacy';
import { scrubText } from '../scrub';
import { activity, canModerate, canWrite, commentBody, fields, issueFence, mentionFence, mentions, revision, subscribe, subscription } from './model';
import type { DiscussionData } from './model';

export const discussionRoutes=new Hono<any>();
discussionRoutes.onError((error,c)=>{
 if(error instanceof AuthError)return c.json({error:error.code},error.status as any);
 return conflict(c,error);
});
for(const path of ['/:project/issues/:issue/discussion','/:project/issues/:issue/comments','/:project/issues/:issue/comments/:comment','/:project/issues/:issue/subscription'])discussionRoutes.use(path,async(c,next)=>{
 const auth=await authorize(c);if('response' in auth)return auth.response;
 const project=c.req.param('project')!,found=await resolveIssue(c.env.DB,project,c.req.param('issue')!);
 const issue=found&&await s(c.env.DB,'SELECT id,revision FROM issues WHERE project=? AND id=?',project,found.issue).first<any>();
 if(!issue)return c.json({error:'Issue not found'},404);
 c.set('discussionSession',auth.session);c.set('discussionIssue',issue);
 c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');
 if(!['GET','HEAD'].includes(c.req.method)&&!canWrite(auth.session))return c.json({error:'Project not found'},404);
 await next();
});

discussionRoutes.get('/:project/issues/:issue/discussion',async c=>{
 const db=c.env.DB,project=c.req.param('project'),issue=c.get('discussionIssue'),session=c.get('discussionSession');
 const comments=(await s(db,`SELECT c.*,o.display_name FROM issue_comments c LEFT JOIN oa_operators o ON o.id=c.operator_id
 WHERE c.project=? AND c.issue=? ORDER BY c.created,c.id LIMIT 200`,project,issue.id).all<any>()).results;
 const data:DiscussionData={issue:issue.id,revision:issue.revision,canWrite:canWrite(session),limit:200,
  comments:comments.map(row=>({id:row.id,body:scrubText(row.body,4000),version:row.version,created:row.created,updated:row.updated,
   author:row.display_name?scrub(row.display_name):'Former member',canEdit:canWrite(session)&&(row.operator_id===session.operator.id||canModerate(session)),mentions:JSON.parse(row.mentions)})),
  subscription:await subscription(db,project,issue.id,session.operator.id)};
 const recurrence=await s(db,"SELECT COALESCE(SUM(CASE WHEN kind='resolved_release_recurrence' THEN json_extract(detail,'$.count') ELSE 0 END),0) sameRelease,COALESCE(SUM(CASE WHEN kind='older_release_recurrence' THEN json_extract(detail,'$.count') ELSE 0 END),0) olderRelease FROM issue_activity WHERE project=? AND issue=?",project,issue.id).first();
 const signature=await hash(JSON.stringify(['issue-activity-v1',project,issue.id]));
 let cursor:{signature:string;created:number;id:string}|null=null;
 if(c.req.query('cursor')) {
  try{cursor=JSON.parse(atob(c.req.query('cursor')!));}catch{throw new AuthError('invalid_activity_cursor',400);}
  if(!cursor||cursor.signature!==signature||!Number.isSafeInteger(cursor.created)||cursor.created<0||typeof cursor.id!=='string'||cursor.id.length>100)throw new AuthError('invalid_activity_cursor',400);
 }
 const rows=(await s(db,`SELECT a.*,(SELECT o.display_name FROM audit_actor_links l JOIN oa_operators o ON o.id=l.owner_id WHERE l.label=a.actor_label AND l.kind IN ('owner','member') LIMIT 1) actor_name FROM issue_activity a WHERE a.project=? AND a.issue=?${cursor?' AND (a.created,a.id)<(?,?)':''} ORDER BY a.created DESC,a.id DESC LIMIT 51`,project,issue.id,...cursor?[cursor.created,cursor.id]:[]).all<any>()).results;
 const activityRows=rows.slice(0,50).map(row=>({...row,actor_name:row.actor_name?scrub(row.actor_name):null,detail:JSON.parse(activityDetail(row.detail))})),last=rows[49];
 return c.json({...data,recurrence,activity:activityRows,next:rows.length>50?btoa(JSON.stringify({signature,created:last.created,id:last.id})):null});
});

discussionRoutes.post('/:project/issues/:issue/comments',async c=>{
 const input=await jsonBody(c.req.raw,32768);fields(input,['body','revision']);const expected=revision(input.revision),text=commentBody(input.body);
 const db=c.env.DB,project=c.req.param('project'),issue=c.get('discussionIssue').id,session=c.get('discussionSession');
 const count=await s(db,'SELECT COUNT(*) count FROM issue_comments WHERE project=? AND issue=?',project,issue).first<{count:number}>();
 if(count!.count>=200)return c.json({error:'comment_capacity_reached',limit:200},409);
 const targets=await mentions(db,project,text),id=crypto.randomUUID(),time=Date.now(),actor=currentAuditScope().actor;
 await write(c,session,[...issueFence(db,project,issue,expected),guard(db,'(SELECT COUNT(*) FROM issue_comments WHERE project=? AND issue=?)<200',project,issue),
  ...targets.map(member=>mentionFence(db,project,member)),
  s(db,'INSERT INTO issue_comments(id,project,issue,operator_id,actor_kind,actor_label,body,mentions,version,created,updated) VALUES(?,?,?,?,?,?,?,?,1,?,?)',id,project,issue,session.operator.id,actor.kind,actor.label,text,JSON.stringify(targets.map(member=>member.alias)),time,time),
  subscribe(db,project,issue,session.operator.id,'comment',time),...targets.map(member=>subscribe(db,project,issue,member.operator_id,'mention',time)),
  activity(db,project,issue,'comment_added',{comment:id,mentionCount:targets.length},time),auditCommit(db)]);
 return c.json({id,version:1,revision:expected+1},201);
});

discussionRoutes.on(['PATCH','DELETE'],'/:project/issues/:issue/comments/:comment',async c=>{
 const deleting=c.req.method==='DELETE',input=await jsonBody(c.req.raw,32768);fields(input,deleting?['revision','version']:['revision','version','body']);
 const expected=revision(input.revision),version=revision(input.version),db=c.env.DB,project=c.req.param('project'),issue=c.get('discussionIssue').id,session=c.get('discussionSession'),id=c.req.param('comment');
 const row=await s(db,'SELECT operator_id FROM issue_comments WHERE project=? AND issue=? AND id=?',project,issue,id).first<{operator_id:string}>();
 if(!row||row.operator_id!==session.operator.id&&!canModerate(session))return c.json({error:'Comment not found'},404);
 const text=deleting?'':commentBody(input.body),targets=deleting?[]:await mentions(db,project,text),time=Date.now();
 await write(c,session,[...issueFence(db,project,issue,expected),
  guard(db,'EXISTS(SELECT 1 FROM issue_comments WHERE project=? AND issue=? AND id=? AND version=? AND operator_id=?)',project,issue,id,version,row.operator_id),
  ...targets.map(member=>mentionFence(db,project,member)),
  deleting?s(db,'DELETE FROM issue_comments WHERE project=? AND issue=? AND id=?',project,issue,id):
   s(db,'UPDATE issue_comments SET body=?,mentions=?,version=version+1,updated=? WHERE project=? AND issue=? AND id=?',text,JSON.stringify(targets.map(member=>member.alias)),time,project,issue,id),
  ...targets.map(member=>subscribe(db,project,issue,member.operator_id,'mention',time)),
  activity(db,project,issue,deleting?'comment_deleted':'comment_edited',{comment:id,version:version+1,...deleting?{}:{mentionCount:targets.length}},time),auditCommit(db)]);
 return c.json({id,version:version+1,revision:expected+1,deleted:deleting});
});

discussionRoutes.put('/:project/issues/:issue/subscription',async c=>{
 const input=await jsonBody(c.req.raw,1024);fields(input,['revision','subscribed']);const expected=revision(input.revision);
 if(typeof input.subscribed!=='boolean')throw new AuthError('invalid_subscription',400);
 const db=c.env.DB,project=c.req.param('project'),issue=c.get('discussionIssue').id,session=c.get('discussionSession'),time=Date.now();
 await write(c,session,[...issueFence(db,project,issue,expected),subscribe(db,project,issue,session.operator.id,'manual',time,input.subscribed?'subscribed':'unsubscribed'),activity(db,project,issue,input.subscribed?'subscribed':'unsubscribed',{},time),auditCommit(db)]);
 return c.json({revision:expected+1,subscription:await subscription(db,project,issue,session.operator.id)});
});
