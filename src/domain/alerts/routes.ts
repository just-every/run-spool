import { Hono } from 'hono';
import { ownerSession, ownerWrite } from '../../auth/session.server';
import { runtimeBindings } from '../../auth/bindings';
import type { Bindings } from '../../auth/bindings';
import { ruleInput } from './rules';
import { destinationChoices, findDestination } from './destinations.server';
import { namespace, statement as s } from './types';
import type { AlertEnvironment } from './types';
import { IntegrationsRepository } from '../../modules/integrations/core/repository';
import { D1SqlDatabase } from '../../modules/integrations/core/database';
import { synchronizeHistory } from './dispatch';
type Env=Bindings&AlertEnvironment;
const routes=new Hono<{Bindings:Env}>();
// This router authenticates its own direct transport as well as its parent API mount.
routes.use('*',async(c,next)=>{const env=runtimeBindings(c.env);if(!await ownerSession(c.req.raw,env))return c.json({error:'Owner session required'},401);if(!['GET','HEAD'].includes(c.req.method)&&!ownerWrite(c.req.raw,env))return c.json({error:'Same-origin required'},403);if(!await s(env.DB,'SELECT 1 FROM projects WHERE id=?',c.req.param('project')!).first())return c.json({error:'Project not found'},404);await next()});
async function input(c:any) {
 const reader=c.req.raw.body?.getReader();if(!reader)throw new Error('Invalid alert request');let size=0;const chunks:Uint8Array[]=[];
 for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192){await reader.cancel();throw new Error('Alert request too large')}chunks.push(part.value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new Error('Invalid alert request')}
}
routes.get('/destinations',c=>{try{return c.json({rows:destinationChoices(c.env,c.req.param('project')!),configuration:'available'})}catch{return c.json({rows:[],configuration:'blocked'})}});
routes.get('/rules',async c=>c.json((await s(c.env.DB,'SELECT * FROM alert_rules WHERE project=? ORDER BY created,id',c.req.param('project')!).all()).results));
routes.post('/rules',async c=>{
 const p=c.req.param('project')!,b=ruleInput(await input(c),c.env,p,false),id=crypto.randomUUID(),time=Date.now();
 await c.env.DB.batch([
  s(c.env.DB,'INSERT INTO alert_rules VALUES(?,?,1,?,?,?,?,?,?,?,?,?)',id,p,b.name,Number(b.enabled),b.channel,b.destination,b.kinds,b.windowMs,b.threshold,time,time),
  s(c.env.DB,`INSERT INTO alert_cursors SELECT id,project,revision,? FROM alert_rules WHERE id=? AND enabled=1 AND EXISTS(SELECT 1 FROM json_each(kinds) WHERE value='spike')`,Math.ceil(time/b.windowMs)*b.windowMs,id),
  s(c.env.DB,`INSERT INTO audit VALUES(?,?,'alert_rule_created',?,?)`,crypto.randomUUID(),p,JSON.stringify({rule:id,revision:1}),time),
 ]);return c.json({id,revision:1},201);
});
routes.put('/rules/:rule',async c=>{
 const p=c.req.param('project')!,id=c.req.param('rule'),b=ruleInput(await input(c),c.env,p,true),time=Date.now(),change=crypto.randomUUID();
 if(!b.enabled){
  const previous=await s(c.env.DB,'SELECT destination,channel FROM alert_rules WHERE project=? AND id=?',p,id).first<any>();
  if(!previous||previous.destination!==b.destination||previous.channel!==b.channel)findDestination(c.env,p,b.destination,b.channel);
 }
 const results=await c.env.DB.batch([
  s(c.env.DB,`UPDATE alert_rules SET revision=revision+1,name=?,enabled=?,channel=?,destination=?,kinds=?,window_ms=?,threshold=?,updated=? WHERE project=? AND id=? AND revision=? RETURNING revision`,b.name,Number(b.enabled),b.channel,b.destination,b.kinds,b.windowMs,b.threshold,time,p,id,b.revision),
  s(c.env.DB,`INSERT INTO audit SELECT ?,?,'alert_rule_revised',?,? WHERE changes()=1`,change,p,JSON.stringify({rule:id,revision:b.revision+1}),time),
  s(c.env.DB,`DELETE FROM alert_cursors WHERE project=? AND rule_id=? AND EXISTS(SELECT 1 FROM audit WHERE id=?)`,p,id,change),
  s(c.env.DB,`INSERT INTO alert_cursors SELECT id,project,revision,? FROM alert_rules WHERE project=? AND id=? AND revision=? AND enabled=1 AND EXISTS(SELECT 1 FROM audit WHERE id=?) AND EXISTS(SELECT 1 FROM json_each(kinds) WHERE value='spike') ON CONFLICT(rule_id) DO NOTHING`,Math.ceil(time/b.windowMs)*b.windowMs,p,id,b.revision+1,change),
  s(c.env.DB,`UPDATE alert_intents SET state='cancelled',code='rule_revised' WHERE project=? AND rule_id=? AND rule_revision=? AND expanded=0 AND EXISTS(SELECT 1 FROM audit WHERE id=?)`,p,id,b.revision,change),
  s(c.env.DB,`UPDATE alert_mail_jobs SET state='blocked',code='rule_revised' WHERE state='queued' AND id IN(SELECT id FROM alert_intents WHERE project=? AND rule_id=? AND rule_revision=?) AND EXISTS(SELECT 1 FROM audit WHERE id=?)`,p,id,b.revision,change),
 ]);
 if(!results[0].results.length)return c.json({error:'Revision conflict'},409);
 await synchronizeHistory(c.env,time);return c.json({id,revision:b.revision+1});
});
routes.get('/deliveries',async c=>c.json((await s(c.env.DB,'SELECT * FROM alert_history WHERE project=? ORDER BY created DESC,id LIMIT 100',c.req.param('project')!).all()).results));
routes.get('/deliveries/:delivery',async c=>{
 const p=c.req.param('project')!,id=c.req.param('delivery');
 const row=await s(c.env.DB,'SELECT * FROM alert_history WHERE project=? AND id=?',p,id).first<any>();if(!row)return c.json({error:'Delivery not found'},404);
 const attempts=row.historical?[]:row.channel==='webhook'?await new IntegrationsRepository(new D1SqlDatabase(c.env.DB),namespace(p)).log(id):(await s(c.env.DB,`SELECT a.number,a.started,a.finished,a.state,a.code FROM alert_mail_attempts a JOIN alert_mail_jobs j ON j.id=a.delivery_id WHERE j.project=? AND j.id=? ORDER BY a.number`,p,id).all()).results;
 return c.json({delivery:row,attempts});
});
routes.post('/deliveries/:delivery/resolve',async c=>{
 const p=c.req.param('project')!,id=c.req.param('delivery'),b=await input(c);
 if(!b||Object.keys(b).sort().join()!=='evidence,state'||!['accepted','rejected'].includes(b.state)||typeof b.evidence!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(b.evidence))throw new Error('Resolution requires a safe evidence code and accepted or rejected state');
 const row=await s(c.env.DB,"SELECT * FROM alert_history WHERE project=? AND id=? AND historical=0 AND state='uncertain'",p,id).first<any>();if(!row)return c.json({error:'Uncertain delivery not found'},404);
 if(row.channel==='webhook')await new IntegrationsRepository(new D1SqlDatabase(c.env.DB),namespace(p)).resolve(id,{kind:b.state,code:b.evidence},Date.now());
 else await s(c.env.DB,"UPDATE alert_mail_jobs SET state=?,code=? WHERE project=? AND id=? AND state='uncertain'",b.state,b.evidence,p,id).run();
 await s(c.env.DB,"INSERT INTO audit VALUES(?,?,'alert_delivery_resolved',?,?)",crypto.randomUUID(),p,JSON.stringify({delivery:id,state:b.state,evidence:b.evidence}),Date.now()).run();
 await synchronizeHistory(c.env,Date.now());return c.json({resolved:true,replayed:false});
});
routes.get('/gaps',async c=>c.json((await s(c.env.DB,"SELECT id,kind,detail,created FROM audit WHERE project=? AND kind='alert_history_unavailable' ORDER BY created DESC LIMIT 50",c.req.param('project')!).all()).results));
export default routes;
