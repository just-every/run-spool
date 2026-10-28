import {followErasure} from './project-erasure/follow.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {launchBrowser} from './browser-launch.mjs';
import {archiveProjection} from './archive.mjs';
import {startTestWorker} from './worker.mjs';
import {signIn,testOwner} from './auth.mjs';
import {alertRuntime,rule,prepareDestinations} from './alerts/runtime.mjs';
import {receiver} from './alerts/receiver.mjs';
export async function releaseIdentityFlow({req,json,origin,cookie}){
 await issuePriorityFlow({req,json});
 const project=await json('/api/projects','POST',{id:'release-identity',name:'Cedar checkout releases'}),base='/api/projects/release-identity';
 const dsn=new URL(project.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;
 const make=(release,dist)=>({event_id:(++serial).toString(16).padStart(32,'0'),...(release===undefined?{}:{release}),...(dist===undefined?{}:{dist}),platform:'python',environment:'production',sdk:{name:'sentry.python',version:'2.0'},exception:{values:[{type:'CheckoutError',value:'Account is unavailable',stacktrace:{frames:[{filename:'/app/checkout.py',function:'checkout',lineno:12}]}}]}});
 const send=async(release,dist)=>{const e=make(release,dist),r=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify(e));assert.equal(r.status,200,await r.text());return e};
 await send();assert.equal((await json(base+'/issues')).length,1);assert.equal((await json(base+'/releases')).length,0,'release-less capture creates no pretend release');assert.equal((await json(base+'/issue-search?q=!has:release')).total,1);
 await send('checkout@1.10.0+3');const older=await send('checkout@1.2.0+1','ios');await send('checkout@1.10.0+3','android');
 let releases=await json(base+'/releases');assert.equal(releases.length,2);assert.ok(releases.every(r=>r.auto_created===1&&r.first_seen&&JSON.parse(r.creating_sdk).name==='sentry.python'));
 const before=releases.find(r=>r.name==='checkout@1.10.0+3');
 const issue=()=>json(base+'/issues').then(rows=>rows[0]);let row=await issue();
 await json(base+'/issues/'+row.id,'PATCH',{revision:row.revision,state:'resolved',resolution:'plain'});await send('checkout@1.10.0+3');assert.equal((await issue()).state,'open');assert.equal((await json(base+'/alerts')).filter(a=>a.kind==='regression').length,1);
 row=await issue();await json(base+'/issues/'+row.id,'PATCH',{revision:row.revision,state:'resolved',resolution:'plain'});await send();assert.equal((await issue()).state,'open');assert.equal((await json(base+'/alerts')).filter(a=>a.kind==='regression').length,2);
 // Registered identities enrich the existing row and preserve first-seen metadata.
 const enriched=await json(base+'/releases','POST',{name:before.name,build:before.build});assert.equal(enriched.seq,before.seq);releases=await json(base+'/releases');assert.equal(releases.find(r=>r.name===before.name).auto_created,0);assert.equal(releases.find(r=>r.name===before.name).first_seen,before.first_seen);
 // A late older semantic version must not move the current resolution boundary backwards.
 const semantic={version:1,order:'semver',pattern:'*'};const semanticPreview=await json(base+'/release-policy/preview','POST',{policy:semantic});await json(base+'/release-policy','PUT',{revision:semanticPreview.revision,policy:semantic});
 row=await issue();await json(base+'/issues/'+row.id,'PATCH',{revision:row.revision,state:'resolved',resolution:'current'});const boundaryPreview=await json(base+'/release-policy/preview','POST',{policy:{version:1,order:'registered',pattern:'*'}});assert.ok(boundaryPreview.rows[0].changedReleaseComparisons.includes('checkout@1.2.0+1'));await send();assert.equal((await issue()).state,'resolved');assert.equal((await issue()).seen_without_release,1);await send('checkout@1.2.0+1','ios');assert.equal((await issue()).state,'resolved');await send('checkout@1.10.0+3');assert.equal((await issue()).state,'resolved');await send('checkout@1.11.0+1');assert.equal((await issue()).state,'open','semantic order protects late older and same-release capture');
 await send('bad/name');assert.equal((await json(base+'/releases')).length,3);assert.ok((await json(base+'/outcomes')).rows.some(r=>r.reason==='sentry_release_invalid_release_name'));
 const policy={version:1,order:'sentry',pattern:'checkout@*'};let preview=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:preview.revision,policy});await send('foreign@1.0.0');assert.equal((await json(base+'/releases')).length,3);assert.ok((await json(base+'/outcomes')).rows.some(r=>r.reason==='sentry_release_automatic_release_pattern'));
 const strict={...policy,order:'registered'};preview=await json(base+'/release-policy/preview','POST',{policy:strict});await json(base+'/release-policy','PUT',{revision:preview.revision,policy:strict});
 for(const [e,reason] of [[make(),'missing_release_register_required'],[make('unregistered@2.0.0'),'unregistered_release_or_build'],[make('checkout@1.2.0+1','ios'),'unregistered_release_or_build'],[make('checkout@1.10.0+3','android'),'unregistered_release_or_build']]){const r=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify(e));assert.equal(r.status,422);assert.equal((await r.json()).reason,reason)}
 assert.equal((await req(base+'/release-policy','PUT',{revision:0,policy})).status,409);assert.equal((await req(base+'/release-policy','PUT',{revision:2,policy},{Origin:'https://foreign.invalid'})).status,403);
 row=await issue();const bulkInput={issues:[{id:row.id,revision:row.revision}],state:'resolved',resolution:'current',apply:false};const staleBulk=await json(base+'/bulk-triage','POST',bulkInput);const policyBefore=await json(base+'/release-policy');await json(base+'/release-policy','PUT',{revision:policyBefore.revision,policy:policyBefore.policy});assert.equal((await req(base+'/bulk-triage','POST',{...bulkInput,apply:true,preview:staleBulk.preview})).status,409,'policy change invalidates a previously reviewed bulk decision');assert.equal((await issue()).state,row.state);
 await sdk009ReleaseResolution({req,json});
 const sdkProject=await json('/api/projects','POST',{id:'release-sdk',name:'Unmodified Node release identity'});
 const program="import * as Sentry from '@sentry/node';Sentry.init({dsn:process.env.SPOOL_DSN});Sentry.captureException(new Error('SDK release identity'));if(!await Sentry.flush(10000))throw new Error('SDK did not flush');await Sentry.close();";
 for(const release of [undefined,'b'.repeat(40)]){await promisify(execFile)(process.execPath,['--input-type=module','-e',program],{cwd:process.cwd(),env:{PATH:process.env.PATH,HOME:process.env.HOME,SPOOL_DSN:sdkProject.dsn,...release?{SENTRY_RELEASE:release}:{}},timeout:20000});}
 assert.equal((await json('/api/projects/release-sdk/issue-search?q=!has:release')).total,1,'unmodified Node SDK without release is accepted');
 const sdkReleases=await json('/api/projects/release-sdk/releases');assert.equal(sdkReleases.length,1);assert.equal(sdkReleases[0].name,'b'.repeat(40));assert.equal(sdkReleases[0].auto_created,1);assert.ok(JSON.parse(sdkReleases[0].creating_sdk).name.includes('node'));
 const archive=await archiveProjection(await req('/api/archive'));assert.equal(archive.data.release_metadata.filter(r=>r.project==='release-identity').length,3);assert.ok(archive.data.events.some(e=>e.project==='release-identity'&&e.release===''&&e.release_seq===0));
 const restored=await startTestWorker(15526);try{const restoredCookie=await signIn(restored.origin);const r=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:restoredCookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:archive.text});assert.ok(r.ok,await r.text());const copied=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:restoredCookie}}));for(const t of ['release_metadata','release_builds','release_policies','issue_resolutions'])assert.deepEqual(copied.data[t],archive.data[t]);}finally{await restored.stop()}
 const browser=await launchBrowser();try{await mkdir('.artifacts/release-identity',{recursive:true});for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies(cookie.split('; ').map(v=>({name:v.slice(0,v.indexOf('=')),value:v.slice(v.indexOf('=')+1),url:origin})));const page=await context.newPage();
  await page.goto(origin+'/projects/release-identity/settings');const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Sentry release identity',exact:true})});await panel.getByLabel('Release ordering rule',{exact:true}).selectOption('sentry');await panel.getByRole('button',{name:'Preview release policy',exact:true}).click();await panel.getByRole('heading',{name:'Resolution boundary preview',exact:true}).waitFor();await panel.screenshot({path:`.artifacts/release-identity/policy-${width}.png`});await panel.getByRole('button',{name:'Save release policy',exact:true}).click();await panel.getByRole('status').filter({hasText:'Release policy saved'}).waitFor();
  await page.goto(origin+'/projects/release-identity/releases');await page.getByRole('heading',{name:'Release history',exact:true}).waitFor();await page.locator('.data-row').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:`.artifacts/release-identity/history-${width}.png`,fullPage:true});
  row=await issue();await page.goto(origin+'/projects/release-identity/issues/'+row.id);await page.getByLabel('Resolution',{exact:true}).selectOption('plain');await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('resolved');await page.waitForFunction(()=>document.querySelector('.state-chip')?.textContent==='Resolved');await page.locator('.issue-summary').screenshot({path:`.artifacts/release-identity/resolved-${width}.png`});const recurrence=await send();
  await Promise.all([
   page.waitForResponse(response=>response.url().endsWith('/packet')&&response.ok(),{timeout:30000}).then(async()=>{
    const read=await page.waitForRequest(request=>new URL(request.url()).pathname===`${base}/issues/${row.id}/events`,{timeout:30000});
    const response=await read.response();assert.ok(response?.ok(),'The refreshed issue event list answers before navigation');
   }),
   page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  ]);
  await page.waitForFunction(()=>document.querySelector('.state-chip')?.textContent==='Open');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.getByRole('button',{name:'Latest',exact:true}).click();await page.locator(`.metadata[data-event-id="${recurrence.event_id}"]`).waitFor();await page.locator('.issue-summary').screenshot({path:`.artifacts/release-identity/regressed-${width}.png`});await page.goto(origin+'/projects/release-identity/issues');await page.locator('.issue-select input').first().check();await page.getByRole('combobox',{name:'Bulk action',exact:true}).selectOption('resolved');await page.getByRole('combobox',{name:'Bulk resolution',exact:true}).selectOption('plain');await page.getByRole('button',{name:'Preview triage',exact:true}).click();await page.getByRole('button',{name:'Apply to 1 issue',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.locator('.bulk-triage').screenshot({path:`.artifacts/release-identity/bulk-${width}.png`});await page.getByRole('button',{name:'Apply to 1 issue',exact:true}).click();await page.getByRole('status').filter({hasText:'1 issue resolved.'}).waitFor();await send();assert.equal((await issue()).state,'open');
  await page.goto(origin+'/projects/release-identity/issues/'+row.id);await page.getByLabel('Resolution',{exact:true}).selectOption('next');await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('resolved');await page.waitForFunction(()=>document.querySelector('.state-chip')?.textContent==='Resolved');await page.locator('.issue-summary').screenshot({path:`.artifacts/release-identity/next-${width}.png`});await send('checkout@1.11.0+1');assert.equal((await issue()).state,'resolved');
  await page.goto(origin+'/projects/release-identity/issues/'+row.id);await page.getByLabel('Resolution',{exact:true}).selectOption('named');await page.getByLabel('Resolution release',{exact:true}).selectOption('checkout@1.11.0+1');await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('open');await page.waitForFunction(()=>document.querySelector('.state-chip')?.textContent==='Open');await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('resolved');await page.waitForFunction(()=>document.querySelector('.state-chip')?.textContent==='Resolved');await page.locator('.issue-summary').screenshot({path:`.artifacts/release-identity/named-${width}.png`});await send('checkout@1.11.0+1');assert.equal((await issue()).state,'open');
  for(const mode of ['next','named']){await page.goto(origin+'/projects/release-identity/issues');await page.locator('.issue-select input').first().check();await page.getByRole('combobox',{name:'Bulk action',exact:true}).selectOption('resolved');await page.getByRole('combobox',{name:'Bulk resolution',exact:true}).selectOption(mode);if(mode==='named')await page.getByLabel('Bulk resolution release',{exact:true}).selectOption('checkout@1.11.0+1');await page.getByRole('button',{name:'Preview triage',exact:true}).click();await page.getByRole('button',{name:'Apply to 1 issue',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.locator('.bulk-triage').screenshot({path:`.artifacts/release-identity/bulk-${mode}-${width}.png`});await page.getByRole('button',{name:'Apply to 1 issue',exact:true}).click();await page.getByRole('status').filter({hasText:'1 issue resolved.'}).waitFor();await send('checkout@1.11.0+1');assert.equal((await issue()).state,mode==='named'?'open':'resolved');}
  await context.close();
 }}finally{await browser.close()}
 const erasure=await json(base+'/erasure');assert.ok(erasure.deleted.release_metadata>0&&erasure.deleted.release_builds>0&&erasure.deleted.issue_resolutions>0&&erasure.deleted.release_policies>0);await followErasure(json,await json(base+'/erasure','POST',{confirm:'release-identity',planHash:erasure.planHash}));const erased=await archiveProjection(await req('/api/archive'));for(const table of ['release_metadata','release_builds','issue_resolutions','release_policies'])assert.ok(erased.data[table].every(row=>row.project!=='release-identity'));
 console.log('Release identity public flow passed: optional release, automatic/dists, enrichment, semantic regression, plain resolution, counted strict/pattern/name outcomes, archive restore and 1440/390 settings/history/triage.');
}

// SDK-009 an explicit dist 'sentry-no-dist' stays distinct from no dist, and next/named-release resolution regresses only on a later release.
async function sdk009ReleaseResolution({req,json}) {
 const p=await json('/api/projects','POST',{id:'sdk009-owner',name:'SDK-009 owner resolution'}),base='/api/projects/sdk009-owner',dsn=new URL(p.dsn),path=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;const send=async(release,dist)=>{const e={event_id:(++serial).toString(16).padStart(32,'0'),...(release===undefined?{}:{release}),...(dist===undefined?{}:{dist}),platform:'python',exception:{values:[{type:'ResolutionError',value:'Release boundary',stacktrace:{frames:[{filename:'/app/release.py',function:'release',lineno:8}]}}]}};const r=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify(e));assert.equal(r.status,200,await r.text());return e};
 const policy={version:1,order:'semver',pattern:'*'},preview=await json(base+'/release-policy/preview','POST',{policy});await json(base+'/release-policy','PUT',{revision:preview.revision,policy});
 const missing=await send('app@1.2.0'),explicit=await send('app@1.2.0','sentry-no-dist');let row=(await json(base+'/issues'))[0];
 const packet=await json(base+'/issues/'+row.id+'/packet'),missingEvent=packet.events.find(e=>e.id===missing.event_id),explicitEvent=packet.events.find(e=>e.id===explicit.event_id);assert.notEqual(missingEvent.build,explicitEvent.build,'missing dist and the old explicit marker are different build identities');assert.equal(explicitEvent.build,'sentry-no-dist');
 const issue=()=>json(base+'/issues').then(rows=>rows[0]);const resolve=async(mode,release)=>{row=await issue();return json(base+'/issues/'+row.id,'PATCH',{state:'resolved',revision:row.revision,resolution:mode,...release?{release}:{}})};
 await resolve('next');await send('app@1.2.0');await send();assert.equal((await issue()).state,'resolved');assert.equal((await issue()).seen_without_release,1);await send('app@1.10.0');assert.equal((await issue()).state,'open','next reopens on the first ordered release above the frozen latest');
 const sha1='a'.repeat(40),sha2='b'.repeat(40);await send(sha1);await send(sha2);const releases=await json(base+'/releases');assert.deepEqual(releases.map(r=>r.name),['app@1.2.0','app@1.10.0',sha1,sha2]);assert.ok(releases.every(r=>r.auto_created===1));
 await resolve('next');for(const release of ['app@1.10.0','app@1.2.0',sha1,sha2,undefined]){await send(release);assert.equal((await issue()).state,'resolved','next is above project latest, including non-semver names');}
 await resolve('named','app@1.10.0');await send('app@1.2.0');await send();assert.equal((await issue()).state,'resolved');await send('app@1.10.0');assert.equal((await issue()).state,'open','an event at the named target reopens');
 await resolve('named',sha2);for(const release of ['app@1.10.0',sha1,undefined]){await send(release);assert.equal((await issue()).state,'resolved');}await send(sha2);assert.equal((await issue()).state,'open');
 await resolve('named',sha1);await send(sha2);assert.equal((await issue()).state,'open','an event above a named target reopens');const regressionCount=(await json(base+'/alerts')).filter(a=>a.kind==='regression').length;await send(sha2);assert.equal((await json(base+'/alerts')).filter(a=>a.kind==='regression').length,regressionCount,'open recurrence does not send another regression');
 row=await issue();for(const input of [{resolution:'named'},{resolution:'named',release:'not-in-this-project'},{resolution:'next',release:sha1}])assert.equal((await req(base+'/issues/'+row.id,'PATCH',{revision:row.revision,state:'resolved',...input})).status,400);
 const strict={...policy,order:'registered'},review=await json(base+'/release-policy/preview','POST',{policy:strict});await json(base+'/release-policy','PUT',{revision:review.revision,policy:strict});
 await json(base+'/releases','POST',{name:'app@1.2.0',build:missingEvent.build});await send('app@1.2.0');const refused={event_id:(++serial).toString(16).padStart(32,'0'),release:'app@1.2.0',dist:'sentry-no-dist',message:'Explicit legacy marker'};const r=await req(path,'POST','{}\n{"type":"event"}\n'+JSON.stringify(refused));assert.equal(r.status,422,'registering absence does not register an explicit legacy-marker dist');assert.equal((await r.json()).reason,'unregistered_release_or_build');
 console.log("SDK-009 an explicit dist 'sentry-no-dist' stays distinct from no dist, and next/named-release resolution regresses only on a later release (owner; two auto semvers and two SHA releases).");
}

