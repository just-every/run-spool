import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';import {emitRuntimeDiagnostic,observeRuntimeFetch} from './runtime-diagnostic.mjs';
import {startTestWorker} from './worker.mjs';
import {signIn,authBindings,testSetupToken,testDevKey} from './auth.mjs';
const worker=await startTestWorker(15468),origin=worker.origin;
let failure;
// Visitors without an owner session get the shared Lobby at /, using the same native first-project state as /setup.
async function assertLobby(response,claimed=false){assert.equal(response.status,200);const csp=response.headers.get('content-security-policy');assert.ok(csp.includes("default-src 'none'")&&!csp.includes('script-src'));const html=await response.text();const entry=/<a class="btn" href="([^"]+)"/.exec(html);assert.ok(entry);assert.equal(new URL(entry[1],origin).pathname,claimed?'/sign-in':'/setup');assert.ok(!html.includes('<script'));}
let restoreFetch=()=>{};
try{restoreFetch=observeRuntimeFetch();}catch{}
try {
 assert.deepEqual(await (await fetch(origin+'/setup/state')).json(),{state:'unclaimed'});
 const health=await (await fetch(origin+'/health')).json();assert.equal(health.status,'ok');assert.equal(health.ok,true);
 await assertLobby(await fetch(origin+'/',{redirect:'manual'}));
 // The public docs are built from the repository Markdown and served to everyone; unknown pages are 404.
 {const docs=await fetch(origin+'/docs');assert.equal(docs.status,200);const html=await docs.text();assert.ok(html.includes('href="/docs/install"')&&!html.includes('<script'));const page=await fetch(origin+'/docs/install');assert.equal(page.status,200);await page.body?.cancel();const missing=await fetch(origin+'/docs/missing-page');assert.equal(missing.status,404);await missing.body?.cancel();}
 for(const path of ['/app','/setup']){const response=await fetch(origin+path,{redirect:'manual'});assert.equal(response.status,303);const destination=new URL(response.headers.get('location'),origin);assert.equal(destination.pathname,'/sign-in');assert.equal(destination.searchParams.get('returnTo'),path);}
 for(const path of ['/missing','/health/extra'])assert.equal((await fetch(origin+path,{redirect:'manual'})).status,404);
 for(const path of ['/api','/api/missing','/api/projects','/api/archive'])assert.equal((await fetch(origin+path)).status,401);
 const form=await (await fetch(origin+'/sign-in')).text();assert.ok(form.includes('/auth/dev/enter?as=owner'));
 assert.equal((await fetch(origin+'/__dev/outbox')).status,404,'the outbox needs the key gate');
 assert.equal((await fetch(origin+'/__dev/personas',{redirect:'manual'})).status,404,'dev personas stay hidden before document authorization');
 let cookie=await signIn(origin);
 const headers={Cookie:cookie,Origin:origin,'Content-Type':'application/json'};
 for(const path of ['/','/app']){const pending=await fetch(origin+path,{headers,redirect:'manual'});assert.equal(pending.status,303);assert.equal(pending.headers.get('location'),'/setup');}
 for(const path of ['/missing','/projects/missing'])assert.equal((await fetch(origin+path,{headers,redirect:'manual'})).status,404);
 assert.equal((await fetch(origin+'/setup',{headers,redirect:'manual'})).status,200);
 const create=(value,authority=headers)=>fetch(origin+'/api/projects',{method:'POST',headers:authority,body:JSON.stringify(value)});
 assert.equal((await create({id:'fresh',name:'Fresh'},{Origin:origin,'Content-Type':'application/json'})).status,401);
 assert.equal((await create({id:'fresh',name:'Fresh'},{...headers,Origin:'https://remote.invalid'})).status,403);
 assert.equal((await create({id:'invalid identifier',name:'Fresh'})).status,400);
 assert.equal((await (await fetch(origin+'/api/projects',{headers})).json()).length,0);
 assert.equal((await fetch(origin+'/setup',{headers,redirect:'manual'})).status,200);
 const created=await create({id:'fresh',name:'Fresh'});assert.equal(created.status,201);const project=await created.json();
 assert.deepEqual(await (await fetch(origin+'/setup/state')).json(),{state:'claimed'});
 await assertLobby(await fetch(origin+'/'),true);
 const agentResponse=await fetch(origin+'/api/projects/fresh/keys',{method:'POST',headers,body:JSON.stringify({kind:'agent'})});assert.equal(agentResponse.status,201);const agent=await agentResponse.json();
 for(const key of [project.ingestKey,agent.key,'test-deploy-grant-not-an-owner']){
  const grant={Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+key};
  assert.ok([401,403].includes((await create({id:'not-owner',name:'Denied'},grant)).status));
  const document=await fetch(origin+'/setup',{headers:grant,redirect:'manual'});assert.equal(document.status,303);const destination=new URL(document.headers.get('location'),origin);assert.equal(destination.pathname,'/sign-in');assert.equal(destination.searchParams.get('returnTo'),'/setup');
 }
 assert.equal((await (await fetch(origin+'/api/projects',{headers})).json()).length,1);
 const complete=await fetch(origin+'/setup',{headers,redirect:'manual'});assert.equal(complete.status,303);assert.equal(complete.headers.get('location'),'/');
 {const owner=await fetch(origin,{headers});assert.equal(owner.status,200);assert.ok((await owner.text()).includes('<script'),'owners keep the workbench at /');}
 assert.equal((await fetch(origin+'/missing',{headers})).status,404);
 assert.equal((await fetch(origin+'/auth/bootstrap',{method:'POST',headers,body:JSON.stringify({token:testSetupToken,displayName:'Second owner'}),redirect:'manual'})).status,409);
 assert.equal((await fetch(origin+'/api/projects',{headers:{Cookie:'errors_session=old-password-session'}})).status,401);
 const session=await (await fetch(origin+'/auth/session',{headers})).json();
 const revoked=await fetch(origin+'/auth/session/revoke',{method:'POST',headers,body:JSON.stringify({sessionId:session.id})});assert.equal(revoked.status,204);
 assert.equal((await create({id:'revoked',name:'Revoked'})).status,401);
 const denied=new URL((await fetch(origin+'/setup',{headers,redirect:'manual'})).headers.get('location'),origin);assert.equal(denied.pathname,'/sign-in');assert.equal(denied.searchParams.get('returnTo'),'/setup');
 assert.equal((await fetch(origin+'/api/projects',{headers})).status,401);await assertLobby(await fetch(origin,{headers,redirect:'manual'}),true);
 console.log('Spool runtime: DB health, server document gate, direct API gate, local owner admission, second-claim refusal and immediate revocation passed.');
}catch(error){failure=error;throw new Error('Owner runtime journey failed; private runtime details withheld');}finally{
 try{restoreFetch();}catch{}
 let beforeStop,afterStop;
 if(failure)try{beforeStop=worker.diagnostic();}catch{}
 try{await worker.stop();}finally{
  if(failure){try{afterStop=worker.diagnostic();}catch{}try{emitRuntimeDiagnostic(failure,beforeStop,afterStop);}catch{}}
 }
}
