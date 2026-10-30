import { AuthError } from '../../modules/operator-auth/index.mjs';
import { currentAuditScope } from '../audit/context';
import { auditActor } from '../audit/identity';
import { scrubText } from '../scrub';
import { s, guard } from '../operators/common';
import type { OwnerSession } from '../owner-authority';

export type DiscussionComment = {id:string;body:string;version:number;created:number;updated:number;author:string;canEdit:boolean;mentions:string[]};
export type Subscription = {subscribed:boolean;explicit:'subscribed'|'unsubscribed'|null;reasons:string[];version:number};
export type DiscussionData = {issue:string;revision:number;canWrite:boolean;comments:DiscussionComment[];subscription:Subscription;limit:number};
export type ActivityRow = {actor_name?:string|null;id:string;kind:string;actor_kind:string;actor_label:string;detail:Record<string,unknown>;created:number};

export function fields(input:any, names:string[]) {
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!names.includes(key)))throw new AuthError('invalid_discussion_request',400);
}
export function revision(input:any) {
 if(!Number.isSafeInteger(input)||input<1||input>=Number.MAX_SAFE_INTEGER)throw new AuthError('invalid_revision',400);
 return input as number;
}
export function commentBody(input:unknown) {
 if(typeof input!=='string'||!input.trim()||input.length>4000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input))throw new AuthError('comment_requires_1_to_4000_characters',400);
 const body=scrubText(input.trim(),4000);
 if(!body.trim()||body.length>4000)throw new AuthError('comment_requires_1_to_4000_characters',400);
 return body;
}
export const canWrite = (session:OwnerSession) => session.operator.role==='owner'||session.membership?.role==='admin'||session.membership?.role==='member'&&session.membership?.projectRole!=='read-only';
export const canModerate = (session:OwnerSession) => session.operator.role==='owner'||session.membership?.role==='admin';
export const issueFence = (db:D1Database,project:string,issue:string) => [
 guard(db,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=?)',project,issue),
 s(db,'UPDATE issues SET revision=revision+1 WHERE project=? AND id=?',project,issue),
];
export function activity(db:D1Database,project:string,issue:string,kind:string,detail:Record<string,unknown>,created:number) {
 const actor=currentAuditScope().actor;
 return s(db,'INSERT INTO issue_activity(id,project,issue,kind,actor_kind,actor_label,detail,created) VALUES(?,?,?,?,?,?,?,?)',crypto.randomUUID(),project,issue,kind,actor.kind,actor.label,JSON.stringify(detail),created);
}
export function subscribe(db:D1Database,project:string,issue:string,operator:string,reason:string,time:number,state='subscribed') {
 return s(db,`INSERT INTO issue_subscriptions(project,issue,operator_id,reason,state,updated) VALUES(?,?,?,?,?,?)
 ON CONFLICT(project,issue,operator_id,reason) DO UPDATE SET state=excluded.state,updated=MAX(issue_subscriptions.updated+1,excluded.updated)`,project,issue,operator,reason,state,time);
}
export async function subscription(db:D1Database,project:string,issue:string,operator:string):Promise<Subscription> {
 const rows=(await s(db,'SELECT reason,state,updated FROM issue_subscriptions WHERE project=? AND issue=? AND operator_id=?',project,issue,operator).all<{reason:string;updated:number;state:'subscribed'|'unsubscribed'}>()).results;
 const follows=(await s(db,'SELECT reason FROM spool_issue_follows WHERE project=? AND issue=? AND operator_id=? AND historical=0',project,issue,operator).all<{reason:string}>()).results;
 const manualRow=rows.find(row=>row.reason==='manual'),manual=manualRow?.state;
 const explicit=manual==='subscribed'||manual==='unsubscribed'?manual:null;
 const reasons=[...new Set([...rows.filter(row=>row.state==='subscribed').map(row=>row.reason),...follows.map(row=>row.reason)])];
 return {subscribed:explicit==='unsubscribed'?false:reasons.length>0,explicit,reasons,version:manualRow?.updated??0};
}

// Unknown, ambiguous and inaccessible handles remain ordinary text. Resolving
// a mention never exposes a directory or distinguishes those cases.
export async function mentions(db:D1Database,project:string,text:string) {
 const handles=[...new Set([...text.matchAll(/(?:^|[^\w@])@([A-Za-z0-9][A-Za-z0-9._+\-]*)/g)].map(match=>match[1].replace(/\.+$/,'').toLowerCase()))];
 const found:{id:string;operator_id:string;version:number;alias:string}[]=[];
 for(const handle of handles) {
  const rows=(await s(db,`SELECT m.id,m.operator_id,m.version,o.role native_role FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id
   JOIN spool_project_teams t ON t.organization=m.organization AND t.project=?
   WHERE m.state='active' AND o.status='active' AND (lower(substr(m.email,1,instr(m.email,'@')-1))=? OR lower(m.name)=?) AND
    (o.role='owner' OR m.role='admin' OR m.role IN ('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=t.project))`,project,handle,handle).all<{id:string;operator_id:string;version:number;native_role:string}>()).results;
  if(rows.length!==1||found.some(member=>member.operator_id===rows[0].operator_id))continue;
  const member=rows[0],actor=await auditActor(db,{kind:member.native_role==='owner'?'owner':'member',authority:member.operator_id,project});
  found.push({...member,alias:actor.label});
 }
 return found;
}
export function mentionFence(db:D1Database,project:string,member:{id:string;operator_id:string;version:number}) {
 return guard(db,`EXISTS(SELECT 1 FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id JOIN spool_project_teams t ON t.organization=m.organization
 WHERE t.project=? AND m.id=? AND m.operator_id=? AND m.version=? AND m.state='active' AND o.status='active' AND
 (o.role='owner' OR m.role='admin' OR m.role IN ('member','read-only') AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=t.project)))`,project,member.id,member.operator_id,member.version);
}