// TEAM-004 short IDs, commit citations, resolution and unknown-ID link log: owner, deploy-key and
// agent HTTP, Sentry intake, private archive restore, retention, project erasure and 1440/390 screens.
export async function team004Flow({req,json,origin,cookie}){
 const project=await json('/api/projects','POST',{id:'checkout-web',name:'Cedar checkout web'}),billing=await json('/api/projects','POST',{id:'billing',name:'Cedar billing'}),base='/api/projects/checkout-web';
 assert.equal(project.shortIdPrefix,'CHECKOUT-WEB');
 const deploy=await json(base+'/keys','POST',{kind:'deploy'}),agent=await json(base+'/keys','POST',{kind:'agent'}),asDeploy={Cookie:'',Authorization:'Bearer '+deploy.key},asAgent={Cookie:'',Authorization:'Bearer '+agent.key};
 const envelope=p=>{const dsn=new URL(p.dsn);return `/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`};
 let serial=0;const send=async(p,type,release)=>{const e={event_id:(0x4004000+(++serial)).toString(16).padStart(32,'0'),...release?{release}:{},platform:'python',environment:'production',exception:{values:[{type,value:'Checkout step failed',stacktrace:{frames:[{filename:`/app/${type.toLowerCase()}.py`,function:type.toLowerCase(),lineno:7}]}}]}};const r=await req(envelope(p),'POST','{}\n{"type":"event"}\n'+JSON.stringify(e));assert.equal(r.status,200,await r.text())};
 const issues=async(headers)=>Object.fromEntries((await json(base+'/issues','GET',undefined,headers)).map(i=>[i.title.split(':')[0],i]));
 const packet=(id,headers)=>json(`${base}/issues/${encodeURIComponent(id)}/packet`,'GET',undefined,headers);
 for(const type of ['CheckoutError','PaymentError','CartError'])await send(project,type,'web@1.0.0');
 await send(billing,'InvoiceError','api@1.0.0');
 let rows=await issues();const A=rows.CheckoutError,B=rows.PaymentError,C=rows.CartError;
 assert.deepEqual([A,B,C].map(i=>i.short_id),['CHECKOUT-WEB-1','CHECKOUT-WEB-2','CHECKOUT-WEB-3'],'stable per-project short IDs in first-seen order');
 assert.deepEqual(Object.values(await issues(asAgent)).map(i=>i.short_id).sort(),['CHECKOUT-WEB-1','CHECKOUT-WEB-2','CHECKOUT-WEB-3'],'agent issue list carries short IDs');
 assert.deepEqual((await json(base+'/issue-search?q=checkout-web-2')).rows.map(r=>[r.id,r.short_id]),[[B.id,'CHECKOUT-WEB-2']],'search finds a short ID in any case');
 const byShortId=await packet('checkout-web-1',asAgent);assert.equal(byShortId.issue.id,A.id);assert.equal(byShortId.issue.short_id,'CHECKOUT-WEB-1');assert.equal(byShortId.shortIdRequest.alias,false);assert.equal((await req(base+'/issues/CHECKOUT-WEB-99/packet')).status,404);
 const csv=await (await req(base+'/issue-export?format=csv')).text();assert.ok(csv.startsWith('short_id,id,')&&csv.includes('"CHECKOUT-WEB-3"'),'CSV export carries short IDs');
 assert.deepEqual((await json(base+'/issue-export?format=json')).rows.map(r=>r.short_id).sort(),['CHECKOUT-WEB-1','CHECKOUT-WEB-2','CHECKOUT-WEB-3']);
 assert.deepEqual((await json(base+'/commits/link-log')).rows,[]);assert.deepEqual((await json(base+'/commits/sharing')).share,false);assert.deepEqual((await json(base+'/commits/issues/'+A.id)).links,[]);
 const browser=await launchBrowser(),folder='docs/retained-verification/team004';await mkdir(folder,{recursive:true});
 const shoot=async(label,path,ready)=>{for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies(cookie.split('; ').map(v=>({name:v.slice(0,v.indexOf('=')),value:v.slice(v.indexOf('=')+1),url:origin})));const page=await context.newPage();await page.goto(origin+path);const target=await ready(page,width);const identity=page.getByRole('region',{name:'Affected users',exact:true});if(await identity.count())await identity.getByText(/occurrences have no retained user key/).waitFor();const suspects=page.getByRole('region',{name:'Suspect changes',exact:true});if(await suspects.count())await suspects.getByRole('heading',{name:'Release comparison',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`TEAM-004 ${label} reflows at ${width}`);await target.screenshot({path:`${folder}/${label}-${width}.png`});await context.close()}};
 const timeline=async page=>{const section=page.locator('.commit-timeline');await section.getByRole('heading',{name:'Commits and resolution',exact:true}).waitFor();await section.locator('p').first().waitFor();return section};
 const linkLog=async page=>{const section=page.locator('#repository-link-log');await section.getByRole('heading',{name:'Repository link log',exact:true}).waitFor();await section.locator('p').nth(1).waitFor();return section};
 try{
  await shoot('issue-list','/projects/checkout-web/issues',async page=>{await page.locator('code.short-id').filter({hasText:'CHECKOUT-WEB-1'}).waitFor();return page.locator('.issue-browser')});
  await shoot('empty-timeline','/projects/checkout-web/issues/'+A.id,async page=>{const section=await timeline(page);await section.getByText('No commit cites this issue yet.',{exact:false}).waitFor();await page.locator('.issue-status code.short-id').filter({hasText:'CHECKOUT-WEB-1'}).waitFor();return section});
  await shoot('empty-link-log','/projects/checkout-web/releases',async page=>{const section=await linkLog(page);await section.getByText('No unlinked citations.',{exact:true}).waitFor();return section});
  // A deploy-key registration: two citing commits in mixed case, three citations that change nothing, a bare SHA.
  const S1='a1'.repeat(20),S2='b2'.repeat(20),S3='c3'.repeat(20),S4='d4'.repeat(20),S5='e5'.repeat(20),S6='f6'.repeat(20),S7='a7'.repeat(20),author={name:'Dana Developer',email:'dana.developer@example.test'};
  const registration={name:'web@1.1.0',build:'web-11',commits:[{sha:S1,message:'fixes checkout-web-1: keep the empty cart guard\n\nReviewed in pairing',author},{sha:S2,message:'Retry declined payments\n\nCLOSES CHECKOUT-WEB-2. Fixes BILLING-1, Resolves NOPE-9 and Fixes CHECKOUT-WEB-ZZ',author},S3]};
  const created=await req(base+'/releases','POST',registration,asDeploy);assert.equal(created.status,201,await created.clone().text());const citations=(await created.json()).citations;
  assert.deepEqual(citations.linked.map(l=>[l.shortId,l.citation,l.resolvedIn]),[['CHECKOUT-WEB-1','fixes checkout-web-1','web@1.1.0'],['CHECKOUT-WEB-2','CLOSES CHECKOUT-WEB-2','web@1.1.0']]);assert.equal(citations.logged,3);assert.ok(!JSON.stringify(citations).includes('other_project'),'the deploy key learns no other project’s issues');
  const log=await json(base+'/commits/link-log');assert.deepEqual(log.rows.map(r=>[r.citation,r.sha,r.reason]).sort(),[['Fixes BILLING-1',S2,'other_project'],['Fixes CHECKOUT-WEB-ZZ',S2,'unknown'],['Resolves NOPE-9',S2,'unknown']],'unknown and other-project citations are logged with the literal citation, SHA and reason');
  for(const headers of [asDeploy,asAgent])assert.ok([401,403].includes((await req(base+'/commits/link-log','GET',undefined,headers)).status),'the link log is an owner surface');
  assert.equal((await json('/api/projects/billing/issues'))[0].state,'open','an other-project citation changes nothing');assert.deepEqual((await json('/api/projects/billing/commits/link-log')).rows,[]);
  let story=await json(base+'/commits/issues/'+A.id);assert.equal(story.links.length,1);assert.deepEqual([story.links[0].sha,story.links[0].citation,story.links[0].release,story.links[0].pr,story.links[0].current,story.links[0].author],[S1,'fixes checkout-web-1','web@1.1.0',null,true,author]);
  rows=await issues();assert.deepEqual([rows.CheckoutError.state,rows.PaymentError.state,rows.CartError.state],['resolved','resolved','open']);assert.equal((await packet(A.id)).issue.resolution_release,'web@1.1.0','resolved in the registered release');
  const settled={log:await json(base+'/commits/link-log'),story:await json(base+'/commits/issues/'+A.id),revisions:Object.values(await issues()).map(i=>i.revision)};
  assert.equal((await req(base+'/releases','POST',registration,asDeploy)).status,200);assert.deepEqual(await json(base+'/commits/link-log'),settled.log);assert.deepEqual(await json(base+'/commits/issues/'+A.id),settled.story);assert.deepEqual(Object.values(await issues()).map(i=>i.revision),settled.revisions,'a repeated registration adds no link, log row, timeline entry or revision');
  assert.equal((await req(base+'/issues/'+A.id,'PATCH',{revision:A.revision,state:'acknowledged'})).status,409,'the resolution bumps the revision fence');
  await shoot('linked','/projects/checkout-web/issues/'+A.id,async page=>{const section=await timeline(page);await section.getByText('Resolved in web@1.1.0',{exact:true}).waitFor();return section});
  await shoot('resolved','/projects/checkout-web/issues/'+A.id,async page=>{await page.waitForFunction(()=>document.querySelector('.state-chip')?.textContent==='Resolved');await page.getByText(`Resolved in web@1.1.0 by commit ${S1.slice(0,12)}`,{exact:false}).waitFor();return page.locator('.issue')});
  await shoot('logged-unknown','/projects/checkout-web/releases',async page=>{const section=await linkLog(page);await section.getByText('Unknown short ID',{exact:true}).first().waitFor();return section});
  // ERR-006 under SDK-009 order: an older release cannot regress; a newer one does, with one alert.
  await send(project,'CheckoutError','web@1.0.0');assert.equal((await issues()).CheckoutError.state,'resolved','an older-release occurrence cannot reopen');
  await send(project,'CheckoutError','web@1.2.0');assert.equal((await issues()).CheckoutError.state,'open','a newer-release occurrence regresses');
  let alerts=(await json(base+'/alerts')).filter(a=>a.kind==='regression'&&a.issue===A.id);assert.equal(alerts.length,1);const alertA=JSON.parse(alerts[0].payload);assert.equal(alertA.shortId,'CHECKOUT-WEB-1');assert.deepEqual(alertA.resolution,{release:'web@1.1.0',commit:S1,citation:'fixes checkout-web-1',pr:null},'alert carries the SHA and no author or message by default');
  const sharedA=await packet('CHECKOUT-WEB-1',asAgent);assert.equal(sharedA.commits.sharing,'sha_only');assert.deepEqual(Object.keys(sharedA.commits.rows[0]).sort(),['citation','linked','pr','release','resolved','sha','shortId']);
  const exportedA=(await json(base+'/issue-export?format=json')).rows.find(r=>r.id===A.id);assert.equal(exportedA.resolution_citation,'fixes checkout-web-1');assert.equal(exportedA.resolution_commit,S1);
  const defaultCsv=await (await req(base+'/issue-export?format=csv')).text();assert.ok(defaultCsv.split('\r\n')[0].split(',').includes('resolution_citation')&&defaultCsv.includes('"fixes checkout-web-1"'),'CSV exports the literal resolution citation');
  for(const surface of [sharedA,await json(base+'/alerts','GET',undefined,asAgent),await json(base+'/issue-export?format=json')])assert.ok(!JSON.stringify(surface).includes(author.email)&&!JSON.stringify(surface).includes('empty cart guard'),'author and message stay on owner surfaces by default');
  await shoot('regressed','/projects/checkout-web/issues/'+A.id,async page=>{const section=await timeline(page);await section.getByText('Regressed',{exact:true}).waitFor();return section});
  // An SDK-auto-created release given commits by a later deploy-key registration resolves in that same release.
  const auto=(await json(base+'/releases')).find(r=>r.name==='web@1.2.0');assert.equal(auto.auto_created,1);
  await json(base+'/releases','POST',{name:'web@1.2.0',build:'web-12',commits:[{sha:'b8'.repeat(20),message:'Fixes CHECKOUT-WEB-1 again with a retry budget',author}]},asDeploy);
  const enriched=(await json(base+'/releases')).find(r=>r.name==='web@1.2.0');assert.deepEqual([enriched.auto_created,enriched.first_seen,enriched.seq],[0,auto.first_seen,auto.seq]);
  assert.deepEqual([(await issues()).CheckoutError.state,(await packet(A.id)).issue.resolution_release],['resolved','web@1.2.0'],'resolved in the enriched auto-created release');
  // The owner's audited choice shares author and message; the deploy key cannot make it.
  assert.equal((await req(base+'/commits/sharing','PUT',{share:true,revision:0},asDeploy)).status,401);
  const sharing=page=>page.locator('section').filter({has:page.getByRole('heading',{name:'Commit author and message',exact:true})});
  await shoot('sharing-off','/projects/checkout-web/settings',async page=>{const section=sharing(page);await section.locator('p.metadata').filter({hasText:/^Not shared ·/}).waitFor();return section});
  {const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies(cookie.split('; ').map(v=>({name:v.slice(0,v.indexOf('=')),value:v.slice(v.indexOf('=')+1),url:origin})));const page=await context.newPage();await page.goto(origin+'/projects/checkout-web/settings');const section=sharing(page);await section.getByLabel('Share commit author and message outside the owner session',{exact:true}).check();await section.getByRole('button',{name:'Save commit sharing',exact:true}).click();await section.getByRole('status').filter({hasText:'Commit author and message are now shared.'}).waitFor();await context.close()}
  assert.deepEqual([(await json(base+'/commits/sharing')).share,(await req(base+'/commits/sharing','PUT',{share:false,revision:0})).status],[true,409],'a stale sharing choice is refused');
  assert.ok((await json('/api/audit/export?format=json')).rows.some(r=>r.action==='commit.sharing'&&r.outcome==='succeeded'),'AUDIT-001 records the sharing choice');
  await shoot('sharing-on','/projects/checkout-web/settings',async page=>{const section=sharing(page);await section.locator('p.metadata').filter({hasText:/^Shared ·/}).waitFor();return section});
  await send(project,'PaymentError','web@1.2.0');const alertB=JSON.parse((await json(base+'/alerts')).find(a=>a.kind==='regression'&&a.issue===B.id).payload);assert.deepEqual(alertB.resolution.author,author);assert.ok(alertB.resolution.message.startsWith('Retry declined payments'));
  assert.deepEqual((await packet('CHECKOUT-WEB-2',asAgent)).commits.rows[0].author,author,'the shared packet carries the author');assert.ok(JSON.stringify(await json(base+'/alerts','GET',undefined,asAgent)).includes(author.email));
  // SDK-009 commit-SHA association: an auto-created release named by the full SHA includes the commit when it arrives, and orders first.
  await send(project,'ShippingError',S4);const D=(await issues()).ShippingError;assert.equal(D.short_id,'CHECKOUT-WEB-4');
  await json(base+'/releases','POST',{name:'web@1.3.0',build:'web-13',commits:[{sha:S4,message:'Resolves CHECKOUT-WEB-4 by rounding shipping weights',author}]},asDeploy);
  assert.equal((await packet(D.id)).issue.resolution_release,S4,'the auto-created SHA release resolves the issue');
  // The deployment door accepts commit objects beside bare SHAs.
  const destination=await json(base+'/alerting/destinations','POST',{label:'Release owner',recipient:'release-owner@example.test'}),now=Date.now();
  await json(base+'/deployments','POST',{id:'web-13-production',release:'web@1.3.0',build:'web-13',environment:'production',repository:'https://example.test/cedar/checkout',commitSha:S5,previousCommit:S4,includedCommits:[{sha:S6,message:'Fixes CHECKOUT-WEB-3 with cart rounding',author},S5],startedAt:new Date(now-60000).toISOString(),deadline:new Date(now+3600000).toISOString(),destination:destination.id},asDeploy);
  assert.equal((await packet(C.id)).issue.resolution_release,'web@1.3.0','a deployment registration resolves in its release');
  // Merge: the absorbed short ID becomes an alias of the survivor everywhere, citations included.
  for(const type of ['TaxError','TaxRoundingError'])await send(project,type,'web@1.3.0');rows=await issues();const E=rows.TaxError,F=rows.TaxRoundingError;
  const merge=await json(base+'/corrections/preview','POST',{kind:'merge',source:E.id,revision:(await packet(E.id)).issue.revision,target:F.id,targetRevision:(await packet(F.id)).issue.revision});await json(base+'/corrections/'+merge.id+'/apply','POST',{confirm:true});
  const alias=await packet(E.short_id.toLowerCase(),asAgent);assert.deepEqual([alias.issue.id,alias.shortIdRequest.alias,alias.issue.short_id,alias.issue.short_id_aliases],[F.id,true,F.short_id,[E.short_id]]);
  assert.deepEqual((await json(base+'/issue-search?q='+E.short_id)).rows.map(r=>r.id),[F.id],'search follows the alias');
  await json(base+'/releases','POST',{name:'web@1.4.0',build:'web-14',commits:[{sha:S7,message:'Fixes '+E.short_id,author}]},asDeploy);assert.deepEqual((await json(base+'/commits/issues/'+F.id)).links.map(l=>[l.shortId,l.release]),[[E.short_id,'web@1.4.0']],'a citation of the alias links the survivor');
  await shoot('merged-alias','/projects/checkout-web/issues/'+E.short_id,async page=>{await page.getByText(`${E.short_id} is an alias of ${F.short_id}`,{exact:false}).waitFor();return page.locator('.issue')});
  // S1 / G1: a SHA release admitted after its commit's registration associates it without re-resolving.
  await send(project,'InventoryError','web@1.4.0');const G=(await issues()).InventoryError,laterSha='c8'.repeat(20);
  await json(base+'/releases','POST',{name:'web@1.5.0',build:'web-15',commits:[{sha:laterSha,message:`Fixes ${G.short_id} with inventory reconciliation`,author}]},asDeploy);
  const earlierResolution=(await packet(G.id)).issue,earlierLink=await json(base+'/commits/issues/'+G.id);
  assert.deepEqual([earlierResolution.state,earlierResolution.resolution_release,earlierLink.links[0].sha],['resolved','web@1.5.0',laterSha]);
  await send(project,'ShaAdmissionError',laterSha);
  const associated=await archiveProjection(await req('/api/archive'));
  assert.ok(associated.data.release_commits.some(r=>r.project==='checkout-web'&&r.release===laterSha&&r.sha===laterSha&&r.source==='sha_release'),'later SDK SHA release has the sha_release association');
  assert.equal((await json(base+'/releases')).find(r=>r.name===laterSha).auto_created,1);
  assert.deepEqual(await json(base+'/commits/issues/'+G.id),earlierLink,'association keeps the earlier resolving link');
  assert.deepEqual([(await packet(G.id)).issue.resolution_release,(await packet(G.id)).issue.revision],['web@1.5.0',earlierResolution.revision],'association preserves resolution and its revision');
  const regressions=async()=> (await json(base+'/alerts')).filter(a=>a.issue===G.id&&a.kind==='regression');
  await send(project,'InventoryError','web@1.4.0');assert.equal((await issues()).InventoryError.state,'resolved');assert.equal((await regressions()).length,0,'older release still cannot regress');
  await send(project,'InventoryError',laterSha);await send(project,'InventoryError',laterSha);
  assert.equal((await issues()).InventoryError.state,'open');assert.equal((await regressions()).length,1,'the later SHA release regresses once');
  assert.equal((await packet(G.id)).issue.resolution_release,'web@1.5.0','regression keeps the original resolution');
  console.log('TEAM-004 S1 / G1 passed: later SHA-release association, earlier resolution and revision kept, older-release protection, one SHA-release regression.');
  // Private archive restore keeps every short ID, alias, link and resolution, and re-runs nothing.
  const archive=await archiveProjection(await req('/api/archive')),stores=['short_id_prefixes','issue_short_ids','issue_short_id_moves','commits','release_commits','commit_links','repository_link_log','commit_sharing'];
  for(const table of stores)assert.ok(archive.data[table].some(r=>r.project==='checkout-web'),`archive carries ${table}`);assert.ok(archive.data.commits.some(r=>r.author_email===author.email),'the private archive carries author and message');
  const restored=await startTestWorker(15527);try{const restoredCookie=await signIn(restored.origin);const r=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:restoredCookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:archive.text});assert.ok(r.ok,await r.text());const copied=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:restoredCookie}}));for(const table of [...stores,'issues','issue_resolutions','alerts'])assert.deepEqual(copied.data[table],archive.data[table],`restore keeps ${table} byte-identical and inert`);assert.deepEqual(copied.data.audit.filter(a=>a.kind==='commit_resolution'),archive.data.audit.filter(a=>a.kind==='commit_resolution'),'restore never re-runs resolution')}finally{await restored.stop()}
  // Retention expires author and message, including the copies a shared alert carried.
  await json(base+'/retention','POST',{cutoff:Date.now(),apply:true});const expired=await json(base+'/commits/issues/'+B.id);assert.ok(expired.links.every(l=>l.expired!==null&&l.author===null&&l.message===null));assert.ok(expired.links.every(l=>l.release==='web@1.1.0'),'retention keeps the SHA, link and resolution');
  for(const surface of [await json(base+'/alerts'),await packet(B.id,asAgent),(await archiveProjection(await req('/api/archive'))).data.commits])assert.ok(!JSON.stringify(surface).includes(author.email)&&!JSON.stringify(surface).includes('Retry declined payments'),'retention removes author and message everywhere');
  const plan=await json(base+'/erasure');for(const table of stores)assert.ok(plan.deleted[table]>0,`project erasure declares ${table}`);await followErasure(json,await json(base+'/erasure','POST',{confirm:'checkout-web',planHash:plan.planHash}));
  const erased=await archiveProjection(await req('/api/archive'));for(const table of stores)assert.ok(erased.data[table].every(r=>r.project!=='checkout-web'),`project erasure removes ${table}`);
  assert.equal((await json('/api/projects','POST',{id:'checkout_web',name:'Cedar checkout reborn'})).shortIdPrefix,'CHECKOUT-WEB_2','an erased project’s prefix is never reused');
 }finally{await browser.close()}
 await team004DeliveryRetention();
 console.log('TEAM-004 short IDs, commit citations, resolution and unknown-ID link log passed: short IDs in lists, search, exports, packets and alerts; deploy-key and deployment citations; resolution, regression and older-release protection; SHA release association; merge alias; default-off and owner-shared author/message; inert restore, retention, erasure and retired prefixes; 1440/390 screens.');
}

