import {followErasure} from './project-erasure/follow.mjs';
import {archiveProjection} from './archive.mjs';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {reviewInboxFlow} from './review-inbox-flow.mjs';
import assert from 'node:assert/strict';
export async function bulkTriageFlow({req,json,base,origin}) {
 const rows=(await json(base+'/issue-search')).rows.slice(0,3),issues=rows.map(({id,revision})=>({id,revision}));
 const input={issues,state:'acknowledged',apply:false};
 const preview=await json(base+'/bulk-triage','POST',input);
 assert.equal(preview.issues.length,3);
 assert.deepEqual((await json(base+'/issue-search')).rows.filter(row=>issues.some(item=>item.id===row.id)).map(row=>row.state),['open','open','open'],'preview has no effects');
 for(const headers of [{Cookie:''},{Origin:'https://forbidden.example'}])assert.ok([401,403].includes((await req(base+'/bulk-triage','POST',input,headers)).status));
 const agent=await json(base+'/keys','POST',{kind:'agent'});
 assert.equal((await req(base+'/bulk-triage','POST',input,{Cookie:'',Authorization:`Bearer ${agent.key}`})).status,403);
 assert.equal((await req(base+'/bulk-triage','POST',{...input,issues:[issues[0],issues[0]]})).status,400);
 assert.equal((await req('/api/projects/wire/bulk-triage','POST',input)).status,409,'foreign selection refused');
 await json(base+'/issues/'+issues[0].id,'PATCH',{state:'resolved',revision:issues[0].revision});
 assert.equal((await req(base+'/bulk-triage','POST',{...input,apply:true,preview:preview.preview})).status,409);
 const unchanged=await Promise.all(issues.map(async item=>(await json(base+'/issues/'+item.id+'/packet')).issue));
 for(const item of issues.slice(1))assert.equal(unchanged.find(row=>row.id===item.id).state,'open','one stale row prevents every other write');
 const current=unchanged.filter(row=>issues.some(item=>item.id===row.id)).map(({id,revision})=>({id,revision}));
 const next={issues:current,state:'acknowledged',apply:false},confirmed=await json(base+'/bulk-triage','POST',next);
 assert.equal((await req(base+'/bulk-triage','POST',{...next,state:'open',apply:true,preview:confirmed.preview})).status,409,'preview bound to action');
 const applied=await json(base+'/bulk-triage','POST',{...next,apply:true,preview:confirmed.preview});assert.equal(applied.changed,3);
 const after=await Promise.all(issues.map(async item=>(await json(base+'/issues/'+item.id+'/packet')).issue));
 for(const item of current){const row=after.find(row=>row.id===item.id);assert.equal(row.state,'acknowledged');assert.equal(row.revision,item.revision+1)}
 assert.equal((await req(base+'/bulk-triage','POST',{...next,apply:true,preview:confirmed.preview})).status,409,'retry cannot repeat the action');
 await sdk009BulkResolution({req,json});
 await suppressionLifecycleFlow({req,json,origin});
 const exported=await json(base+'/issue-export?status=acknowledged');assert.equal(exported.total,3);
 await reviewInboxFlow({req,json,origin});
 console.log('Bulk triage public flow passed: preview, atomic stale refusal, action binding, project/owner/origin scope, apply, revision and query export.');
}

