import assert from 'node:assert/strict';
import {startTestWorker} from '/workspace/run-spool/tests/worker.mjs';
import {signIn} from '/workspace/run-spool/tests/auth.mjs';
import {teamTriage} from '/workspace/run-spool/tests/team-browser.mjs';
const app=await startTestWorker(15496);
try{
const origin=app.origin,cookie=await signIn(origin),client=cookie=>({origin,cookie,req:(path,method='GET',value)=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...value?{'Content-Type':'application/json'}:{}},...value?{body:JSON.stringify(value)}:{}}),async json(...args){const r=await this.req(...args);assert.ok(r.ok,args[0]+' '+r.status);return r.json()}}),owner=client(cookie);
await owner.json('/api/organization','POST',{id:'synthetic-spool-team',name:'Synthetic team'});const project=await owner.json('/api/projects','POST',{id:'synthetic-spool-member',name:'Synthetic member project'});
await owner.json('/api/organization/invites','POST',{email:'synthetic-spool-member@example.test',name:'Synthetic responder',role:'member',grants:[{project:project.id,role:'maintainer'}]});const organization=await owner.json('/api/organization'),invite=organization.invites.find(row=>row.localLink);assert.ok(invite);const confirmed=await fetch(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:new URL(invite.localLink).searchParams.get('token')})});assert.equal(confirmed.status,303);const member=client(confirmed.headers.get('set-cookie').split(';')[0]);member.member=(await owner.json('/api/organization')).members.find(row=>row.name==='Synthetic responder');await teamTriage(owner,member,project,1440);
}finally{await app.stop()}
