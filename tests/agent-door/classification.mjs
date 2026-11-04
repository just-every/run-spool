import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

// Read each result back through native HTTP. The policy is chosen independently
// of the metadata that generates the public guide.
export async function classificationContract(app){
 const code=answer=>answer?._meta?.['com.runeditrun/error']?.code;
 const decision=answer=>answer._meta['com.runeditrun/decision'].classes.map(({class:kind,facts})=>({class:kind,facts}));
 const standard=[{class:'standard',facts:{measure:1}}];
 for(const [policyName,policy] of [['autonomous',autonomousPolicy()],['held',heldPolicy()]]){
  await app.adopt(policy);
  const project=`synthetic-spool-319-${policyName}`,created=await app.json('/api/projects','POST',{id:project,name:project});
  const invoke=async(name,args,expected,read)=>{
   const input={...args,idempotency_key:randomUUID()},flags={classes:['security'],approved:true,item_count:0};
   const before=await read();
   if(name==='spool.credentials.update'){
    const refused=await app.call(name,{...input,...flags});
    assert.equal(code(refused),'invalid_arguments','The closed revoke-only schema refuses injected fields before classification');
    assert.deepEqual(await read(),before,'An injected revocation leaves the real credential unchanged');
   }else Object.assign(input,flags);
   const answer=await app.call(name,input);
   assert.ok(answer._meta?.['com.runeditrun/decision'],`${policyName}: ${name} has a native decision: ${code(answer)}`);
   assert.deepEqual(decision(answer),expected,`${policyName}: ${name} computes native facts despite injected flags`);
   if(policyName==='held'&&expected.some(row=>row.class!=='standard')){
    assert.equal(code(answer),'approval_required',`${name} must wait under the held policy`);
    assert.deepEqual(await read(),before,`${name} waiting changes no native state`);
    const reference=answer._meta['com.runeditrun/error'].approval;
    const {approval}=await app.json('/agents/api/approvals/'+reference.id);
    assert.deepEqual(approval.classes,expected,`${name} person sees the computed evidence`);
    const execution=await app.json('/agents/api/approvals/'+reference.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
    assert.equal(execution.approval.state,'executed',`${name} executes only after the actual person step`);
   }else assert.ok(!answer.isError,`${name}: ${code(answer)}`);
   const saved=await read(),replay=await app.call(name,input);
   assert.ok(!replay.isError,`${name} replay returns its completed result`);
   assert.deepEqual(decision(replay),expected,`${name} replay retains its computed facts`);
   assert.deepEqual(await read(),saved,`${name} retry has no second effect`);
   return replay.structuredContent;
  };
  await app.json(`/api/projects/${project}/releases`,'POST',{name:'synthetic-spool-319',build:'synthetic-spool-319'});
  const admitted=await app.json('/api/ingest/'+project,'POST',{version:1,eventId:'synthetic-spool-319',release:'synthetic-spool-319',build:'synthetic-spool-319',environment:'test',type:'TypeError',message:'Synthetic classification failure',frames:[{file:'https://synthetic.invalid/cart.js',line:1,column:0,function:'checkout'}],breadcrumbs:[]},{Authorization:'Bearer '+created.ingestKey});
  const issue=admitted.issue,issueState=async()=>(await app.json(`/api/projects/${project}/issues`)).find(row=>row.id===issue);
  const live=[{class:'live',facts:{measure:1,service:project}}];
  for(const [state,expected] of [['acknowledged',standard],['suppressed',live],['open',live]]){
   await invoke('spool.issues.update',{project,issue,state,revision:(await issueState()).revision},expected,issueState);
   assert.equal((await issueState()).state,state);
  }
  const recipient=['synthetic-spool-319-'+policyName,'synthetic.invalid'].join('@');
  const destination=await app.json(`/api/projects/${project}/alerting/destinations`,'POST',{label:'Synthetic classification recipient',recipient});
  const mailState=()=>app.json(`/api/projects/${project}/alerting/deliveries`);
  const tested=await invoke('spool.alerts.test',{project,id:destination.id},[{class:'external',facts:{measure:1,counterparty:'known',provider:'email',step:'destination test'}}],mailState);
  assert.ok((await app.mail()).some(message=>message.to?.includes(recipient)&&message.subject==='Spool TEST — destination check'),'Supported destination test reaches the controlled mail edge');
  await app.json(`/api/projects/${project}/alerting/destinations/${destination.id}/review`,'POST',{testId:tested.id});
  const added=await app.json(`/api/projects/${project}/alerting/rules`,'POST',{name:'Synthetic class rule',enabled:false,channel:'mail',destination:destination.id,kinds:['new_issue'],windowMs:60000,threshold:2});
  const alertState=async()=>(await app.json(`/api/projects/${project}/alerting/rules`)).find(row=>row.id===added.id);
  for(const [enabled,expected] of [[false,standard],[true,live],[false,live]]){
   const current=await alertState(),args={project,id:current.id,name:current.name,enabled,channel:'mail',destination:destination.id,kinds:['new_issue'],windowMs:60000,threshold:2,revision:current.revision};
   if(enabled){const preview=await app.call('spool.alerts.preview',{...args,idempotency_key:randomUUID()});assert.ok(!preview.isError);args.previewToken=preview.structuredContent.token;}
   await invoke('spool.alerts.update',args,expected,alertState);
   assert.equal(Boolean((await alertState()).enabled),enabled);
  }
  const followupState=async()=>(await app.json(`/api/projects/${project}/follow-up`)).alternate;
  for(const [value,expected] of [[null,standard],[destination.id,live],[null,live]]){
   await invoke('spool.followups.update',{project,destination:value,channel:'mail'},expected,followupState);
   assert.equal((await followupState()).destination,value);
  }
  const retentionState=async()=>{const {revision,windows}=await app.json(`/api/projects/${project}/retention-policy`);return {revision,windows};};
  for(const [days,expected] of [[90,standard],[90,standard],[30,[{class:'destructive',facts:{measure:0}}]]]){
   // Only session windows shorten: the project has a real captured occurrence,
   // while its affected session inventory is independently known to be empty.
   const windows={...(await retentionState()).windows,sessions:days};
   const preview=await app.json(`/api/projects/${project}/retention-policy/preview`,'POST',{windows});
   await invoke('spool.retention.update',{project,...preview},expected,retentionState);
   assert.equal((await retentionState()).windows.sessions,days);
  }
  const memberAddress=['synthetic-spool-319-member-'+policyName,'synthetic.invalid'].join('@');
  const invited=await app.json('/api/organization/invites','POST',{email:memberAddress,name:'Synthetic class member',role:'member',grants:[{project,role:'member'}]});
  const invitation=(await app.mail()).findLast(message=>message.to?.includes(memberAddress));
  const token=invitation?.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);
  const accepted=await app.request('/auth/confirm','POST',{token},{Cookie:''});assert.equal(accepted.status,303);await accepted.body?.cancel();
  const memberState=async()=>(await app.json('/api/organization')).members.find(row=>row.id===invited.id);
  for(const [role,direction] of [['read-only','narrows'],['member','widens']]){
   const current=await memberState();
   await invoke('spool.access.update',{id:current.id,version:current.version,role,grants:[{project,role}]},[{class:'access',facts:{measure:1,direction}}],memberState);
   assert.equal((await memberState()).role,role);
  }
  const key=await app.json(`/api/projects/${project}/keys`,'POST',{kind:'agent'});
  const credentialState=()=>app.json(`/api/projects/${project}/keys`);
  await invoke('spool.credentials.update',{id:key.id??key.hash},[{class:'access',facts:{measure:1,direction:'narrows'}},{class:'security',facts:{measure:1,setting:'project credential revocation'}}],credentialState);
  const retired=await app.request(`/api/projects/${project}/issues`,'GET',undefined,{Cookie:'',Authorization:'Bearer '+key.key});
  assert.equal(retired.status,401,'The supported revocation retires the actual credential');await retired.body?.cancel();
  console.log(`PROBE BASE-AGENT-013 computed classes (${policyName}): native MCP triage, alert, follow-up, retention, member grants, destination test and revocation -> documented classes; person-held calls inert until approval; retries unchanged`);
 }
 await app.adopt(autonomousPolicy());
}
