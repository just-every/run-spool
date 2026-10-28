import { resolveMembership } from '../members/resolver';
import {primaryShortIdSql} from '../short-ids/lookup';
import { revokeSlack } from './slack-destinations.server';
import { Hono } from 'hono';
import { ownerSession, ownerWrite } from '../../auth/session.server';
import { ownerBatch, type OwnerSession } from '../owner-authority';
import { runtimeBindings } from '../../auth/bindings';
import type { Bindings } from '../../auth/bindings';
import { previewRule,previewGuard,configSql } from './preview';
import { ruleInput } from './rules';
import { destinationChoices, findDestination } from './destinations.server';
import { namespace, statement as s } from './types';
import type { AlertEnvironment } from './types';
import { IntegrationsRepository } from '../../modules/integrations/core/repository';
import { D1SqlDatabase } from '../../modules/integrations/core/database';
import type { SqlDatabase } from '../../modules/integrations/core/database';
import { synchronizeHistory } from './dispatch';
import { saveDestination } from './destination-management.server';
import { testDestination, reviewTest, requireReviewedTest } from './destination-tests.server';
type Env=Bindings&AlertEnvironment;
import { controlsRoutes } from './controls-routes';
import { teamControls } from './team-controls';
const routes=new Hono<{Bindings:Env;Variables:{alertSession:OwnerSession}}>();
// This router authenticates its own direct transport as well as its parent API mount.
routes.use('*',async(c,next)=>{const env=runtimeBindings(c.env);const session=await ownerSession(c.req.raw,env,resolveMembership);if(!session)return c.json({error:'Owner session required'},401);c.set('alertSession',session);if(!['GET','HEAD'].includes(c.req.method)&&!ownerWrite(c.req.raw,env))return c.json({error:'Same-origin required'},403);if(!await s(env.DB,'SELECT 1 FROM projects WHERE id=?',c.req.param('project')!).first())return c.json({error:'Project not found'},404);await next()});
async function input(c:any) {
 const reader=c.req.raw.body?.getReader();if(!reader)throw new Error('Invalid alert request');let size=0;const chunks:Uint8Array[]=[];
 for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192){await reader.cancel();throw new Error('Alert request too large')}chunks.push(part.value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new Error('Invalid alert request')}
 await ownerBatch(c.env.DB,c.get('alertSession'),[]);return value;
}
controlsRoutes(routes,input);
teamControls(routes,input);
routes.get('/destinations',async c=>{try{return c.json({rows:await destinationChoices(c.env,c.req.param('project')!),configuration:'available'})}catch{return c.json({rows:[],configuration:'blocked'})}});
routes.post('/destinations',async c=>c.json(await saveDestination(c.env,c.get('alertSession'),c.req.param('project')!,undefined,await input(c)),201));
routes.put('/destinations/:destination',async c=>{const result=await saveDestination(c.env,c.get('alertSession'),c.req.param('project')!,c.req.param('destination'),await input(c));await synchronizeHistory(c.env,Date.now());return c.json(result)});
routes.delete('/destinations/:destination',async c=>c.json(await revokeSlack(c.env,c.get('alertSession'),c.req.param('project')!,c.req.param('destination')!)));
routes.post('/destinations/:destination/test',async c=>c.json(await testDestination(c.env,c.get('alertSession'),c.req.param('project')!,c.req.param('destination'))));
routes.post('/destinations/:destination/review',async c=>c.json(await reviewTest(c.env,c.get('alertSession'),c.req.param('project')!,c.req.param('destination'),(await input(c)).testId)));
routes.post('/rules/preview',async c=>c.json(await previewRule(c.env,c.get('alertSession'),c.req.param('project')!,await input(c))));
routes.get('/decisions',async c=>c.json((await s(c.env.DB,`SELECT d.*,i.title issue_title,${primaryShortIdSql('i')} issue_short_id FROM alert_decisions d LEFT JOIN issues i ON i.id=d.issue AND i.project=d.project WHERE d.project=? ORDER BY d.end DESC,d.id LIMIT 100`,c.req.param('project')!).all()).results));
routes.get('/rules',async c=>c.json((await s(c.env.DB,`SELECT r.*,${configSql} config FROM alert_rules r WHERE project=? ORDER BY created,id`,c.req.param('project')!).all()).results));
routes.post('/rules',async c=>{
 const p=c.req.param('project')!,b=ruleInput(await input(c),c.env,p,false),id=crypto.randomUUID(),time=Date.now();
 await findDestination(c.env,p,b.destination,b.channel);
 const testGuard=b.enabled?await requireReviewedTest(c.env,p,b.destination,b.channel):null,preview=await previewGuard(c.env,p,null,b);
 await ownerBatch(c.env.DB,c.get('alertSession'),[
  ...preview,
  s(c.env.DB,'INSERT INTO alert_rules VALUES(?,?,1,?,?,?,?,?,?,?,?,?)',id,p,b.name,Number(b.enabled),b.channel,b.destination,b.kinds,b.windowMs,b.threshold,time,time),
  s(c.env.DB,'INSERT INTO alert_rule_configs VALUES(?,?,1,?)',id,p,b.config),
  s(c.env.DB,`INSERT INTO alert_cursors SELECT id,project,revision,? FROM alert_rules WHERE id=? AND enabled=1 AND EXISTS(SELECT 1 FROM json_each(kinds) WHERE value='spike')`,Math.ceil(time/b.windowMs)*b.windowMs,id),
  s(c.env.DB,`INSERT INTO audit VALUES(?,?,'alert_rule_created',?,?)`,crypto.randomUUID(),p,JSON.stringify({rule:id,revision:1}),time),
  ...(testGuard?[testGuard]:[]),
 ]);return c.json({id,revision:1},201);
});
routes.put('/rules/:rule',async c=>{
 const p=c.req.param('project')!,id=c.req.param('rule'),b=ruleInput(await input(c),c.env,p,true),time=Date.now(),change=crypto.randomUUID();
 const previousRevision=await s(c.env.DB,'SELECT revision FROM alert_rules WHERE project=? AND id=?',p,id).first<any>();if(previousRevision?.revision!==b.revision)return c.json({error:'Revision conflict'},409);
 const preview=await previewGuard(c.env,p,id!,b);
 let testGuard:D1PreparedStatement|null=null;
 if(b.enabled){await findDestination(c.env,p,b.destination,b.channel);testGuard=await requireReviewedTest(c.env,p,b.destination,b.channel)}
 else {
  const previous=await s(c.env.DB,'SELECT destination,channel FROM alert_rules WHERE project=? AND id=?',p,id).first<any>();
  if(!previous||previous.destination!==b.destination||previous.channel!==b.channel)await findDestination(c.env,p,b.destination,b.channel);
 }
 const results=await ownerBatch(c.env.DB,c.get('alertSession'),[
  s(c.env.DB,`UPDATE alert_rules SET revision=revision+1,name=?,enabled=?,channel=?,destination=?,kinds=?,window_ms=?,threshold=?,updated=? WHERE project=? AND id=? AND revision=? RETURNING revision`,b.name,Number(b.enabled),b.channel,b.destination,b.kinds,b.windowMs,b.threshold,time,p,id,b.revision),
  s(c.env.DB,`INSERT INTO audit SELECT ?,?,'alert_rule_revised',?,? WHERE changes()=1`,change,p,JSON.stringify({rule:id,revision:b.revision+1}),time),
  s(c.env.DB,`DELETE FROM alert_cursors WHERE project=? AND rule_id=? AND EXISTS(SELECT 1 FROM audit WHERE id=?)`,p,id,change),
  s(c.env.DB,`INSERT INTO alert_cursors SELECT id,project,revision,? FROM alert_rules WHERE project=? AND id=? AND revision=? AND enabled=1 AND EXISTS(SELECT 1 FROM audit WHERE id=?) AND EXISTS(SELECT 1 FROM json_each(kinds) WHERE value='spike') ON CONFLICT(rule_id) DO NOTHING`,Math.ceil(time/b.windowMs)*b.windowMs,p,id,b.revision+1,change),
  ...preview,
  s(c.env.DB,`INSERT INTO alert_rule_configs SELECT id,project,revision,? FROM alert_rules WHERE id=? AND project=? AND revision=? AND EXISTS(SELECT 1 FROM audit WHERE id=?) ON CONFLICT(rule_id) DO UPDATE SET revision=excluded.revision,config=excluded.config`,b.config,id,p,b.revision+1,change),
  // Retention withdrawal is irreversible: its reason also fences stale expansion.
  s(c.env.DB,`UPDATE alert_intents SET state='cancelled',code='rule_revised' WHERE project=? AND rule_id=? AND rule_revision=? AND expanded=0 AND code IS NOT 'retention_removed' AND EXISTS(SELECT 1 FROM audit WHERE id=?)`,p,id,b.revision,change),
  s(c.env.DB,`UPDATE alert_mail_jobs SET state='blocked',code='rule_revised' WHERE state='queued' AND id IN(SELECT id FROM alert_intents WHERE project=? AND rule_id=? AND rule_revision=?) AND EXISTS(SELECT 1 FROM audit WHERE id=?)`,p,id,b.revision,change),
  ...(testGuard?[testGuard]:[]),
 ]);
 if(!results[0].results.length)return c.json({error:'Revision conflict'},409);
 await synchronizeHistory(c.env,time);return c.json({id,revision:b.revision+1});
});
routes.get('/deliveries',async c=>c.json((await s(c.env.DB,`SELECT h.*,(SELECT message_id FROM slack_delivery_meta sm WHERE sm.project=h.project AND sm.delivery_id=h.id) message_id,EXISTS(SELECT 1 FROM slack_delivery_meta sm WHERE sm.project=h.project AND sm.delivery_id=h.id) slack,(SELECT state FROM alert_provider_events e WHERE e.project=h.project AND e.delivery_id=h.id AND e.state IS NOT NULL ORDER BY CASE WHEN state IN ('delivered','bounced','complained','dropped') THEN 1 ELSE 0 END DESC,occurred_at DESC,CASE state WHEN 'complained' THEN 4 WHEN 'bounced' THEN 3 WHEN 'dropped' THEN 2 ELSE 1 END DESC,event_id DESC LIMIT 1) recipient_state,(SELECT provenance FROM alert_provider_events e WHERE e.project=h.project AND e.delivery_id=h.id AND e.state IS NOT NULL ORDER BY CASE WHEN state IN ('delivered','bounced','complained','dropped') THEN 1 ELSE 0 END DESC,occurred_at DESC,CASE state WHEN 'complained' THEN 4 WHEN 'bounced' THEN 3 WHEN 'dropped' THEN 2 ELSE 1 END DESC,event_id DESC LIMIT 1) provenance,a.issue,a.kind,json_extract(a.payload,\'$.title\') title FROM alert_history h LEFT JOIN alerts a ON a.id=h.alert_id AND a.project=h.project WHERE h.project=? ORDER BY h.created DESC,h.id LIMIT 100`,c.req.param('project')!).all()).results));
routes.get('/deliveries/:delivery',async c=>{
 const p=c.req.param('project')!,id=c.req.param('delivery');
 const row=await s(c.env.DB,'SELECT * FROM alert_history WHERE project=? AND id=?',p,id).first<any>();if(!row)return c.json({error:'Delivery not found'},404);
 const attempts=row.historical?[]:row.channel==='webhook'?await new IntegrationsRepository(new D1SqlDatabase(c.env.DB),namespace(p)).log(id):(await s(c.env.DB,`SELECT a.number,a.started,a.finished,a.state,a.code FROM alert_mail_attempts a JOIN alert_mail_jobs j ON j.id=a.delivery_id WHERE j.project=? AND j.id=? ORDER BY a.number`,p,id).all()).results;
 const events=(await s(c.env.DB,'SELECT * FROM alert_provider_events WHERE project=? AND delivery_id=? ORDER BY occurred_at,event_id',p,id).all()).results;const slack=await s(c.env.DB,'SELECT message_id FROM slack_delivery_meta WHERE project=? AND delivery_id=?',p,id).first();return c.json({delivery:row,attempts,events,...slack?{slack}:{}});
});
routes.post('/deliveries/:delivery/resolve',async c=>{
 const p=c.req.param('project')!,id=c.req.param('delivery'),b=await input(c);
 if(!b||Object.keys(b).sort().join()!=='evidence,state'||!['accepted','rejected'].includes(b.state)||typeof b.evidence!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(b.evidence))throw new Error('Resolution requires a safe evidence code and accepted or rejected state');
 const row=await s(c.env.DB,"SELECT * FROM alert_history WHERE project=? AND id=? AND historical=0 AND state='uncertain'",p,id).first<any>();if(!row)return c.json({error:'Uncertain delivery not found'},404);
 // The resolution and its audit entry commit together, and only while the admitting session still holds owner authority.
 const audit=s(c.env.DB,"INSERT INTO audit SELECT ?,?,'alert_delivery_resolved',?,? WHERE changes()=1",crypto.randomUUID(),p,JSON.stringify({delivery:id,state:b.state,evidence:b.evidence}),Date.now());
 if(row.channel==='webhook'){
  const sql:SqlDatabase={async batch(statements){return (await ownerBatch(c.env.DB,c.get('alertSession'),[...statements.map(x=>s(c.env.DB,x.sql,...(x.params??[]))),audit])).slice(0,-1).map(r=>r.results as Record<string,unknown>[])}};
  await new IntegrationsRepository(sql,namespace(p)).resolve(id,{kind:b.state,code:b.evidence},Date.now());
 }
 else await ownerBatch(c.env.DB,c.get('alertSession'),[s(c.env.DB,"UPDATE alert_mail_jobs SET state=?,code=? WHERE project=? AND id=? AND state='uncertain'",b.state,b.evidence,p,id),audit]);
 await synchronizeHistory(c.env,Date.now());return c.json({resolved:true,replayed:false});
});
routes.get('/gaps',async c=>c.json((await s(c.env.DB,"SELECT id,kind,detail,created FROM audit WHERE project=? AND kind='alert_history_unavailable' ORDER BY created DESC LIMIT 50",c.req.param('project')!).all()).results));
export default routes;
