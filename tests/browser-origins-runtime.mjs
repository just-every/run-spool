import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import {safeFailure} from './product-diagnostics.mjs';
import {legacyOriginData} from './legacy-origin-data.mjs';
import {authBindings,signIn} from './auth.mjs';
import {archiveProjection,nativeArchive,assertLegacyUpgrade} from './archive.mjs';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,mkdir,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {migrationEvidence} from './migration-evidence.mjs';
import {canonical} from '../src/domain/privacy.ts';
import {requestedHeaders} from '../src/domain/origins.ts';
import {captureException} from '../src/domain/capture.ts';
// No browser imports or launches. Real browser CORS enforcement remains a separate gate.
const temporary=await mkdtemp(resolve(tmpdir(),'errors-origin-acceptance-'));
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(temporary,'logs')};

const port=15472,origin='http://127.0.0.1:'+port,foreign='http://127.0.0.1:15476';
const evidence={browserLaunched:false,legacyProducer:'b2eb94aaa4d9fd1ea3d8e5f71535a9751bbf54e3',checks:[],completed:false};
const check=name=>evidence.checks.push(name);
let worker,cookie='',state,redirectServer,destinationServer;
const legacySource=await readFile('tests/fixtures/archive-v1-b2eb94a.txt','utf8');
const legacyFile=resolve(temporary,'legacy-native.ts');
await writeFile(legacyFile,legacySource.replace("from './privacy'","from "+JSON.stringify(resolve('src/domain/privacy.ts'))).replace("from './artifacts'","from "+JSON.stringify(resolve('src/domain/artifacts.ts'))));
const harness=resolve(temporary,'harness.ts');
await writeFile(harness,`
import {withDevIdentity} from ${JSON.stringify(resolve('src/modules/operator-auth/dev/index.mjs'))};
import {authConfig} from ${JSON.stringify(resolve('src/auth/session.server.ts'))};
import api from ${JSON.stringify(resolve('src/domain/api.ts'))};
import {wrapRequest} from ${JSON.stringify(resolve('src/domain/audit/request.ts'))};
import {authenticationResponse} from ${JSON.stringify(resolve('src/auth/dispatch.server.ts'))};
import {portability} from ${JSON.stringify(resolve('src/domain/portability.ts'))};
import {exportArchive as legacyExport} from ${JSON.stringify(legacyFile)};
api.post('/api/test-snapshot',async c=>{const service=await portability(c.env.DB);const id=await service.exports.create();while((await service.exports.advance(id)).phase==='building'){};return c.json({id});});
api.get('/api/test-transfer-state',async c=>c.json({jobs:await c.env.DB.prepare('SELECT COUNT(*) count FROM rer_portability_jobs').first(),snapshots:await c.env.DB.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE name GLOB 'rer_portability_snap_*'").first(),journal:await c.env.DB.prepare('SELECT COUNT(*) count FROM rer_portability_journal').first()}));
api.get('/api/test-guard-count',async c=>c.json(await c.env.DB.prepare('SELECT COUNT(*) count FROM browser_origin_guards').first()));
const application={async fetch(request,env,ctx){
  if(env.TEST_LEGACY_PRODUCER==='true'){if(new URL(request.url).pathname==='/health'){await env.DB.prepare('SELECT COUNT(*) FROM projects').first();return Response.json({ok:true});}if(new URL(request.url).pathname==='/api/test-legacy-export')return Response.json(await legacyExport(env.DB));return new Response(null,{status:404});}
  const auth=await authenticationResponse(request,env);if(auth)return auth;
  if(request.headers.get('x-test-storage-failure')==='yes'){
    const db=env.DB;
    const facade={prepare(sql){if(!sql.startsWith('SELECT 1 FROM credentials'))return db.prepare(sql);return {bind(){return {first(){throw new Error('D1_ERROR: synthetic storage read unavailable')}}}}},batch:db.batch.bind(db)};
    return wrapRequest(request,{...env,DB:facade},()=>api.fetch(request,{...env,DB:facade},ctx));
  }
  if(request.headers.get('x-test-revoke-origin')==='yes'&&new URL(request.url).pathname.startsWith('/api/ingest/')){
    const db=env.DB;
    const facade={prepare(sql){const prepared=db.prepare(sql);if(sql!=='SELECT origin FROM browser_origins WHERE project=?')return prepared;return {bind(...args){const bound=prepared.bind(...args);return {async all(){const result=await bound.all();await db.prepare('DELETE FROM browser_origins WHERE project=? AND origin=?').bind(args[0],'http://127.0.0.1:15476').run();return result}}}}},batch:db.batch.bind(db)};
    return wrapRequest(request,{...env,DB:facade},()=>api.fetch(request,{...env,DB:facade},ctx));
  }
  // As in src/server.ts, every API request runs inside its audit scope.
  return wrapRequest(request,env,()=>api.fetch(request,env,ctx));
}};
export default withDevIdentity(application,{config:authConfig});
`);
await build({entryPoints:[harness],outfile:resolve(temporary,'worker.js'),bundle:true,format:'esm',platform:'browser',external:['node:*','cloudflare:*'],plugins:[migrationEvidence]});
const source=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const config={name:'errors-origin-acceptance',main:resolve(temporary,'worker.js'),compatibility_date:source.compatibility_date,compatibility_flags:source.compatibility_flags,d1_databases:source.d1_databases,vars:{...authBindings(origin)}};
const cfg=resolve(temporary,'wrangler.json');await writeFile(cfg,JSON.stringify(config));
async function sql(text){const path=resolve(temporary,'query.sql');await writeFile(path,text);const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','errors-local','--local','--config',cfg,'--persist-to',state,'--file',path,'--json'],{env,encoding:'utf8'});assert.equal(result.status,0,'test SQL command succeeds');return JSON.parse(result.stdout)}
async function start(name,migrationFiles,{legacy=false,fixtureSql}={}){config.vars={...authBindings(origin),TEST_LEGACY_PRODUCER:String(legacy)};await writeFile(cfg,JSON.stringify(config));state=resolve(temporary,name);for(const file of migrationFiles)await sql(await readFile('migrations/core/'+file,'utf8'));if(fixtureSql)await sql(fixtureSql);worker=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--config',cfg,'--persist-to',state,'--port',String(port),'--inspector-port','15471'],{env,stdio:['ignore','pipe','pipe']});worker.stdout.resume();worker.stderr.resume();for(let n=0;n<120;n++){if(worker.exitCode!==null)throw new Error('Test Worker failed readiness; private output withheld');try{if((await fetch(origin+'/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw new Error('Test Worker failed readiness; private output withheld')}
async function stop(){worker?.kill('SIGTERM');if(worker&&worker.exitCode===null)await new Promise(r=>worker.once('exit',r));worker=null;cookie=''}
async function request(path,method='GET',value,headers={}){const response=await fetch(origin+path,{method,headers:{...(path==='/api/restore'?{'X-Confirm-Restore':'yes'}:{}),Origin:origin,Connection:'close',...cookie?{Cookie:cookie}:{},...value?{'Content-Type':typeof value==='string'?'application/x-ndjson':'application/json'}:{},...headers},...value?{body:typeof value==='string'?value:JSON.stringify(value)}:{}});const bytes=await response.arrayBuffer();return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers})}
async function json(path,method,value,headers){const response=await request(path,method,value,headers);assert.ok(response.ok,'product HTTP request succeeds');if(path==='/api/archive'){const value=await archiveProjection(response);for(const rows of Object.values(value.data))rows.sort((a,b)=>canonical(a).localeCompare(canonical(b)));return value}return response.json()}
async function login(){cookie=await signIn(origin)}
const migrations=(await readdir('migrations/core')).filter(name=>name.endsWith('.sql')).sort();
const legacyMigrations=migrations.filter(name=>Number(name.split('_')[0])<=2);
const rehash=archive=>{archive.checksum=createHash('sha256').update(canonical({version:archive.version,migration:archive.migration,data:archive.data})).digest('hex');return archive};
try{
 assert.equal(requestedHeaders(' \tAuthorization, Content-Type\t '),true);for(const value of ['authorization,\u00a0content-type','authorization,content-type\n','authorization,content-type,','authorization,authorization'])assert.equal(requestedHeaders(value),false);
 const {project,event,sql:fixtureSql}=await legacyOriginData();
 await start('old-data',legacyMigrations,{legacy:true,fixtureSql});
 const auth={Authorization:'Bearer '+project.ingestKey};
 const originalV1=await json('/api/test-legacy-export');for(const rows of Object.values(originalV1.data))rows.sort((a,b)=>canonical(a).localeCompare(canonical(b)));rehash(originalV1);
 await stop();await start('old-data',migrations.filter(name=>!legacyMigrations.includes(name)));await login();
 let archive=await json('/api/archive');assertLegacyUpgrade(archive.data,originalV1.data);check('actual native v1 producer reads matching predecessor schema; every old field survives all additive migrations with legacy identities');
 assert.ok(isDeepStrictEqual(await json('/api/projects/cors/browser-origins'),[]),'private domain rows match exactly');const implicit=await json('/api/projects/cors/browser-origins','POST',{origin});assert.equal(implicit.implicit,true);assert.equal(implicit.changed,false);assert.ok(isDeepStrictEqual(await json('/api/projects/cors/browser-origins'),[]),'private domain rows match exactly');
 const denied=await request('/api/ingest/cors','POST',{...event,eventId:'denied'},{...auth,Origin:foreign});assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
 for(const invalid of ['null','https://app.example/','https://app.example:443','https://user@app.example','https://app.example/path','*.example','https://*.example',' https://app.example','https://app.example?x=1','https://app.example#x','file:///tmp/a','https://app.example,https://other.example'])assert.equal((await request('/api/projects/cors/browser-origins','POST',{origin:invalid})).status,400,invalid);
 assert.equal((await request('/api/projects/cors/browser-origins','POST',{origin:foreign,extra:'unsafe'})).status,400);
 await json('/api/projects/cors/browser-origins','POST',{origin:foreign});
 const beforeOptions=await json('/api/archive');
 const preflight=await request('/api/ingest/cors','OPTIONS',undefined,{Origin:foreign,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Content-Type, Authorization'});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),foreign);assert.equal(preflight.headers.get('access-control-allow-methods'),'POST');assert.equal(preflight.headers.get('access-control-allow-headers'),'Authorization, Content-Type');assert.equal(preflight.headers.get('access-control-allow-credentials'),null);assert.ok(preflight.headers.get('set-cookie')===null,'preflight never sets a cookie');
 for(const headers of [{'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,content-type'},{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type,extra'},{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,authorization'},{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'*'},{'Access-Control-Request-Method':'POST'}]){const response=await request('/api/ingest/cors','OPTIONS',undefined,{Origin:foreign,...headers});assert.equal(response.status,403);assert.equal(response.headers.get('access-control-allow-origin'),null)}
 assert.ok(isDeepStrictEqual((await json('/api/archive')).data,beforeOptions.data),'private domain rows match exactly');check('strict OPTIONS exact grants, no cookies/credentials or mutations');
 for(const invalid of ['null','http://127.0.0.1:15477','https://127.0.0.1:15476','https://other.example','https://app.example/path']){const response=await request('/api/ingest/cors','POST',{...event,eventId:'denied-origin'},{...auth,Origin:invalid});assert.equal(response.status,403);assert.equal(response.headers.get('access-control-allow-origin'),null)}
 const afterDenied=await json('/api/archive');assert.deepEqual({...afterDenied.data,outcomes:beforeOptions.data.outcomes},beforeOptions.data,'domain refusals only change outcomes');const sums=rows=>Object.fromEntries([...new Set(rows.map(row=>row.project+':'+row.reason))].map(key=>[key,rows.filter(row=>row.project+':'+row.reason===key).reduce((n,row)=>n+row.count,0)]));const beforeCounts=sums(beforeOptions.data.outcomes),afterCounts=sums(afterDenied.data.outcomes);for(const key of new Set([...Object.keys(beforeCounts),...Object.keys(afterCounts)]))assert.equal((afterCounts[key]??0)-(beforeCounts[key]??0),['cors:filtered','cors:filtered:allowed_domains'].includes(key)?5:0,'each domain refusal counts once overall and once for the domain filter');
 const unavailable=await request('/api/ingest/cors','POST',{...event,eventId:'storage-unavailable'},{...auth,Origin:foreign,'X-Test-Storage-Failure':'yes'});assert.equal(unavailable.status,503);assert.equal(unavailable.headers.get('access-control-allow-origin'),foreign);assert.equal((await unavailable.json()).reason,'transaction_not_confirmed');assert.ok(isDeepStrictEqual((await json('/api/archive')).data,afterDenied.data),'storage failure adds no admission effects');
 const foreignEvent={...event,eventId:'foreign-accepted'};const accepted=await request('/api/ingest/cors','POST',foreignEvent,{...auth,Origin:foreign});assert.equal(accepted.status,201);assert.equal(accepted.headers.get('access-control-allow-origin'),foreign);assert.equal(accepted.headers.get('access-control-allow-credentials'),null);
 assert.equal((await request('/api/ingest/cors','POST',foreignEvent,{...auth,Origin:foreign})).status,200);
 assert.equal((await request('/api/ingest/cors','POST',{...foreignEvent,message:'altered'},{...auth,Origin:foreign})).status,409);
 for(const [value,headers,status] of [[{...event,eventId:'cookie-only'},{Origin:foreign},401],[{...event,eventId:'bad-key'},{Authorization:'Bearer invalid',Origin:foreign},401],[{...event,eventId:'bad-body',frames:[]},{...auth,Origin:foreign},400],[{...event,eventId:'bad-release',release:'unknown'},{...auth,Origin:foreign},422]]){const response=await request('/api/ingest/cors','POST',value,headers);assert.equal(response.status,status);assert.equal(response.headers.get('access-control-allow-origin'),foreign)}
 const oversized=await request('/api/ingest/cors','POST',{...event,eventId:'oversized',message:'x'.repeat(40000)},{...auth,Origin:foreign});assert.equal(oversized.status,400);assert.equal(oversized.headers.get('access-control-allow-origin'),foreign);
 const revoked=await json('/api/projects/cors/keys','POST',{kind:'ingest'});await json('/api/projects/cors/keys/'+createHash('sha256').update(revoked.key).digest('hex'),'DELETE');const revokedResponse=await request('/api/ingest/cors','POST',{...event,eventId:'revoked'},{Authorization:'Bearer '+revoked.key,Origin:foreign});assert.equal(revokedResponse.status,401);assert.equal(revokedResponse.headers.get('access-control-allow-origin'),foreign);
 const other=await json('/api/projects','POST',{id:'other',name:'Other'});await json('/api/projects/other/releases','POST',{name:'r1',build:'b1'});
 const wrongKey=await request('/api/ingest/cors','POST',{...event,eventId:'wrong-project-key'},{Authorization:'Bearer '+other.ingestKey,Origin:foreign});assert.equal(wrongKey.status,401);assert.equal(wrongKey.headers.get('access-control-allow-origin'),foreign);
 assert.equal((await request('/api/ingest/other','POST',{...event,eventId:'other-project'},{Authorization:'Bearer '+other.ingestKey,Origin:foreign})).status,403);
 assert.equal((await request('/api/projects/cors/browser-origins','DELETE',{origin:foreign},{Origin:foreign})).status,403);
 const agent=await json('/api/projects/cors/keys','POST',{kind:'agent'});const saved=cookie;cookie='';
 assert.equal((await request('/api/projects/cors/browser-origins','GET',undefined,{Authorization:'Bearer '+agent.key})).status,403);
 assert.equal((await request('/api/projects/cors/browser-origins','POST',{origin:'https://agent.example'},{Authorization:'Bearer '+agent.key})).status,403);cookie=saved;
 assert.equal((await request('/api/projects','GET',undefined,{Origin:foreign})).headers.get('access-control-allow-origin'),null);
 const packet=await json('/api/projects/cors/issues/'+(await accepted.clone().json()).issue+'/packet');assert.ok(!JSON.stringify(packet).includes('test-spool-origin-private-canary'));assert.ok(!JSON.stringify(packet).includes(foreign));check('foreign keyed HTTP admission/error headers, retry/conflict/privacy, cookie/agent/project/private boundaries');
 const beforeRace=await json('/api/archive');const raced=await request('/api/ingest/cors','POST',{...event,eventId:'race',frames:[{...event.frames[0],function:'raceFixture'}]},{...auth,Origin:foreign,'X-Test-Revoke-Origin':'yes'});assert.equal(raced.status,403,'revoked origin is refused');assert.equal(raced.headers.get('access-control-allow-origin'),null);const afterRace=await json('/api/archive');assert.ok(isDeepStrictEqual(afterRace.data,{...beforeRace.data,browser_origins:[]}),'private domain rows match exactly');assert.equal((await json('/api/test-guard-count')).count,0);check('real D1 membership removal between lookup and batch aborts every admission effect; no residual guard');
 const postRemoval=await request('/api/ingest/cors','POST',{...event,eventId:'cached-preflight'},{...auth,Origin:foreign});assert.equal(postRemoval.status,403);assert.equal(postRemoval.headers.get('access-control-allow-origin'),null);
 const origins=Array.from({length:30},(_,i)=>'https://origin-'+i+'.example');
 const added=await Promise.all(origins.map(value=>request('/api/projects/cors/browser-origins','POST',{origin:value})));assert.ok(added.some(r=>r.status===201)&&added.some(r=>r.status===429));assert.ok(added.every(r=>[201,429].includes(r.status)));const acceptedOrigins=added.filter(r=>r.status===201).length;
 const configured=await json('/api/projects/cors/browser-origins');assert.equal(configured.length,acceptedOrigins);const beforeNoop=await json('/api/archive');assert.equal((await json('/api/projects/cors/browser-origins','POST',{origin:configured[0].origin})).changed,false);assert.equal((await json('/api/projects/cors/browser-origins','DELETE',{origin:'https://absent.example'})).changed,false);assert.ok(isDeepStrictEqual((await json('/api/archive')).data,beforeNoop.data),'private domain rows match exactly');assert.equal(beforeNoop.data.audit.filter(row=>row.project==='cors'&&row.kind==='browser_origin_added').length,acceptedOrigins+1);check('Concurrent additions reach capacity; each admitted origin has one audit row and no-op changes remain idempotent');
 const own=(await request('/api/ingest/cors','POST',{...event,eventId:'same-origin-preserved'},auth));assert.equal(own.status,201);
 const withoutOrigin=await fetch(origin+'/api/ingest/cors',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({...event,eventId:'server-preserved'})});assert.equal(withoutOrigin.status,201);check('service-origin and no-Origin keyed HTTP preservation');
 let destinationHits=0;destinationServer=createServer((req,res)=>{destinationHits++;req.resume();res.end(JSON.stringify({outcome:'accepted'}))});await new Promise(r=>destinationServer.listen(15478,'127.0.0.1',r));redirectServer=createServer((req,res)=>{req.resume();res.writeHead(307,{Location:'http://127.0.0.1:15478/refused'});res.end()});await new Promise(r=>redirectServer.listen(15477,'127.0.0.1',r));const redirect=await captureException(new Error('Synthetic redirect check'),{endpoint:'http://127.0.0.1:15477',project:'cors',ingestKey:project.ingestKey,release:'r1',build:'b1',environment:'test'},'redirect-refused');assert.equal(redirect.outcome,'unknown');assert.equal(destinationHits,0);check('real HTTP307 helper refuses follow; destination receives no request');
 await json('/api/projects/cors/browser-origins','DELETE',{origin:configured[0].origin});const alias='http://localhost:'+port;const aliasAdd=await fetch(alias+'/api/projects/cors/browser-origins',{method:'POST',headers:{Origin:alias,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({origin})});assert.equal(aliasAdd.status,403,'configured origin refuses an authenticated alternate host');
 archive=nativeArchive((await json('/api/archive')).data);archive.data.browser_origins.push({project:'cors',origin,created:Date.now()});archive.data.browser_origins.sort((a,b)=>canonical(a).localeCompare(canonical(b)));rehash(archive);assert.ok(!('browser_origin_guards' in archive.data));assert.ok(!('credentials' in archive.data));assert.ok(!JSON.stringify(archive).includes(project.ingestKey));
 await stop();await start('v1-restore',migrations);await login();await json('/api/restore','POST',originalV1);assertLegacyUpgrade((await json('/api/archive')).data,originalV1.data);check('original native v1 independently restores into current schema with legacy identities, empty origins and zero grants');
 await stop();await start('v2-restore',migrations);await login();
 const poisons=[
 a=>a.data.browser_origins[0].origin='https://user@private.example',
 a=>a.data.browser_origins[0].origin+='/',a=>a.data.browser_origins[0].project='orphan',
 a=>a.data.browser_origins[0].project=null,a=>a.data.browser_origins[0].created=-1,
 a=>a.data.browser_origins.push({...a.data.browser_origins[0]}),
 a=>a.data.browser_origins.push({...a.data.browser_origins[0],origin:'https://overflow.example'}),
 a=>a.data.audit.find(row=>row.kind==='browser_origin_added').detail='{"origin":"https://safe.example","secret":"synthetic-test-spool-archive-canary"}',
 a=>a.data.audit.find(row=>row.kind==='browser_origin_added').project=null,
 a=>a.data.browser_origin_guards=[],a=>a.version=3,a=>a.migration='wrong'
 ];
 for(const poison of poisons){const candidate=structuredClone(archive);poison(candidate);const rejected=await request('/api/restore','POST',rehash(candidate));assert.equal(rejected.status,400,'invalid restore is refused');assert.ok(isDeepStrictEqual(await json('/api/projects'),[]),'private domain rows match exactly')}
 const legacyPoison=structuredClone(originalV1);legacyPoison.data.browser_origins=[];assert.equal((await request('/api/restore','POST',rehash(legacyPoison))).status,400);
 await json('/api/restore','POST',archive);assertLegacyUpgrade((await json('/api/archive')).data,archive.data);const redundant=await json('/api/projects/cors/browser-origins','DELETE',{origin});assert.equal(redundant.changed,true);assert.equal(redundant.implicit,true);assert.equal(redundant.allowed,true);assert.ok(!(await json('/api/projects/cors/browser-origins')).some(row=>row.origin===origin));check('portable restored explicit service-origin row removed without disabling implicit transport');
 await json('/api/test-snapshot','POST',{});const staged=await json('/api/test-transfer-state');assert.ok(staged.jobs.count>0&&staged.snapshots.count>0);
 await json('/api/projects/cors/retention','POST',{cutoff:Date.now(),apply:true});const erased=await json('/api/test-transfer-state');assert.equal(erased.jobs.count,0);assert.equal(erased.snapshots.count,0);assert.ok(erased.journal.count>staged.journal.count);assert.equal((await json('/api/archive')).data.events.filter(row=>row.project==='cors').length,0);check('retention invalidates real Base stored snapshots and records erasure tombstones');
 await stop();const grants=await sql('SELECT COUNT(*) count FROM credentials; SELECT COUNT(*) count FROM browser_origin_guards;');assert.equal(grants[0].results[0].count,0);assert.equal(grants[1].results[0].count,0);check('v2 independent equivalence; poisoned/orphan/duplicate/over-cap configs and audit/guard fields reject before mutation; zero grants/guards');
 evidence.completed=true;
 console.log('Browser-origin non-browser runtime gates passed: '+evidence.checks.length+' groups. Actual two-origin Chrome capture/a11y remain blocked and unclaimed.');
}catch(error){throw new Error('Browser-origin runtime journey failed: '+JSON.stringify(safeFailure(error)));}finally{
 if(redirectServer)await new Promise(r=>redirectServer.close(r));if(destinationServer)await new Promise(r=>destinationServer.close(r));await stop();await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/browser-origins-runtime-results.json',JSON.stringify(evidence,null,2));await rm(temporary,{recursive:true,force:true});
}