// S2 / G2 uses the emitted app and existing signed receiver/provider edges. All changes
// go through owner/deploy/ingest doors; SQL only reads private delivery copies for assertions.
async function team004DeliveryRetention(){
 const temporary=await mkdtemp(join(tmpdir(),'spool-team004-delivery-')),inbox=await receiver(join(temporary,'receiver.sqlite'));let app;
 try{
  app=await alertRuntime(inbox,{mail:'sendgrid',captureMail:true});
  const project=await app.json('/api/projects','POST',{id:'web',name:'Cedar checkout delivery retention'}),base='/api/projects/web',delivery=base+'/alerting',auth={Cookie:'',Authorization:'Bearer '+project.ingestKey};
  const deploy=await app.json(base+'/keys','POST',{kind:'deploy'}),asDeploy={Cookie:'',Authorization:'Bearer '+deploy.key};
  await app.json(base+'/releases','POST',{name:'web@1.0.0',build:'web-10'},asDeploy);
  let serial=0;const capture=async(label,release,build)=>app.json('/api/ingest/web','POST',{version:1,eventId:`team004-${label}-${++serial}`,release,build,environment:'production',type:'CheckoutError',message:`Checkout ${label} failed`,frames:[{file:`https://checkout.example.test/${label}.js`,function:label,line:7,column:0}]},auth);
  const fixtures=[];
  for(const [label,sha] of [['default','d1'.repeat(20)],['shared','d2'.repeat(20)],['pending','d3'.repeat(20)]]){
   const admitted=await capture(label,'web@1.0.0','web-10'),issue=(await app.json(base+'/issues')).find(r=>r.id===admitted.issue);
   fixtures.push({label,sha,issue:issue.id,shortId:issue.short_id,citation:`Fixes ${issue.short_id}`});
  }
  const after=async time=>{const cutoff=time+1;await new Promise(resolve=>setTimeout(resolve,Math.max(0,cutoff-Date.now())));return cutoff};
  // Remove the original occurrences before registering commits. The final cutoff then
  // removes commit identity alone, keeping regression evidence and the mail's SHA/citation.
  const original=await archiveProjection(await app.request('/api/archive'));
  await app.json(base+'/retention','POST',{cutoff:await after(Math.max(...original.data.events.map(r=>r.received))),apply:true});
  const author={name:'Dana Delivery',email:'dana.delivery@example.test'},privateMessage='retained checkout delivery detail',scrubCanary='COMMIT_SCRUB_CANARY_004';
  await app.json(base+'/releases','POST',{name:'web@1.1.0',build:'web-11',commits:fixtures.map(f=>({sha:f.sha,message:`${f.citation}: ${privateMessage} ${f.label}\n\npassword=${scrubCanary}`,author}))},asDeploy);
  const commits=await archiveProjection(await app.request('/api/archive')),cutoff=await after(Math.max(...commits.data.commits.map(r=>r.received)));
  assert.ok(!commits.text.includes(scrubCanary),'commit messages are scrubbed before persistence');
  await app.json(base+'/releases','POST',{name:'web@1.2.0',build:'web-12'},asDeploy);
  const mail=await app.json(delivery+'/destinations','POST',{label:'Release owner',recipient:testOwner});
  await prepareDestinations(app);
  for(const channel of ['mail','webhook'])await app.json(delivery+'/rules','POST',rule(channel,{kinds:['regression'],...(channel==='mail'?{destination:mail.id}:{})}));
  const copies=async f=>{
   const histories=(await app.json(delivery+'/deliveries')).filter(r=>r.issue===f.issue&&r.kind==='regression');assert.equal(histories.length,2);
   const mail=histories.find(r=>r.channel==='mail'),webhook=histories.find(r=>r.channel==='webhook');assert.ok(mail&&webhook);
   const job=await app.db.prepare('SELECT message,state,code FROM alert_mail_jobs WHERE id=?').bind(mail.id).first();assert.ok(job);
   const wire=inbox.requests.find(r=>r.headers['webhook-id']===webhook.id);assert.ok(wire,'signed receiver observed this delivery');
   return {mail,webhook,job,message:JSON.parse(job.message),body:JSON.parse(wire.body)};
  };
  const expected=f=>({release:'web@1.1.0',commit:f.sha,citation:f.citation,pr:null});
  const [plain,shared,pending]=fixtures;
  await capture(plain.label,'web@1.2.0','web-12');const defaultCopies=await copies(plain);
  assert.deepEqual(defaultCopies.body.resolution,expected(plain),'default webhook keeps SHA, release and literal citation only');
  assert.ok(defaultCopies.message.text.includes(plain.sha)&&defaultCopies.message.text.includes(plain.citation)&&defaultCopies.message.text.includes('web@1.1.0'));
  assert.ok(!defaultCopies.message.text.includes(author.email)&&!defaultCopies.message.text.includes(privateMessage)&&!defaultCopies.message.text.includes('Commit author and message'));
  const sharing=await app.json(base+'/commits/sharing');await app.json(base+'/commits/sharing','PUT',{share:true,revision:sharing.revision});
  await capture(shared.label,'web@1.2.0','web-12');const sharedCopies=await copies(shared);
  assert.deepEqual(sharedCopies.body.resolution,{...expected(shared),author,message:commits.data.commits.find(r=>r.sha===shared.sha).message});
  assert.ok(sharedCopies.message.text.includes('Commit author and message, shared by the project owner:')&&sharedCopies.message.text.includes(author.email)&&sharedCopies.message.text.includes(privateMessage));
  const outboxBefore=(await app.db.prepare('SELECT id,message FROM rer_mail_development_outbox').all()).results.filter(r=>JSON.parse(r.message).deliveryId===sharedCopies.mail.id);
  assert.equal(outboxBefore.length,1,'controlled provider edge retained a real fixture mail copy');assert.ok(outboxBefore[0].message.includes(author.email)&&outboxBefore[0].message.includes('Short ID: '+shared.shortId));
  assert.equal(sharedCopies.mail.state,'accepted');assert.equal(sharedCopies.webhook.state,'accepted');
  inbox.mailStatuses.push(429);inbox.statuses.push(429);await capture(pending.label,'web@1.2.0','web-12');const pendingCopies=await copies(pending);
  assert.equal(pendingCopies.job.state,'queued');assert.equal(pendingCopies.webhook.state,'retrying');assert.deepEqual(pendingCopies.body.resolution.author,author);assert.ok(pendingCopies.message.text.includes(author.email));
  for(const f of [shared,pending]){
   const exported=(await app.json(base+'/issue-export?format=json')).rows.find(r=>r.id===f.issue);assert.equal(exported.resolution_citation,f.citation);assert.ok(exported.resolution_author.includes(author.email)&&exported.resolution_message.includes(privateMessage));
  }
  const sharedIds=[sharedCopies,pendingCopies].flatMap(c=>[c.mail.id,c.webhook.id]),webhookIds=[sharedCopies.webhook.id,pendingCopies.webhook.id];
  const integrationCopies=async()=> (await app.db.prepare("SELECT id,envelope FROM integration_deliveries WHERE namespace='spool.web'").all()).results.filter(r=>webhookIds.includes(r.id));
  assert.equal((await integrationCopies()).length,2,'accepted and pending webhook envelopes exist before retention');
  await app.json(base+'/retention','POST',{cutoff,apply:true});
  for(const c of [sharedCopies,pendingCopies]){
   const job=await app.db.prepare('SELECT message,code,state FROM alert_mail_jobs WHERE id=?').bind(c.mail.id).first();assert.ok(job);assert.equal(job.code,'retention_removed');
   const text=JSON.parse(job.message).text;assert.ok(text.includes(c.body.resolution.commit)&&text.includes(c.body.resolution.citation)&&text.includes('web@1.1.0'),'retention keeps the mail resolution while removing only the shared block');
   assert.ok(!text.includes(author.email)&&!text.includes(privateMessage)&&!text.includes('Commit author and message'));
  }
  assert.equal((await integrationCopies()).length,0,'accepted and pending webhook copies are removed');
  const replays=(await app.db.prepare("SELECT id FROM integration_replays WHERE namespace='spool.web'").all()).results;assert.ok(replays.every(r=>!webhookIds.includes(r.id)));
  const outboxAfter=(await app.db.prepare('SELECT message FROM rer_mail_development_outbox').all()).results;assert.ok(outboxAfter.every(r=>!sharedIds.includes(JSON.parse(r.message).deliveryId)&&!r.message.includes(author.email)&&!r.message.includes(privateMessage)),'retention removes shared mail outbox text');
  const histories=await app.json(delivery+'/deliveries');for(const id of [pendingCopies.mail.id,pendingCopies.webhook.id]){const h=histories.find(r=>r.id===id);assert.equal(h.state,'cancelled');assert.equal(h.code,'retention_removed')}
  const intents=(await app.db.prepare('SELECT id,body,state,code FROM alert_intents').all()).results.filter(r=>sharedIds.includes(r.id));assert.equal(intents.length,4);
  for(const i of intents){assert.ok(!i.body.includes(author.email)&&!i.body.includes(privateMessage));if([pendingCopies.mail.id,pendingCopies.webhook.id].includes(i.id)){assert.equal(i.state,'cancelled');assert.equal(i.code,'retention_removed')}}
  const clean=await archiveProjection(await app.request('/api/archive'));for(const value of [author.email,author.name,privateMessage,scrubCanary])assert.ok(!clean.text.includes(value),'fresh archive removes '+value);
  for(const f of fixtures){assert.ok(clean.data.release_commits.some(r=>r.sha===f.sha&&r.release==='web@1.1.0'));assert.ok(clean.data.commit_links.some(r=>r.sha===f.sha&&r.citation===f.citation&&r.release==='web@1.1.0'));assert.ok(clean.data.events.some(r=>r.issue===f.issue&&r.received>=cutoff),'regression event stays retained')}
  const attempts=inbox.requests.length,mailCount=inbox.mailCount;await app.schedule(Date.now()+60000);assert.equal(inbox.requests.length,attempts);assert.equal(inbox.mailCount,mailCount,'retention-removed deliveries never retry');
  console.log('TEAM-004 S2 / G2 passed: reviewed email/signed-webhook regression rules; default SHA/release/citation and shared author/message bodies; nonempty fixture outbox; owner cutoff removes shared mail/outbox text and webhook copies, cancels pending deliveries retention_removed; clean archive, shared exports and scrub canary.');
 }finally{await app?.close();await inbox.close();await rm(temporary,{recursive:true,force:true})}
}

