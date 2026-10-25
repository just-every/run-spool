import assert from 'node:assert/strict';

const width=60000,week=7*86400000;
const close=(actual,expected,label)=>assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<1e-10,`${label}: expected ${expected}, received ${actual}`);

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
 const sentryPath=`/api${dsn.pathname}/envelope/?sentry_key=${encodeURIComponent(dsn.username)}`;
 let serial=0,issue;
 async function receipt(id,time){
  const result=await app.db.prepare('UPDATE events SET received=? WHERE project=? AND id=?').bind(time+100,project,id).run();
  assert.equal(result.meta.changes,1,'each replayed receipt came from accepted public intake');
 }
 async function window(time,target,background){
  for(let i=0;i<target;i++){
   const id=(++serial).toString(16).padStart(32,'0');
   const event={event_id:id,release:'r1',dist:'b1',environment:name,level:'error',fingerprint:['synthetic-spool-34-target'],
    sdk:{name:'synthetic-spool',version:'1',sample_rate:0.5},
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
 async function loss(time){
  const response=await app.request(`/api/ingest/${project}`,'POST',{version:1},headers);
  assert.equal(response.status,400,'malformed public intake records real capture loss');await response.json();
  const changed=await app.db.prepare("UPDATE outcomes SET window=? WHERE project=? AND reason='invalid'").bind(time,project).run();
  assert.equal(changed.meta.changes,1,'the rejected receipt supplies the replayed loss window');
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

export async function baselineJourney(app,fixture){
 // Separate projects keep each synthetic capture burst below the native intake
 // budget and keep project-scoped loss counters from crossing scenarios.
 const start=Math.floor(Date.now()/width)*width-2*width;
 const histories=async(s)=>{await s.window(start-week,2,8);await s.window(start-2*week,2,8)};

 const normal=await scenario(app,'normal',start);await histories(normal);await normal.window(start,2,8);
 const normalRule=await normal.enable(),normalDecision=await normal.evaluate(normalRule);
 assert.equal(normalDecision.fired,false,'normal issue rate does not fire');
 close(normalDecision.baseline,1/3,'sample-weighted normal baseline');close(normalDecision.value,1/3,'sample-weighted current rate');
 assert.equal(normalDecision.sampleRate,0.5,'the decision exposes recorded half-rate sampling');
 assert.equal(normalDecision.denominator,10,'the denominator names actual accepted traffic');
 assert.equal(normalDecision.history.length,2,'two complete comparable weeks establish the baseline');
 assert.equal((await normal.spikes()).length,0,'normal traffic creates no spike');

 const burst=await scenario(app,'burst',start);await histories(burst);await burst.window(start,6,6);
 const burstRule=await burst.enable(),burstDecision=await burst.evaluate(burstRule);
 assert.equal(burstDecision.fired,true,'a doubled sample-scaled issue rate fires');
 close(burstDecision.baseline,1/3,'burst historical baseline');close(burstDecision.value,2/3,'burst sample-weighted current rate');
 assert.equal(burstDecision.count,6,'the burst receipt retains its observed occurrence count');
 const firstAlerts=await burst.spikes(),firstDeliveries=await burst.deliveries(burstRule);
 assert.equal(firstAlerts.length,1,'only the target burst creates a spike');assert.equal(firstDeliveries.length,1,'the burst routes exactly one delivery');
 await burst.evaluate(burstRule);
 assert.deepEqual((await burst.spikes()).map(row=>row.id),firstAlerts.map(row=>row.id),'same-process re-evaluation creates no second spike');
 await app.restart();await burst.evaluate(burstRule);
 assert.deepEqual((await burst.spikes()).map(row=>row.id),firstAlerts.map(row=>row.id),'restart preserves the durable spike identity');
 assert.deepEqual((await burst.deliveries(burstRule)).map(row=>row.id),firstDeliveries.map(row=>row.id),'restart and re-evaluation do not route another delivery');

 const seasonal=await scenario(app,'seasonal',start);
 for(const offset of [week,2*week]){await seasonal.window(start-offset,6,4);await seasonal.window(start-offset-3600000,0,10)}
 await seasonal.window(start,6,4);
 const seasonalRule=await seasonal.enable(),seasonalDecision=await seasonal.evaluate(seasonalRule);
 assert.equal(seasonalDecision.fired,false,'a normal weekly peak does not fire');
 close(seasonalDecision.baseline,0.75,'weekly peaks define the baseline, rather than the off-hour average of 0.375');
 close(seasonalDecision.value,0.75,'the current peak equals its own seasonal baseline');
 assert.deepEqual(seasonalDecision.history.map(row=>row.start).sort((a,b)=>a-b),[start-2*week,start-week],'only matching weekly windows contribute');
 assert.equal((await seasonal.spikes()).length,0,'seasonal traffic creates no spike');

 const low=await scenario(app,'lowtraffic',start);await histories(low);await low.window(start,7,2);
 const lowRule=await low.enable(),lowDecision=await low.evaluate(lowRule);
 assert.equal(lowDecision.fired,false,'nine observed events withhold an otherwise anomalous rate');
 assert.equal(lowDecision.denominator,9);assert.match(lowDecision.reason,/low traffic/i);
 assert.equal((await low.spikes()).length,0,'low traffic creates no spike');

 const currentLoss=await scenario(app,'current-loss',start);await histories(currentLoss);await currentLoss.window(start,6,6);await currentLoss.loss(start);
 const currentLossRule=await currentLoss.enable(),lossDecision=await currentLoss.evaluate(currentLossRule);
 assert.equal(lossDecision.fired,false,'current capture loss withholds a doubled rate');
 close(lossDecision.value,2/3,'loss does not hide the observed anomaly');
 assert.ok(lossDecision.loss.some(row=>row.reason==='invalid'&&row.count===1),'the rejected capture is named in the decision');
 assert.match(lossDecision.reason,/capture loss/i);assert.equal((await currentLoss.spikes()).length,0);

 const historicLoss=await scenario(app,'historic-loss',start);await histories(historicLoss);
 await historicLoss.window(start-3*week,9,1);await historicLoss.loss(start-3*week);await historicLoss.window(start,6,6);
 const historicRule=await historicLoss.enable(),historicDecision=await historicLoss.evaluate(historicRule);
 assert.equal(historicDecision.fired,true,'a lossy historical high-rate window cannot suppress a real burst');
 close(historicDecision.baseline,1/3,'historical loss is excluded from the baseline');
 assert.equal(historicDecision.history.length,2);assert.equal(historicDecision.loss.length,0,'historical loss is not current loss');
 assert.ok(historicDecision.excluded.some(row=>row.start===start-3*week&&row.reasons.includes('invalid')),'excluded historical loss names its actual reason');
 assert.equal((await historicLoss.spikes()).length,1,'the clean comparable history admits one burst');

 const insufficient=await scenario(app,'insufficient',start);await insufficient.window(start-week,2,8);await insufficient.window(start,6,6);
 const insufficientRule=await insufficient.enable(),insufficientDecision=await insufficient.evaluate(insufficientRule);
 assert.equal(insufficientDecision.fired,false,'one comparable week withholds an otherwise doubled rate');
 assert.equal(insufficientDecision.history.length,1);assert.match(insufficientDecision.reason,/insufficient history/i);
 assert.equal((await insufficient.spikes()).length,0,'insufficient history creates no spike');
 console.log('ALERT-001 baseline journey: sample-scaled normal/burst, weekly seasonality, low traffic, current/historical loss, insufficient history, and durable once-only routing across restart');
}
