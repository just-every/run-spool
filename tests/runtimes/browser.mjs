import assert from 'node:assert/strict';
import {counts,expectedOutcomes,issueDetails,outcomeMap,api,sentIdentities,referenceCollector} from './harness.mjs';
import {readScreens} from './screens.mjs';
import {parseEnvelope,objectJson} from '../../src/domain/sentry/wire.ts';
import {browserLifecycleReport} from '../client-report-sdk.mjs';

// [SDK-001] One built official-SDK program, identical actions for reference and Spool.
export async function qualifyBrowser({browser,origin,cookie,request,applicationOrigin,dsns,upload,expectedLine}){
 const app=api(origin,cookie);
 for(const width of [1440,390]){
  const project=await request('/api/projects','POST',{id:`browser-qualification-${width}`,name:'Browser qualification'});
  await request(`/api/projects/${project.id}/browser-origins`,'POST',{origin:applicationOrigin});
  const execute=async(target)=>{
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),sent=[];
   page.on('request',req=>{
    if(req.method()==='POST'&&new URL(req.url()).pathname.includes('/envelope/')){
     const envelope=parseEnvelope(req.postDataBuffer());sent.push(...envelope.items.map(item=>({type:item.header.type,header:item.header,bytes:item.bytes})));
    }
   });
   try{
    console.log(JSON.stringify({stage:'browser-qualification',width,target}));
    await page.goto(applicationOrigin+'/?target='+target);
    for(let round=0;round<2;round++){
     console.log(JSON.stringify({stage:'browser-round',width,target,round}));
     await page.waitForFunction(()=>window.__SDK_READY__&&window.__SPOOL_SENT__.includes('session')&&window.__SPOOL_SENT__.includes('transaction'));
     await page.evaluate(()=>window.qualifyHandled());
     await page.getByRole('button',{name:'Throw checkout exception',exact:true}).click();
     await page.waitForFunction(()=>window.__SPOOL_SENT__.filter(type=>type==='event').length===2);
     await page.evaluate(()=>window.flushSDK());
     await page.evaluate(()=>window.stopReplay());
     await page.evaluate(()=>window.openFeedback());
     await page.getByRole('button',{name:'Report a Bug',exact:true}).click();
     await page.getByRole('textbox',{name:'Description',exact:false}).fill('synthetic-spool-browser-widget');
     await page.getByRole('button',{name:'Send Bug Report',exact:true}).click();
     try{await page.waitForFunction(()=>window.__SPOOL_FEEDBACK__===true||window.__SPOOL_FEEDBACK_ERROR__,null,{timeout:35000})}
     catch(error){console.log(JSON.stringify({stage:'widget-submit',target,round,observed:await page.evaluate(()=>({sent:window.__SPOOL_SENT__,responses:window.__SPOOL_RESPONSES__,error:window.__SPOOL_FEEDBACK_ERROR__}))}));throw error}
     assert.equal(await page.evaluate(()=>window.__SPOOL_FEEDBACK_ERROR__),undefined,'the actual widget submission succeeds');
     await page.evaluate(()=>window.flushSDK());
     await page.evaluate(()=>window.queueDiscards());
     await page.waitForFunction(()=>window.__SPOOL_DISCARDS__===3);
     await page.evaluate(()=>window.flushSDK()); // finish capture processing; ordinary browser flush leaves reports buffered.
     // Only the SDK constructs and emits this report, on the actual hidden lifecycle.
     const report=await browserLifecycleReport(page,async()=>{
      let received=0;
      for(let attempt=0;attempt<200;attempt++){
       received=target==='reference'
        ?collector.sent.filter(item=>item.type==='client_report').flatMap(item=>objectJson(item.bytes).discarded_events).filter(row=>row.category==='error'&&row.reason==='before_send').reduce((n,row)=>n+row.quantity,0)
        :(await outcomeMap(app,project.id)).get('client_discarded:error:before_send')??0;
       if(received===(round+1)*3)break;
       await new Promise(resolve=>setTimeout(resolve,50));
      }
      assert.equal(received,(round+1)*3,'the lifecycle report is received and counted before reload');
      return round===0?page.reload():page.goto(applicationOrigin+'/empty');
     });
     assert.deepEqual(objectJson(report.bytes).discarded_events,[{reason:'before_send',category:'error',quantity:3}]);
    }
   }finally{await context.close()}
   return sent;
  };
  const collector=await referenceCollector(),previous=dsns.reference;
  let observedReference;
  try{dsns.reference=collector.dsn;observedReference=await execute('reference')}finally{dsns.reference=previous;await collector.close()}
  const reference=collector.sent;
  assert.deepEqual([...counts(reference.map(i=>i.type))].sort(),[...counts(observedReference.map(i=>i.type))].sort(),'collector received every observed reference item');
  const inventory=counts(reference.map(item=>item.type));
  for(const type of ['event','session','transaction','log','attachment','feedback','replay_event','replay_recording','client_report'])assert.ok(inventory.get(type),`browser wizard qualification sent no ${type}`);
  dsns.qualification=project.dsn;
  const observedSpool=await execute('qualification');
  assert.deepEqual([...counts(observedSpool.map(i=>i.type))].sort(),[...inventory].sort(),'same browser actions produce the same item inventory with only DSN changed');
  const outcomes=await outcomeMap(app,project.id),expected=expectedOutcomes(reference.map(item=>({...item,type:item.header.type})));
  assert.deepEqual([...outcomes].sort(),[...expected].sort(),'every SDK item has one persisted or counted Spool outcome');
  let details=await issueDetails(app,project.id);
  const handled=details.find(d=>d.issue.title.includes('synthetic-spool-browser-handled'));
  const unhandled=details.find(d=>d.events.some(e=>e.event.sentry.exceptions.some(x=>x.mechanism?.handled===false)));
  assert.ok(handled&&unhandled,'handled and automatic unhandled exceptions both persist');
  assert.equal(handled.issue.count,2,'flush and reload group handled captures without duplicate occurrences');
  assert.equal(unhandled.issue.count,2,'automatic errors across reload keep one group');
  assert.equal(details.reduce((n,d)=>n+d.issue.count,0),inventory.get('event'));
  assert.ok(handled.events.every(e=>e.event.sentry.exceptions.every(x=>x.mechanism?.handled!==false)));
  assert.equal(new Set(details.flatMap(d=>d.events.map(e=>e.id))).size,inventory.get('event'));
  const sent=sentIdentities(reference);
  const stored=new Set(details.flatMap(d=>d.events.map(e=>JSON.stringify([e.release,e.event.build]))));
  assert.deepEqual([...stored].sort(),[...sent].sort());
  const releases=await request(`/api/projects/${project.id}/releases`);
  for(const [release] of [...sent].map(JSON.parse))assert.ok(releases.some(r=>r.name===release&&r.auto_created===1),'SDK release is automatically created before artifact registration');
  await upload(project.id);
  details=await issueDetails(app,project.id);
  const mapped=details.flatMap(d=>d.events).flatMap(e=>e.currentLookup??[]).find(f=>f.status==='mapped'&&f.original.line===expectedLine);
  assert.ok(mapped,'the build-plugin map resolves the actual original failure line');
  await readScreens(origin,cookie,[
   {name:`browser-${width}-handled`,path:`/projects/${project.id}/issues/${handled.issue.id}`,check:page=>page.getByRole('heading',{name:/synthetic-spool-browser-handled/}).first().waitFor()},
   {name:`browser-${width}-mapped`,path:`/projects/${project.id}/issues/${unhandled.issue.id}`,check:page=>page.getByText(new RegExp(`checkout\\.js:${expectedLine}:`)).first().waitFor()},
   {name:`browser-${width}-diagnostics`,path:`/projects/${project.id}/capture`,check:page=>page.getByRole('heading',{name:'SDK discarded',exact:true}).waitFor()},
  ]);
  console.log(JSON.stringify({qualification:'[SDK-001] browser',width,sent:Object.fromEntries(inventory),outcomes:Object.fromEntries(outcomes)}));
 }
}
