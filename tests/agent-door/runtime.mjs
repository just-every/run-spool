import assert from 'node:assert/strict';
import {randomUUID,webcrypto} from 'node:crypto';
import {startTestWorker} from '../worker.mjs';
import {testOwner} from '../auth.mjs';
import {catalogue} from '../../src/domain/agent-door/catalogue.mjs';
import {signJws,accessToken,policyEnvelope,autonomousPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

export async function agentRuntime(port=15916){
 const origin=`http://127.0.0.1:${port}`,issuer='https://spool-agent-fixture.invalid',installationId=randomUUID(),kid=randomUUID(),sub=randomUUID();
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const {kty,crv,x,y}=await webcrypto.subtle.exportKey('jwk',pair.publicKey),keys={[kid]:{kty,crv,x,y,alg:'ES256',use:'sig'}};
 const app=await startTestWorker(port,{RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_APP_ORIGIN:origin,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(keys),RER_BUSINESS_TRUST:JSON.stringify({v:1,issuer,audience:origin,subject:installationId,email:testOwner,keys})});
 const now=Math.floor(Date.now()/1000);
 const claim=await signJws(pair.privateKey,kid,'rer-owner-claim+jwt',{v:1,iss:issuer,aud:origin,installationId,email:testOwner,jti:randomUUID(),iat:now,exp:now+300});
 let cookie='';
 const request=(path,method='GET',body,headers={})=>fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,...cookie?{Cookie:cookie}:{},...body===undefined?{}:{'content-type':'application/json'},...headers},...body===undefined?{}:{body:JSON.stringify(body)}});
 const json=async(...args)=>{const r=await request(...args);const value=await r.json();assert.ok(r.ok,`${args[0]}: HTTP ${r.status} ${JSON.stringify(value).slice(0,200)}`);return value;};
 try{
  const entered=await request('/auth/owner-claim','POST',{token:claim,displayName:'Dana Engineer',returnTo:'/'});
  assert.equal(entered.status,303,'real signed owner claim');cookie=entered.headers.getSetCookie().map(row=>row.split(';')[0]).join('; ');await entered.body?.cancel();assert.ok(cookie);
  const settings=await signJws(pair.privateKey,kid,'rer-business-settings+jwt',{v:1,iss:issuer,aud:origin,sub:installationId,business:'spool-fixture',email:testOwner,owner_id:sub,jti:randomUUID(),iat:now,exp:now+300,rev:1,values:{display_name:'Spool'},logo:null,team:[]});
  await json('/api/rer/business-settings','POST',{settings});
  const surface={seed:'spool',specialist:'triage engineer',tools:[...catalogue,{scope:'events:read'}]};
  const c={origin,signer:{privateKey:pair.privateKey,kid,issuer,installationId},person:{sub,email:testOwner},surface,agentId:'spool-fixture-agent',consent:'spool-fixture-consent',business:'spool-fixture',seq:0,revision:0};
  let rpcId=0;
  const mcp=async(method,params={},overrides={},version='2025-11-25',expectedStatus=200)=>{
   const token=await accessToken(c,overrides);
   const r=await request('/mcp','POST',{jsonrpc:'2.0',id:++rpcId,method,params:{...params,_meta:{...params._meta,'io.modelcontextprotocol/protocolVersion':version}}},{Authorization:`Bearer ${token}`,Accept:'application/json, text/event-stream','MCP-Protocol-Version':version,'Mcp-Method':method,...params.name?{'Mcp-Name':params.name}:{}});
   const body=await r.json();assert.equal(r.status,expectedStatus,`${method} HTTP ${r.status}: ${JSON.stringify(body).slice(0,250)}`);return body.result??{httpStatus:r.status,error:body.error};
  };
  const call=(name,args={},overrides)=>mcp('tools/call',{name,arguments:args},overrides);
  const adopt=async(document=autonomousPolicy(),extra={})=>{
   const {policy,payload}=await policyEnvelope(c,document,extra);const result=await json('/api/rer/agent-policy','POST',{policy});c.seq=payload.seq;c.revision=payload.revision;return result;
  };
  return {...app,origin,get cookie(){return cookie},context:c,request,json,mcp,call,adopt};
 }catch(error){await app.stop();throw error;}
}
