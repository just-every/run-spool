import { resolveIssue } from '../short-ids/lookup';
import { Hono } from 'hono';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import { auditCommit, currentAuditScope } from '../audit/context';
import { jsonBody } from '../owner-router';
import { authorize, write, guard, s, conflict } from '../operators/common';
import { timezone } from '../alerts/calendar';
import { defaultEmailPreferences, emailPreferences, readPreferences, readDigestSettings } from './model';

export const notificationPreferenceRoutes = new Hono<any>();
notificationPreferenceRoutes.onError((error,c) => error instanceof AuthError ? c.json({error:error.code},error.status as any) : conflict(c,error));
notificationPreferenceRoutes.use('/:project/notifications/*',async(c,next) => {
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

notificationPreferenceRoutes.get('/:project/notifications/digest',async c=>c.json(await readDigestSettings(c.env.DB,c.req.param('project'),c.get('preferenceSession').operator.id)));
notificationPreferenceRoutes.put('/:project/notifications/digest',async c=>{
 const input=await jsonBody(c.req.raw,2048);
 if(Object.keys(input).sort().join()!=='daily,hour,revision,timezone,weekly'||typeof input.daily!=='boolean'||typeof input.weekly!=='boolean'||!Number.isInteger(input.hour)||input.hour<0||input.hour>23||!Number.isSafeInteger(input.revision)||input.revision<0)throw new AuthError('invalid_digest_preferences',400);
 let zone:string;try{zone=timezone(input.timezone)}catch{throw new AuthError('invalid_digest_timezone',400)}
 const project=c.req.param('project'),db=c.env.DB,session=c.get('preferenceSession'),time=Date.now(),alias=currentAuditScope().actor.label;
 await write(c,session,[guard(db,'COALESCE((SELECT revision FROM spool_personal_digest_settings WHERE project=? AND operator_id=? AND historical=0),0)=?',project,session.operator.id,input.revision),
  s(db,`INSERT INTO spool_notification_preferences(project,actor_label,operator_id,email,revision,updated) VALUES(?,?,?,?,1,?) ON CONFLICT(project,operator_id) WHERE historical=0 DO NOTHING`,project,alias,session.operator.id,JSON.stringify(defaultEmailPreferences()),time),
  s(db,`INSERT INTO spool_personal_digest_settings(project,actor_label,operator_id,timezone,hour,daily,weekly,created,updated) VALUES(?,?,?,?,?,?,?,?,?)
   ON CONFLICT(project,operator_id) WHERE historical=0 DO UPDATE SET timezone=excluded.timezone,hour=excluded.hour,daily=excluded.daily,weekly=excluded.weekly,updated=excluded.updated,revision=revision+1`,project,alias,session.operator.id,zone,input.hour,Number(input.daily),Number(input.weekly),time,time),auditCommit(db)]);
 return c.json(await readDigestSettings(db,project,session.operator.id));
});

notificationPreferenceRoutes.get('/:project/notifications/mandatory-rules',async c=>c.json((await s(c.env.DB,`SELECT r.id,r.name,r.enabled,COALESCE(x.mandatory,0) mandatory,COALESCE(x.revision,0) revision FROM alert_rules r LEFT JOIN spool_personal_rule_settings x ON x.project=r.project AND x.rule_id=r.id AND x.historical=0 WHERE r.project=? ORDER BY r.created,r.id`,c.req.param('project')).all()).results));
notificationPreferenceRoutes.put('/:project/notifications/mandatory-rules/:rule',async c=>{
 const session=c.get('preferenceSession');if(session.operator.role!=='owner'&&session.membership?.role!=='admin')return c.json({error:'Project not found'},404);
 const input=await jsonBody(c.req.raw,1024),project=c.req.param('project'),rule=c.req.param('rule'),db=c.env.DB;
 if(Object.keys(input).sort().join()!=='mandatory,revision'||typeof input.mandatory!=='boolean'||!Number.isSafeInteger(input.revision)||input.revision<0)throw new AuthError('invalid_mandatory_rule',400);
 await write(c,session,[guard(db,'EXISTS(SELECT 1 FROM alert_rules WHERE project=? AND id=?)',project,rule),guard(db,'COALESCE((SELECT revision FROM spool_personal_rule_settings WHERE project=? AND rule_id=? AND historical=0),0)=?',project,rule,input.revision),
  s(db,`INSERT INTO spool_personal_rule_settings(project,rule_id,mandatory,updated) VALUES(?,?,?,?) ON CONFLICT(project,rule_id) DO UPDATE SET mandatory=excluded.mandatory,updated=excluded.updated,revision=revision+1,historical=0`,project,rule,Number(input.mandatory),Date.now()),auditCommit(db)]);
 return c.json({mandatory:input.mandatory,revision:input.revision+1});
});
