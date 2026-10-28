import assert from 'node:assert/strict';
import {rule} from './runtime.mjs';
const base='/api/projects/web/alerting';
const config=(metric,filters={})=>({metric,filters,tagKeys:['tenant']});
export async function conditionsJourney(app,fixture){
 const schedule=async time=>{const response=await app.tick(time);assert.equal(response.status,200,'native condition evaluation succeeds');assert.equal((await response.json()).outcome,'ok')};
 const width=60000,start=Math.floor(Date.now()/width)*width,end=start+width,dsn=new URL(fixture.dsn);
 const send=async(type,value)=>{const r=await app.request(`/api${dsn.pathname}/envelope/?sentry_version=7&sentry_key=${encodeURIComponent(dsn.username)}`,'POST','{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(value));assert.equal(r.status,200,await r.clone().text());return r.json()};
 const error=async(id,{user,environment='rules',release='r1',level='error',tenant='approved',group='rules',sample=1}={})=>{
  const event_id=id.toString(16).padStart(32,'0');await send('event',{event_id,...release?{release}:{},environment,level,tags:{tenant},sdk:{name:'synthetic-spool',version:'1',sample_rate:sample},...user?{user:{id:user}}:{},exception:{values:[{type:'Error',value:'Synthetic alert conditions',stacktrace:{frames:[{filename:`https://synthetic-spool.test/${group}.js`,function:group,lineno:1,colno:1}]}}]}});
  return (await app.db.prepare('SELECT issue FROM events WHERE project=? AND id=?').bind('web',event_id).first()).issue;
 };
 const untouched=await app.json(base+'/rules');
 const noToken=await app.request(base+'/rules','POST',rule('mail',{name:'Synthetic missing preview',enabled:true}));
 assert.equal(noToken.status,400,'an enabled raw POST without a preview token is refused');await noToken.body.cancel();
 assert.deepEqual(await app.json(base+'/rules'),untouched,'a missing-token POST writes no rule');
 const disabledDraft=rule('mail',{name:'Synthetic disabled draft',enabled:false});
 const disabledRule=await app.json(base+'/rules','POST',disabledDraft);
 const disabledRows=await app.json(base+'/rules');
 const noReenable=await app.request(base+'/rules/'+disabledRule.id,'PUT',{...disabledDraft,enabled:true,revision:disabledRule.revision});
 assert.equal(noReenable.status,400,'a raw re-enable PUT without a preview token is refused');await noReenable.body.cancel();
 assert.deepEqual(await app.json(base+'/rules'),disabledRows,'a missing-token re-enable leaves rules unchanged');
 const userRule=rule('mail',{kinds:['spike'],threshold:3,config:config('users',{environment:'rules'})});
 let preview=await app.json(base+'/rules/preview','POST',userRule);assert.match(preview.refusal,/policy.*drops/i,'identity policy refusal precedes enable');assert.equal(preview.token,null);assert.deepEqual(preview.decisions,[],'an unavailable user condition is refused before measurement');
 const sessionRule=rule('mail',{kinds:['spike'],threshold:30,config:config('session_percent',{environment:'sessions'})});
 preview=await app.json(base+'/rules/preview','POST',sessionRule);assert.match(preview.refusal,/no session data/i,'session data refusal never evaluates zero');
 const identity=await app.json('/api/projects/web/identity-policy'),policy={id:'keep',email:'drop',username:'drop',ip_address:'drop'},ip=await app.json('/api/projects/web/identity-policy/preview','POST',{policy});
 await app.json('/api/projects/web/identity-policy','PUT',{revision:identity.revision,policy,token:ip.token});
 let id=100,issue;
 for(let i=0;i<3;i++)issue=await error(id++,{user:'synthetic-spool-'+i});
 await app.db.prepare("UPDATE events SET received=? WHERE project='web' AND environment='rules'").bind(start-width+100).run();
 for(let i=0;i<4;i++)await error(id++,{user:'synthetic-spool-'+i});await error(id++);
 const users=await app.json(base+'/rules','POST',userRule);
 await app.db.prepare('UPDATE alert_cursors SET next_start=? WHERE rule_id=?').bind(start-width,users.id).run();
 await schedule(end);let decisions=(await app.json(base+'/decisions')).filter(d=>d.rule_id===users.id).map(d=>JSON.parse(d.reason));
 assert.equal(decisions.filter(d=>d.fired).length,1,'four distinct users fire once, three do not');
 const before=(await app.json(base+'/deliveries')).filter(d=>d.rule_id===users.id).length;
 await app.db.prepare('UPDATE alert_cursors SET next_start=? WHERE rule_id=?').bind(start,users.id).run();await app.restart();await schedule(end);assert.equal((await app.json(base+'/deliveries')).filter(d=>d.rule_id===users.id).length,before,'durable window key deduplicates re-evaluation and restart');
 for(let i=0;i<10;i++)await send('session',{sid:crypto.randomUUID().replaceAll('-',''),started:new Date(start+100).toISOString(),timestamp:new Date().toISOString(),status:'exited',errors:i<3?1:0,attrs:{release:'r1',environment:'sessions'}});
 const sessions=await app.json(base+'/rules','POST',sessionRule);await error(id++,{environment:'sessions'});await app.db.prepare('UPDATE alert_cursors SET next_start=? WHERE rule_id=?').bind(start,sessions.id).run();await schedule(end);
 const percent=JSON.parse((await app.json(base+'/decisions')).find(d=>d.rule_id===sessions.id).reason);assert.ok(percent.fired&&percent.affected===3&&percent.denominator===10,'known affected sessions fire using the observed denominator');
 const filtered=await app.json(base+'/rules','POST',rule('mail',{kinds:['new_issue','regression','reactivation'],config:config('count',{environment:'filtered',level:'error',release:'',tags:{tenant:'approved'}})}));
 for(const extra of [{environment:'elsewhere'},{level:'info'},{release:'r1'},{tenant:'outside'}])await error(id++,{environment:'filtered',release:'',group:'excluded-'+id,...extra});
 const a=await error(id++,{environment:'filtered',release:'',group:'included'});
 assert.equal((await app.json(base+'/deliveries')).filter(d=>d.rule_id===filtered.id).length,1,'environment severity release and approved tag filters exclude every nonmatch');
 const row=(await app.json('/api/projects/web/issues')).find(i=>i.id===a);await app.json('/api/projects/web/issues/'+a,'PATCH',{state:'suppressed',revision:row.revision});const suppressed=(await app.json('/api/projects/web/issues')).find(i=>i.id===a);await app.json('/api/projects/web/issues/'+a,'PATCH',{state:'open',revision:suppressed.revision});await error(id++,{environment:'filtered',release:'',group:'included'});assert.equal((await app.json('/api/projects/web/alerts')).filter(x=>x.issue===a&&x.kind==='reactivation').length,1);
 const scheduled=await app.json(base+'/rules','POST',rule('mail',{name:'Synthetic scheduled filters',kinds:['spike'],threshold:2,config:config('count',{environment:'scheduled',level:'error',release:'r1',tags:{tenant:'approved'}})}));
 const created=(await app.json(base+'/rules')).find(row=>row.id===scheduled.id).created,expected=Math.ceil(created/width)*width;
 const initialCursor=await app.db.prepare('SELECT next_start FROM alert_cursors WHERE rule_id=?').bind(scheduled.id).first();
 assert.ok(initialCursor,'enabling a scheduled rule creates its cursor');
 assert.equal(initialCursor.next_start,expected,'enabling starts at the next complete aligned window');
 let scheduledIssue;
 for(const extra of [{},{},{environment:'elsewhere'},{level:'info'},{release:''},{tenant:'outside'}]){
  const eventId=id.toString(16).padStart(32,'0');scheduledIssue=await error(id++,{environment:'scheduled',group:'scheduled',...extra});
  await app.db.prepare("UPDATE events SET received=? WHERE project='web' AND id=?").bind(expected+100,eventId).run();
 }
 const priorEventId=id.toString(16).padStart(32,'0');await error(id++,{environment:'scheduled',group:'scheduled'});
 await app.db.prepare("UPDATE events SET received=? WHERE project='web' AND id=?").bind(expected-width+100,priorEventId).run();
 await schedule(expected+width);
 const scheduledDecisions=(await app.json(base+'/decisions')).filter(row=>row.rule_id===scheduled.id);
 assert.equal(scheduledDecisions.length,1,'only the first complete window is evaluated after enabling');
 assert.equal(scheduledDecisions[0].start,expected,'the evaluated window starts at the enabled cursor');
 assert.equal(scheduledDecisions[0].issue,scheduledIssue,'the scheduled decision belongs to the matching issue');
 const measured=JSON.parse(scheduledDecisions[0].reason);
 assert.equal(measured.count,2,'scheduled filters exclude each environment severity release and tag nonmatch');
 assert.equal((await app.json(base+'/deliveries')).filter(row=>row.rule_id===scheduled.id).length,1,'the matching scheduled window routes exactly one delivery');
 const advancedCursor=await app.db.prepare('SELECT next_start FROM alert_cursors WHERE rule_id=?').bind(scheduled.id).first();
 assert.equal(advancedCursor.next_start,expected+width,'evaluating the first complete window advances the cursor once');
 const policyPreview=await app.json(base+'/rules/preview','POST',userRule);
 const currentPolicy=await app.json('/api/projects/web/identity-policy'),nextPolicy={...currentPolicy.policy,username:'hash'},nextPreview=await app.json('/api/projects/web/identity-policy/preview','POST',{policy:nextPolicy});
 await app.json('/api/projects/web/identity-policy','PUT',{revision:currentPolicy.revision,policy:nextPolicy,token:nextPreview.token});
 const stalePolicy=await app.request(base+'/rules','POST',{...userRule,previewToken:policyPreview.token});assert.equal(stalePolicy.status,400,'identity policy revision changes invalidate an otherwise unchanged rule preview');await stalePolicy.body.cancel();
 const stale=await app.json(base+'/rules/preview','POST',userRule);const changed={...userRule,name:'Changed after preview',previewToken:stale.token};assert.equal((await app.request(base+'/rules','POST',changed)).status,400,'rule changes invalidate preview');
 console.log('ALERT-001 filters, retained-user windows, explicit session denominator, identity/session refusals, stale preview, durable deduplication, reactivation and plain Resolve passed');
}

export async function plainRegression(app,fixture){
 const dsn=new URL(fixture.dsn),base='/api/projects/web';
 for(const release of ['r1','']){
  const group='plain-'+(release||'none');
  const capture=async()=>{
   const event={event_id:crypto.randomUUID().replaceAll('-',''),...release?{release,dist:'b1'}:{},exception:{values:[{type:'Error',value:'Synthetic plain Resolve',stacktrace:{frames:[{filename:group+'.js',function:group,lineno:1,colno:1}]}}]}};
   const r=await app.request('/api'+dsn.pathname+'/envelope/?sentry_version=7&sentry_key='+dsn.username,'POST','{}\n{"type":"event"}\n'+JSON.stringify(event));assert.equal(r.status,200);await r.json();
   return (await app.db.prepare('SELECT issue FROM events WHERE id=?').bind(event.event_id).first()).issue;
  };
  const issue=await capture(),row=(await app.json(base+'/issues')).find(i=>i.id===issue);
  await app.json(base+'/issues/'+issue,'PATCH',{state:'resolved',revision:row.revision,resolution:'plain'});
  await capture();await capture();
  assert.equal((await app.json(base+'/alerts')).filter(a=>a.issue===issue&&a.kind==='regression').length,1,'plain Resolve regresses once in the same release and with no release');
  const alerts=await app.json(base+'/alerts'),regression=alerts.find(a=>a.issue===issue&&a.kind==='regression');
  assert.equal((await app.json(base+'/alerting/deliveries')).filter(d=>d.alert_id===regression.id).length,1);
 }
}

const width=60000,week=7*86400000;

// Public capture produces every occurrence and loss counter. Only receipt dates
// and scheduler cursors move in D1, replaying history without waiting weeks.
async function scenario(app,name,start){
 const project=`synthetic-spool-34-${name}`,root=`/api/projects/${project}`,base=root+'/alerting';
 const created=await app.json('/api/projects','POST',{id:project,name:`Synthetic baseline ${name}`});
 await app.json(root+'/releases','POST',{name:'r1',build:'b1'});
 const destination=await app.json(base+'/destinations','POST',{label:'Synthetic baseline owner',recipient:'synthetic-spool-1@mail.runeditrun.com'});
 const tested=await app.json(`${base}/destinations/${destination.id}/test`,'POST',{});
 assert.equal(tested.state,'passing','the baseline destination passes its public test');
 await app.json(`${base}/destinations/${destination.id}/review`,'POST',{testId:tested.id});
 const dsn=new URL(created.dsn),headers={Authorization:`Bearer ${created.ingestKey}`};
 const sentryPath=`/api${dsn.pathname}/envelope/?sentry_version=7&sentry_key=${encodeURIComponent(dsn.username)}`;
 let serial=0,issue;
 async function receipt(id,time){
  const result=await app.db.prepare('UPDATE events SET received=? WHERE project=? AND id=?').bind(time+100,project,id).run();
  assert.equal(result.meta.changes,1,'each replayed receipt came from accepted public intake');
 }
 async function window(time,target,background,sampleRate=0.5){
  for(let i=0;i<target;i++){
   const id=(++serial).toString(16).padStart(32,'0');
   const event={event_id:id,release:'r1',dist:'b1',environment:name,level:'error',fingerprint:['synthetic-spool-34-target'],
    sdk:{name:'synthetic-spool',version:'1',sample_rate:sampleRate},
    exception:{values:[{type:'Error',value:'Synthetic baseline target',stacktrace:{frames:[{filename:'https://synthetic-spool.test/target.js',function:'baselineTarget',lineno:1,colno:1}]}}]}};
   const response=await app.request(sentryPath,'POST','{}\n{"type":"event"}\n'+JSON.stringify(event));
   assert.equal(response.status,200,'Sentry baseline sample is accepted');await response.json();
   await receipt(id,time);
  }
  for(let i=0;i<background;i++){
   const id=`baseline-${++serial}`;
   await app.json(`/api/ingest/${project}`,'POST',{version:1,eventId:id,release:'r1',build:'b1',environment:name,
    type:'Error',message:'Synthetic baseline background',frames:[{file:'https://synthetic-spool.test/background.js',function:'baselineBackground',line:1,column:0}],breadcrumbs:[]},headers);
   await receipt(id,time);
  }
 }
 async function loss(time,clientReport=false){
  const reason=clientReport?'client_discarded:error:network_error':'invalid';
  const response=clientReport
   ?await app.request(sentryPath,'POST','{}\n{"type":"client_report"}\n'+JSON.stringify({timestamp:Date.now()/1000,discarded_events:[{reason:'network_error',category:'error',quantity:3}]}))
   :await app.request(`/api/ingest/${project}`,'POST',{version:1},headers);
  assert.equal(response.status,clientReport?200:400,'public intake records actual capture loss');await response.json();
  const changed=await app.db.prepare('UPDATE outcomes SET window=? WHERE project=? AND reason=?').bind(time,project,reason).run();
  assert.equal(changed.meta.changes,1,'the public capture outcome supplies the replayed loss window');
 }
 async function enable(){
  const issues=await app.json(root+'/issues');
  issue=issues.find(row=>row.title.includes('Synthetic baseline target'))?.id;
  assert.ok(issue,'the target issue exists through the owner evidence API');
  const rule=await app.json(base+'/rules','POST',{name:`Synthetic ${name} baseline`,enabled:true,channel:'mail',destination:destination.id,
   kinds:['spike'],threshold:2,windowMs:width,config:{metric:'baseline',filters:{environment:name,release:'r1'},tagKeys:[]}});
  return rule;
 }
 async function evaluate(rule){
  await app.db.prepare('UPDATE alert_cursors SET next_start=? WHERE rule_id=?').bind(start,rule.id).run();
  const response=await app.tick(start+width);assert.equal(response.status,200,'native scheduled baseline evaluation succeeds');
  assert.equal((await response.json()).outcome,'ok');
  const rows=(await app.json(base+'/decisions')).filter(row=>row.rule_id===rule.id&&row.issue===issue&&row.start===start);
  assert.equal(rows.length,1,'one durable target decision exists for the completed window');
  return JSON.parse(rows[0].reason);
 }
 const spikes=async()=> (await app.json(root+'/alerts')).filter(row=>row.kind==='spike');
 const deliveries=async(rule)=> (await app.json(base+'/deliveries')).filter(row=>row.rule_id===rule.id);
 return {window,loss,enable,evaluate,spikes,deliveries};
}


export async function baselineJourney(app){
 const start=Math.floor(Date.now()/width)*width-2*width;
 for(const name of ['normal','burst','seasonal','lowtraffic','loss']){
  const flow=await scenario(app,name,start),peak=name==='seasonal';
  for(const offset of [week,2*week])await flow.window(start-offset,peak?6:2,peak?4:8);
  if(peak)await flow.window(start-week-3600000,0,10);
  await flow.window(start,name==='normal'?2:6,name==='lowtraffic'?2:name==='normal'?8:6);
  if(name==='loss')await flow.loss(start,true);
  const rule=await flow.enable(),d=await flow.evaluate(rule),fired=name==='burst';
  assert.equal(d.fired,fired,'normal seasonal low-traffic and lossy windows withhold; a burst fires');
  assert.ok(d.history.length>=2,'clean same-hour weekly history is retained for review');
  if(name==='lowtraffic')assert.match(d.reason,/low traffic/i);
  if(name==='loss')assert.ok(/capture loss/i.test(d.reason)&&d.loss.length,'capture loss is recorded with its reason');
  const deliveries=await flow.deliveries(rule);assert.equal(deliveries.length,fired?1:0);
  await flow.evaluate(rule);await app.restart();await flow.evaluate(rule);
  assert.deepEqual((await flow.deliveries(rule)).map(d=>d.id),deliveries.map(d=>d.id),'restart and repeated evaluation cannot dispatch twice');
 }
 // Historical-only issues must not produce idle decision rows in later windows.
 const idle=await scenario(app,'idle',start);await idle.window(start-week,2,8);const rule=await idle.enable();
 await app.db.prepare('UPDATE alert_cursors SET next_start=? WHERE rule_id=?').bind(start,rule.id).run();await app.tick(start+width);
 assert.equal((await app.json('/api/projects/synthetic-spool-34-idle/alerting/decisions')).length,0,'no current matching accepted event means no decision');
}
