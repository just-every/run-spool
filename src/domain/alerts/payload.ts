import type { AlertKind } from './types';
export const events:Record<AlertKind,string> = {new_issue:'spool.issue.new',regression:'spool.issue.regressed',spike:'spool.issue.spike'};
export function publicOrigin(value?:string):string|null {
 if (!value) return null;
 try { const u=new URL(value); return u.protocol==='https:' && u.origin===value && !u.username && !u.password ? u.origin : null; } catch { return null; }
}
export function issueLink(origin:string|null,project:string,issue:string) {
 return origin ? `${origin}/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issue)}` : null;
}
export function mailMessage(id:string,body:string,from:string,to:string) {
 const alert=JSON.parse(body);
 return {deliveryId:id,from,to:[to],subject:`Spool ${alert.kind.replaceAll('_',' ')}: ${String(alert.title).replace(/[\x00-\x1f\x7f]/g,' ').slice(0,160)}`,
  text:`${alert.title}\nProject: ${alert.projectId}\nIssue: ${alert.issueId}\nObserved: ${alert.occurredAt}\n${alert.window ? `Accepted occurrences: ${alert.window.count}; threshold: ${alert.window.threshold}; window: ${alert.window.start} – ${alert.window.end}\n` : `Release: ${alert.release.name}\n`}${alert.issueUrl ?? ''}\n\nSanitized telemetry. Capture before admission is unknown.`};
}