// SDK-009 an explicit dist 'sentry-no-dist' stays distinct from no dist, and next/named-release resolution regresses only on a later release.
async function sdk009BulkResolution({req,json}) {
 const p=await json('/api/projects','POST',{id:'sdk009-bulk',name:'SDK-009 bulk resolution'}),base='/api/projects/sdk009-bulk',dsn=new URL(p.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;const send=async(release,type,dist)=>{const e={event_id:(++serial).toString(16).padStart(32,'0'),...(release===undefined?{}:{release}),...(dist===undefined?{}:{dist}),platform:'python',exception:{values:[{type,value:'Bulk release boundary',stacktrace:{frames:[{filename:'/app/bulk.py',function:type,lineno:8}]}}]}};const r=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify(e));assert.equal(r.status,200,await r.text());return e};
 const types=['BulkFirstError','BulkSecondError'],policy={version:1,order:'semver',pattern:'*'},review=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:review.revision,policy});
 const absent=await send('app@1.2.0',types[0]),explicit=await send('app@1.2.0',types[0],'sentry-no-dist');await send('app@1.2.0',types[1]);let rows=await json(base+'/issues');const packet=await json(base+'/issues/'+rows.find(r=>r.title.startsWith(types[0])).id+'/packet');assert.notEqual(packet.events.find(e=>e.id===absent.event_id).build,packet.events.find(e=>e.id===explicit.event_id).build);
 const select=async(mode,release)=>({issues:(await json(base+'/issues')).map(({id,revision})=>({id,revision})),state:'resolved',resolution:mode,...release?{release}:{},apply:false});
 const resolve=async(mode,release)=>{const input=await select(mode,release),preview=await json(base+'/bulk-triage','POST',input);assert.equal(preview.issues.length,2);await json(base+'/bulk-triage','POST',{...input,apply:true,preview:preview.preview});return preview};
 const states=async expected=>{rows=await json(base+'/issues');assert.equal(rows.length,2);assert.ok(rows.every(r=>r.state===expected),`every selected issue is ${expected}`)};
 await resolve('next');for(const type of types){await send('app@1.2.0',type);await send(undefined,type);}await states('resolved');assert.ok((await json(base+'/issues')).every(r=>r.seen_without_release===1));for(const type of types)await send('app@1.10.0',type);await states('open');
 const sha1='c'.repeat(40),sha2='d'.repeat(40);await send(sha1,types[0]);await send(sha2,types[1]);const releases=await json(base+'/releases');assert.deepEqual(releases.map(r=>r.name),['app@1.2.0','app@1.10.0',sha1,sha2]);assert.ok(releases.every(r=>r.auto_created===1));
 const next=await resolve('next');assert.ok(next.issues.every(r=>r.resolvedSequence===releases.find(r=>r.name===sha2).seq),'next uses project latest even for an issue only seen in an older release');for(const type of types)for(const release of ['app@1.2.0','app@1.10.0',sha1,sha2,undefined])await send(release,type);await states('resolved');
 const namedInput=await select('named',sha2),namedPreview=await json(base+'/bulk-triage','POST',namedInput);assert.equal((await req(base+'/bulk-triage','POST',{...namedInput,release:sha1,apply:true,preview:namedPreview.preview})).status,409,'a reviewed named target cannot change on apply');await json(base+'/bulk-triage','POST',{...namedInput,apply:true,preview:namedPreview.preview});for(const type of types){await send(sha1,type);await send(undefined,type);}await states('resolved');for(const type of types)await send(sha2,type);await states('open');
 await resolve('named','app@1.10.0');for(const type of types)await send('app@1.2.0',type);await states('resolved');for(const type of types)await send('app@1.10.0',type);await states('open');
 await resolve('named',sha1);for(const type of types)await send(sha2,type);await states('open');const input=await select('named',sha2);for(const change of [{release:undefined},{release:'unknown-release'},{resolution:'next'}])assert.equal((await req(base+'/bulk-triage','POST',{...input,...change})).status,400);
 console.log("SDK-009 an explicit dist 'sentry-no-dist' stays distinct from no dist, and next/named-release resolution regresses only on a later release (bulk; two auto semvers and two SHA releases).");
}

