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
