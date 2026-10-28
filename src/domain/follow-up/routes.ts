import {settingsCustody} from '../agent-door/settings-custody';
import { runtimeBindings } from '../../auth/bindings';
import { ownerProjectRouter,ownerWrites,jsonBody } from '../owner-router';
import { auditCommit } from '../audit/context';
import { findDestination } from '../alerts/destinations.server';
import { IntegrationsRepository } from '../../modules/integrations/core/repository';
import { D1SqlDatabase } from '../../modules/integrations/core/database';
import { attentionAction } from './actions';
import { activeProjectRecipient } from '../members/notifications';
import { s,type Attention } from './types';
const routes=ownerProjectRouter();
routes.get('/',async c=>{
 const project=c.req.param('project')!,db=c.env.DB;
 const config=await s(db,'SELECT destination,channel,revision FROM follow_up_settings WHERE project=?',project).first<any>();
 const alternateMember=await s(db,'SELECT a.member,m.name FROM spool_follow_up_alternates a JOIN spool_members m ON m.id=a.member WHERE a.project=?',project).first<{member:string;name:string}>();
 let label='No alternate',configured=false;
 if(config?.destination)try{label=(await findDestination(runtimeBindings(c.env),project,config.destination,config.channel)).label;configured=true;}catch{label='Alternate unavailable';}
 if(alternateMember){configured=!!await activeProjectRecipient(db,project,alternateMember.member);label=configured?alternateMember.name:'Alternate member unavailable';}
 const rows=(await s(db,'SELECT * FROM follow_up_attention WHERE project=? ORDER BY CASE WHEN state IN (\'completed\',\'canceled\') THEN 1 ELSE 0 END,due,id LIMIT 100',project).all<Attention>()).results;
 const enriched=[];
 for(const row of rows){
  let attempts:any[]=[];
  if(row.source==='alert'){
   const history=await s(db,'SELECT channel FROM alert_history WHERE id=? AND project=?',row.source_id,project).first<any>();
   attempts=history?.channel==='webhook'?await new IntegrationsRepository(new D1SqlDatabase(db),'spool.'+project).log(row.source_id):(await s(db,'SELECT number,started,finished,state,code FROM alert_mail_attempts WHERE delivery_id=? ORDER BY number',row.source_id).all()).results;
  }else if(row.source==='fix')attempts=(await s(db,'SELECT id,step,method,state,started,finished,due,evidence FROM follow_up_fix_steps WHERE project=? AND workflow=? ORDER BY started,id',project,row.source_id).all()).results;
  else attempts=(await s(db,'SELECT number,started,finished,state,code FROM follow_up_deployment_attempts WHERE project=? AND deployment=? ORDER BY number',project,row.source_id).all()).results;
  const notices=(await s(db,'SELECT id,destination,channel,state,attempts,code,next_at FROM follow_up_notices WHERE attention=? ORDER BY id',row.id).all<any>()).results;
  for(const notice of notices)notice.log=(await s(db,'SELECT number,started,finished,state,code FROM follow_up_attempts WHERE notice=? ORDER BY number',notice.id).all()).results;
  const loss=/^loss:(\d+):(.+)$/.exec(row.source_id);
  const captureLoss=loss?Number((await s(db,'SELECT count FROM outcomes WHERE project=? AND window=? AND reason=?',project,Number(loss[1]),loss[2]).first<any>())?.count??0):null;
  const held=row.source_id.startsWith('snooze:')?await s(db,'SELECT COUNT(*) n FROM alert_suppressed WHERE project=? AND snooze_id=? AND released_at IS NULL',project,row.source_id.slice(7)).first<any>():row.source_id.startsWith('held:')?await s(db,'SELECT COUNT(*) n FROM alert_suppressed WHERE project=? AND delivery_id=? AND released_at IS NULL',project,row.source_id.slice(5)).first<any>():null;
  enriched.push({...row,attempts,notices,capture_loss:captureLoss,held_alerts:held?.n??null});
 }
 return c.json({alternate:{destination:alternateMember?'member:'+alternateMember.member:config?.destination??null,member:alternateMember?.member??null,channel:alternateMember?'mail':config?.channel??null,state:configured?'configured':alternateMember||config?.destination?'broken':'none',configured,label},rows:enriched});
});
routes.put('/alternate-member',async c=>{
 const body=await jsonBody(c.req.raw,1024),project=c.req.param('project')!,db=c.env.DB;
 if(!body||Object.keys(body).sort().join()!=='member'||body.member!==null&&typeof body.member!=='string')throw new Error('Choose an active project member or clear the alternate.');
 if(body.member&&!await activeProjectRecipient(db,project,body.member))throw new Error('Active accountable project member required');
 await ownerWrites(c,[
  ...(body.member?[s(db,`INSERT INTO spool_follow_up_alternates(project,member,updated) VALUES(?,?,?)
   ON CONFLICT(project) DO UPDATE SET member=excluded.member,revision=revision+1,updated=excluded.updated`,project,body.member,Date.now())]:[s(db,'DELETE FROM spool_follow_up_alternates WHERE project=?',project)]),
  auditCommit(db),settingsCustody(db,c.req.raw,'followup',project),
  s(db,"UPDATE follow_up_notices SET state='canceled',code='alternate_changed' WHERE project=? AND state='queued' AND destination LIKE 'member:%' AND destination IS NOT ?",project,body.member?'member:'+body.member:null),
 ]);
 return c.json({saved:true});
});
routes.put('/alternate',async c=>{
 const body=await jsonBody(c.req.raw,1024),project=c.req.param('project')!,env=runtimeBindings(c.env);
 if(body.destination!==null&&(typeof body.destination!=='string'||!['mail','webhook'].includes(body.channel)))throw new Error('Choose a project destination or no alternate.');
 if(body.destination!==null&&(await findDestination(env,project,body.destination,body.channel)).kind==='slack')throw new Error('Slack destinations currently route issue alerts only; choose email or a signed webhook for alternate notices.');
 await ownerWrites(c,[
  s(env.DB,'INSERT INTO follow_up_settings(project,destination,channel,updated) VALUES(?,?,?,?) ON CONFLICT(project) DO UPDATE SET destination=excluded.destination,channel=excluded.channel,revision=revision+1,updated=excluded.updated',project,body.destination,body.destination===null?null:body.channel,Date.now()),
  auditCommit(env.DB),
  s(env.DB,"UPDATE follow_up_notices SET state='canceled',code='alternate_changed' WHERE project=? AND state='queued' AND (destination IS NOT ? OR channel IS NOT ?)",project,body.destination,body.destination===null?null:body.channel),
 ]);
 return c.json({saved:true});
});
for(const action of ['reconcile','resend'] as const)routes.post('/:attention/'+action,async c=>{
 const row=await s(c.env.DB,'SELECT * FROM follow_up_attention WHERE project=? AND id=?',c.req.param('project')!,c.req.param('attention')).first<Attention>();
 if(!row)return c.json({error:'Follow-up not found'},404);
 return attentionAction(c,row,await jsonBody(c.req.raw,4096),action==='resend');
});
export default routes;
