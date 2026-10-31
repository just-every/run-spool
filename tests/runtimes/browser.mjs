import assert from 'node:assert/strict';
import {counts,expectedOutcomes,issueDetails,outcomeMap,api,sentIdentities,referenceCollector} from './harness.mjs';
import {readScreens} from './screens.mjs';
import {parseEnvelope,objectJson} from '../../src/domain/sentry/wire.ts';
import {browserLifecycleReport} from '../client-report-sdk.mjs';
import {archiveProjection} from '../archive.mjs';

// [SDK-001] One built official-SDK program, identical actions for reference and Spool.
export async function qualifyBrowser({browser,origin,cookie,request,applicationOrigin,dsns,upload,expectedLine}){
 const app=api(origin,cookie);
 for(const width of [1440,390]){
  const project=await request('/api/projects','POST',{id:`browser-qualification-${width}`,name:'Browser qualification'});
  await request(`/api/projects/${project.id}/browser-origins`,'POST',{origin:applicationOrigin});
  const execute=async(target)=>{
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),sent=[],reports=[];
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
     const handledId=await page.evaluate(()=>window.qualifyHandled());
     await page.getByRole('button',{name:'Throw checkout exception',exact:true}).click();
     await page.waitForFunction(()=>window.__SPOOL_SENT__.filter(type=>type==='event').length===2);
     await page.evaluate(()=>window.flushSDK());
     const unhandledId=await page.evaluate(()=>window.lastErrorId());
     assert.notEqual(unhandledId,handledId,'the automatic and handled captures have distinct SDK event IDs');
     assert.match(handledId,/^[a-f0-9]{32}$/);
     assert.match(unhandledId,/^[a-f0-9]{32}$/);
     // Reuse this page's captured errors while switching the widget target.
     // Reverse the report order after reload so neither last-capture nor first-report wins.
     const targets=[['handled',handledId],['unhandled',unhandledId]];
     for(const [kind,eventId] of round===0?targets:targets.toReversed()){
      const message=`synthetic-spool-browser-widget ${kind} round ${round+1}`;
      const submitted={eventId,message,kind};
      reports.push(submitted);
      await page.evaluate(()=>window.stopReplay());
      await page.evaluate(id=>window.openFeedback(id),eventId);
      await page.getByRole('button',{name:'Report a Bug',exact:true}).click();
      await page.getByRole('textbox',{name:'Description',exact:false}).fill(message);
      await page.getByRole('button',{name:'Send Bug Report',exact:true}).click();
      try{await page.waitForFunction(()=>window.__SPOOL_FEEDBACK__!==null||window.__SPOOL_FEEDBACK_ERROR__,null,{timeout:35000})}
      catch(error){console.log(JSON.stringify({stage:'widget-submit',target,round,observed:await page.evaluate(()=>({sent:window.__SPOOL_SENT__,responses:window.__SPOOL_RESPONSES__,error:window.__SPOOL_FEEDBACK_ERROR__}))}));throw error}
      assert.equal(await page.evaluate(()=>window.__SPOOL_FEEDBACK_ERROR__),undefined,'the actual widget submission succeeds');
      await page.evaluate(()=>window.flushSDK());
      const receipt=await page.evaluate(()=>window.__SPOOL_FEEDBACK__);
      assert.equal(receipt.message,message,'the SDK submit-success callback identifies the submitted description');
      assert.match(receipt.id,/^[a-f0-9]{32}$/);
      submitted.id=receipt.id;
      if(target==='qualification'){
       const inbox=await app.json(`/api/projects/${project.id}/feedback`);
       assert.deepEqual(inbox.items.map(row=>row.id).sort(),reports.map(row=>row.id).sort(),'each round retains exactly the widget reports acknowledged so far');
       assert.equal(inbox.total,reports.length);
       for(const acknowledged of reports){
        const row=inbox.items.find(row=>row.id===acknowledged.id);
        assert.equal(row.message,acknowledged.message);
        assert.equal(row.eventId,acknowledged.eventId,'later widget submissions never retarget earlier reports');
        assert.equal(row.association,'attached');
        assert.ok(row.issueId,'each acknowledged widget report belongs to a retained issue before reload');
       }
       assert.equal((await outcomeMap(app,project.id)).get('feedback_accepted'),reports.length,'accepted quantity reconciles before each reload');
      }
     }
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
   const feedback=sent.filter(item=>item.type==='feedback').map(item=>objectJson(item.bytes));
   assert.equal(feedback.length,reports.length,'each report action sends exactly one actual widget report');
   for(const report of reports){
    const matches=feedback.filter(event=>event.contexts.feedback.message===report.message);
    assert.equal(matches.length,1,'every submitted description identifies exactly one SDK feedback item');
    const event=matches[0];
    assert.match(event.event_id,/^[a-f0-9]{32}$/);
    assert.equal(event.event_id,report.id,'the emitted feedback ID equals the SDK submit-success ID');
    assert.equal(event.contexts.feedback.source,'widget');
    assert.equal(event.contexts.feedback.associated_event_id,report.eventId,'the real widget sends the intended captured error reference');
    const error=sent.filter(item=>item.type==='event').map(item=>objectJson(item.bytes)).find(event=>event.event_id===report.eventId);
    assert.ok(error,'the reference belongs to an error actually emitted by this SDK program');
    assert.equal(error.exception.values.some(value=>value.mechanism?.handled===false),report.kind==='unhandled');
   }
   assert.equal(new Set(reports.map(report=>report.id)).size,reports.length,'reloads create distinct report IDs');
   return {sent,reports};
  };
  const collector=await referenceCollector(),previous=dsns.reference;
  let observedReference;
  try{dsns.reference=collector.dsn;observedReference=await execute('reference')}finally{dsns.reference=previous;await collector.close()}
  const reference=collector.sent;
  assert.deepEqual([...counts(reference.map(i=>i.type))].sort(),[...counts(observedReference.sent.map(i=>i.type))].sort(),'collector received every observed reference item');
  for(const report of observedReference.reports){
   const received=reference.filter(item=>item.type==='feedback').map(item=>objectJson(item.bytes)).find(event=>event.event_id===report.id);
   assert.equal(received?.contexts.feedback.message,report.message);
   assert.equal(received?.contexts.feedback.associated_event_id,report.eventId,'the collector receives the actual widget association');
  }
  const inventory=counts(reference.map(item=>item.type));
  for(const type of ['event','session','transaction','log','attachment','feedback','replay_event','replay_recording','client_report'])assert.ok(inventory.get(type),`browser wizard qualification sent no ${type}`);
  dsns.qualification=project.dsn;
  const observedSpool=await execute('qualification');
  assert.deepEqual([...counts(observedSpool.sent.map(i=>i.type))].sort(),[...inventory].sort(),'same browser actions produce the same item inventory with only DSN changed');
  assert.deepEqual(observedSpool.reports.map(({message,kind})=>({message,kind})),observedReference.reports.map(({message,kind})=>({message,kind})),'both targets perform identical report actions across reloads');
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
  const feedback=await app.json(`/api/projects/${project.id}/feedback`);
  const snapshot=await archiveProjection(await app.request('/api/archive'));
  const archived=snapshot.data.feedback.filter(row=>row.project===project.id);
  assert.equal(feedback.total,observedSpool.reports.length);
  assert.equal(feedback.next,null,'the complete report set is read');
  assert.equal(archived.length,observedSpool.reports.length,'every widget report has exactly one stored row');
  const acknowledgedIds=observedSpool.reports.map(row=>row.id).sort();
  assert.deepEqual(feedback.items.map(row=>row.id).sort(),acknowledgedIds,'the complete public inbox equals the SDK-acknowledged report set');
  assert.deepEqual(archived.map(row=>row.id).sort(),acknowledgedIds,'the complete archived report set equals the SDK-acknowledged report set');
  assert.equal(outcomes.get('feedback_accepted'),observedSpool.reports.length,'accepted quantity equals distinct persisted widget reports');
  const issueReports=new Map();
  for(const report of observedSpool.reports){
   const intended=report.kind==='handled'?handled:unhandled;
   const occurrence=intended.events.find(event=>event.id===report.eventId);
   assert.ok(occurrence,'the SDK reference resolves to the intended retained error');
   const row=feedback.items.find(row=>row.id===report.id);
   assert.ok(row,'each SDK feedback ID is present in the public inbox');
   assert.equal(row.message,report.message);
   assert.equal(row.eventId,report.eventId);
   assert.equal(row.issueId,intended.issue.id,'feedback attaches to the intended issue, not the other captured failure');
   assert.equal(row.association,'attached');
   const stored=archived.find(row=>row.id===report.id);
   assert.equal(stored.message,report.message);
   assert.equal(stored.event_id,report.eventId);
   assert.equal(stored.occurrence,occurrence.occurrence,'archive custody binds the exact retained occurrence');
   assert.deepEqual(Object.keys(stored).sort(),['project','id','message','digest','received','event_id','occurrence'].sort(),'widget contact, URL, screenshot and other metadata have no stored fields');
   issueReports.set(intended.issue.id,[...(issueReports.get(intended.issue.id)??[]),report]);
  }
  for(const detail of details){
   const attached=await app.json(`/api/projects/${project.id}/feedback?issue=${detail.issue.id}`);
   assert.deepEqual(attached.items.map(row=>row.id).sort(),(issueReports.get(detail.issue.id)??[]).map(row=>row.id).sort(),'issue reads contain exactly their own widget reports');
  }
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
   {name:`browser-${width}-handled`,path:`/projects/${project.id}/issues/${handled.issue.id}`,check:async page=>{
    await page.getByRole('heading',{name:/synthetic-spool-browser-handled/}).first().waitFor();
    await widgetReportsVisible(page,handled.issue.id);
   }},
   {name:`browser-${width}-mapped`,path:`/projects/${project.id}/issues/${unhandled.issue.id}`,check:async page=>{
    await page.getByText(new RegExp(`checkout\\.js:${expectedLine}:`)).first().waitFor();
    await widgetReportsVisible(page,unhandled.issue.id);
   }},
   {name:`browser-${width}-diagnostics`,path:`/projects/${project.id}/capture`,check:page=>page.getByRole('heading',{name:'SDK discarded',exact:true}).waitFor()},
  ]);
  console.log(JSON.stringify({qualification:'[SDK-001] browser',width,sent:Object.fromEntries(inventory),outcomes:Object.fromEntries(outcomes)}));
  console.log(`PROBE SDK-004 acceptance5: actual Sentry widget, handled then automatic error across reloads at ${width} -> ${acknowledgedIds.length} callback IDs equal emitted, inbox and archived reports; exact occurrence and issue links; feedback_accepted=${outcomes.get('feedback_accepted')}`);
  async function widgetReportsVisible(page,issue){
   const panel=page.getByRole('region',{name:'Issue feedback',exact:true});
   for(const report of issueReports.get(issue)??[]){
    const row=panel.getByRole('listitem').filter({hasText:report.message});
    await row.getByText(report.message,{exact:true}).waitFor();
    assert.equal(await row.locator('code').textContent(),report.eventId,'the correct issue renders the exact linked event');
   }
   assert.equal(await panel.getByRole('listitem').count(),(issueReports.get(issue)??[]).length);
   await panel.scrollIntoViewIfNeeded();
  }
 }
}
