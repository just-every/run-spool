import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {authBindings,signIn,testDevKey,testOwner} from './auth.mjs';

export async function devCredentials() {

// Local ingest/deploy grants work with their scoped key alone; dev agent reads need the owner gate. This runs the real
// local entry (src/server.dev.ts) and the real deployed entry (src/server.ts) over one real migrated D1; only the
// document renderers are replaced (the Start entry and the build-time docs module behind the landing and /docs),
// because neither the API nor the gate reaches them.
const require=createRequire(import.meta.url);
const {Miniflare,convertV4MiniflareOptions}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
const {unstable_splitSqlQuery}=require('wrangler');
const esbuild=require('esbuild');
const documentStub={name:'document-stub',setup(build){
 build.onResolve({filter:/^@tanstack\/react-start\/server-entry$/},()=>({path:'document',namespace:'stub'}));
 build.onResolve({filter:/^virtual:spool-docs$/},()=>({path:'docs',namespace:'stub'}));
 build.onLoad({filter:/^docs$/,namespace:'stub'},()=>({loader:'js',contents:"export const repository='';export default {repository:'',sections:[],pages:[]}"}));
 build.onLoad({filter:/^document$/,namespace:'stub'},()=>({loader:'js',contents:"export default {fetch:async()=>new Response('<!doctype html><title>Spool</title><body>document</body>',{headers:{'content-type':'text/html'}})}"}));
}};
const bundle=async entry=>(await esbuild.build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',conditions:['workerd','worker','browser'],mainFields:['module','main'],external:['cloudflare:*','node:*'],plugins:[documentStub],loader:{'.sql':'text'},logLevel:'error'})).outputFiles[0].text;

// The linked Auth install's published key, the only network edge: a loopback JWKS.
const {publicKey,privateKey}=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const {kty,crv,x,y}=await crypto.subtle.exportKey('jwk',publicKey),authKey={kty,crv,x,y,kid:'auth-key-1',alg:'ES256',use:'sig'};
const jwks=createServer((request,response)=>{response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({keys:[authKey]}));});
await new Promise(ready=>jwks.listen(0,'127.0.0.1',ready));
const issuer=`http://127.0.0.1:${jwks.address().port}`;
const part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const signed=async(header,claims)=>{const input=part(header)+'.'+part(claims);return input+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,new TextEncoder().encode(input))).toString('base64url');};

