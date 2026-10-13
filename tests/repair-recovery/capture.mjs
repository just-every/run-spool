import assert from 'node:assert/strict';
import {startDispatchApp} from '../triage-app.mjs';
import {signIn} from '../auth.mjs';
// One minified Cedar Dispatch app per project on its own loopback origin. An
// ordinary owner session mints its ingest key: a cross-origin SDK client cannot
// carry the checkout's private dev gate.
export async function captureApp(app,browser,project,release,build){
 const cookie=await signIn(app.origin,{bootstrap:false});
 const key=await app.json(`/api/projects/${project}/keys`,'POST',{kind:'ingest'},{headers:{Cookie:cookie}});
 const dispatch=await startDispatchApp({endpoint:app.origin,project,ingestKey:key.key,release,build,environment:'browser',debugId:'dispatch-map'});
 await app.json(`/api/projects/${project}/browser-origins`,'POST',{origin:dispatch.origin});
 const page=await browser.newPage();
 return {ingestKey:key.key,map:dispatch.map,
  // Prepare delivery throws the repaired failure; Track delivery throws another group.
  async throw(releaseName,buildName,button='Prepare delivery'){
   dispatch.setRelease(releaseName,buildName);await page.goto(dispatch.origin);
   await page.getByRole('button',{name:button}).click();await page.waitForFunction(()=>window.captureOutcome);
   const outcome=await page.evaluate(()=>window.captureOutcome);assert.equal(outcome.outcome,'accepted',`${button} in ${releaseName} accepted`);return outcome;
  },
  async stop(){await page.close();await dispatch.stop();},
 };
}
