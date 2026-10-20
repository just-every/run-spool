import type { AuditAction, SubjectKind } from './types';

type Door = { action: AuditAction; kind: SubjectKind; project?: string; subject: string };
type Rule = { pattern: RegExp; action: AuditAction; kind: SubjectKind; methods?: string[] };
// Patterns are server-owned. Only captured identifiers reach the private alias
// lookup; neither the path nor a query or body is copied into a permanent fact.
const rules: Rule[] = [
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/grouping-proposals$/,methods:['POST'],action:'grouping.propose',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/grouping-proposals(?:\/(?<subject>[^/]+))?$/,methods:['GET'],action:'grouping.proposals',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/grouping-proposals\/(?<subject>[^/]+)\/approve$/,methods:['POST'],action:'grouping.approve',kind:'correction'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/grouping-proposals\/(?<subject>[^/]+)\/reject$/,methods:['POST'],action:'grouping.reject',kind:'correction'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/deployments$/,methods:['POST'],action:'deployment.start',kind:'release'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/deployments\/(?<subject>[^/]+)\/callbacks$/,methods:['POST'],action:'deployment.callback',kind:'run'},
 {pattern:/^\/api\/projects$/,methods:['POST'],action:'project.create',kind:'installation'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/keys$/,methods:['POST'],action:'credential.create',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/keys\/(?<subject>[^/]+)$/,methods:['DELETE'],action:'credential.revoke',kind:'credential'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/browser-origins$/,methods:['POST','DELETE'],action:'origin.change',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/issues\/(?<subject>[^/]+)$/,methods:['PATCH'],action:'issue.triage',kind:'issue'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/issues\/(?<subject>[^/]+)\/assignment$/,methods:['PATCH'],action:'issue.assign',kind:'issue'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/bulk-triage$/,methods:['POST'],action:'issue.bulk_triage',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/suppression-policies(?:\/(?<subject>[^/]+))?$/,methods:['POST','PATCH'],action:'suppression.change',kind:'policy'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/corrections\/preview$/,methods:['POST'],action:'grouping.preview',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/corrections\/(?<subject>[^/]+)\/apply$/,methods:['POST'],action:'grouping.apply',kind:'correction'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/corrections\/(?<subject>[^/]+)\/undo$/,methods:['POST'],action:'grouping.undo',kind:'correction'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/grouping-rules\/preview$/,methods:['POST'],action:'grouping.preview',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/grouping-rules$/,methods:['PUT'],action:'grouping.policy',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/inbound-filters\/preview$/,methods:['POST'],action:'filter.preview',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/inbound-filters$/,methods:['PUT'],action:'filter.change',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/release-policy\/preview$/,methods:['POST'],action:'release.preview',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/release-policy$/,methods:['PUT'],action:'release.policy',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/releases$/,methods:['POST'],action:'release.register',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/artifacts$/,methods:['POST'],action:'artifact.upload',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/issues\/(?<subject>[^/]+)\/packet$/,action:'evidence.packet',kind:'issue'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/issue-export$/,action:'evidence.export',kind:'project'},
 {pattern:/^\/api\/archive$/,action:'archive.export',kind:'installation'},
 {pattern:/^\/api\/restore$/,action:'archive.restore',kind:'installation'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/retention$/,action:'retention.preview_or_apply',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/erasure$/,methods:['GET','HEAD'],action:'erasure.preview',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/erasure$/,action:'erasure.start',kind:'project'},
 {pattern:/^\/api\/erasures\/(?<subject>[^/]+)\/resume$/,action:'erasure.resume',kind:'erasure'},
 {pattern:/^\/api\/owner\/erasure\/successor$/,action:'owner.successor',kind:'installation'},
 {pattern:/^\/api\/owner\/erasure(?:\/receipts)?$/,action:'owner.erasure',kind:'installation'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/alerting\/destinations$/,methods:['POST'],action:'alert.destination.create',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/alerting\/destinations\/(?<subject>[^/]+)$/,methods:['PUT'],action:'alert.destination.change',kind:'destination'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/alerting\/destinations\/(?<subject>[^/]+)\/test$/,action:'alert.destination.test',kind:'destination'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/alerting\/rules$/,methods:['POST'],action:'alert.rule.create',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/alerting\/rules\/(?<subject>[^/]+)$/,methods:['PUT'],action:'alert.rule.change',kind:'rule'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/alerting\/deliveries\/(?<subject>[^/]+)\/resolve$/,action:'alert.delivery.resolve',kind:'delivery'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/repairs$/,methods:['POST'],action:'repair.create',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/repairs\/(?<subject>[^/]+)\/checks$/,action:'repair.check',kind:'repair'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/repairs\/(?<subject>[^/]+)\/facts$/,action:'repair.fact',kind:'repair'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/reproducers$/,methods:['POST'],action:'reproducer.create',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/reproducers\/(?<subject>[^/]+)\/runs$/,action:'reproducer.queue',kind:'reproducer'},
 {pattern:/^\/api\/sandbox\/runs\/(?<subject>[^/]+)$/,action:'reproducer.read',kind:'run'},
 {pattern:/^\/api\/sandbox\/runs\/(?<subject>[^/]+)\/observation$/,action:'reproducer.finish',kind:'run'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/fixes$/,methods:['POST'],action:'fix.propose',kind:'project'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/fixes\/(?<subject>[^/]+)\/approve$/,action:'fix.approve',kind:'workflow'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/fixes\/(?<subject>[^/]+)\/advance$/,action:'fix.advance',kind:'workflow'},
 {pattern:/^\/api\/projects\/(?<project>[^/]+)\/feedback\/(?<subject>[^/]+)$/,methods:['DELETE'],action:'feedback.withdraw',kind:'feedback'},
 {pattern:/^\/api\/imports\/business$/,methods:['POST'],action:'import.settings',kind:'installation'},
 {pattern:/^\/api\/imports\/business\/(?<subject>[^/]+)\/undo$/,action:'import.undo',kind:'import'},
 ...(['operator','rer'] as const).flatMap(authority => ([['uploads','import.upload'],['plan','import.plan'],['apply','import.apply'],['status','import.status'],['reconcile','import.reconcile'],['undo','import.undo']] as const).map(([path,action])=>({pattern:new RegExp('^/api/'+authority+'/import/'+path+'$'),action,kind:'installation' as const}))),
 {pattern:/^\/api\/rer\/import\/archive$/,action:'import.archive',kind:'installation'},
 {pattern:/^\/api\/rer\/import\/restore-check$/,action:'import.restore_check',kind:'installation'},
 {pattern:/^\/api\/rer\/cutover-status$/,action:'cutover.status',kind:'installation'},
 {pattern:/^\/api\/imports\/sentry\/[^/]+\/(?<subject>[^/]+)\/resume$/,action:'import.resume',kind:'import'},
 {pattern:/^\/api\/imports\/sentry\/[^/]+\/(?<subject>[^/]+)\/undo$/,action:'import.undo',kind:'import'},
 {pattern:/^\/api\/imports\/sentry\/[^/]+\/(?<subject>[^/]+)\/originals$/,action:'import.originals',kind:'import'},
 {pattern:/^\/api\/ingest\/(?<project>[^/]+)\/exposure$/,action:'capture.exposure',kind:'project'},
 {pattern:/^\/api\/ingest\/(?<project>[^/]+)$/,action:'capture.native',kind:'project'},
 {pattern:/^\/api\/[^/]+\/(?:store|envelope)\/?$/,action:'capture.sentry',kind:'installation'},
 {pattern:/^\/api\/otlp\//,action:'capture.otlp',kind:'installation'},
];
const auth: Record<string,AuditAction> = {
 'bootstrap':'auth.bootstrap','owner-claim':'auth.claim','magic-link':'auth.magic_link','confirm':'auth.confirm','owner-signin':'auth.owner_signin','one-click':'auth.one_click','review-session':'auth.review_session','signout':'auth.signout','invite':'auth.invite','invite/cancel':'auth.invite_cancel','operator/status':'auth.operator_status','operator/role':'auth.operator_role','session/revoke':'auth.session_revoke','step-up':'auth.step_up','domain-rules':'auth.domain_rule','providers/unlink':'auth.provider_unlink','providers/relink':'auth.provider_relink','settings/identity':'auth.identity_settings','setup-complete':'auth.setup_complete','email':'auth.email','display-name':'auth.display_name',
};
export function classifyRequest(request: Request): Door | null {
 const path=new URL(request.url).pathname;
 // Unauthenticated provider forgeries must leave no storage write. Verified
 // delivery events record their service fact inside the projection transaction.
 if (/^\/api\/alert-events\/sendgrid\/[a-zA-Z0-9._-]+$/.test(path))return null;
 if (path==='/api/audit'||path.startsWith('/api/audit/')) return null; // This router records its own refusals/exports.
 if (path.startsWith('/auth/')) return {action:Object.hasOwn(auth,path.slice(6))?auth[path.slice(6)]:(path.startsWith('/auth/oidc/')?'auth.oidc':path.startsWith('/auth/dependencies/')?'auth.dependency':'private.action'),kind:'identity',subject:'native-auth'};
 for (const rule of rules) {
  if (rule.methods&&!rule.methods.includes(request.method)) continue;
  const match=rule.pattern.exec(path); if (!match) continue;
  const group=match.groups??{};
  let project=group.project, subject=group.subject;
  try { if(project)project=decodeURIComponent(project);if(subject)subject=decodeURIComponent(subject); } catch { return {action:'private.action',kind:'unknown',subject:'malformed-route'}; }
  return {action:rule.action,kind:rule.kind,project,subject:subject??project??'installation'};
 }
 if(path.startsWith('/api/')&&path!=='/api/health')return {action:'private.action',kind:'unknown',subject:'unclassified-private-route'};
 return null;
}
