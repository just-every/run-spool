import {launchBrowser} from './browser-launch.mjs';
import {expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {legacyMailRows} from './legacy-mail.mjs';

const types=['resolution','regression','assignment','comment','mention','issue_alert','deploy','weekly_report'];
const choices=(...enabled)=>Object.fromEntries(types.map(type=>[type,enabled.includes(type)]));
const personal=async owner=>(await legacyMailRows(owner.origin)).map(row=>JSON.parse(row.message)).filter(row=>row.subject.startsWith('Spool personal '));
const addresses=rows=>rows.flatMap(row=>row.to).sort();
const kind=(rows,type)=>rows.filter(row=>row.subject==='Spool personal '+type.replaceAll('_',' '));
const tick=async(owner,time)=>{const response=await fetch(owner.origin+'/cdn-cgi/local/scheduled?time='+time+'&cron=*+*+*+*+*&format=json');const text=await response.text();assert.equal(response.status,200,text);};

/** One native public-door sanity journey: choices, recipients, no unsafe send,
 * idempotent schedule, and message capabilities, with real stored mail. */
export async function personalNotificationFlow(owner,actors,projects,invite) {
 const [a,b]=actors,[project,foreign]=projects,root='/api/projects/'+project.id,settings=root+'/notifications/preferences';
 const saved=await Promise.all(actors.map(actor=>actor.json(settings)));
 const set=async(actor,email)=>actor.json(settings,'PUT',{revision:(await actor.json(settings)).revision,email});
 for(const actor of actors)await set(actor,choices(...types));
 const initial=(await personal(owner)).length;
 const capture=async(id,release='synthetic-spool-1',line=10)=>{
  const response=await owner.req('/api/ingest/'+project.id,'POST',{version:1,eventId:id,release,build:'web',environment:'production',type:'SyntheticSpoolNotification',message:'synthetic-spool-notification',frames:[{file:'https://synthetic-spool.example/notifications.js',function:'notify',line,column:0}],breadcrumbs:[]},{Cookie:'',Authorization:'Bearer '+project.ingestKey});
  assert.equal(response.status,201);await response.arrayBuffer();
 };
 await capture('synthetic-spool-personal-1');
 const issue=(await owner.json(root+'/issues')).find(row=>row.type==='SyntheticSpoolNotification'||row.title.includes('synthetic-spool-notification'));assert.ok(issue);
 const door=root+'/issues/'+issue.id;
 const drain=async(time=Date.now()+1000)=>{const before=new Set((await personal(owner)).map(row=>row.deliveryId));await tick(owner,time);return (await personal(owner)).filter(row=>!before.has(row.deliveryId));};
 let sent=await drain();assert.deepEqual(addresses(kind(sent,'issue_alert')),actors.map(actor=>actor.member.email).sort(),'personal issue alerts reach both opted-in project members');assert.equal((await personal(owner)).length,initial+2);
 await a.json(door+'/bookmark','PUT',{bookmarked:true});
 let discussion=await b.json(door+'/discussion');await b.json(door+'/subscription','PUT',{subscribed:true,version:discussion.subscription.version});
 assert.ok((await a.json(door+'/discussion')).subscription.reasons.includes('bookmark'));
 await owner.json(door+'/comments','POST',{body:'synthetic-spool-comment @'+b.member.name});
 sent=await drain();assert.deepEqual(addresses(kind(sent,'comment')),actors.map(actor=>actor.member.email).sort());assert.deepEqual(addresses(kind(sent,'mention')),[b.member.email],'a mention reaches only its resolved native target');
 for(const row of sent){assert.match(row.text,/Settings: https:\/\//);assert.match(row.text,/Unsubscribe from this type in this project: https:\/\//);}
 await a.json(door+'/comments','POST',{body:'synthetic-spool-own-comment'});
 sent=await drain();assert.deepEqual(addresses(kind(sent,'comment')),[b.member.email],'the workflow actor receives no self notification');
 const unsubscribe=kind(sent,'comment')[0].text.match(/https:\/\/\S+\/notifications\/unsubscribe\/[a-f0-9]{64}/)?.[0];assert.ok(unsubscribe);
 const unsubscribePath=new URL(unsubscribe).pathname;
 const beforeA=await a.json(settings);
 const stopped=await owner.req(unsubscribePath,'GET',undefined,{Cookie:''});assert.equal(stopped.status,200);await stopped.arrayBuffer();
 assert.equal((await b.json(settings)).email.comment,false);assert.deepEqual((await a.json(settings)).email,beforeA.email,'message capability changes only its own recipient');
 await owner.json(door+'/comments','POST',{body:'synthetic-spool-after-unsubscribe'});
 sent=await drain();assert.deepEqual(addresses(kind(sent,'comment')),[a.member.email],'link unsubscribe applies before the next matching message');
 const snapshot=await b.json(settings),bad=await owner.req(unsubscribePath+'?member='+a.member.id,'GET',undefined,{Cookie:''});assert.equal(bad.status,404);await bad.arrayBuffer();assert.deepEqual(await b.json(settings),snapshot,'a widened message capability is refused without mutation');
 // A queued message is canceled by the link before dispatch, not just hidden
 // from future event expansion. Repeated use remains safely idempotent.
 await set(b,choices(...types));await owner.json(door+'/comments','POST',{body:'synthetic-spool-queued-before-unsubscribe'});
 await (await owner.req(unsubscribePath,'POST',undefined,{Cookie:''})).arrayBuffer();
 sent=await drain();assert.deepEqual(addresses(kind(sent,'comment')),[a.member.email],'unsubscribe cancels an already queued matching message');
 discussion=await b.json(door+'/discussion');await b.json(door+'/subscription','PUT',{subscribed:false,version:discussion.subscription.version});
 await owner.json(door+'/comments','POST',{body:'synthetic-spool-explicit @'+b.member.name});
 sent=await drain();assert.deepEqual(addresses(kind(sent,'comment')),[a.member.email]);assert.equal(kind(sent,'mention').length,0,'explicit unsubscribe wins over a later automatic mention');
 let current=(await owner.json(root+'/issues')).find(row=>row.id===issue.id);
 await owner.json(door,'PATCH',{state:'resolved',revision:current.revision,resolution:'plain'});
 sent=await drain();assert.deepEqual(addresses(kind(sent,'resolution')),[a.member.email]);
 await capture('synthetic-spool-personal-2');
 sent=await drain();assert.deepEqual(addresses(kind(sent,'regression')),[a.member.email]);
 // Native assignment is explicit; labels alone are retained as inert labels.
 current=(await owner.json(root+'/issues')).find(row=>row.id===issue.id);
 await owner.json(door+'/assignment','PATCH',{label:'synthetic-spool-assignee',member:a.member.id,revision:current.revision});
 sent=await drain();assert.deepEqual(addresses(kind(sent,'assignment')),[a.member.email]);assert.ok((await a.json(door+'/discussion')).subscription.reasons.includes('assignment'));
 const beforeInvalid=await a.json(door+'/discussion');
 const refused=await owner.req(door+'/assignment','PATCH',{label:'synthetic-spool-foreign',member:'synthetic-spool-missing',revision:beforeInvalid.revision});assert.equal(refused.status,404);await refused.arrayBuffer();assert.deepEqual(await a.json(door+'/discussion'),beforeInvalid,'an unavailable native assignee cannot mutate the issue or subscriptions');
 await owner.json(door+'/assignment','PATCH',{label:'synthetic-spool-team',team:project.id,revision:beforeInvalid.revision});
 sent=await drain();assert.deepEqual(addresses(kind(sent,'assignment')),[a.member.email],'explicit unsubscribe also overrides team assignment');assert.ok((await a.json(door+'/discussion')).subscription.reasons.includes('team'));
 // The release carries a recorded author. The other member has the same deploy
 // opt-in but no included commit, so preference alone cannot select them.
 const sha='e'.repeat(40),started=new Date(Date.now()).toISOString(),deadline=new Date(Date.now()+60000).toISOString();
 await owner.json(root+'/deployments','POST',{id:'synthetic-spool-personal-deploy',release:'synthetic-spool-1',build:'web',environment:'production',repository:'https://github.com/just-every/run-spool',commitSha:sha,includedCommits:[{sha,author:{email:a.member.email,name:'synthetic-spool-author'}}],startedAt:started,deadline,destination:'synthetic-spool-mail'});
 await owner.json(root+'/deployments/synthetic-spool-personal-deploy/callbacks','POST',{callback:'synthetic-spool-success',state:'succeeded',exposure:100,at:started});
 sent=await drain();assert.deepEqual(addresses(kind(sent,'deploy')),[a.member.email],'deploy notification matches only the included commit author');
 const week=Date.now()+14*86400000;
 sent=await drain(week);assert.deepEqual(addresses(kind(sent,'weekly_report').filter(row=>row.text.includes('Project: '+project.id+'.'))),actors.map(actor=>actor.member.email).sort(),'weekly report requires each member’s opt-in');
 assert.deepEqual(addresses(kind(sent,'weekly_report').filter(row=>row.text.includes('Project: '+foreign.id+'.'))),[a.member.email],'the second project retains its independently saved weekly opt-in');
 for(const row of kind(sent,'weekly_report')){assert.match(row.text,/Calendar period:/);assert.match(row.text,/including loss:/);assert.match(row.text,/backlog:/);}
 assert.equal((await drain(week)).length,0,'repeated schedules do not resend events or the same calendar report');
 // Personal calendar settings are independent, current-person-only choices.
 const digestPath=settings.replace(/preferences$/,'digest');
 for(const [index,actor] of actors.entries())await actor.json(digestPath,'PUT',{revision:0,timezone:index===0?['America','New_York'].join('/'):'UTC',hour:index===0?9:12,daily:true,weekly:true});
 const scheduleBefore=await a.json(digestPath),invalid=await a.req(digestPath,'PUT',{...scheduleBefore,member:b.member.id});assert.equal(invalid.status,400);await invalid.arrayBuffer();assert.deepEqual(await a.json(digestPath),scheduleBefore);
 const calendarTime=Date.now()+21*86400000;
 sent=await drain(calendarTime);
 for(const type of ['daily_digest','weekly_digest'])assert.deepEqual(addresses(kind(sent,type)),actors.map(actor=>actor.member.email).sort(),'each enabled personal calendar digest reaches its current recipient');
 for(const row of kind(sent,'daily_digest'))assert.ok(row.text.includes('Timezone: '+(row.to.includes(a.member.email)?['America','New_York'].join('/'):'UTC')));
 assert.equal((await drain(calendarTime)).length,0,'one delivery per completed personal calendar period');
 const dailyLink=kind(sent,'daily_digest').find(row=>row.to.includes(a.member.email)).text.match(/https:\/\/\S+\/notifications\/unsubscribe\/[a-f0-9]{64}/)[0];
 await (await owner.req(new URL(dailyLink).pathname,'POST',undefined,{Cookie:''})).arrayBuffer();assert.equal((await a.json(digestPath)).daily,false);assert.equal((await b.json(digestPath)).daily,true);
 sent=await drain(calendarTime+86400000);assert.deepEqual(addresses(kind(sent,'daily_digest')),[b.member.email],'digest unsubscribe stops the next calendar delivery for only its person');
 await personalIssueBrowser(owner,a,project,issue);
 // An explicitly reviewed project rule still obeys personal opt-out. Only a
 // native organization administrator can override it, with visible disclosure.
 const destination=await owner.json(root+'/alerting/destinations','POST',{label:'synthetic-spool-personal-rule',recipient:a.member.email});
 const check=await owner.json(root+'/alerting/destinations/'+destination.id+'/test','POST',{});
 await owner.json(root+'/alerting/destinations/'+destination.id+'/review','POST',{testId:check.id});
 const rule=await owner.json(root+'/alerting/rules','POST',{name:'synthetic-spool-required-rule',enabled:true,channel:'mail',destination:destination.id,kinds:['new_issue'],windowMs:60000,threshold:2});
 const policy=root+'/notifications/mandatory-rules/'+rule.id;
 await set(a,choices());await set(b,choices('issue_alert'));
 const all=async()=>new Set((await legacyMailRows(owner.origin)).map(row=>row.id));
 const delivered=async before=>(await legacyMailRows(owner.origin)).filter(row=>!before.has(row.id)).map(row=>JSON.parse(row.message)).filter(row=>row.to.some(address=>actors.some(actor=>actor.member.email===address)));
 let mailBefore=await all();await capture('synthetic-spool-rule-1','synthetic-spool-1',11);await drain();
 let ruleMail=await delivered(mailBefore);assert.deepEqual(addresses(ruleMail),[b.member.email],'personal opt-out stops even a configured rule mailbox without stopping another member');
 let refusal=await a.req(policy,'PUT',{revision:0,mandatory:true});assert.equal(refusal.status,404);await refusal.arrayBuffer();assert.equal((await owner.json(root+'/notifications/mandatory-rules')).find(row=>row.id===rule.id).mandatory,0,'ordinary member cannot require a rule');
 const admin=await invite(owner,owner.origin,{email:['synthetic-spool-33','example.test'].join('@'),name:'synthetic-spool-33',role:'admin',grants:[]});
 await admin.json(policy,'PUT',{revision:0,mandatory:true});
 mailBefore=await all();await capture('synthetic-spool-rule-2','synthetic-spool-1',12);await drain();ruleMail=await delivered(mailBefore);
 assert.deepEqual(addresses(ruleMail),actors.map(actor=>actor.member.email).sort(),'a mandatory rule reaches the opted-out current person exactly once, without duplicating optional delivery');
 const mandatory=ruleMail.find(row=>row.to.includes(a.member.email));assert.match(mandatory.text,/mandatory/i);assert.match(mandatory.text,/Settings: https:\/\//);assert.match(mandatory.text,/Unsubscribe/);
 await mandatorySettingsBrowser(owner,a,project);
 await owner.json(policy,'PUT',{revision:1,mandatory:false});
 mailBefore=await all();await capture('synthetic-spool-rule-3','synthetic-spool-1',13);await drain();assert.deepEqual(addresses(await delivered(mailBefore)),[b.member.email]);
 assert.equal((await owner.json(root+'/alerting/rules')).find(row=>row.id===rule.id).enabled,1,'personal opt-out leaves the project rule enabled');
 console.log('PROBE TEAM-005 mandatory rules: reviewed rule mailbox plus member opt-out -> member refused mandatory change, native admin enabled disclosed mandatory delivery exactly once, owner removed override and optional opt-out resumed without disabling rule');
 console.log('PROBE TEAM-005 personal digests: independent timezone and hour schedules, repeated calendar ticks and message-link unsubscribe -> one digest per period; chosen member stopped, other member unchanged; loss and backlog remain disclosed');
 // A different current member queues mail and is removed before the provider
 // edge. Their old capability cannot affect a later member or opt-in.
 const removed=await invite(owner,owner.origin,{email:['synthetic-spool-32','example.test'].join('@'),name:'synthetic-spool-32',role:'member',grants:[{project:project.id,role:'member'}]});
 await set(removed,choices('comment'));
 await removed.json(door+'/bookmark','PUT',{bookmarked:true});await owner.json(door+'/comments','POST',{body:'synthetic-spool-revoked-queue'});
 const member=(await owner.json('/api/organization')).members.find(row=>row.id===removed.member.id);
 await owner.json('/api/organization/members/'+member.id,'DELETE',{version:member.version});
 sent=await drain();assert.ok(!addresses(sent).includes(removed.member.email),'member removal cancels queued mail at the delivery boundary');
 // Cross-project events do not consult preferences from this project.
 const prior=(await personal(owner)).length;
 const badScope=await removed.req('/api/projects/'+foreign.id+'/notifications/preferences');assert.ok([401,403,404].includes(badScope.status));await badScope.arrayBuffer();assert.equal((await personal(owner)).length,prior);
 for(const [index,actor] of actors.entries())await set(actor,saved[index].email);
 const archive=await owner.req('/api/archive'),text=await archive.text();assert.equal(archive.status,200);
 const rows=text.trim().split('\n').flatMap(line=>JSON.parse(line).items??[]).filter(row=>row.kind==='row');
 const history=rows.filter(row=>row.table==='spool_personal_mail').map(row=>row.row);for(const row of history)assert.ok(row.updated>=row.created,'notification history chronology: '+row.type+' '+row.state+' '+row.code);assert.ok(history.some(row=>row.type==='comment')&&history.some(row=>row.type==='deploy')&&history.some(row=>row.type==='weekly_report'));assert.ok(history.every(row=>row.operator_id===null&&row.historical===1&&row.state==='historical'));
 assert.ok(!rows.some(row=>row.table==='spool_personal_unsubscribe'),'private archive excludes message capabilities');
 console.log('PROBE TEAM-005 delivery: native assignment, comment, mention, resolution, regression, issue alert, commit-matched deploy and weekly report -> exact opted-in recipients; workflow actor excluded; repeated schedules produce no duplicate');
 console.log('PROBE TEAM-005 unsubscribe: bearer message link and queued follow-up -> matching personal type stopped before next send; other member unchanged; widened link refused; removed recipient receives no queued mail');
 return {issue:issue.id};
}

export async function personalNotificationJourney(runtime,client,invite) {
 const worker=await runtime({ALERT_DESTINATIONS:JSON.stringify([{id:'synthetic-spool-mail',project:'synthetic-spool-1',label:'Synthetic Spool',channel:'mail',recipient:['synthetic-spool-90','example.test'].join('@')}])});
 try {
  const owner={...client(worker.origin,worker.cookie),origin:worker.origin,cookie:worker.cookie};
  await owner.json('/api/organization','POST',{id:'synthetic-spool-1',name:'synthetic-spool-1'});
  const projects=[];
  for(const id of ['synthetic-spool-1','synthetic-spool-2']){
   projects.push(await owner.json('/api/projects','POST',{id,name:id}));
   await owner.json('/api/organization/projects/'+id,'PUT',{team:id});
   await owner.json('/api/projects/'+id+'/releases','POST',{name:'synthetic-spool-1',build:'web'});
  }
  const actors=[];for(const n of [30,31])actors.push(await invite(owner,owner.origin,{email:['synthetic-spool-'+n,'example.test'].join('@'),name:'synthetic-spool-'+n,role:'member',grants:projects.map(project=>({project:project.id,role:'member'}))}));
  const foreign='/api/projects/'+projects[1].id+'/notifications/preferences';
  await actors[0].json(foreign,'PUT',{revision:0,email:choices('weekly_report')});
  await personalNotificationFlow(owner,actors,projects,invite);
  const archive=await (await owner.req('/api/archive')).text();
  const fresh=await runtime();
  try {
   const restored={...client(fresh.origin,fresh.cookie),origin:fresh.origin,cookie:fresh.cookie};
   const response=await restored.req('/api/restore','POST',archive,{'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'}),value=await response.json();assert.equal(response.status,200,JSON.stringify(value));
   const carried=(await fresh.DB.prepare('SELECT * FROM spool_personal_mail').all()).results;assert.ok(carried.length);assert.ok(carried.every(row=>row.historical===1&&row.operator_id===null&&row.state==='historical'));
   assert.equal((await fresh.DB.prepare('SELECT COUNT(*) n FROM spool_personal_unsubscribe').first()).n,0);
   const before=(await personal(restored)).length;await tick(restored,Date.now()+21*86400000);assert.equal((await personal(restored)).length,before,'restoring retained notification history sends no mail');
   console.log('PROBE TEAM-005 delivery custody: native archive and independent restore -> historical delivery and subscription rows preserved with null authority; capabilities absent; scheduled replay sends no mail');
  } finally {await fresh.close();}
  const erasure='/api/projects/'+projects[0].id+'/erasure',preview=await owner.json(erasure);
  for(const table of ['spool_personal_mail','spool_personal_unsubscribe','spool_issue_follows','spool_personal_digest_settings','spool_personal_rule_settings'])assert.ok(preview.deleted[table]>0,'project erasure includes '+table);
  let receipt=await owner.json(erasure,'POST',{confirm:projects[0].id,planHash:preview.planHash});
  for(let attempt=0;receipt.phase!=='complete'&&attempt<20;attempt++)receipt=await owner.json('/api/erasures/'+receipt.id+'/resume','POST',{});
  assert.equal(receipt.phase,'complete');
  for(const table of ['spool_personal_mail','spool_personal_unsubscribe','spool_issue_follows','spool_personal_digest_settings','spool_personal_rule_settings'])assert.equal((await worker.DB.prepare('SELECT COUNT(*) n FROM '+table+' WHERE project=?').bind(projects[0].id).first()).n,0);
  const oldRestore=await owner.req('/api/restore','POST',archive,{'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'});assert.ok([400,409].includes(oldRestore.status));await oldRestore.arrayBuffer();
  console.log('PROBE TEAM-005 project erasure: preview and owner-confirmed deletion -> personal queues, links, follows, calendar settings and mandatory policy removed; older archive cannot revive them');
 } finally {await worker.close();}
}

async function personalIssueBrowser(owner,actor,project,issue) {
 const browser=await launchBrowser();
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),split=actor.cookie.indexOf('=');
  await context.addCookies([{name:actor.cookie.slice(0,split),value:actor.cookie.slice(split+1),url:owner.origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();await page.goto(owner.origin+'/projects/'+project.id+'/issues/'+issue.id);
  const discussion=page.getByRole('region',{name:'Discussion',exact:true});
  await discussion.getByRole('button',{name:'Remove bookmark',exact:true}).click();await discussion.getByRole('button',{name:'Bookmark issue',exact:true}).click();
  await expect(discussion.getByText(/you bookmarked it/)).toBeVisible();
  await page.getByRole('combobox',{name:'Assignment target',exact:true}).selectOption('member:'+actor.member.id);
  await page.getByRole('button',{name:'Save assignment',exact:true}).click();
  await expect(discussion.getByText(/you are assigned/)).toBeVisible();
  const folder=process.env.SPOOL_TEAM_EVIDENCE||'.artifacts/team';await mkdir(folder,{recursive:true});
  await page.screenshot({path:resolve(folder,'personal-issue-1440.png'),fullPage:true});
  await page.setViewportSize({width:390,height:900});await page.screenshot({path:resolve(folder,'personal-issue-390.png'),fullPage:true});
  await context.close();
 }finally {await browser.close();}
}

async function mandatorySettingsBrowser(owner,actor,project) {
 const browser=await launchBrowser();
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),split=actor.cookie.indexOf('=');await context.addCookies([{name:actor.cookie.slice(0,split),value:actor.cookie.slice(split+1),url:owner.origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();await page.goto(owner.origin+'/projects/'+project.id+'/settings');
  const panel=page.getByRole('region',{name:'Personal notifications',exact:true}),rule=panel.getByRole('checkbox',{name:'synthetic-spool-required-rule',exact:true});
  await expect(rule).toBeChecked();await expect(rule).toBeDisabled();await expect(panel.getByRole('checkbox',{name:'Issue alerts',exact:true})).not.toBeChecked();
  const folder=process.env.SPOOL_TEAM_EVIDENCE||'.artifacts/team';await mkdir(folder,{recursive:true});await panel.screenshot({path:resolve(folder,'mandatory-settings-1440.png')});await page.setViewportSize({width:390,height:900});await panel.screenshot({path:resolve(folder,'mandatory-settings-390.png')});await context.close();
 }finally {await browser.close();}
}
