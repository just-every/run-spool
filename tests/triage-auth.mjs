import assert from 'node:assert/strict';
import {testOwner,outboxFetch} from './auth.mjs';
import {signInDocument} from '../src/auth/sign-in.server.ts';
export async function verifyReturnDestinations(origin,protectedPath,cookie) {
 const hosted=signInDocument(new Request('https://spool.example/sign-in'),{AUTH_ORIGIN:'https://spool.example',AUTH_LOCAL:'false',MAIL_PROVIDER:'development'});assert.ok(!(await hosted.text()).includes('href="/__dev/outbox"'));
 const post=(path,value)=>fetch(origin+path,{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(value)});
 const anonymous=await fetch(origin+protectedPath,{redirect:'manual'});assert.equal(anonymous.status,303);
 const signIn=new URL(anonymous.headers.get('location'),origin);assert.equal(signIn.origin,origin);assert.equal(signIn.pathname,'/sign-in');assert.equal(signIn.searchParams.get('returnTo'),protectedPath);
 for(const [index,hostile] of ['https://attacker.invalid/path','//attacker.invalid','/%2f%2fattacker.invalid','/\\attacker.invalid'].entries()) {
  const page=await fetch(origin+'/sign-in?returnTo='+encodeURIComponent(hostile)),html=await page.text();assert.match(html,/name="returnTo" value="\/setup"/);
  if(index>1)continue;
  const before=new Set([...((await (await outboxFetch(origin)).text()).matchAll(/\?message=([^"&]+)"/g))].map(match=>match[1]));
  const sent=await post('/auth/magic-link',{email:testOwner,returnTo:hostile});assert.equal(sent.status,202);await sent.body?.cancel();
  const listing=await (await outboxFetch(origin)).text(),id=[...listing.matchAll(/\?message=([^"&]+)"/g)].map(match=>match[1]).find(value=>!before.has(value));assert.ok(id);
  const message=await (await outboxFetch(origin,'?message='+id)).text(),link=/href="([^"\s]*\/auth\/confirm\?token=[^"\s]+)"/.exec(message)?.[1]?.replaceAll('&amp;','&');assert.ok(link);
  const token=new URL(link,origin).searchParams.get('token');
  const confirmation=await post('/auth/confirm',{token,returnTo:'https://attacker.invalid/forged'});assert.equal(confirmation.status,303);
  const destination=confirmation.headers.get('location');assert.ok(destination?.startsWith('/')&&!destination.startsWith('//'));assert.equal(new URL(destination,origin).origin,origin);
  await confirmation.body?.cancel();
 }
 const crossed=await fetch(origin+'/api/projects',{method:'POST',headers:{Origin:'https://attacker.invalid','Content-Type':'application/json'},body:JSON.stringify({id:'unauthorized',name:'Unauthorized'})});assert.equal(crossed.status,401);await crossed.body?.cancel();
 const forged=await fetch(origin+'/api/projects',{method:'POST',headers:{Cookie:cookie,Origin:'https://attacker.invalid','Content-Type':'application/json'},body:JSON.stringify({id:'forged',name:'Forged'})});assert.equal(forged.status,403);await forged.body?.cancel();
}
