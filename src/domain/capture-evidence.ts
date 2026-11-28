import { diagnose } from './artifacts';
import { captureGrouping } from './bundle-grouping';
import { prepareRelease } from './releases/admission';
import { readGroupingPolicy } from './grouping/policy';
import { hash, normalize, scrub, type Envelope } from './privacy';

async function captureEvidence(db: D1Database, project: string, input: Envelope, clean = scrub) {
 const policy=await readGroupingPolicy(db,project);
 const grouping=policy.revision?policy:undefined;
 const event=normalize(input.sentry?{...input,grouping:undefined,sentry:{...input.sentry,grouping}}:{...input,grouping},clean);
 const fingerprint=await captureGrouping(db,project,event);
 const issue=await hash(project+':'+fingerprint.fingerprint);
 const diagnosis=JSON.stringify(await diagnose(db,project,event));
 return {...fingerprint,event,issue,diagnosis,groupingRevision:policy.revision};
}
type CaptureReady = {
 evidence:Awaited<ReturnType<typeof captureEvidence>>;
 policyRevision:number;
 notes:string[];
 registeredRelease:string;
};
type CaptureRefusal = {refusal:string};
export type CapturePlan = CaptureRefusal | CaptureReady;

export async function prepareCapture(db:D1Database,project:string,input:Envelope,sentryIntake:boolean,clean=scrub):Promise<CaptureRefusal | CaptureReady & {jobs:D1PreparedStatement[]}> {
 const release=await prepareRelease(db,project,input,sentryIntake);
 if(release.refusal)return {refusal:release.refusal};
 const capacity=await db.prepare("SELECT COALESCE((SELECT n FROM spool_capacity_counts WHERE project=? AND kind='events'),0) total").bind(project).first<{total:number}>();
 if(capacity!.total>=10000)return {refusal:'retained_event_budget'};
 return {
  evidence:await captureEvidence(db,project,release.event!,clean),
  policyRevision:release.policyRevision!,notes:release.notes!,jobs:release.jobs!,registeredRelease:release.event!.release,
 };
}