const port=15471,origin=`http://127.0.0.1:${port}`,directory=await mkdtemp(resolve(tmpdir(),'spool-dev-credentials-'));
const worker=(name,script)=>({name,modules:true,script,compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'spool-dev-credentials'},bindings:{...authBindings(origin),IDENTITY_PROVIDER:issuer}});
const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port,defaultPersistRoot:directory,workers:[worker('local',await bundle('src/server.dev.ts')),worker('deployed',await bundle('src/server.ts'))]}));
try{
 await mf.ready;
 const db=await mf.getD1Database('DB','local');
 for(const file of (await readdir('migrations/core')).filter(f=>f.endsWith('.sql')).sort()){
  const queries=unstable_splitSqlQuery(await readFile(resolve('migrations/core',file),'utf8')).filter(sql=>!/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(sql.trim()));
  await db.batch(queries.map(sql=>db.prepare(sql)));
 }
 const deployed=await mf.getWorker('deployed');
 // key: the header the rer harness sends; without it a request looks as one through a forwarding proxy does.
 const call=(target,path,{method='GET',cookie,body,key=false,bearer}={})=>target(origin+path,{method,redirect:'manual',headers:{Origin:origin,...body?{'Content-Type':'application/json'}:{},...cookie?{Cookie:cookie}:{},...bearer?{Authorization:'Bearer '+bearer}:{},...key?{'x-rer-dev-key':testDevKey}:{}},...body?{body:JSON.stringify(body)}:{}});
 const local=(path,options)=>call(fetch,path,options),remote=(path,options)=>call((url,init)=>deployed.fetch(url,init),path,options);
 const status=async response=>{await response.body?.cancel();return response.status};
 const event=id=>({version:1,eventId:id,release:'r1',build:'b1',environment:'production',type:'TypeError',message:'failed',frames:[{file:'https://app.test/bundle.js',line:1,column:0,function:'run',debugId:'d1'}],breadcrumbs:[]});

 // An ordinary session: the first owner and every credential it mints work with no key at all.
 const ordinary=await signIn(origin);
 assert.equal(await status(await local('/api/projects',{method:'POST',cookie:ordinary,body:{id:'web',name:'Web'}})),201);
 assert.equal(await status(await local('/api/projects/web/releases',{method:'POST',cookie:ordinary,body:{name:'r1',build:'b1'}})),201);
 const minted=async(cookie,kind,key,project='web')=>(await (await local(`/api/projects/${project}/keys`,{method:'POST',cookie,body:{kind},key})).json()).key;
 const ordinaryAgent=await minted(ordinary,'agent');
 for(const target of [local,remote])assert.equal(await status(await target('/api/projects/web/issues',{bearer:ordinaryAgent})),200,'an ordinary agent key is unchanged');

 // A dev session needs the key on every request; the deployed entry never admits it.
 const entered=await local('/auth/dev/enter?as=owner',{key:true});assert.equal(entered.status,303);await entered.body?.cancel();
 // The browser also receives the port-named gate cookie (rer_dev_gate_<port>); the session cookie alone is what a request without the key carries.
 const dev=entered.headers.getSetCookie().map(line=>line.split(';')[0]).filter(pair=>!pair.startsWith('rer_dev_gate')).join('; ');
 assert.equal(await status(await local('/api/projects',{cookie:dev})),401,'a dev session without the key is refused');
 assert.equal(await status(await remote('/api/projects',{cookie:dev,key:true})),401,'the deployed entry refuses a dev session even with the key');
 const create=await local('/api/projects',{method:'POST',cookie:dev,key:true,body:{id:'minted',name:'Minted'}});assert.equal(create.status,201);
 const project=await create.json(),agent=await minted(dev,'agent',true,'minted'),deploy=await minted(dev,'deploy',true,'minted'),ingest=await minted(dev,'ingest',true,'minted');
 assert.ok(agent&&deploy&&ingest);
 assert.equal(await status(await local('/api/projects/minted/releases',{method:'POST',cookie:dev,key:true,body:{name:'r1',build:'b1'}})),201);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM oa_dev_credentials WHERE credential='credentials'").first()).n,4,'every mint path in the dev session is recorded; the ordinary ones are not');

 // Dev-minted capture/build credentials need no owner gate locally. Agent reads
 // still need it, and production refuses every dev-minted credential.
 const probes=[
  ['ingest key',(target,key)=>target('/api/ingest/minted',{method:'POST',bearer:project.ingestKey,body:event('e-'+Math.random()),key}),201],
  ['agent key',(target,key)=>target('/api/projects/minted/issues',{bearer:agent,key}),200],
  ['deploy key',(target,key)=>target('/api/projects/minted/releases',{method:'POST',bearer:deploy,body:{name:'r'+Math.random().toString(36).slice(2,8),build:'b'},key}),201],
 ];
 for(const [name,probe,allowed] of probes){
  assert.equal(await status(await probe(local,true)),allowed,`a dev-minted ${name} works behind the key`);
  assert.equal(await status(await probe(local,false)),name==='agent key'?401:allowed,`local ${name} admission follows its scope`);
  assert.equal(await status(await probe(remote,true)),401,`a dev-minted ${name} is refused by the deployed entry`);
 }
 assert.equal(await status(await local('/api/ingest/minted',{method:'POST',bearer:ingest,body:event('second')})),201,'Settings ingest keys work without the owner gate');
 const captured=(await (await local('/api/projects/minted/issues',{cookie:dev,key:true})).json())[0];
 const packetPath='/api/projects/minted/issues/'+captured.id+'/packet';
 assert.equal(await status(await local(packetPath,{bearer:agent})),401,'a dev-minted packet grant needs the owner gate');
 assert.equal(await status(await local(packetPath,{bearer:agent,key:true})),200);
 assert.equal(await status(await remote(packetPath,{bearer:agent,key:true})),401,'deployed packet reads reject dev grants');

 // A fence from the linked Auth install ends the owner's session and fences every agent and deploy key a session of
 // theirs minted; signing in again brings none back, and keys minted after the fence work. (Link and binding rows are
 // what a completed link and an Auth sign-in leave.)
 const owner=await db.prepare('SELECT id FROM oa_operators WHERE email=?').bind(testOwner).first();
 await db.prepare('INSERT INTO rer_dependency_link(interface,issuer,client_id,metadata,needs_relink,linked_at) VALUES(?,?,?,?,0,?)').bind('oidc-provider@1',issuer,'spool-client',JSON.stringify({algorithms:['ES256'],jwks:issuer+'/jwks'}),Date.now()).run();
 await db.prepare('INSERT INTO oa_external_identities(issuer,subject,operator_id) VALUES(?,?,?)').bind(issuer,'pairwise-owner',owner.id).run();
 const ordinaryDeploy=await minted(ordinary,'deploy');
 const release=bearer=>local('/api/projects/web/releases',{method:'POST',bearer,body:{name:'r'+Math.random().toString(36).slice(2,8),build:'b'}});
 const keys=async(agentKey,deployKey)=>[await status(await local('/api/projects/web/issues',{bearer:agentKey})),await status(await release(deployKey))];
 assert.deepEqual(await keys(ordinaryAgent,ordinaryDeploy),[200,201]);
 const now=Math.floor(Date.now()/1000);
 const fence=await signed({alg:'ES256',kid:authKey.kid,typ:'logout+jwt'},{iss:issuer,aud:'spool-client',sub:'pairwise-owner',iat:now,exp:now+120,jti:crypto.randomUUID(),events:{'https://runeditrun.com/events/identity-fence':{}}});
 assert.equal(await status(await fetch(origin+'/auth/oidc/auth/logout',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({logout_token:fence})})),204);
 assert.equal(await status(await local('/api/projects',{cookie:ordinary})),401,'the fenced session ends');
 assert.deepEqual(await keys(ordinaryAgent,ordinaryDeploy),[401,401],'the agent and deploy keys it minted are fenced');
 const again=await signIn(origin,{bootstrap:false});
 assert.deepEqual(await keys(ordinaryAgent,ordinaryDeploy),[401,401],'signing in again restores none of them');
 assert.deepEqual(await keys(await minted(again,'agent'),await minted(again,'deploy')),[200,201],'keys minted after the fence work');
 console.log('Spool dev credentials: local ingest/deploy work with scoped keys alone; agent reads and owner sessions retain the gate; deployed entries reject dev grants; identity fences retire agent/deploy keys.');
}finally{
 await mf.dispose();await rm(directory,{recursive:true,force:true});jwks.close();
}

}