export async function suppressionLifecycleFlow({req,json,origin}) {
 const project=await json('/api/projects','POST',{id:'suppression-lifecycle',name:'Checkout suppression deadlines'}),base='/api/projects/'+project.id;
 const identity=await json(base+'/identity-policy'),identityPolicy={...identity.policy,id:'hash'},identityPreview=await json(base+'/identity-policy/preview','POST',{policy:identityPolicy});await json(base+'/identity-policy','PUT',{revision:identity.revision,policy:identityPolicy,token:identityPreview.token});
 const dsn=new URL(project.dsn),door=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;
 const send=async(type,user='customer-one')=>{const response=await req(door,'POST','{}\n{"type":"event"}\n'+JSON.stringify({event_id:(++serial+26000).toString(16).padStart(32,'0'),release:'checkout@1.0.0',level:'warning',user:{id:user},exception:{values:[{type,value:'Checkout is unavailable',stacktrace:{frames:[{filename:'/app/checkout.js',function:type,lineno:24,colno:2}]}}]}}));assert.equal(response.status,200,await response.text())};
 const row=async type=>(await json(base+'/issues')).find(row=>row.title.startsWith(type+':'));
 const modes=['forever','until','count','users','escalating','snooze'];
 for(const mode of modes)await send('Archive'+mode);
 const archive=async(type,suppression)=>{const issue=await row(type),input={revision:issue.revision,suppression,apply:false},preview=await json(base+'/issues/'+issue.id+'/suppression','POST',input);assert.equal((await row(type)).state,'open','archive preview is inert');await json(base+'/issues/'+issue.id+'/suppression','POST',{...input,apply:true,preview:preview.preview});return {issue,preview,input}};
 const now=Date.now(),deadline=now+60000;
 const plans={};
 for(const mode of modes){const type='Archive'+mode,suppression={mode,reason:'Investigating checkout recovery. password=synthetic-archive-secret',...mode==='until'?{until:deadline}:mode==='count'?{count:2}:mode==='users'?{users:2}:mode==='snooze'?{durationMs:60000}:{}};plans[mode]=await archive(type,suppression);assert.ok(!JSON.stringify(plans[mode].preview).includes('synthetic-archive-secret'))}
 const archivedBefore=await json(base+'/issues'),bad=plans.forever;
 assert.equal((await req(base+'/issues/'+bad.issue.id+'/suppression','POST',{...bad.input,apply:true,preview:bad.preview.preview})).status,409);assert.deepEqual(await json(base+'/issues'),archivedBefore,'stale archive cannot mutate issues');
 const untouched=await json(base+'/issues/'+bad.issue.id+'/suppression');assert.equal((await req(base+'/issues/'+bad.issue.id+'/suppression','POST',{revision:(await row('Archiveforever')).revision,suppression:{mode:'count',count:0,reason:'Invalid'},apply:false})).status,400);assert.deepEqual(await json(base+'/issues/'+bad.issue.id+'/suppression'),untouched,'invalid threshold leaves policy and revision unchanged');
 const escalation=await row('Archiveescalating');await json(base+'/issues/'+escalation.id+'/priority','PUT',{priority:'low',revision:escalation.revision});
 await send('Archivecount');await send('Archiveusers');
 const schedule=async time=>{const response=await fetch(origin+'/cdn-cgi/local/scheduled?time='+time+'&cron=*+*+*+*+*&format=json');assert.ok(response.ok,await response.text())};
 await schedule(Date.now());assert.equal((await row('Archivecount')).state,'suppressed');assert.equal((await row('Archiveusers')).state,'suppressed','repeated identity is still one affected user');assert.equal((await row('Archiveescalating')).state,'suppressed','forecast is not exceeded at archive time');
 await send('Archivecount');await send('Archiveusers','customer-two');
 const forecast=plans.escalating.preview.suppression.forecast;assert.ok(Number.isInteger(forecast));for(let i=plans.escalating.preview.suppression.metrics.rollingOccurrences;i<=forecast;i++)await send('Archiveescalating');
 await schedule(Date.now());for(const mode of ['count','users','escalating'])assert.equal((await row('Archive'+mode)).state,'open',mode+' suppression must expire');assert.equal((await row('Archiveescalating')).priority,'low','manual priority survives forecast escalation');
 assert.equal((await json(base+'/issues/'+plans.users.issue.id+'/affected-users')).affectedUsers,plans.users.preview.suppression.userTarget);
 await schedule(deadline+60000);for(const mode of ['until','snooze'])assert.equal((await row('Archive'+mode)).state,'open');assert.equal((await row('Archiveforever')).state,'suppressed');
 const follow=await json(base+'/follow-up'),items=follow.rows.filter(row=>row.source_id.startsWith('suppression:'));assert.equal(items.length,modes.length-1);assert.ok(items.every(row=>row.owner==='installation_owner'&&row.state==='overdue'));
 const beforeRepeat=await Promise.all(modes.map(async mode=>({issue:await row('Archive'+mode),discussion:await json(base+'/issues/'+plans[mode].issue.id+'/discussion')})));
 await schedule(deadline+60000);assert.deepEqual((await json(base+'/follow-up')).rows.filter(row=>row.source_id.startsWith('suppression:')),items,'repeated schedule does not duplicate follow-up');
 const afterRepeat=await Promise.all(modes.map(async mode=>({issue:await row('Archive'+mode),discussion:await json(base+'/issues/'+plans[mode].issue.id+'/discussion')})));assert.deepEqual(afterRepeat,beforeRepeat,'expiry happens once with one timeline entry');
 for(const mode of ['until','count','users','escalating','snooze'])assert.equal((await json(base+'/issues/'+plans[mode].issue.id+'/discussion')).activity.filter(row=>row.kind==='suppression_expired').length,1);
 const completed=items[0];await json(base+'/follow-up/'+completed.id+'/reconcile','POST',{revision:completed.revision,evidence:'issue_reviewed',state:'accepted'});assert.equal((await json(base+'/follow-up')).rows.find(row=>row.id===completed.id).state,'completed');
 const selection=(await json(base+'/issue-search')).rows.filter(row=>row.state==='open').slice(0,2).map(({id,revision})=>({id,revision}));
 const bulk={state:'suppressed',issues:selection,suppression:{mode:'count',reason:'Wait for two additional checkout failures',count:2},apply:false},preview=await json(base+'/bulk-triage','POST',bulk);assert.equal(preview.issues.length,selection.length);assert.ok(preview.issues.every(row=>row.suppression?.occurrenceTarget>0));
 await json(base+'/bulk-triage','POST',{...bulk,apply:true,preview:preview.preview});assert.ok((await json(base+'/issues')).filter(row=>selection.some(s=>s.id===row.id)).every(row=>row.state==='suppressed'));
 const archivedIssue=await row('Archiveforever');await json(base+'/issues/'+archivedIssue.id+'/comments','POST',{revision:archivedIssue.revision,body:'Monitor checkout while the patch is in review.'});
 const saved=await archiveProjection(await req('/api/archive'));
 const restored=await startTestWorker(15576);try{
  const restoredCookie=await signIn(restored.origin),headers={Origin:restored.origin,Cookie:restoredCookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'};
  const response=await fetch(restored.origin+'/api/restore',{method:'POST',headers,body:saved.text});assert.ok(response.ok,await response.text());
  const read=async path=>{const response=await fetch(restored.origin+path,{headers:{Cookie:restoredCookie}});assert.ok(response.ok);return response.json()};
  const copied=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:restoredCookie}}));for(const table of ['issue_priorities','issue_activity','issue_comments','issue_subscriptions','recurrence_policies','issue_suppressions'])assert.deepEqual(copied.data[table],saved.data[table],table+' survives private restore');
  const beforeTick=await read(base+'/issues');const tick=await restored.scheduled(deadline+3600000);assert.ok(tick.ok);await tick.body?.cancel();assert.deepEqual(await read(base+'/issues'),beforeTick,'restored suppression cannot revive a deadline');assert.deepEqual((await read(base+'/follow-up')).rows,[],'restore creates no active follow-up');
 }finally{await restored.stop()}
 const erasure=await json(base+'/erasure');assert.ok(erasure.deleted.issue_suppressions>0&&erasure.deleted.issue_activity>0&&erasure.deleted.issue_priorities>0&&erasure.deleted.issue_comments>0&&erasure.deleted.issue_subscriptions>0);
 await followErasure(json,await json(base+'/erasure','POST',{confirm:project.id,planHash:erasure.planHash}));
 const erased=await archiveProjection(await req('/api/archive'));for(const table of ['issue_priorities','issue_activity','issue_comments','issue_subscriptions','recurrence_policies','issue_suppressions'])assert.ok(!(erased.data[table]??[]).some(row=>row.project===project.id),table+' is removed by project erasure');
 console.log('[TEAM-003] server deadlines, additional occurrences, shared affected-user definition, shown forecast, snooze, one follow-up and bulk suppression preview passed');
 return {project,plans};
}
