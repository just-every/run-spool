import {archiveProjection} from './archive.mjs';
import {archiveText} from './agent-handoff/caps.mjs';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import {openGate,signIn} from './auth.mjs';
import {startTestWorker} from './worker.mjs';
export async function retentionFlow(app,browser,directory){
 const {json,request}=app,p='synthetic-spool-17',path=`/api/projects/${p}/retention-policy`;
 const project=await json('/api/projects','POST',{id:p,name:'synthetic-spool-17'});
 await json(`/api/projects/${p}/releases`,'POST',{name:'r1',build:'b1'});
 const event={version:1,eventId:'synthetic-spool-17',type:'Error',message:'synthetic-spool-17',release:'r1',build:'b1',environment:'test',frames:[{file:'https://app.example/bundle.js',line:1,column:0,function:'syntheticSpool'}],breadcrumbs:[]};
 const admitted=await json(`/api/ingest/${p}`,'POST',event,app.checkout?{agent:project.ingestKey}:{Authorization:'Bearer '+project.ingestKey});
 const initial=await json(path);assert.deepEqual(Object.values(initial.windows),Array(6).fill(90));assert.equal(initial.held,false);assert.ok(initial.preview.storage.estimatedBytes>0);
 for(const days of [29,91]){const response=await request(path+'/preview','POST',{windows:{...initial.windows,events:days}});assert.equal(response.status,400);await response.body?.cancel()}
 const shorter={...initial.windows,events:30},preview=await json(path+'/preview','POST',{windows:shorter});
 assert.equal(preview.shortening,true);assert.ok(preview.rows.every(r=>'count'in r&&'oldest'in r&&'newest'in r));assert.match(preview.coverage,/incomplete/);
 const input={windows:shorter,revision:preview.revision,at:preview.at,token:preview.token};
 assert.equal((await request(path,'PUT',input)).status,400,'[GOV-002] shortening requires exact typed confirmation');
 await json(path,'PUT',{...input,confirmation:'SHORTEN RETENTION'});
 assert.equal((await request(path,'PUT',{...input,confirmation:'SHORTEN RETENTION'})).status,409,'stale preview cannot change policy');
 const saved=await json(path),sessionWindows={...saved.windows,sessions:30},sessionPreview=await json(path+'/preview','POST',{windows:sessionWindows}),dsnBefore=new URL(project.dsn),oldSessionTime=new Date(Date.now()-60*86400000).toISOString();
 await json(`/api/${dsnBefore.pathname.slice(1)}/envelope/?sentry_key=${dsnBefore.username}&sentry_version=7`,'POST','{}\n{"type":"session"}\n'+JSON.stringify({sid:crypto.randomUUID().replaceAll('-',''),started:oldSessionTime,timestamp:oldSessionTime,status:'exited',errors:0,attrs:{release:'r1',environment:'test'}}));
 assert.equal((await request(path,'PUT',{...sessionPreview,confirmation:'SHORTEN RETENTION'})).status,409,'[GOV-002] newly admitted eligible session invalidates shortening preview');const freshSessionPreview=await json(path+'/preview','POST',{windows:sessionWindows});assert.equal(freshSessionPreview.rows.find(row=>row.type==='sessions').count,1);await json(path,'PUT',{...freshSessionPreview,confirmation:'SHORTEN RETENTION'});
 const captures=[];
 for(const width of [1440,390]){
  let current=await json(path);if(current.windows.feedback!==90){const pr=await json(path+'/preview','POST',{windows:{...current.windows,feedback:90}});await json(path,'PUT',{...pr,confirmation:''})}
  const context=await browser.newContext({viewport:{width,height:1000}});
  try{
   await openGate(context,app.origin);await context.addCookies(app.cookie.split('; ').filter(Boolean).map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:app.origin})));
   const page=await context.newPage();await page.goto(app.origin+`/projects/${p}/settings`);const panel=page.getByRole('region',{name:'Project retention'});await panel.getByRole('heading',{name:'Retention windows'}).waitFor();
   await panel.getByLabel('Feedback (days)',{exact:true}).fill('60');await panel.getByRole('button',{name:'Preview windows',exact:true}).click();await panel.getByLabel('Type SHORTEN RETENTION',{exact:true}).waitFor();
   assert.equal(await panel.getByRole('button',{name:'Save windows',exact:true}).isDisabled(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const previewRegion=panel.getByRole('region',{name:'Retention preview',exact:true});if(await previewRegion.evaluate(el=>el.scrollWidth>el.clientWidth)){await previewRegion.focus();await previewRegion.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('[aria-label="Retention preview"]').scrollLeft>0);await previewRegion.evaluate(el=>{el.scrollLeft=0})}const previewAxe=await new AxeBuilder({page}).include('[aria-label="Project retention"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(previewAxe.violations.map(v=>v.id),[]);const previewCapture=directory+`/gov002-preview-${width}.png`;await panel.screenshot({path:previewCapture});captures.push(previewCapture);await panel.getByLabel('Type SHORTEN RETENTION',{exact:true}).fill('SHORTEN RETENTION');await panel.getByRole('button',{name:'Save windows',exact:true}).click();await panel.getByLabel('Type SHORTEN RETENTION',{exact:true}).waitFor({state:'hidden'});
   await panel.getByLabel('Reason for legal hold',{exact:true}).fill('synthetic-spool-17 legal preservation');await panel.getByRole('button',{name:'Set legal hold',exact:true}).click();await panel.getByRole('heading',{name:'Legal hold: active',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const axe=await new AxeBuilder({page}).include('[aria-label="Project retention"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.map(v=>v.id),[]);
   await panel.scrollIntoViewIfNeeded();const file=directory+`/gov002-retention-${width}.png`;await panel.screenshot({path:file});captures.push(file);
   if(width===1440){current=await json(path);await json(path+'/hold','PUT',{held:false,reason:'synthetic-spool-17 temporary release',revision:current.revision})}
  }finally{await context.close()}
 }
 let current=await json(path);assert.equal(current.held,true);
 assert.equal((await request(`/api/projects/${p}/retention`,'POST',{cutoff:Date.now(),apply:true})).status,409,'[GOV-002] held cutoff refuses deletion');
 assert.equal((await json(`/api/projects/${p}/issues/${admitted.issue}/packet`)).events.length,1);
 assert.equal((await json(`/api/projects/${p}/issues/${admitted.issue}/packet`)).retentionPolicy.held,true);
 const snapshot=await archiveProjection(await request('/api/archive')),aged=structuredClone(snapshot.data),old=Date.now()-93*86400000,oldSid=crypto.randomUUID().replaceAll('-','');
 aged.health_sessions.push({project:p,sid:oldSid,release:'r1',environment:'test',started:old,updated:old,status:'exited',errors:0,user_hash:null});aged.health_aggregates.push({project:p,release:'r1',environment:'test',started:Math.floor(old/60000)*60000,status:'exited',quantity:1});
 const archive=await archiveText(snapshot,aged);assert.ok(archive.includes('synthetic-spool-17 legal preservation'));
 const restored=await startTestWorker(15549);
 try{
  const cookie=await signIn(restored.origin),req=(url,method='GET',body)=>fetch(restored.origin+url,{method,headers:{Origin:restored.origin,Cookie:cookie,...body?{'Content-Type':'application/json','x-confirm-restore':'yes'}:{}},...body?{body:typeof body==='string'?body:JSON.stringify(body)}:{}}),get=async(...args)=>{const response=await req(...args);assert.ok(response.ok,`[GOV-002] restore door ${args[0]} ${response.status}`);return response.json()};
  await get('/api/restore','POST',archive);const roundtrip=await get(path);assert.deepEqual(roundtrip.windows,current.windows);assert.equal(roundtrip.held,true);assert.equal(roundtrip.reason,current.reason);
  const ingest=await get(`/api/projects/${p}/keys`,'POST',{kind:'ingest'}),dsn=new URL(ingest.dsn),session={sid:crypto.randomUUID().replaceAll('-',''),started:new Date().toISOString(),timestamp:new Date().toISOString(),status:'ok',errors:0,attrs:{release:'r1',environment:'test'}};
  const admittedSession=await get(`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`,'POST','{}\n{"type":"session"}\n'+JSON.stringify(session));assert.equal(admittedSession.sessions.session_stored,1);const heldDb=await restored.db();assert.ok(await heldDb.prepare('SELECT 1 FROM health_sessions WHERE project=? AND sid=?').bind(p,oldSid).first(),'[GOV-002] held old session survives opportunistic intake expiry');assert.equal((await heldDb.prepare('SELECT COUNT(*) n FROM health_aggregates WHERE project=?').bind(p).first()).n,1,'[GOV-002] held old aggregate survives opportunistic intake expiry');
  const erasure=await get(`/api/projects/${p}/erasure`);assert.equal(erasure.hold,null,'legal hold does not block erasure');let receipt=await get(`/api/projects/${p}/erasure`,'POST',{confirm:p,planHash:erasure.planHash});for(let n=0;n<50&&receipt.phase!=='complete';n++)receipt=await get(`/api/erasures/${receipt.id}/resume`,'POST',{});assert.equal(receipt.phase,'complete');assert.equal((await (await restored.db()).prepare('SELECT COUNT(*) n FROM retention_policies WHERE project=?').bind(p).first()).n,0,'[GOV-002] erasure deletes held policy');
 }finally{await restored.stop()}
 await json(path+'/hold','PUT',{held:false,reason:'synthetic-spool-17 release for expiry',revision:current.revision});
 const cutoff=Date.now(),dry=await json(`/api/projects/${p}/retention`,'POST',{cutoff,apply:false}),applied=await json(`/api/projects/${p}/retention`,'POST',{cutoff,apply:true});assert.equal(applied.events,dry.events,'[GOV-002] dry run equals applied cutoff');assert.ok(applied.events>0);assert.equal((await json(`/api/projects/${p}/issues/${admitted.issue}/packet`)).events.length,0);
 console.log('[GOV-002] windows, preview, typed confirmation, legal hold, release, packet note, archive round trip and held erasure passed; 1440/390 captures');return captures;
}
