import assert from 'node:assert/strict';
import {rule} from './runtime.mjs';
const base='/api/projects/web/alerting';
const config=(metric,filters={})=>({metric,filters,tagKeys:['tenant']});
export async function conditionsJourney(app,fixture){
 const width=60000,start=Math.floor(Date.now()/width)*width,end=start+width,dsn=new URL(fixture.dsn);
 const send=async(type,value)=>{const r=await app.request(`/api${dsn.pathname}/envelope/?sentry_key=${encodeURIComponent(dsn.username)}`,'POST','{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(value));assert.equal(r.status,200,await r.clone().text());return r.json()};
 const error=async(id,{user,environment='rules',release='r1',level='error',tenant='approved',group='rules',sample=1}={})=>{
  const event_id=id.toString(16).padStart(32,'0');await send('event',{event_id,...release?{release}:{},environment,level,tags:{tenant},sdk:{name:'synthetic-spool',version:'1',sample_rate:sample},...user?{user:{id:user}}:{},exception:{values:[{type:'Error',value:'Synthetic alert conditions',stacktrace:{frames:[{filename:`https://synthetic-spool.test/${group}.js`,function:group,lineno:1,colno:1}]}}]}});
  return (await app.db.prepare('SELECT issue FROM events WHERE project=? AND id=?').bind('web',event_id).first()).issue;
 };
 const userRule=rule('mail',{kinds:['spike'],threshold:3,config:config('users',{environment:'rules'})});
 let preview=await app.json(base+'/rules/preview','POST',userRule);assert.match(preview.refusal,/policy.*drops/i,'identity policy refusal precedes enable');assert.equal(preview.token,null);
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
 await app.tick(end);let decisions=(await app.json(base+'/decisions')).filter(d=>d.rule_id===users.id).map(d=>JSON.parse(d.reason));
 assert.equal(decisions.filter(d=>d.fired).length,1,'four distinct users fire once, three do not');assert.equal(decisions.find(d=>d.fired).users,4);assert.equal(decisions.find(d=>d.fired).unattributed,1,'events without identity remain named');
 const before=(await app.json(base+'/deliveries')).filter(d=>d.rule_id===users.id).length;
 await app.db.prepare('UPDATE alert_cursors SET next_start=? WHERE rule_id=?').bind(start,users.id).run();await app.restart();await app.tick(end);assert.equal((await app.json(base+'/deliveries')).filter(d=>d.rule_id===users.id).length,before,'durable window key deduplicates re-evaluation and restart');
 for(let i=0;i<10;i++)await send('session',{sid:crypto.randomUUID().replaceAll('-',''),started:new Date(start+100).toISOString(),timestamp:new Date().toISOString(),status:'exited',errors:i<3?1:0,attrs:{release:'r1',environment:'sessions'}});
 const sessions=await app.json(base+'/rules','POST',sessionRule);await error(id++,{environment:'sessions'});await app.db.prepare('UPDATE alert_cursors SET next_start=? WHERE rule_id=?').bind(start,sessions.id).run();await app.tick(end);
 const percent=JSON.parse((await app.json(base+'/decisions')).find(d=>d.rule_id===sessions.id).reason);assert.deepEqual([percent.affected,percent.denominator,percent.value,percent.fired],[3,10,30,true],'three affected of ten observed sessions');
 const filtered=await app.json(base+'/rules','POST',rule('mail',{kinds:['new_issue','regression','reactivation'],config:config('count',{environment:'filtered',level:'error',release:'',tags:{tenant:'approved'}})}));
 for(const extra of [{environment:'elsewhere'},{level:'info'},{release:'r1'},{tenant:'outside'}])await error(id++,{environment:'filtered',release:'',group:'excluded-'+id,...extra});
 const a=await error(id++,{environment:'filtered',release:'',group:'included'});
 assert.equal((await app.json(base+'/deliveries')).filter(d=>d.rule_id===filtered.id).length,1,'environment severity release and approved tag filters exclude every nonmatch');
 for(const release of ['r1','']){
  const target=release?await error(id++,{group:'same-release',release}):a;
  const row=(await app.json('/api/projects/web/issues')).find(i=>i.id===target);await app.json('/api/projects/web/issues/'+target,'PATCH',{state:'resolved',revision:row.revision});await error(id++,{environment:release?'rules':'filtered',release,group:release?'same-release':'included'});
  const regressions=(await app.json('/api/projects/web/alerts')).filter(x=>x.issue===target&&x.kind==='regression');assert.equal(regressions.length,1,'plain Resolve regresses exactly once in same release or with no release');
 }
 const row=(await app.json('/api/projects/web/issues')).find(i=>i.id===a);await app.json('/api/projects/web/issues/'+a,'PATCH',{state:'suppressed',revision:row.revision});const suppressed=(await app.json('/api/projects/web/issues')).find(i=>i.id===a);await app.json('/api/projects/web/issues/'+a,'PATCH',{state:'open',revision:suppressed.revision});await error(id++,{environment:'filtered',release:'',group:'included'});assert.equal((await app.json('/api/projects/web/alerts')).filter(x=>x.issue===a&&x.kind==='reactivation').length,1);
 const stale=await app.json(base+'/rules/preview','POST',userRule);const changed={...userRule,name:'Changed after preview',previewToken:stale.token};assert.equal((await app.request(base+'/rules','POST',changed)).status,400,'rule changes invalidate preview');
 console.log('ALERT-001 filters, retained-user windows, explicit session denominator, identity/session refusals, stale preview, durable deduplication, reactivation and plain Resolve passed');
}
