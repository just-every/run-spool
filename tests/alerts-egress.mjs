import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:https';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {alertRuntime,setup,event,rule} from './alerts/runtime.mjs';
import {receiver as mailbox,signingKey} from './alerts/receiver.mjs';
import {verifyWebhook} from '../src/modules/integrations/core/webhook.ts';
import {createDevEgress} from '../src/modules/egress-service/testing/dev-egress.ts';
import {nodeLoopbackSockets} from '../src/modules/egress-service/testing/node-socket.mjs';
import {testTls} from '../src/modules/egress-service/testing/wasm-tls.mjs';

// Webhook alerts leave only through INTEGRATION_EGRESS. Here the binding is the
// egress service's own transport (createDevEgress) dialling a real loopback TLS
// receiver, driven by Spool's scheduled delivery path.
const hosts={delivered:'hooks.example.com',redirect:'redirect.example.com',private:'private.example.com'};
async function certificates(){
 const dir=await mkdtemp(join(tmpdir(),'spool-egress-certs-')),run=args=>execFileSync('openssl',args,{cwd:dir,stdio:'ignore'});
 run(['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout','ca.key','-out','ca.pem','-subj','/CN=Spool Egress Test CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign']);
 run(['req','-newkey','rsa:2048','-nodes','-keyout','receiver.key','-out','receiver.csr','-subj',`/CN=${hosts.delivered}`]);
 await writeFile(join(dir,'receiver.ext'),`subjectAltName=DNS:${hosts.delivered},DNS:${hosts.redirect}\nextendedKeyUsage=serverAuth\n`);
 run(['x509','-req','-in','receiver.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial','-days','1','-out','receiver.pem','-extfile','receiver.ext']);
 return {ca:await readFile(join(dir,'ca.pem')),key:await readFile(join(dir,'receiver.key')),cert:await readFile(join(dir,'receiver.pem')),cleanup:()=>rm(dir,{recursive:true,force:true})};
}
// A real TLS receiver that verifies the signed webhook, or answers with a redirect.
async function tlsReceiver(pair){
 const requests=[];
 const server=createServer(pair,async(req,res)=>{
  const chunks=[];for await(const part of req)chunks.push(part);const body=Buffer.concat(chunks),host=req.headers.host;
  if(host===hosts.redirect){requests.push({host,verified:false});res.writeHead(302,{location:'https://elsewhere.example/spool'});res.end();return;}
  try{const verified=await verifyWebhook({body,headers:req.headers,key:signingKey,tenant:'spool.web',destinationId:'webhook-v1'});requests.push({host,verified:true,id:verified.envelope.id,servername:req.socket.servername});res.writeHead(204);res.end();}
  catch{requests.push({host,verified:false});res.writeHead(400);res.end();}
 });
 await new Promise(accept=>server.listen(0,'127.0.0.1',accept));
 return {port:server.address().port,requests,close:()=>{server.closeAllConnections();return new Promise(accept=>server.close(accept));}};
}

const directory=await mkdtemp(resolve(tmpdir(),'spool-alerts-egress-'));
const certs=await certificates(),receiver=await tlsReceiver(certs),mail=await mailbox(join(directory,'mail.sqlite'));
const egress=createDevEgress({receivers:{[hosts.delivered]:{port:receiver.port},[hosts.redirect]:{port:receiver.port},[hosts.private]:{port:receiver.port,answers:['10.0.0.7']}},openSocket:nodeLoopbackSockets(),tls:await testTls(certs.ca)});
const outcomes=[];
const key=Buffer.from(signingKey).toString('base64');
const destinations=[
 {id:'webhook-v1',project:'web',label:'Verified receiver',channel:'webhook',url:`https://${hosts.delivered}/spool`,key},
 {id:'redirect-v1',project:'web',label:'Redirecting receiver',channel:'webhook',url:`https://${hosts.redirect}/spool`,key},
 {id:'private-v1',project:'web',label:'Private address',channel:'webhook',url:`https://${hosts.private}/spool`,key},
];
let app;
try{
 app=await alertRuntime(mail,{destinations,egressBridge:async wire=>{const host=new URL(wire.url).hostname;try{const response=await egress.send(wire);outcomes.push({host,status:response.status});return response;}catch(error){outcomes.push({host,error:error.code});throw error;}}});
 const auth=await app.json('/api/projects','POST',{id:'web',name:'Web app'}).then(p=>({Authorization:`Bearer ${p.ingestKey}`}));await app.json('/api/projects/web/releases','POST',{name:'r1',build:'b1'});
 const valid=await app.json('/api/projects/web/alerting/destinations/webhook-v1/test','POST',{});assert.equal(valid.state,'passing');await app.json('/api/projects/web/alerting/destinations/webhook-v1/review','POST',{testId:valid.id});
 receiver.requests.length=0;outcomes.length=0;
 for(const destination of ['webhook-v1'])await app.json('/api/projects/web/alerting/rules','POST',rule('webhook',{name:destination,destination,kinds:['new_issue']}));
 await app.json('/api/ingest/web','POST',event('egress-1'),auth);
 await app.schedule(Date.now());
 for(const id of ['redirect-v1','private-v1']){const failed=await app.json('/api/projects/web/alerting/destinations/'+id+'/test','POST',{});assert.equal(failed.state,'failing');assert.equal((await app.request('/api/projects/web/alerting/rules','POST',rule('webhook',{destination:id}))).status,400)}
 const deliveries=await app.json('/api/projects/web/alerting/deliveries'),state=id=>deliveries.find(row=>row.destination===id)?.state;
 // One signed alert arrives once at the real TLS receiver, and the log says delivered.
 const delivered=receiver.requests.filter(row=>row.host===hosts.delivered);
 assert.equal(delivered.length,1,'the webhook alert arrives once');assert.equal(delivered[0].verified,true,'its HMAC signature verifies');assert.equal(delivered[0].servername,hosts.delivered,'TLS used the original hostname');
 assert.equal(state('webhook-v1'),'accepted','the delivery log shows it delivered');
 // A destination that resolves to a private address is refused before any connection.
 assert.deepEqual(outcomes.filter(row=>row.host===hosts.private),[{host:hosts.private,error:'egress_dns_not_public'}]);
 assert.ok(!egress.connects.includes('10.0.0.7'),'nothing connects to the private address');
 assert.equal(receiver.requests.filter(row=>row.host===hosts.private).length,0);
 // A redirect is not followed, and the delivery is uncertain.
 assert.deepEqual(outcomes.filter(row=>row.host===hosts.redirect),[{host:hosts.redirect,status:302}]);
 assert.equal(receiver.requests.filter(row=>row.host===hosts.redirect).length,1,'only the redirecting receiver was asked');
 assert.equal(state('redirect-v1'),undefined,'a failed test cannot enable a rule');
 assert.equal(state('private-v1'),undefined,'a refused destination cannot enable a rule');
 assert.match(deliveries[0].code,/http_204_signature_sent/);
 // A later scheduled run sends nothing again.
 const sent=receiver.requests.length,tried=outcomes.length;await app.schedule(Date.now()+60_000);
 assert.equal(receiver.requests.length,sent,'no replay to the receiver');assert.equal(outcomes.length,tried,'no further egress call');
 console.log(`Alert egress delivery passed: signed delivery through the egress service transport, private-address refusal without connection, redirect not followed (${egress.connects.length} pinned connections).`);
}finally{await app?.close();await receiver.close();await mail.close();await certs.cleanup();await rm(directory,{recursive:true,force:true});}
