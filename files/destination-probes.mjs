// Isolated execution of the actual fixture callback; no live external service.
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gunzipSync,inflateSync,brotliDecompressSync} from 'node:zlib';
const repo=process.argv[2];
const {parseEnvelope,objectJson}=await import(repo+'/src/domain/sentry/wire.ts');
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
const close=server=>new Promise(resolve=>server.close(resolve));
const body=Buffer.from('{}\n{"type":"event"}\n{"event_id":"synthetic-probe"}');
async function probe(source){
 const observed={foreign:0,unexpected:0,valid:0};
 const foreign=createServer((req,res)=>{observed.foreign++;res.end('foreign')});
 const foreignOrigin=await listen(foreign);
 const upstream=createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);if(req.url.startsWith('/api/1/envelope/')){observed.valid++;assert.deepEqual(Buffer.concat(chunks),body);assert.equal(req.headers['x-fixture-probe'],'preserved')}else observed.unexpected++;res.writeHead(201);res.end('fixture')});
 const origin=await listen(upstream),fixtureOrigin=new URL(origin),original=new URL(origin.replace('://','://synthetic@')+'/1'),items=[];
 const destination=new URL('/api/1/envelope/?sentry_key=synthetic&sentry_version=7',fixtureOrigin);
 const start=source.indexOf('const edge=createServer('),end=source.indexOf('\n  await new Promise(resolve=>edge.listen',start);
 assert.ok(start>=0&&end>start);
 const edge=eval(source.slice(start,end).replace('const edge=','').replace(/;\s*$/,''));
 const edgeOrigin=await listen(edge),edgeUrl=new URL(edgeOrigin);
 const send=path=>new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port:edgeUrl.port,path,method:'POST',headers:{'x-fixture-probe':'preserved'}},res=>{res.resume();res.once('end',()=>resolve(res.statusCode))});req.once('error',reject);req.end(body)});
 try{
  const targets=[foreignOrigin+'/api/1/envelope/','//'+new URL(foreignOrigin).host+'/api/1/envelope/','http://fixture@'+new URL(foreignOrigin).host+'/api/1/envelope/','/unexpected'];
  const refusals=[];for(const target of targets)refusals.push(await send(target));
  const validStatus=await send('/api/1/envelope/?sentry_key=synthetic&sentry_version=7&sentry_client=synthetic-probe');
  assert.equal(validStatus,201);assert.equal(observed.valid,1);assert.equal(items.length,source.includes('const target=new URL(req.url,fixtureOrigin)')?1:5);
  return {probes:4,rejected:refusals.filter(s=>s===400).length,statuses:refusals,...observed,validStatus,bodyAndHeaderPreserved:true};
 }finally{await close(edge);await close(upstream);await close(foreign)}
}
const before=await probe(execFileSync('git',['-C',repo,'show','origin/main:tests/inbound-filter-flow.mjs'],{encoding:'utf8'}));
const after=await probe(readFileSync(repo+'/tests/inbound-filter-flow.mjs','utf8'));
assert.equal(before.rejected,0);assert.equal(before.foreign,2);assert.equal(before.unexpected,1);
assert.equal(after.rejected,4);assert.equal(after.foreign,0);assert.equal(after.unexpected,0);
console.log(JSON.stringify({before,after},null,2));
