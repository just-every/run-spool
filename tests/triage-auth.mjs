import assert from 'node:assert/strict';
import {gate} from './auth.mjs';
export async function verifyReturnDestinations(origin,protectedPath,cookie) {
 const post=(path,value)=>fetch(origin+path,{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(value)});
 const anonymous=await fetch(origin+protectedPath,{redirect:'manual'});assert.equal(anonymous.status,303);
 const signIn=new URL(anonymous.headers.get('location'),origin);assert.equal(signIn.origin,origin);assert.equal(signIn.pathname,'/sign-in');assert.equal(signIn.searchParams.get('returnTo'),protectedPath);
 for(const [index,hostile] of ['https://attacker.invalid/path','//attacker.invalid','/%2f%2fattacker.invalid','/\\attacker.invalid'].entries()) {
  const page=await fetch(origin+'/sign-in?returnTo='+encodeURIComponent(hostile)),html=await page.text();assert.match(html,/returnTo=%2Fsetup/);
  if(index>1)continue;
  const entered=await fetch(origin+'/auth/dev/enter?as=owner&returnTo='+encodeURIComponent(hostile),{redirect:'manual',headers:{'x-rer-dev-key':gate.key}});assert.equal(entered.status,303);assert.equal(new URL(entered.headers.get('location'),origin).origin,origin);

 }
 const crossed=await fetch(origin+'/api/projects',{method:'POST',headers:{Origin:'https://attacker.invalid','Content-Type':'application/json'},body:JSON.stringify({id:'unauthorized',name:'Unauthorized'})});assert.equal(crossed.status,401);await crossed.body?.cancel();
 const forged=await fetch(origin+'/api/projects',{method:'POST',headers:{Cookie:cookie,Origin:'https://attacker.invalid','Content-Type':'application/json'},body:JSON.stringify({id:'forged',name:'Forged'})});assert.equal(forged.status,403);await forged.body?.cancel();
}
