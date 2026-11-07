import { words } from './readable';

const actions: Record<string, string> = {
  'retention.policy': 'Retention settings updated', 'retention.hold': 'Retention hold changed', 'retention.scheduled': 'Expired records removed', 'retention.preview_or_apply': 'Retention reviewed',
  'billing.read': 'Billing viewed', 'identity.policy': 'User identity settings updated', 'identity.preview': 'User identity changes previewed', 'identity.erasure_preview': 'User erasure previewed',
  'project.create': 'Project created', 'credential.create': 'Project key created', 'credential.revoke': 'Project key revoked', 'credential.rate_limit': 'Key rate limit changed', 'credential.loader': 'Browser loader settings changed',
  'issue.triage': 'Issue status changed', 'issue.bulk_triage': 'Issue statuses changed', 'issue.assign': 'Issue assignment changed', 'issue.suspect': 'Suspect change reviewed',
  'origin.change': 'Allowed capture origins changed', 'report.read': 'Report viewed', 'report.export': 'Report exported', 'reporting.view': 'Saved view opened', 'reporting.query': 'Report query run',
  'grouping.propose': 'Grouping change proposed', 'grouping.proposals': 'Grouping proposals viewed', 'grouping.approve': 'Grouping proposal approved', 'grouping.reject': 'Grouping proposal rejected', 'grouping.preview': 'Grouping changes previewed', 'grouping.apply': 'Grouping correction applied', 'grouping.undo': 'Grouping correction undone', 'grouping.policy': 'Grouping rules updated',
  'archive.export': 'Private archive downloaded', 'archive.restore': 'Private archive restored', 'audit.read': 'Action history viewed', 'audit.export': 'Action history exported',
  'erasure.preview': 'Project erasure previewed', 'erasure.start': 'Project erasure started', 'erasure.resume': 'Project erasure continued', 'erasure.complete': 'Project erased',
  'auth.owner_signin': 'Owner signed in', 'auth.signout': 'Signed out', 'auth.one_click': 'Local sign-in opened', 'auth.magic_link': 'Sign-in link requested', 'auth.confirm': 'Sign-in confirmed',
};
const subjects: Record<string, string> = {
  installation: 'Installation', project: 'Project', credential: 'Project key', issue: 'Issue', policy: 'Settings', release: 'Release', artifact: 'Source map', correction: 'Grouping correction',
  destination: 'Alert destination', rule: 'Alert rule', delivery: 'Alert delivery', repair: 'Repair', reproducer: 'Reproducer', run: 'Sandbox run', workflow: 'Fix workflow', feedback: 'User feedback',
  import: 'Imported data', erasure: 'Erasure', identity: 'User identity', session: 'Sign-in session', audit: 'Action history', unknown: 'Installation',
};
const areas: Record<string, string> = {
  notification: 'Notification', reporting: 'Saved report', organization: 'Organization', member: 'Member', team: 'Team', service: 'Service account', scrubbing: 'Scrubbing', review: 'Issue review', checkin: 'Check-in', suppression: 'Archive condition',
  filter: 'Capture filter', release: 'Release', commit: 'Commit sharing', artifact: 'Source map', alert: 'Alert', repair: 'Repair', reproducer: 'Reproducer', fix: 'Fix workflow', feedback: 'User feedback', import: 'Import', cutover: 'Import cutover',
  auth: 'Sign-in', deployment: 'Deployment', cli: 'Command-line operation', capture: 'Error capture', automation: 'Background follow-up', owner: 'Owner account', private: 'Private action',
};
const verbs: Record<string, string> = {
  create: 'created', change: 'changed', share: 'sharing changed', export: 'exported', read: 'viewed', invite: 'invitation sent', remove: 'removed', transfer: 'transferred', preview: 'previewed', policy: 'settings changed',
  register: 'registered', upload: 'uploaded', settings: 'settings changed', test: 'tested', resolve: 'resolved', check: 'checked', fact: 'updated', queue: 'queued', finish: 'finished', propose: 'proposed', approve: 'approved', advance: 'advanced',
  status: 'status checked', apply: 'applied', reconcile: 'reconciled', undo: 'undone', resume: 'continued', originals: 'originals viewed', archive: 'archived', start: 'started', timeout: 'timed out',
};
export function auditAction(action: string) {
  if (actions[action]) return actions[action];
  const parts = action.split('.'), area = areas[parts[0]] ?? 'Action', verb = verbs[parts.at(-1)!];
  return verb ? `${area} ${verb}` : `${area} activity recorded`;
}
export const auditSubject = (kind: string) => subjects[kind] ?? words(kind);
export const auditOutcome = (outcome: string) => ({ succeeded: 'Completed', accepted: 'Accepted', suppressed: 'Not sent', denied: 'Access denied', conflict: 'Needs a fresh review', invalid: 'Invalid request', failed: 'Failed', uncertain: 'Result unconfirmed', started: 'Started' } as Record<string, string>)[outcome] ?? words(outcome);
export const auditSource = (source: string) => ({ transaction: 'Saved change', request: 'Request', service: 'Background task', legacy: 'Imported history' } as Record<string, string>)[source] ?? 'Recorded action';
