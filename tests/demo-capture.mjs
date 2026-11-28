import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';

// One flow through the real demo hook, native ingest and owner HTTP doors.
const {publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const app=await startTestWorker(15561,{
 RER_DEMO:'1',RER_OWNER_CLAIM_ISSUER:'http://127.0.0.1:15561',RER_OWNER_CLAIM_INSTALLATION_ID:crypto.randomUUID(),
 // Worker Loader binds the visitor's origin as AUTH_ORIGIN.
 RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify({demo:publicKey.export({format:'jwk'})}),
});
try {
 const cookie=await signIn(app.origin);
 const request=(path,method='GET',input)=>fetch(app.origin+path,{method,headers:{Cookie:cookie,Origin:app.origin,'Content-Type':'application/json'},body:JSON.stringify(input)});
 const json=async(path,method,input)=>{
  const response=await request(path,method,input);
  assert.ok(response.ok,`${method??'GET'} ${path.split('/').at(-1)} returned ${response.status}`);
  return response.json();
 };
 const response=await request('/app');
 assert.equal(response.status,200,'the signed-in demo app loads');
 await response.body?.cancel();
 let db=await app.db();
 const recent=()=>db.prepare("SELECT id,historical FROM events WHERE id LIKE 'cedar-live-%' ORDER BY id").all();
 assert.deepEqual((await recent()).results,[0,1,2].map(i=>({id:`cedar-live-${i}`,historical:0})), 'all three samples pass native admission');
 const facts=async()=>{
  const response=await request('/api/audit/export?format=json');assert.equal(response.status,200);
  return (await response.json()).rows.filter(row=>row.action==='capture.native');
 };
 const rows=await facts(),committed=rows.filter(row=>row.source==='transaction');
 assert.equal(committed.length,3,'each admitted sample commits its audit fact');
 assert.ok(rows.every(row=>row.actor_kind==='ingest'),'demo samples retain credential attribution');
 assert.equal(new Set(rows.map(row=>row.actor_label)).size,1,'all samples name the same demo ingest actor');
 assert.ok(rows.every(row=>row.project_label===committed[0].project_label&&row.project_label),'all facts name the demo project');
 assert.deepEqual(rows.filter(row=>row.source==='request').map(row=>row.status),[201,201,201]);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM credentials WHERE kind='ingest'").first()).n,0,'temporary grant is removed');
 const issues='/api/projects/cedar-market/issues';
 const [issue]=await json(issues);
 const issuePath=`${issues}/${issue.id}`,commentBody='Reproduced in the sample workspace';
 const comment=await json(`${issuePath}/comments`,'POST',{body:commentBody,revision:issue.revision});
 const [owner]=await json('/api/projects/cedar-market/assignment-members').then(value=>value.members);
 await json(`${issuePath}/assignment`,'PATCH',{member:owner.id,revision:comment.revision});
 await app.restart();db=await app.db();
 const repeated=await request('/app');assert.equal(repeated.status,200);await repeated.body?.cancel();
 assert.equal((await recent()).results.length,3);
 assert.equal((await facts()).filter(row=>row.source==='transaction').length,3,'restart never seeds duplicate captures');
 const discussion=await json(`${issuePath}/discussion`);
 assert.ok(discussion.comments.some(row=>row.id===comment.id&&row.body===commentBody),'comment persists after restart');
 const saved=await json('/api/projects/cedar-market/operator-state');
 assert.equal(saved.assignments.find(row=>row.issue===issue.id)?.member,owner.id,'assignment persists after restart');
 console.log('Demo capture: 3 attributed events; comment and assignment survive restart without reseeding');
} finally {await app.stop();}
