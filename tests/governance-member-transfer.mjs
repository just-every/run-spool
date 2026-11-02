import assert from 'node:assert/strict';
import {admissionRuntime} from './admission-runtime.mjs';
import {confirmEmailLink,emailSignIn,testOwner,testSetupToken} from './auth.mjs';
import {legacyMailRows} from './legacy-mail.mjs';
import {assertAuditAppendOnly} from './audit-state.mjs';

const organization='/api/organization',transfer=organization+'/transfer';
async function snapshot(app,{confirmation=false}={}) {
 const tables=(await app.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results;
 const selected=tables.filter(({name})=>!confirmation||name!=='oa_limits');
 const rows=await app.DB.batch(selected.map(({name})=>app.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`)));
 return Object.fromEntries(selected.map(({name},index)=>[name,rows[index].results]));
}

/** Native organization handoff: fresh email proof belongs to the requesting session. */
export async function governanceMemberTransferFlow() {
 const app=await admissionRuntime({}, {hostedMail:true});
 try {
  const bootstrap=await app.call('/auth/bootstrap',{token:testSetupToken,displayName:'synthetic-spool-1'});
  assert.equal(bootstrap.status,303);
  const ownerCookie=bootstrap.headers.get('set-cookie')?.split(';')[0];assert.ok(ownerCookie);
  await bootstrap.arrayBuffer();
  const request=(path,value,cookie=ownerCookie,method)=>app.call(path,value,{Cookie:cookie},method);
  const json=async(path,value,cookie=ownerCookie,status=200,method)=>{
   const response=await request(path,value,cookie,method);assert.equal(response.status,status,path);return response.json();
  };
  const originalSession=await json('/auth/session');
  assert.equal(originalSession.kind,'native');assert.equal(originalSession.operator.role,'owner');
  await json(organization,{id:'synthetic-spool-1',name:'synthetic-spool-1'},ownerCookie,201);
  const project=await json('/api/projects',{id:'synthetic-spool-1',name:'synthetic-spool-1'},ownerCookie,201);
  const root='/api/projects/'+project.id;
  await json(root+'/releases',{name:'synthetic-spool-1',build:'web'},ownerCookie,201);
  for(const kind of ['agent','deploy'])await json(root+'/keys',{kind},ownerCookie,201);
  const captured=await app.call('/api/ingest/'+project.id,{version:1,eventId:'synthetic-spool-1',release:'synthetic-spool-1',build:'web',environment:'test',type:'SyntheticSpoolError',message:'synthetic-spool-1',frames:[{file:'https://synthetic-spool.example/app.js',function:'capture',line:1,column:0}],breadcrumbs:[]},{Authorization:'Bearer '+project.ingestKey});
  assert.equal(captured.status,201);await captured.arrayBuffer();
  assert.equal((await json(root+'/issues')).length,1,'the protected installation contains real captured evidence');
  const successorEmail=['synthetic-spool-2','example.test'].join('@');
  const previousIds=(await legacyMailRows(app.origin)).map(row=>row.id);
  await json(organization+'/invites',{email:successorEmail,name:'synthetic-spool-2',role:'admin',grants:[]},ownerCookie,202);
  let successor=(await json(organization)).members.find(row=>row.email===successorEmail);
  assert.equal(successor.operatorStatus,'invited');
  const successorCookie=await confirmEmailLink(app.origin,successorEmail,{previousIds});
  successor=(await json(organization)).members.find(row=>row.id===successor.id);
  assert.equal(successor.operatorStatus,'active');
  const successorSession=await json('/auth/session',undefined,successorCookie);
  assert.equal(successorSession.kind,'native');assert.equal(successorSession.operator.role,'member');
  const pendingEmail=['synthetic-spool-3','example.test'].join('@');
  await json(organization+'/invites',{email:pendingEmail,name:'synthetic-spool-3',role:'admin',grants:[]},ownerCookie,202);
  const pending=(await json(organization)).members.find(row=>row.email===pendingEmail);
  assert.equal(pending.operatorStatus,'invited');
  const input={member:successor.id,version:successor.version};
  async function refused(path,value,cookie,status,error,{confirmation=false}={}) {
   const before=await snapshot(app,{confirmation}),response=await request(path,value,cookie);
   assert.equal(response.status,status,path);assert.equal((await response.json()).error,error);
   assert.equal(response.headers.get('set-cookie'),null,'a refusal issues no replacement session');
   assertAuditAppendOnly(await snapshot(app,{confirmation}),before,'refusal preserves ownership, membership, credentials and product rows');
  }
  await refused(transfer,input,ownerCookie,403,'step_up_required');
  console.log('PROBE GOV-001 missing proof: native bootstrap session POST organization transfer -> 403 step_up_required; protected rows unchanged');

  // A second real owner session must not consume the first session's challenge.
  const otherCookie=await emailSignIn(app.origin,testOwner);
  assert.notEqual((await json('/auth/session',undefined,otherCookie)).id,originalSession.id);
  const beforeMail=(await legacyMailRows(app.origin)).map(row=>row.id);
  const returnTo='/projects/'+project.id+'/settings';
  const challenge=await request('/auth/step-up',{action:'owner:transfer',returnTo});
  assert.equal(challenge.status,202);assert.equal(challenge.headers.get('set-cookie'),null);await challenge.arrayBuffer();
  const message=(await legacyMailRows(app.origin)).filter(row=>!beforeMail.includes(row.id)).map(row=>JSON.parse(row.message)).find(row=>row.to.includes(testOwner));
  assert.ok(message,'native step-up mail is addressed to the current owner');
  const token=message.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);
  const previewBefore=await snapshot(app),preview=await request('/auth/confirm?token='+token);
  assert.equal(preview.status,200);assert.equal(preview.headers.get('set-cookie'),null);await preview.arrayBuffer();
  assertAuditAppendOnly(await snapshot(app),previewBefore,'link preview does not consume the proof');
  await refused('/auth/confirm',{token},otherCookie,400,'invalid_or_expired',{confirmation:true});
  await refused(transfer,input,ownerCookie,403,'step_up_required');
  console.log('PROBE GOV-001 session binding: another native owner session POST confirmation -> 400 invalid_or_expired; requesting session still cannot transfer');

  const confirmed=await request('/auth/confirm',{token});
  assert.equal(confirmed.status,303);assert.equal(confirmed.headers.get('location'),returnTo);
  assert.equal(confirmed.headers.get('set-cookie'),null,'step-up confirms the SAME session without issuing a replacement cookie');
  await confirmed.arrayBuffer();
  assert.equal((await json('/auth/session')).id,originalSession.id);
  await refused('/auth/confirm',{token},ownerCookie,400,'invalid_or_expired',{confirmation:true});
  await refused(transfer,{member:pending.id,version:pending.version},ownerCookie,409,'Verified member required');
  await json(organization+'/members/'+successor.id,{version:successor.version,role:'admin',grants:[]},ownerCookie,200,'PUT');
  await refused(transfer,input,ownerCookie,409,'Verified member required');
  successor=(await json(organization)).members.find(row=>row.id===successor.id);
  assert.equal(successor.version,input.version+1);
  console.log('PROBE GOV-001 successor controls: confirmed session rejects replay, unverified successor and stale membership version; protected rows unchanged');

  const beforeTransfer=await snapshot(app),handed=await request(transfer,{member:successor.id,version:successor.version});
  assert.equal(handed.status,200);assert.deepEqual(await handed.json(),{transferred:true,signInRequired:true});
  assert.equal(handed.headers.get('set-cookie'),null);
  const afterTransfer=await snapshot(app);
  const owners=afterTransfer.oa_operators.filter(row=>row.role==='owner'&&row.status==='active');
  assert.equal(owners.length,1);assert.equal(owners[0].id,successorSession.operator.id);
  assert.equal(afterTransfer.oa_operators.find(row=>row.id===originalSession.operator.id).role,'member');
  const expectedOperators=beforeTransfer.oa_operators.map(row=>row.id===originalSession.operator.id?{...row,role:'member',version:row.version+1}:row.id===successorSession.operator.id?{...row,role:'owner',version:row.version+1}:row);
  assert.deepEqual(afterTransfer.oa_operators,expectedOperators,'only the two current identities exchange authority and advance their session fences');
  assert.deepEqual(afterTransfer.spool_members,beforeTransfer.spool_members.map(row=>row.operator_id===originalSession.operator.id?{...row,role:'admin',version:row.version+1}:row),'handoff preserves every other membership');
  assert.deepEqual(afterTransfer.credentials,beforeTransfer.credentials.map(row=>({...row,minted_version:row.minted_version+1})),'handoff carries the exact valid credentials without changing any key or revocation state');
  const oldFacts=beforeTransfer.spool_audit_events.length,newFacts=afterTransfer.spool_audit_events.slice(oldFacts);
  assert.deepEqual(afterTransfer.spool_audit_events.slice(0,oldFacts),beforeTransfer.spool_audit_events,'prior audit facts remain immutable');
  assert.deepEqual(newFacts.map(row=>row.source).sort(),['request','transaction'],'one committed handoff has one transaction fact and one HTTP observation');
  for(const row of newFacts){assert.equal(row.action,'member.transfer');assert.equal(row.outcome,'succeeded');}
  const carried={...afterTransfer,oa_operators:beforeTransfer.oa_operators,spool_members:beforeTransfer.spool_members,credentials:beforeTransfer.credentials,spool_audit_events:beforeTransfer.spool_audit_events};
  assertAuditAppendOnly(carried,beforeTransfer,'handoff preserves all product evidence and existing sessions');
  for(const cookie of [ownerCookie,otherCookie,successorCookie]) {
   for(const path of ['/auth/session','/api/projects']) {
    const fenced=await request(path,undefined,cookie);assert.equal(fenced.status,401,'handoff fences predecessor and successor sessions');await fenced.arrayBuffer();
   }
  }
  await refused(transfer,{member:successor.id,version:successor.version},ownerCookie,401,'Sign in required');
  const nextCookie=await emailSignIn(app.origin,successorEmail),next=await json('/auth/session',undefined,nextCookie);
  assert.equal(next.operator.role,'owner');assert.equal(next.operator.id,successorSession.operator.id);
  const current=await json(organization,undefined,nextCookie);
  assert.equal(current.members.filter(row=>row.role==='owner').length,1);
  assert.equal(current.members.find(row=>row.id===successor.id).role,'owner');
  const audit=await json('/api/audit/export?format=json',undefined,nextCookie);
  assert.equal(audit.rows.filter(row=>row.action==='member.transfer'&&row.source==='transaction'&&row.outcome==='succeeded').length,1,'exactly one handoff commits');
  for(const privateValue of [testOwner,successorEmail,pendingEmail,ownerCookie,successorCookie,project.ingestKey])assert.ok(!JSON.stringify(audit).includes(privateValue),'audit exposes no private identity or credential');
  console.log('PROBE GOV-001 allowed transfer: same confirmed native session POST current verified successor -> exactly one transfer; no replacement cookie; both old identities fenced; fresh successor sign-in is owner');
 } finally {await app.close();}
}
