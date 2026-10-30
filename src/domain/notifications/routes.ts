import { resolveIssue } from '../short-ids/lookup';
import { Hono } from 'hono';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import { auditCommit, currentAuditScope } from '../audit/context';
import { jsonBody } from '../owner-router';
import { authorize, write, guard, s, conflict } from '../operators/common';
import { emailPreferences, readPreferences } from './model';

export const notificationPreferenceRoutes = new Hono<any>();
notificationPreferenceRoutes.onError((error,c) => error instanceof AuthError ? c.json({error:error.code},error.status as any) : conflict(c,error));
notificationPreferenceRoutes.use('/:project/notifications/preferences',async(c,next) => {
 const auth = await authorize(c); if ('response' in auth) return auth.response;
 const project = c.req.param('project')!;
 if (!await s(c.env.DB,'SELECT 1 FROM projects WHERE id=?',project).first()) return c.json({error:'Project not found'},404);
 // The subject is always the current native person. No member selector, even
 // for an administrator, can turn this personal door into a delegated write.
 if (new URL(c.req.url).search) return c.json({error:'invalid_notification_preferences'},400);
 c.set('preferenceSession',auth.session);
 c.header('Cache-Control','no-store'); c.header('X-Content-Type-Options','nosniff');
 await next();
});
notificationPreferenceRoutes.get('/:project/notifications/preferences',async c => c.json(await readPreferences(c.env.DB,c.req.param('project'),c.get('preferenceSession').operator.id)));
notificationPreferenceRoutes.put('/:project/notifications/preferences',async c => {
 let input: any;
 try { input = await jsonBody(c.req.raw,4096); } catch { throw new AuthError('invalid_notification_preferences',400); }
 if (Object.keys(input).sort().join() !== 'email,revision' || !Number.isSafeInteger(input.revision) || input.revision < 0) throw new AuthError('invalid_notification_preferences',400);
 const email = emailPreferences(input.email),db = c.env.DB,project = c.req.param('project'),session = c.get('preferenceSession');
 await write(c,session,[
  guard(db,'EXISTS(SELECT 1 FROM projects WHERE id=?)',project),
  guard(db,'COALESCE((SELECT revision FROM spool_notification_preferences WHERE project=? AND operator_id=? AND historical=0),0)=?',project,session.operator.id,input.revision),
  s(db,`INSERT INTO spool_notification_preferences(project,actor_label,operator_id,email,revision,updated,historical) VALUES(?,?,?,?,1,?,0)
   ON CONFLICT(project,operator_id) WHERE historical=0 DO UPDATE SET email=excluded.email,revision=revision+1,updated=excluded.updated`,project,currentAuditScope().actor.label,session.operator.id,JSON.stringify(email),Date.now()),
  auditCommit(db),
 ]);
 return c.json(await readPreferences(db,project,session.operator.id));
});

// A bookmark is a personal subscription reason, including for a read-only
// collaborator. It never grants a project or changes the issue itself.
notificationPreferenceRoutes.put('/:project/issues/:issue/bookmark',async c => {
 const auth=await authorize(c);if('response' in auth)return auth.response;
 const project=c.req.param('project'),found=await resolveIssue(c.env.DB,project,c.req.param('issue'));
 if(!found)return c.json({error:'Issue not found'},404);
 const input=await jsonBody(c.req.raw,1024);
 if(Object.keys(input).join()!=='bookmarked'||typeof input.bookmarked!=='boolean')throw new AuthError('invalid_bookmark',400);
 const db=c.env.DB,operator=auth.session.operator.id;
 await write(c,auth.session,[guard(db,'EXISTS(SELECT 1 FROM issues WHERE project=? AND id=?)',project,found.issue),
  s(db,"DELETE FROM spool_issue_follows WHERE project=? AND issue=? AND operator_id=? AND reason='bookmark' AND historical=0",project,found.issue,operator),
  ...input.bookmarked?[s(db,"INSERT INTO spool_issue_follows(project,issue,operator_id,actor_label,reason,updated) VALUES(?,?,?,?,'bookmark',?)",project,found.issue,operator,currentAuditScope().actor.label,Date.now())]:[],auditCommit(db)]);
 return c.json({bookmarked:input.bookmarked});
});
