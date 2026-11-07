import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';
import {auditHistory} from './audit-retirement-contract.mjs';

const code=answer=>answer?._meta?.['com.runeditrun/error']?.code;
const done=answer=>{assert.ok(answer&&!answer.isError,code(answer)??'Missing result');return answer.structuredContent;};
const fixture=()=> 'synthetic-spool-'+randomUUID();

/** Populated native audit, review, filters and downloads through the emitted Worker. */
export async function auditContract(app,screens,{agents=[]}={}){
 const fixed=Date.parse('2026-11-04T12:00:00Z'),weekStart=Date.parse('2026-11-02T00:00:00Z');
 const project=fixture(),created=await app.json('/api/projects','POST',{id:project,name:'Audit fixture week'});
 await app.json('/api/projects/'+project+'/releases','POST',{name:'1.0.0',build:'web-1'});
 for(let i=0;i<2;i++)await app.json('/api/ingest/'+project,'POST',{version:1,eventId:fixture(),release:'1.0.0',build:'web-1',environment:'production',type:'TypeError',message:'Audit fixture',frames:[{file:'https://checkout.example/audit.js',line:1,column:0,function:'total'}],breadcrumbs:[]},{Cookie:'',Authorization:'Bearer '+created.ingestKey});
 const email=fixture()+String.fromCharCode(64)+'spool.test',sub=fixture();
 const invited=await app.json('/api/organization/invites','POST',{email,name:'Audit member',role:'member',grants:[{project,role:'member'}]});
 const invitation=(await app.mail()).findLast(row=>row.to?.includes(email)),token=invitation?.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);
 const accepted=await app.request('/auth/confirm','POST',{token},{Cookie:''});assert.equal(accepted.status,303);const memberCookie=accepted.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');assert.ok(memberCookie);await accepted.body?.cancel();
 await app.syncSettings([{id:sub,email,name:'Audit member',role:'member',invite:1}]);
 const member=(await app.json('/api/organization')).members.find(row=>row.id===invited.id);assert.ok(member);
 const priorNow=app.context.now;
 // Native SQL transaction fences use the database clock. Keep signed fixture
 // authority live there while the Worker clock fixes audit-week expectations.
 const adopt=document=>app.adopt(document,{exp:Math.floor(Math.max(Date.now(),fixed)/1000)+3600});
 const clock=async at=>{app.context.now=()=>at;await app.setTime(at);};
 const browser=await chromium.launch({headless:true,...process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{},args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{Cookie:app.cookie}}),page=await context.newPage();
 const subjects=[];
 try{
  for(const [policy,document] of [['autonomous',autonomousPolicy()],['held',heldPolicy()]]){
   const claims={act:{sub:fixture(),name:'Audit engineer '+policy,specialist:'triage engineer'},consent:fixture()};subjects.push(claims.act.sub);
   const select='agent='+encodeURIComponent(claims.act.sub),read=()=>app.call('spool.issues.list',{project},claims);
   // A prior-week real call must not inflate this week's dashboard.
   await clock(weekStart-3600000);await adopt(document);done(await read());
   await clock(fixed);await adopt(document);
   let initial=(await app.json('/api/projects/'+project+'/issues')).find(row=>row.count>0);assert.ok(initial);
   if(initial.state!=='open'){await app.json('/api/projects/'+project+'/issues/'+initial.id,'PATCH',{state:'open',revision:initial.revision});initial=(await app.json('/api/projects/'+project+'/issues')).find(row=>row.id===initial.id);}
   const trace=fixture(),key=fixture();
   const source=done(await app.call('spool.packets.read',{project,issue:initial.id},claims));
   const written=await app.mcp('tools/call',{name:'spool.proposals.create',arguments:{project,kind:'split',source:initial.id,revision:initial.revision,events:[source.events[0].id],variants:[{stack:JSON.stringify(source.events[0].event.frames),release:'1.0.0',route:''}],window:{start:source.events[0].received,end:source.events[0].received+1},rationale:'Audit-only inert suggestion',idempotency_key:key},_meta:{traceparent:trace}},claims);
   const proposal=done(written);assert.equal(proposal.state,'proposed');
   const complete=(await auditHistory(app,select)).rows.find(row=>row.idempotency_key===key);assert.ok(complete);
   assert.deepEqual(complete.agent,{id:claims.act.sub,name:claims.act.name,specialist:claims.act.specialist});assert.equal(complete.client_id,'rer-agent-conformance');assert.equal(complete.consent,claims.consent);
   assert.equal(complete.sponsor.name,'Dana Engineer');assert.ok(complete.sponsor.id);assert.equal(complete.label,claims.act.name+' for Dana Engineer');
   assert.equal(complete.tool,'spool.proposals.create');assert.deepEqual(complete.resource,{kind:'issue',id:initial.id});
   assert.ok(complete.id&&complete.operation_id);assert.ok(complete.scopes.includes('spool:propose'));
   assert.equal(complete.at,new Date(fixed).toISOString());assert.equal(complete.trace,trace);assert.equal(complete.idempotency_key,key);
   assert.deepEqual(complete.classes,[{class:'standard',facts:{measure:1}}]);assert.equal(complete.revision,app.context.revision);
   assert.deepEqual(complete.rules,[{class:'standard',rule:policy==='held'?'standard':'all',do:policy==='held'?'review':'autonomous'}]);
   assert.equal(complete.decision,policy==='held'?'review':'autonomous');assert.equal(complete.outcome,'done');assert.equal(complete.code,null);
   assert.equal(complete.approval,null);assert.equal(complete.review?.id??null,written._meta?.['com.runeditrun/review']?.id??null);
   console.log('PROBE BASE-AGENT-009 acceptance-1 '+policy+': authenticated proposal write -> complete identity, sponsor, consent, scope, target, class facts, policy rule, decision, outcome, review, key and trace row');
   const before=await app.json('/api/projects/'+project+'/issues');
   const blocked=autonomousPolicy();blocked.rules[0].do='blocked';await adopt(blocked);
   assert.equal(code(await read()),'policy_blocked');
   await adopt(null);assert.equal(code(await read()),'policy_unset');
   await adopt(document);
   const held=await app.call('spool.issues.update',{project,issue:initial.id,revision:initial.revision,state:'suppressed',idempotency_key:fixture()},claims);
   if(policy==='held'){
    assert.equal(code(held),'approval_required');assert.deepEqual(await app.json('/api/projects/'+project+'/issues'),before);
    const pending=held._meta?.['com.runeditrun/approval']??held._meta?.['com.runeditrun/error']?.approval,approval=(await app.json('/agents/api/approvals/'+pending.id)).approval;
    await app.json('/agents/api/approvals/'+pending.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
    const approved=(await auditHistory(app,select)).rows.filter(row=>row.approval?.id===pending.id);
    assert.deepEqual(approved.map(row=>row.outcome),['pending','done']);for(const row of approved)assert.deepEqual(row.approval.by,[complete.sponsor.id]);
   }else assert.equal(done(held).state,'suppressed');
   assert.equal((await app.json('/api/projects/'+project+'/issues')).find(row=>row.id===initial.id).state,'suppressed');
   const scoped={sub,email,act:{sub:fixture(),name:'Audit member agent '+policy,specialist:'triage engineer'},consent:fixture()};subjects.push(scoped.act.sub);
   const escalated=await app.call('spool.access.update',{id:member.operator_id,version:member.version,role:'admin',grants:[],idempotency_key:fixture()},scoped);
   assert.equal(code(escalated),'self_escalation');
   assert.equal((await app.json('/api/organization')).members.find(row=>row.id===member.id).role,'member','Refused escalation preserves native authority');
   const selfRow=(await auditHistory(app,'agent='+encodeURIComponent(scoped.act.sub))).rows.at(-1);assert.equal(selfRow.decision,'self_escalation');assert.equal(selfRow.outcome,'refused');assert.equal(selfRow.code,'self_escalation');
   const rows=(await auditHistory(app,select)).rows;
   for(const [decision,outcome] of [['blocked','refused'],['unset','refused'],...(policy==='held'?[['approval','pending']]:[])])assert.ok(rows.some(row=>row.decision===decision&&row.outcome===outcome));
   console.log('PROBE BASE-AGENT-009 acceptance-2 '+policy+': blocked, unset, held write and member escalation -> retained truthful refusals and pending audit; unsafe calls preserve native state');
   await adopt(document);
   // Reversible native grouping is a review call under the held policy.
   const issue=(await app.json('/api/projects/'+project+'/issues')).find(row=>row.count>0),packet=done(await app.call('spool.packets.read',{project,issue:issue.id},claims));
   const preview=done(await app.call('spool.grouping.preview',{project,kind:'split',source:issue.id,revision:issue.revision,events:[packet.events[0].id],idempotency_key:fixture()},claims));
   const membershipBefore=await app.json('/api/projects/'+project+'/issues');
   const applied=await app.call('spool.grouping.apply',{project,id:preview.id,idempotency_key:fixture()},claims);done(applied);
   if(policy==='held'){
    const history=(await auditHistory(app,select)).rows,reviews=(await app.json('/agents/api/reviews')).reviews;
    const expected=history.filter(row=>row.decision==='review'&&row.outcome==='done').map(row=>row.review.id).sort();
    assert.deepEqual(reviews.filter(row=>history.some(item=>item.id===row.decision_id)).map(row=>row.id).sort(),expected,'Review feed membership equals actual completed review decisions');
    await page.goto(app.origin+'/agents');
    const shown=await page.locator('[data-review-id]').evaluateAll(nodes=>nodes.map(node=>node.dataset.reviewId).sort());
    assert.deepEqual(shown,reviews.filter(row=>['open','flagged'].includes(row.state)).map(row=>row.id).sort());
    const note=page.locator('[data-review-id="'+written._meta['com.runeditrun/review'].id+'"]');
    await note.getByRole('button',{name:'Mark reviewed',exact:true}).click();await page.waitForLoadState('networkidle');
    const marked=(await app.json('/agents/api/reviews')).reviews.find(row=>row.id===complete.review.id);assert.equal(marked.state,'reviewed');assert.equal(marked.marked_by,complete.sponsor.id);assert.equal(marked.marked_at,new Date(fixed).toISOString());
    const flagged=page.locator('[data-review-id="'+applied._meta['com.runeditrun/review'].id+'"]');
    await flagged.getByRole('button',{name:'Flag',exact:true}).click();await page.waitForLoadState('networkidle');
    assert.equal((await app.json('/agents/api/reviews')).reviews.find(row=>row.id===applied._meta['com.runeditrun/review'].id).state,'flagged');
    await page.locator('[data-review-id="'+applied._meta['com.runeditrun/review'].id+'"]').getByRole('button',{name:'Undo',exact:true}).click();await page.waitForLoadState('networkidle');
    const restored=await app.json('/api/projects/'+project+'/issues');
    for(const prior of membershipBefore){const current=restored.find(row=>row.id===prior.id);assert.ok(current);assert.equal(current.count,prior.count);assert.equal(current.state,prior.state);}
    const restoredPacket=await app.json('/api/projects/'+project+'/issues/'+issue.id+'/packet');
    assert.deepEqual(restoredPacket.events.map(row=>row.id).sort(),packet.events.map(row=>row.id).sort(),'Person Undo restores exact event membership');
    assert.equal((await app.json('/agents/api/reviews')).reviews.find(row=>row.id===applied._meta['com.runeditrun/review'].id).marked_by,complete.sponsor.id);
    assert.equal((await auditHistory(app,select)).rows.find(row=>row.id===complete.id).review.by,complete.sponsor.id);
   }else{assert.ok(!(await app.json('/agents/api/reviews')).reviews.some(row=>row.decision_id===complete.id),'Autonomous writes create no review');await app.json('/api/projects/'+project+'/corrections/'+preview.id+'/undo','POST',{confirm:true});}
   console.log('PROBE BASE-AGENT-009 acceptance-4 '+policy+': native review feed and person controls -> exact review membership; held Mark reviewed, Flag and reversible Undo preserve real person attribution');
   await page.goto(app.origin+'/agents?'+select);
   const audit=(await auditHistory(app,select)).rows,counts=new Map();
   for(const row of audit.filter(row=>Date.parse(row.at)>=weekStart&&Date.parse(row.at)<=fixed))for(const item of row.classes){const k=item.class+':'+row.decision;counts.set(k,(counts.get(k)??0)+1);}
   assert.ok(audit.some(row=>Date.parse(row.at)<weekStart),'The known corpus has out-of-week history');
   const displayed=await page.locator('[data-agents-count]').evaluateAll(nodes=>nodes.map(node=>[node.dataset.class+':'+node.dataset.decision,Number(node.textContent)]));
   assert.deepEqual(displayed.sort(),[...counts].sort(),'Fixture-week counts reconcile with public audit, including refusals and approvals');
   console.log('PROBE BASE-AGENT-009 acceptance-3 '+policy+': Agents fixture-week counts -> exact class and decision totals; earlier week excluded');
   assert.ok(audit.length);await page.getByLabel('Class',{exact:true}).focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.getByLabel('Class',{exact:true}).inputValue(),'standard');await page.getByRole('button',{name:'Filter activity'}).click();await page.waitForLoadState('networkidle');
   const filtered=audit.filter(row=>row.classes.some(item=>item.class==='standard'));
   const filteredReviews=(await app.json('/agents/api/reviews?'+select+'&class=standard')).reviews;
   assert.deepEqual(await page.locator('[data-review-id]').evaluateAll(nodes=>nodes.map(node=>node.dataset.reviewId)),filteredReviews.filter(row=>['open','flagged'].includes(row.state)).map(row=>row.id),'Agent and Class filters also constrain the visible review feed');
   assert.deepEqual(await page.locator('[data-audit-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.auditId)),filtered.slice(-20).reverse().map(row=>row.id));
   assert.ok((await page.locator('[data-audit-agent]').evaluateAll(nodes=>nodes.map(n=>n.dataset.auditAgent))).every(id=>id===claims.act.sub));
   const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Export JSON'}).click()]);
   const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
   assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()),filtered,'The actual downloaded export retains every visible audit field');
   await screens.capture('agents-audit-'+policy,'/agents?'+select,undefined,page=>page.locator('[data-audit-id]').first().waitFor());
   console.log('PROBE BASE-AGENT-009 acceptance-5 '+policy+': native Agent and Class filters and browser download -> matching rows only; every visible field preserved');
   console.log('PROBE BASE-AGENT-009 acceptance-7 '+policy+': populated Agents screen -> 1440 Axe and keyboard form; 1440 and 390 browser proof');
  }
  // The export must traverse multiple native pages, including matches after a long peer prefix.
  const all=(await auditHistory(app)).rows;assert.ok(all.length>200);
  assert.deepEqual(await app.json('/agents/api/audit/export'),all,'Unfiltered export traverses every native page');
  for(const cls of ['standard','live','access']){
   const expected=all.filter(row=>row.classes.some(item=>item.class===cls));
   assert.deepEqual((await auditHistory(app,'class='+cls)).rows,expected,'Class-only pagination does not drop sparse later matches');
   assert.deepEqual(await app.json('/agents/api/audit/export?class='+cls),expected,'Class-only export includes every match');
  }
  assert.deepEqual((await auditHistory(app,'agent='+subjects[0])).rows,all.filter(row=>row.agent.id===subjects[0]));
  assert.deepEqual(await app.json('/agents/api/audit/export?agent='+fixture()),[],'An unmatched export is an empty JSON array');
  const anonymous=await app.request('/agents/api/audit/export','GET',undefined,{Cookie:''});assert.equal(anonymous.status,401);await anonymous.body?.cancel();
  const memberExport=await app.request('/agents/api/audit/export','GET',undefined,{Cookie:memberCookie});assert.equal(memberExport.status,403);await memberExport.body?.cancel();
  assert.ok(!JSON.stringify(all).includes(created.ingestKey),'Audit exports never include the raw project credential');
  const bearer=await app.request('/agents/api/audit/export','GET',undefined,{Cookie:'',Authorization:'Bearer '+created.ingestKey});assert.equal(bearer.status,403);await bearer.body?.cancel();
  assert.deepEqual(await app.json('/agents/api/audit/export'),all,'Refused export callers cannot modify audit history');
  const reviewPages=[],reviewIds=[];let after='';
  do{const result=await app.json('/agents/api/reviews?after='+encodeURIComponent(after));reviewPages.push(result);reviewIds.push(...result.reviews.map(row=>row.id));after=result.cursor;}while(after);
  assert.ok(reviewPages.length>1,'Populated review history crosses the native page limit');
  const ownedAgents=new Set([...agents,...subjects]);
  const completedReviews=all.filter(row=>ownedAgents.has(row.agent.id)&&row.decision==='review'&&row.outcome==='done'&&row.review);
  assert.ok(completedReviews.length>200,'The authorized fixture has more than one page of real review decisions');
  for(const row of completedReviews)assert.ok(reviewIds.includes(row.review.id),'Every completed review call remains reachable in the paginated feed');
  assert.equal(new Set(reviewIds).size,reviewIds.length);
  await page.goto(app.origin+'/agents');await page.getByRole('link',{name:'Earlier reviews'}).click();
  assert.deepEqual(await page.locator('[data-review-id]').evaluateAll(nodes=>nodes.map(node=>node.dataset.reviewId)),reviewPages[1].reviews.filter(row=>['open','flagged'].includes(row.state)).map(row=>row.id),'The browser reaches earlier review decisions without truncation');
 }finally{
  await browser.close();app.context.now=priorNow;await app.setTime(Date.now());await app.adopt();
 }
}
