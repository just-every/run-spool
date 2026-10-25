import {conditionsJourney} from './alerts/conditions-journey.mjs';
import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import {test} from 'node:test';
import {nativeAlertRuntime} from './alerts/native-runtime.mjs';
import {prepareNativeAlerts,newIssue,regression,spike,capture,verifyNoReplay} from './alerts/native-journey.mjs';

await test('native scheduled event delivers a new issue with silent local mail once',async()=>{
 const app=await nativeAlertRuntime();
 try{const fixture=await prepareNativeAlerts(app,['new_issue']);await newIssue(app,fixture);await verifyNoReplay(app);await conditionsJourney(app,fixture)}finally{await app.close()}
});
await test('native scheduled event delivers a later-release regression with silent local mail once',async()=>{
 const app=await nativeAlertRuntime();
 try{const fixture=await prepareNativeAlerts(app,['regression']);await capture(app,fixture,'initial');await regression(app,fixture);await verifyNoReplay(app)}finally{await app.close()}
});
await test('native scheduled event completes a real spike window and completes with silent local mail once',async()=>{
 const app=await nativeAlertRuntime();
 try{
  const fixture=await prepareNativeAlerts(app,['spike']);
  await app.json('/api/projects/web/releases','POST',{name:'r2',build:'b2'});
  await spike(app,fixture);await verifyNoReplay(app);
 }finally{await app.close()}
});
