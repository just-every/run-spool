import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

// One native MCP journey: the reviewed retention inventory governs policy,
// approval, execution and replay. Only the mail network edge is substituted.
export async function retentionClasses(app,screens){
 const tool='spool.retention.update',types=['events','artifacts','feedback','exposures','commits','sessions'];
 const windows=days=>Object.fromEntries(types.map(type=>[type,days]));
 const code=answer=>answer?._meta?.['com.runeditrun/error']?.code;
 const done=answer=>{assert.ok(answer&&!answer.isError,code(answer)??'Missing native result');return answer.structuredContent;};
 const classes=answer=>answer._meta['com.runeditrun/decision'].classes.map(({class:kind,facts})=>({class:kind,facts}));
 const standard=[{class:'standard',facts:{measure:1}}],destructive=count=>[{class:'destructive',facts:{measure:count}}];
 const state=async project=>{const {revision,generation,windows,held}=await app.json(`/api/projects/${project}/retention-policy`);return {revision,generation,windows,held};};
 const preview=async(project,windows)=>{
  const native=await app.json(`/api/projects/${project}/retention-policy/preview`,'POST',{windows});
  const viaMcp=done(await app.call('spool.retention.preview',{project,windows}));
  const inventory=rows=>rows.map(({cutoff,...row})=>row);
  assert.deepEqual(inventory(viaMcp.rows),inventory(native.rows),'MCP preview agrees with native retained counts, ranges and bytes');
  assert.equal(viaMcp.shortening,native.shortening);
  return viaMcp;
 };
 const args=(project,p)=>({project,revision:p.revision,windows:p.windows,at:p.at,token:p.token,idempotency_key:randomUUID()});
 const approve=async approval=>(await app.json(`/agents/api/approvals/${approval.id}/approve`,'POST',{revision:approval.revision,summary_sha256:approval.summary_sha256})).approval;
 const pending=async input=>{
  const before=await state(input.project),answer=await app.call(tool,input);
  assert.equal(code(answer),'approval_required');
  assert.deepEqual(await state(input.project),before,'Waiting for destructive approval changes no policy');
  const reference=answer._meta['com.runeditrun/error'].approval;
  const approval=(await app.json('/agents/api/approvals/'+reference.id)).approval;
  assert.deepEqual(approval.classes,classes(answer),'Approval retains exactly the server-computed facts');
  return {answer,approval};
 };
 const auditRows=async()=>{const rows=[];let after='0';for(;;){const page=await app.json('/agents/api/audit?after='+after);rows.push(...page.rows);if(!page.rows.length)return rows;after=page.cursor;}};
 await app.adopt(heldPolicy());
 const empty='synthetic-spool-170-empty';await app.json('/api/projects','POST',{id:empty,name:empty});
 const emptyPreview=await preview(empty,windows(30));
 assert.equal(emptyPreview.rows.reduce((sum,row)=>sum+row.count,0),0);
 const emptyInput=args(empty,emptyPreview),zero=await pending(emptyInput);
 assert.deepEqual(classes(zero.answer),destructive(0),'An empty inventory still requires destructive approval for shortening');
 assert.equal((await approve(zero.approval)).state,'executed');
 assert.equal((await state(empty)).windows.sessions,30);
 for(const days of [60,60,90]){
  const p=await preview(empty,windows(days)),input=args(empty,p),answer=await app.call(tool,input);
  done(answer);assert.deepEqual(classes(answer),standard,'Longer and unchanged windows are standard, without live');
  assert.ok(answer._meta['com.runeditrun/review']?.id,'Standard configuration enters the company review feed');
  assert.equal((await state(empty)).revision,p.revision+1);
 }
 console.log('PROBE SURFACE-003 windows: authenticated MCP 30 -> 60 -> 60 -> 90 -> standard and review; empty shortening -> destructive count 0, approved once');

 const project='synthetic-spool-170-retained',created=await app.json('/api/projects','POST',{id:project,name:project});
 await app.json(`/api/projects/${project}/releases`,'POST',{name:'synthetic-spool-170',build:'synthetic-spool-170'});
 const dsn=new URL(created.dsn),baseTime=Date.now();
 const envelope=async session=>{
  const response=await fetch(`${app.origin}/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`,{method:'POST',headers:{Origin:app.origin,'content-type':'application/x-sentry-envelope'},body:'{}\n{"type":"session"}\n'+JSON.stringify(session)});
  const result=await response.json();assert.equal(response.status,200,'Native session intake accepts the controlled inventory');assert.equal(result.sessions.session_stored,1);
 };
 const capture=async(days,sid=randomUUID().replaceAll('-',''))=>{
  const time=new Date(baseTime-days*86400000).toISOString();
  await envelope({sid,started:time,timestamp:time,status:'exited',errors:0,attrs:{release:'synthetic-spool-170',environment:'test'}});return sid;
 };
 const first=await capture(70);await capture(65);await capture(1);
 const shorter={...windows(90),sessions:30};let p=await preview(project,shorter);
 assert.equal(p.rows.find(row=>row.type==='sessions').count,2);
 assert.equal(p.rows.reduce((sum,row)=>sum+row.count,0),2,'The controlled retained inventory has two eligible records and one newer record');
 const initial=await state(project),blockedPolicy=autonomousPolicy();
 blockedPolicy.rules.push({id:'retention-blocked',class:'destructive',do:'blocked'});await app.adopt(blockedPolicy);
 const blockedInput=args(project,p);
 const blocked=await app.call(tool,{...blockedInput,classes:['standard'],facts:{measure:0},item_count:0,shortening:false,approved:true});
 assert.equal(code(blocked),'policy_blocked');assert.deepEqual(classes(blocked),destructive(2),'Injected class and count claims cannot lower the computed risk');
 assert.deepEqual(await state(project),initial,'Blocked destructive configuration changes no policy');
 const blockedAudit=(await auditRows()).findLast(row=>row.idempotency_key===blockedInput.idempotency_key);
 assert.deepEqual(blockedAudit.classes,destructive(2));
 assert.ok(blockedAudit.ignored_arguments.includes('classes')&&blockedAudit.ignored_arguments.includes('item_count'));
 console.log('PROBE SURFACE-003 blocked: MCP shortening with injected standard and zero count -> policy_blocked, destructive count 2, unchanged native policy');

 await app.adopt(heldPolicy());
 const staleInventory=await pending(args(project,p));assert.deepEqual(classes(staleInventory.answer),destructive(2));
 await capture(60);const beforeInventoryApproval=await state(project);
 const changed=await approve(staleInventory.approval);
 assert.equal(changed.state,'refused');assert.equal(changed.code,'approval_evidence_changed');
 assert.deepEqual(await state(project),beforeInventoryApproval,'Changed affected count cannot execute an earlier approval');
 p=await preview(project,shorter);assert.equal(p.rows.find(row=>row.type==='sessions').count,3);
 const sameCount=await pending(args(project,p));
 // Advance an existing old session without changing the eligible quantity.
 const originalTime=new Date(baseTime-70*86400000).toISOString(),updatedTime=new Date(baseTime-69*86400000).toISOString();
 await envelope({sid:first,started:originalTime,timestamp:updatedTime,status:'exited',errors:0,attrs:{release:'synthetic-spool-170',environment:'test'}});
 assert.equal((await preview(project,shorter)).rows.find(row=>row.type==='sessions').count,3);
 const fenced=await approve(sameCount.approval);assert.equal(fenced.state,'refused');assert.equal(fenced.code,'revision_conflict');
 assert.deepEqual(await state(project),initial,'The native reviewed-preview token also fences same-count inventory changes');
 p=await preview(project,shorter);const staleRevision=await pending(args(project,p));
 const nativePreview=await app.json(`/api/projects/${project}/retention-policy/preview`,'POST',{windows:windows(90)});
 await app.json(`/api/projects/${project}/retention-policy`,'PUT',nativePreview);
 const revised=await state(project),revisionRefused=await approve(staleRevision.approval);
 assert.equal(revisionRefused.state,'refused');assert.equal(revisionRefused.code,'revision_conflict');
 assert.deepEqual(await state(project),revised,'A later native policy revision fences a stale company approval');
 console.log('PROBE SURFACE-003 stale: approved MCP calls after changed quantity, same-count range and native revision -> refused, no policy mutation');

 p=await preview(project,shorter);const input=args(project,p),current=await pending(input);
 assert.deepEqual(classes(current.answer),destructive(3));
 await screens?.capture('retention-shortening-approval','/agents/approvals/'+current.approval.id,'3 items',page=>page.locator('summary').filter({hasText:'Details'}).click());
 const approved=await approve(current.approval);assert.equal(approved.state,'executed');
 let saved=await state(project);assert.equal(saved.revision,p.revision+1);assert.deepEqual(saved.windows,shorter);
 assert.equal((await approve(current.approval)).state,'executed');
 const replay=await app.call(tool,input);done(replay);assert.deepEqual(classes(replay),destructive(3),'Replay retains the original destructive evidence after policy execution');
 assert.deepEqual(await state(project),saved,'Repeated approval and MCP replay execute the policy change once');
 const history=(await auditRows()).filter(row=>row.approval?.id===current.approval.id);
 assert.ok(history.some(row=>row.outcome==='pending')&&history.some(row=>row.outcome==='done'));
 for(const row of history){assert.deepEqual(row.classes,destructive(3));assert.deepEqual(row.approval.by,[row.sponsor.id]);}
 const custody=await app.DB.prepare("SELECT principal FROM spool_agent_custody WHERE kind='retention' AND id=?").bind(project).first();
 const principal=JSON.parse(custody.principal);assert.equal(principal.revision,saved.revision);assert.equal(principal.agent.id,app.context.agentId);assert.equal(principal.consent,app.context.consent);
 const nativeAudit=(await app.json('/api/audit/export')).rows;
 assert.ok(nativeAudit.some(row=>row.action==='retention.policy'&&row.actor_kind==='agent'&&row.outcome==='succeeded'),'Native policy audit records the agent action');
 console.log('PROBE SURFACE-003 approval: MCP shortening of 3 eligible sessions -> pending, approved current policy saved once; replay and audit preserve destructive count 3 and native standing custody');
 const longer=await preview(project,{...shorter,sessions:60});
 assert.equal(longer.rows.find(row=>row.type==='sessions').count,3,'Retained records can remain eligible even when a window grows');
 const extended=await app.call(tool,args(project,longer));done(extended);assert.deepEqual(classes(extended),standard,'Lengthening is standard even with a nonempty native expiry preview');
 saved=await state(project);assert.equal(saved.windows.sessions,60);
 console.log('PROBE SURFACE-003 lengthening: MCP 30 -> 60 days with 3 eligible retained records -> standard, no destructive or live addition');

 await app.adopt();
 // A native maintainer in a disjoint project has no authority here even when
 // the company allows every risk class.
 const foreign='synthetic-spool-170-foreign';await app.json('/api/projects','POST',{id:foreign,name:foreign});
 const sub=randomUUID(),email=['synthetic-spool-170', 'spool.test'].join('@');
 const invited=await app.json('/api/organization/invites','POST',{email,name:'Synthetic retention maintainer',role:'member',grants:[{project:foreign,role:'maintainer'}]});
 const invitation=(await app.mail()).findLast(message=>message.to?.includes(email)),token=invitation?.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);
 const confirmed=await app.request('/auth/confirm','POST',{token},{Cookie:''});assert.equal(confirmed.status,303);await confirmed.body?.cancel();
 await app.syncSettings([{id:sub,email,name:'Synthetic retention maintainer',role:'member',invite:1}]);
 const claims={sub,email,act:{sub:randomUUID(),name:'Synthetic retention agent',specialist:'triage engineer'}};
 p=await preview(project,windows(90));
 assert.equal(code(await app.call(tool,args(project,p),claims)),'not_found');
 assert.deepEqual(await state(project),saved,'Foreign native authority cannot change the project retention policy');
 const roster=await app.json('/api/organization'),member=roster.members.find(row=>row.id===invited.id);
 await app.json('/api/organization/members/'+member.id,'DELETE',{version:member.version});
 const worker=await app.mcp('tools/call',{name:'spool.workers.retention',arguments:{id:project,item:'injected',idempotency_key:randomUUID()}},{},'2025-11-25',400);
 assert.equal(worker.error?.data?.code,'tool_not_found','Configuration classification does not expose standing worker admission through MCP');
 console.log('PROBE SURFACE-003 authority: foreign-project maintainer MCP update -> not_found and unchanged policy; direct standing-worker MCP call remains unavailable');
}
