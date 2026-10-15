import {openGate} from './auth.mjs';
import assert from 'node:assert/strict';
// Preview now provides the same one-click local owner entry as dev.
export async function browserPreviewSignIn(page,origin,output) {
 const ready=output.split('\n').flatMap(line=>{try{const e=JSON.parse(line);return e.event==='ready'?[e]:[]}catch{return []}});
 assert.equal(ready.length,1);assert.ok(ready[0].openUrl);
 await openGate(page.context(),origin);
 await page.goto(origin+'/sign-in');
 await page.getByRole('link',{name:'Continue as owner',exact:true}).click();
 await page.waitForURL(origin+'/');
 assert.equal((await page.context().request.get(origin+'/api/projects')).status(),200);
 assert.equal((await page.context().request.get(origin+'/__dev/outbox')).status(),404);
}
