import { captureException, type CaptureOptions } from '../../domain/capture';

// Both setup and Capture call this same location, so a fresh event has the same
// fingerprint. It remains explicitly separate from real application errors.
export function testException() {
  try { const order: any = {}; order.customer.email; throw new Error('Unexpected test result'); }
  catch (error) { const exception=error as Error; exception.name='SpoolTestError'; return exception; }
}
export async function sendTestSample(options: CaptureOptions) {
  return captureException(testException(),options);
}
export async function testResult(request: (path:string)=>Promise<any>,project:string,outcome:any) {
  if(outcome.outcome!=='accepted')return outcome;
  try {
    const alerts=await request(`/api/projects/${encodeURIComponent(project)}/alerts`);
    const raised=alerts.map((row:any)=>({...row,payload:typeof row.payload==='string'?JSON.parse(row.payload):row.payload}))
      .find((row:any)=>row.issue===outcome.issue&&row.payload?.trigger?.event===outcome.eventId);
    return {...outcome,testResult:raised?.kind==='new_issue'?'new':raised?.kind==='regression'?'regressed':'received',testRelease:raised?.payload?.release?.name};
  } catch { return {...outcome,testResult:'received'}; }

}
export function testResultLabel(outcome:any) {
  if(outcome.testResult==='regressed')return `Same error came back: now Regressed${outcome.testRelease?` in ${outcome.testRelease}`:''}.`;
  if(outcome.testResult==='new')return 'New alert raised for the test error.';
  return 'Test error received.';
}
