import { diagnose } from './artifacts';
import { captureGrouping } from './bundle-grouping';
import { readGroupingPolicy } from './grouping/policy';
import { hash, normalize, scrub, type Envelope } from './privacy';

export async function captureEvidence(db: D1Database, project: string, input: Envelope, clean = scrub) {
 const policy=await readGroupingPolicy(db,project);
 const grouping=policy.revision?policy:undefined;
 const event=normalize(input.sentry?{...input,grouping:undefined,sentry:{...input.sentry,grouping}}:{...input,grouping},clean);
 const fingerprint=await captureGrouping(db,project,event);
 const issue=await hash(project+':'+fingerprint.fingerprint);
 const diagnosis=JSON.stringify(await diagnose(db,project,event));
 return {...fingerprint,event,issue,diagnosis,groupingRevision:policy.revision};
}
export type CaptureEvidence = Awaited<ReturnType<typeof captureEvidence>>;
