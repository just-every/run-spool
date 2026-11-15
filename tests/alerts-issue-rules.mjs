import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {nativeAlertRuntime} from './alerts/native-runtime.mjs';
import {rule,testAndReview} from './alerts/runtime.mjs';
import {fixture,sentry} from './alerts-metric.mjs';
async function join(app,input){
 const invited=await app.json('/api/organization/invites','POST',input),org=await app.json('/api/organization');
 const invitation=org.invites.find(i=>i.member===invited.id),token=new URL(invitation.localLink).searchParams.get('token');
 const confirmed=await app.request('/auth/confirm','POST',{token});assert.equal(confirmed.status,303);
 return {id:invited.id,cookie:confirmed.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
}
export async function issueRuleJourney(app){
 const f=await fixture(app,'target-service'),other=await fixture(app,'target-other');
 const org=await app.json('/api/organization');if(!org.organization)await app.json('/api/organization','POST',{id:'synthetic-spool-1',name:'Platform'});
 const invite=(name,project,role='member',grant='member')=>join(app,{name,email:`synthetic-spool-${name}@example.test`,role,grants:[{project,role:grant}]});
 const member=await invite('maintainer',f.project.id,'member','maintainer'),foreign=await invite('foreign',other.project.id),readonly=await invite('reader',f.project.id,'read-only','member');
 const choices=await app.json(f.base+'/recipients');assert.ok(choices.members.some(m=>m.member===member.id));assert.ok(!choices.members.some(m=>[foreign.id,readonly.id].includes(m.member)));
 for(const actor of [foreign,readonly]){
  const response=await app.request(f.base+'/destinations','POST',{label:'Unauthorized',target:{type:'member',id:member.id}},{Cookie:actor.cookie});assert.equal(response.status,404);
 }
 const foreignRead=await app.request(f.base+'/recipients','GET',undefined,{Cookie:foreign.cookie});assert.equal(foreignRead.status,404);
 const refused=await app.request(f.base+'/destinations','POST',{label:'Wrong project',target:{type:'member',id:foreign.id}});assert.equal(refused.status,400);
 const destinations=[];
 for(const [label,target] of [['Platform team',{type:'team',id:choices.teams[0].team}],['Checkout maintainer',{type:'member',id:member.id}],['Issue owners',{type:'issue_owners',fallthrough:'active_members'}]]){
  const d=await app.json(f.base+'/destinations','POST',{label,target});destinations.push(d.id);await testAndReview(app.json,f.base,d.id);
 }
 const config={metric:'count',filters:{environment:'production',level:'error',levelMatch:'gte',tags:{route:{op:'contains',value:'/checkout%_'},handled:'no'}},tagKeys:['route','handled'],actionIntervalMinutes:30};
 const rules=[];for(const destination of destinations)rules.push(await app.json(f.base+'/rules','POST',rule('mail',{name:'Checkout failures '+rules.length,destination,kinds:['new_issue','regression'],config})));
 let sequence=10000;
 const capture=async(type,level='fatal',route='/checkout%_/pay')=>{
  const response=await sentry(app,f.project,[['event',{event_id:(sequence++).toString(16).padStart(32,'0'),release:'r1',dist:'b1',environment:'production',level,tags:{route},exception:{values:[{type,value:'Checkout could not complete',mechanism:{type:'onerror',handled:false}}]}}]]);assert.equal(response.status,200);return response.json();
 };
 await capture('WarningOnly','warning');await capture('WrongRoute','fatal','/checkoutXX/pay');
 const first=await capture('PaymentFailure');
 const tick=await app.tick();assert.equal(tick.status,200);
 const initial=(await app.json(f.base+'/deliveries')).filter(d=>rules.some(r=>r.id===d.rule_id));assert.equal(initial.length,3);
 for(const delivery of initial){
  const detail=await app.json(f.base+'/deliveries/'+delivery.id),emails=detail.recipients.map(r=>r.email).sort();
  const intended=delivery.rule_id===rules[1].id?choices.members.filter(m=>m.member===member.id):choices.members;
  assert.deepEqual(emails,intended.map(m=>m.email).sort());assert.ok(detail.recipients.every(r=>!['synthetic-spool-foreign@example.test','synthetic-spool-reader@example.test'].includes(r.email)));
 }
 let issue=(await app.json(`/api/projects/${f.project.id}/issues`)).find(i=>i.title.startsWith('PaymentFailure:'));
 await app.json(`/api/projects/${f.project.id}/issues/${issue.id}`,'PATCH',{revision:issue.revision,state:'resolved'});
 await capture('PaymentFailure');await app.tick();
 assert.equal((await app.json(f.base+'/deliveries')).filter(d=>rules.some(r=>r.id===d.rule_id)).length,3,'action interval prevents another notification for the same issue');
 await capture('InventoryFailure');await app.tick();assert.equal((await app.json(f.base+'/deliveries')).filter(d=>rules.some(r=>r.id===d.rule_id)).length,6,'a different issue has its own action interval');
 const before=await Promise.all(initial.map(d=>app.json(f.base+'/deliveries/'+d.id)));
 const current=(await app.json('/api/organization')).members.find(m=>m.id===member.id);
 await app.json('/api/organization/members/'+member.id,'PUT',{version:current.version,role:'member',grants:[{project:other.project.id,role:'member'}]});
 await app.tick();assert.deepEqual(await Promise.all(initial.map(d=>app.json(f.base+'/deliveries/'+d.id))),before,'recipient custody is retained without rerouting or duplicate sends');
 assert.ok(!(await app.json(f.base+'/recipients')).members.some(m=>m.member===member.id));
 const noOwner=await app.json(f.base+'/destinations','POST',{label:'Owners only',target:{type:'issue_owners',fallthrough:'no_one'}});
 const noOwnerTest=await app.json(f.base+'/destinations/'+noOwner.id+'/test','POST',{});assert.equal(noOwnerTest.state,'failing','no invented owner identity authorizes mail');
 return f;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=await nativeAlertRuntime();try{await issueRuleJourney(app);console.log('Authorized recipient custody, issue filters and action intervals passed')}finally{await app.close()}}
