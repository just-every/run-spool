import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {admissionRuntime} from './admission-runtime.mjs';
import {signIn} from './auth.mjs';
import {confirmLatest} from './owner-erasure/helpers.mjs';
import {ownerSetupBrowser} from './owner-setup-browser.mjs';

// Extends TEAM-001's existing owner journey; native sessions and real HTTP doors.
export async function ownerSetupFlow() {
 const app=await admissionRuntime({}, {hostedMail:true});let archive,originalRoles;
 try {
  const cookie=await signIn(app.origin,{emailLink:true});
  const req=(path,method='GET',value,actor=cookie,headers={})=>app.call(path,value,{Cookie:actor,...headers},method);
  const json=async(path,method='GET',value,actor=cookie)=>{const r=await req(path,method,value,actor);assert.ok(r.ok,path+' HTTP '+r.status);return r.json()};
  const denied=async response=>{const r=await response;assert.ok([401,403,404].includes(r.status),'private authority is refused');await r.arrayBuffer();};
  await json('/api/organization','POST',{id:'synthetic-spool-setup',name:'Cedar Operations'});
  const project=await json('/api/projects','POST',{id:'synthetic-spool-setup',name:'Cedar checkout'}),foreign=await json('/api/projects','POST',{id:'synthetic-spool-foreign',name:'Cedar back office'}),root='/api/projects/'+project.id;
  await json('/api/organization/projects/'+project.id,'PUT',{team:'Platform'});await json('/api/organization/projects/'+foreign.id,'PUT',{team:'Back office'});
  await json('/api/organization/invites','POST',{email:'synthetic-spool-outsider@example.test',name:'Other team member',role:'member',grants:[{project:foreign.id,role:'member'}]});
  const grant=await ownerSetupBrowser(app,cookie,project,json);
  let org=await json('/api/organization');const sourceOwner=org.members.find(row=>row.name==='Imported owner'),manager=org.members.find(row=>row.name==='Imported manager');
  assert.equal(sourceOwner.role,'admin');assert.equal(manager.role,'member');assert.ok([sourceOwner,manager].every(row=>row.operatorStatus==='invited'),'imports never bypass native invitation acceptance');
  const ownerCookie=await confirmLatest(app,sourceOwner.email),managerCookie=await confirmLatest(app,manager.email);
  assert.equal((await json('/auth/session','GET',undefined,ownerCookie)).operator.role,'member','an imported owner is not installation owner');
  assert.equal((await json('/api/organization/me','GET',undefined,managerCookie)).role,'member');
  await json('/api/organization','GET',undefined,ownerCookie);await denied(req('/api/organization','GET',undefined,managerCookie));
  assert.deepEqual((await json('/api/projects','GET',undefined,managerCookie)).map(row=>[row.id,row.role]),[[project.id,'maintainer']]);
  await denied(req('/api/projects/'+foreign.id+'/issues','GET',undefined,managerCookie));
  await denied(req('/api/editor/config','GET',undefined,ownerCookie));
  await denied(req('/api/organization/invites','POST',{email:'synthetic-spool-escalation@example.test',name:'Unapproved import',role:'owner',grants:[]},ownerCookie));
  await denied(req('/api/organization','GET',undefined,''));
  const roles=[['member','member'],['read-only','read-only'],['billing',null]];
  for(const [role,projectRole] of roles){
   const email='synthetic-spool-'+role+'@example.test';await json('/api/organization/invites','POST',{email,name:role,role,grants:projectRole?[{project:project.id,role:projectRole}]:[]});const actor=await confirmLatest(app,email);
   await denied(req(root+'/keys','POST',{kind:'ingest'},actor));await denied(req(root+'/keys/'+grant.hash,'DELETE',undefined,actor));await denied(req(root+'/alerting/recipients','GET',undefined,actor));await denied(req('/api/organization','GET',undefined,actor));
  }
  await denied(req(root+'/keys','POST',{kind:'ingest'},''));
  const event={version:1,eventId:'synthetic-spool-revoked',release:'spool-setup',build:'browser-test',environment:'spool-test',type:'SyntheticSpoolError',message:'Synthetic key lifecycle',frames:[{file:'synthetic.js',line:1,column:0,function:'capture'}]};
  const ingest=key=>req('/api/ingest/'+project.id,'POST',event,'',{Authorization:'Bearer '+key});
  await json(root+'/keys/'+grant.hash,'DELETE');await denied(ingest(grant.key));
  const replacement=await json(root+'/keys','POST',{kind:'ingest'});assert.equal((await ingest(replacement.key)).status,201);await denied(ingest(grant.key));
  const response=await req('/api/archive');assert.equal(response.status,200);archive=await response.text();assert.ok(!archive.includes(grant.key)&&!archive.includes(replacement.key));
  originalRoles=Object.fromEntries((await json('/api/organization')).members.filter(row=>[sourceOwner.id,manager.id].includes(row.id)).map(row=>[row.id,row.role]));
  console.log('Owner setup: team roster and pending role mapping; exact project authority; denied contacts and ingest issuance/revocation; copied key and received native synthetic event; revoked key remains refused.');
 }finally{await app.close();}
 const restored=await admissionRuntime();
 try{
  const cookie=await signIn(restored.origin),response=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:cookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:archive});assert.equal(response.status,200);await response.arrayBuffer();
  const org=await (await restored.call('/api/organization',undefined,{Cookie:cookie})).json();
  for(const [id,role] of Object.entries(originalRoles)){const member=org.members.find(row=>row.id===id);assert.equal(member.role,role);assert.equal(member.state,'inert');assert.equal(member.operator_id,null);}
  assert.equal((await (await restored.call('/api/projects/synthetic-spool-setup/keys',undefined,{Cookie:cookie})).json()).length,0);
  console.log('Owner setup: archive restore preserves distinct native mapped roles and grants without creating identities, sessions or credentials.');
 }finally{await restored.close();}
}
if(process.argv[1]===fileURLToPath(import.meta.url))await ownerSetupFlow();
