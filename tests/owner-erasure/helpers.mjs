export { assertAuditAppendOnly } from '../audit-state.mjs';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { admissionRuntime } from '../admission-runtime.mjs';
import { signIn, testOwner } from '../auth.mjs';

export async function runtime(extra={}) {
 const issuer='https://owner-erasure-issuer.test',installationId=randomUUID();
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const app=await admissionRuntime({RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify({erasure:publicKey.export({format:'jwk'})}),...extra},{hostedMail:true});
 try {
  const now=Math.floor(Date.now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const body=encode({alg:'ES256',typ:'rer-owner-claim+jwt',kid:'erasure'})+'.'+encode({v:1,iss:issuer,aud:'https://spool.example',installationId,email:testOwner,jti:randomUUID(),iat:now,exp:now+240});
  const token=body+'.'+sign('sha256',Buffer.from(body),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  assert.equal((await app.call('/auth/owner-claim',{token,displayName:'Test owner'})).status,303);
  app.cookie=await nativeSignIn(app,testOwner);
  app.request=(path,value,headers={},method)=>app.call(path,value,{Cookie:app.cookie,...headers},method);
  app.json=async(path,value,status=200,headers={})=>{const response=await app.request(path,value,headers);const data=await response.json();assert.equal(response.status,status,`${path}: ${JSON.stringify(data)}`);return data;};
  return app;
 }catch(error){await app.close();throw error;}
}
async function nativeSignIn(app,email){
 assert.equal((await app.call('/auth/magic-link',{email})).status,202);
 return confirmLatest(app,email);
}
export async function confirmLatest(app,email,cookie) {
 const rows=(await app.DB.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence DESC').all()).results;
 const message=rows.map(row=>JSON.parse(row.message)).find(message=>message.to.includes(email));
 assert.ok(message,'ordinary native email delivery exists');
 const match=JSON.stringify(message).match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/);assert.ok(match);
 const response=await app.call('/auth/confirm',{token:match[1]},cookie?{Cookie:cookie}:{});
 assert.equal(response.status,303,'ordinary native one-use confirmation');
 return response.headers.get('set-cookie')?.split(';')[0];
}
export async function successor(app) {
 const email='successor@spool.test';
 await app.json('/api/owner/erasure/successor',{email,displayName:'Successor Person'},202);
 const cookie=await confirmLatest(app,email);
 assert.equal((await app.call('/api/projects',undefined,{Cookie:cookie})).status,401,'invited member has no owner management');
 return {email,cookie};
}
export async function snapshot(app) {
 const tables=(await app.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results;
 const data={};for(const {name} of tables)data[name]=(await app.DB.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()).results;
 return data;
}
export async function archive(app) {
 const response=await app.request('/api/archive');assert.equal(response.status,200);
 const text=await response.text(),records=text.trim().split('\n').map(line=>JSON.parse(line));
 const data={};for(const record of records)for(const item of record.items??[])if(item.kind==='row')(data[item.table]??=[]).push(item.row);
 return {text,manifest:records[0],data};
}
export const eraseInput=preview=>({confirm:'ERASE MY PERSONAL DATA',planHash:preview.planHash});
export async function restore(app,text) {
 const response=await fetch(app.origin+'/api/restore',{method:'POST',headers:{Origin:app.origin,Cookie:app.cookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:text});
 return {status:response.status,body:await response.json()};
}
