import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {localCookieName} from '../src/modules/operator-auth/http.mjs';

// Mint an ordinary owner session through the real local CLI endpoint before Dev
// stops. Preview serves the production entry, which never admits dev sessions.
export async function previewOwnerSession(origin,secret) {
 const response=await fetch(origin+'/auth/local/cli-session',{method:'POST',redirect:'manual',headers:{Origin:origin,'content-type':'application/json','x-rer-local-cli':createHmac('sha256',secret).update('local-cli\0sign-in').digest('hex')},body:JSON.stringify({returnTo:'/'})});
 assert.equal(response.status,303);
 const cookies=response.headers.getSetCookie().map(value=>value.split(';')[0]);
 assert.equal(cookies.length,1);await response.body?.cancel();return cookies[0].slice(cookies[0].indexOf('=')+1);
}
export async function browserPreviewSession(page,origin,output,token) {
 const ready=output.split('\n').flatMap(line=>{try{const e=JSON.parse(line);return e.event==='ready'?[e]:[]}catch{return []}});
 assert.equal(ready.length,1);assert.equal(ready[0].url,origin);assert.equal(ready[0].openUrl,undefined);
 const context=page.context();
 assert.equal((await context.request.get(origin+'/api/projects')).status(),401);
 assert.equal((await context.request.get(origin+'/auth/dev/enter')).status(),404);
 // Preview overrides the port of this same installation. Its cookie name is
 // port-scoped, so install the genuine native token under Preview's name.
 await context.addCookies([{name:localCookieName('operator_session_local',origin),value:token,url:origin,httpOnly:true,sameSite:'Lax'}]);
 await page.goto(origin+'/');await page.waitForURL(origin+'/');
 assert.equal((await context.request.get(origin+'/api/projects')).status(),200);
 assert.equal((await context.request.get(origin+'/__dev/outbox')).status(),404);
}
