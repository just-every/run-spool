import {nativeAlertRuntime} from './alerts/native-runtime.mjs';
import {prepareNativeAlerts,newIssue,regression,spike,verifyNoReplay} from './alerts/native-journey.mjs';
import {plainResolvedRegressions} from './alerts/plain-resolve.mjs';

export async function nativeDeliveryJourney(){
const native=await nativeAlertRuntime();
try {
 const fixture=await prepareNativeAlerts(native,['new_issue','regression','spike']);
 await newIssue(native,fixture);await regression(native,fixture);
  await plainResolvedRegressions(native,fixture);
 await spike(native,fixture);await verifyNoReplay(native);
} finally {await native.close()}
}