// TEAM-003 priorities travel through the same retained search/export and packet doors.
export async function issuePriorityFlow({req,json}) {
 const project=await json('/api/projects','POST',{id:'priority-lifecycle',name:'Checkout priority lifecycle'}),base='/api/projects/'+project.id;
 const dsn=new URL(project.dsn),door=`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 let serial=0;
 const send=async(level,kind='WarningFailure',release='checkout@1.0.0')=>{const response=await req(door,'POST','{}\n{"type":"event"}\n'+JSON.stringify({event_id:(++serial+9000).toString(16).padStart(32,'0'),release,level,exception:{values:[{type:kind,value:'Checkout confirmation failed',stacktrace:{frames:[{filename:'/app/checkout.js',function:'confirm',lineno:14,colno:2}]}}]}}));assert.equal(response.status,200,await response.text())};
 await send('warning');await send('fatal','FatalFailure');
 let rows=await json(base+'/issues'),warning=rows.find(r=>r.title.startsWith('WarningFailure')),fatal=rows.find(r=>r.title.startsWith('FatalFailure'));
 assert.equal(warning.priority,'medium');assert.equal(fatal.priority,'high');
 const path=base+'/issues/'+warning.id+'/priority';
 const invalidBefore=await json(base+'/issues');assert.equal((await req(path,'PUT',{priority:'urgent',revision:warning.revision})).status,400);assert.deepEqual(await json(base+'/issues'),invalidBefore,'invalid priority cannot mutate issue');
 await json(path,'PUT',{priority:'low',revision:warning.revision});const after=await json(base+'/issues');assert.equal((await req(path,'PUT',{priority:'high',revision:warning.revision})).status,409);assert.deepEqual(await json(base+'/issues'),after,'stale priority edit cannot mutate issue');
 await send('fatal');warning=(await json(base+'/issues')).find(r=>r.id===warning.id);assert.equal(warning.priority,'low','manual choice survives a later fatal escalation');
 await json(base+'/issues/'+warning.id,'PATCH',{state:'resolved',resolution:'plain',revision:warning.revision});await send('error');warning=(await json(base+'/issues')).find(r=>r.id===warning.id);assert.equal(warning.state,'open');assert.equal(warning.priority,'low','manual choice survives regression');
 const filtered=await json(base+'/issue-search?q=priority:low');assert.deepEqual(filtered.rows.map(r=>r.id),[warning.id]);
 assert.equal((await json(base+'/issue-export?q=priority:low')).rows[0].priority,'low');const csv=await req(base+'/issue-export?q=priority:low&format=csv');const lines=(await csv.text()).split('\r\n');const column=lines[0].split(',').indexOf('priority');assert.ok(column>=0);assert.equal(lines[1].split(',')[column],'"low"');
 const packet=await json(base+'/issues/'+warning.id+'/packet');assert.equal(packet.issue.priority,'low');assert.equal((await req(base+'/issue-search?q=priority:urgent')).status,400);
 return {project,warning,fatal};
}
