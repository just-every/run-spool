import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {brotliDecompressSync,gunzipSync,inflateSync} from 'node:zlib';
import {objectJson,parseEnvelope,unsupportedReason} from '../../src/domain/sentry/wire.ts';

// Reference collector: the same unmodified SDK program first sends to this plain HTTP
// server, so the test knows exactly which envelope items the SDK itself produced.
export async function referenceCollector(){
 const sent=[];
 const server=createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  let bytes=Buffer.concat(chunks);const encoding=req.headers['content-encoding'];
  if(encoding==='gzip')bytes=gunzipSync(bytes);else if(encoding==='deflate')bytes=inflateSync(bytes);else if(encoding==='br')bytes=brotliDecompressSync(bytes);
  if(/envelope/.test(req.url)){const {items}=parseEnvelope(bytes);for(const item of items)sent.push({type:item.header.type,header:item.header,bytes:item.bytes})}
  res.setHeader('Content-Type','application/json');res.end('{}');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const {port}=server.address();
 return {dsn:`http://reference@127.0.0.1:${port}/1`,sent,close:()=>new Promise(resolve=>server.close(resolve))};
}

export function run(command,args,{cwd,env={},unset=[],timeout=900_000}={}){
 return new Promise((resolve,reject)=>{
  const inherited={...process.env};for(const name of unset)delete inherited[name];
  const child=spawn(command,args,{cwd,env:{...inherited,...env},stdio:['ignore','pipe','pipe'],detached:false});
  let stdout='',stderr='';child.stdout.on('data',d=>stdout=(stdout+d).slice(-20000));child.stderr.on('data',d=>stderr=(stderr+d).slice(-20000));
  const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);
  child.once('error',error=>{clearTimeout(timer);reject(error)});
  child.once('exit',code=>{clearTimeout(timer);resolve({code,stdout,stderr})});
 });
}

export async function runOk(command,args,options){
 const result=await run(command,args,options);
 assert.equal(result.code,0,`${command} ${args.slice(0,3).join(' ')} failed:\n${result.stderr||result.stdout}`);return result;
}

export function counts(items){const map=new Map();for(const type of items)map.set(type,(map.get(type)??0)+1);return map}

// What Spool must show in project outcomes for the items one SDK actually sent.
export function expectedOutcomes(sent){
 const expected=new Map(),add=(reason,n=1)=>expected.set(reason,(expected.get(reason)??0)+n);
 for(const item of sent){
  if(item.type==='event')add('accepted');
  else if(item.type==='client_report'){for(const row of objectJson(item.bytes).discarded_events??[])add(`client_discarded:${row.category}:${row.reason}`,row.quantity)}
  else if(item.type==='feedback'||item.type==='user_report')add('feedback_accepted');
  else add(unsupportedReason(item.type));
 }
 return expected;
}

export function api(origin,cookie){
 const request=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...body?{'Content-Type':'application/json'}:{},...headers},...body?{body:JSON.stringify(body)}:{}});
 const json=async(path,method,body,headers)=>{const response=await request(path,method,body,headers);assert.ok(response.ok,`${method??'GET'} ${path}: HTTP ${response.status}`);return response.json()};
 return {request,json};
}

export async function issueDetails(app,project){
 const out=[];
 for(const issue of await app.json(`/api/projects/${project}/issues`)){
  const list=await app.json(`/api/projects/${project}/issues/${issue.id}/events`);
  const events=[];
  for(const row of list.rows)events.push(await app.json(`/api/projects/${project}/issues/${issue.id}/events/${row.id}?occurrence=${row.occurrence}`));
  out.push({issue,events});
 }
 return out;
}

export async function outcomeMap(app,project){
 const map=new Map();for(const row of (await app.json(`/api/projects/${project}/outcomes`)).rows)map.set(row.reason,row.count);return map;
}

export function sentryOf(detail){return detail.event.sentry}
export function exceptionTypes(detail){return sentryOf(detail).exceptions.map(e=>e.type)}
