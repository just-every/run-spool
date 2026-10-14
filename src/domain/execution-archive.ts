import { scrub } from './privacy';

// Reproducers, their runs, fix workflows with their receipts, and exposure
// reports travel in owner archives. Run tokens never do: a restored queued run
// can no longer be claimed. Rows are validated before restore, then Spool's
// strict validator receives only the tables and audit kinds it already knows.
export const executionTables: Record<string, string[]> = {
 reproducers: ['id', 'project', 'issue', 'event', 'defect_class', 'support', 'reason', 'spec', 'created'],
 reproducer_runs: ['id', 'reproducer', 'project', 'release', 'build', 'modules', 'state', 'outcome', 'observation', 'checks', 'tools', 'created', 'expires', 'claimed', 'finished'],
 fix_workflows: ['id', 'project', 'issue', 'reproducer', 'run', 'flow', 'grant_spec', 'revision', 'proposed', 'approved', 'expires', 'pull_number', 'pull_url', 'head_sha', 'merged', 'merge_sha', 'updated'],
 fix_receipts: ['id', 'workflow', 'project', 'step', 'method', 'target', 'outcome', 'status', 'detail', 'at'],
 exposures: ['project', 'release', 'environment', 'flow', 'client', 'capture', 'reports', 'first', 'last'],
};
export const executionArchiveTables = Object.keys(executionTables);
export const executionExcludedTables = ['reproducer_run_tokens', 'fix_leases'];
export const emptyExecutionTables = () => Object.fromEntries(executionArchiveTables.map(name => [name, []]));
const auditKinds: Record<string, string[]> = {
 reproducer_recorded: ['reproducer', 'issue', 'support'], reproducer_run_queued: ['reproducer', 'run', 'release'], reproducer_run_finished: ['reproducer', 'run', 'outcome'],
 fix_proposed: ['workflow', 'issue', 'repository'], fix_approved: ['workflow', 'revision'], fix_advanced: ['workflow', 'revision'],
};
function assert(ok: unknown): asserts ok { if (!ok) throw new Error('Invalid execution archive'); }
const shape = (row: any, fields: string[]) => assert(row && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).sort().join() === [...fields].sort().join());
const integer = (value: any, min = 0) => assert(Number.isSafeInteger(value) && value >= min);
const time = (value: any) => value === null || integer(value);
const uuid = (value: any) => assert(typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value));
const name = (value: any, pattern = /^[a-zA-Z0-9._:@+-]{1,200}$/) => assert(typeof value === 'string' && pattern.test(value));
// Stored JSON holds only text that already passed the scrubber.
const clean = (value: any): boolean => typeof value === 'string' ? scrub(value) === value : Array.isArray(value) ? value.every(clean) : value && typeof value === 'object' ? Object.entries(value).every(([key, item]) => clean(key) && clean(item)) : true;
function object(text: any, nullable = false) {
 if (nullable && text === null) return null;
 assert(typeof text === 'string' && text.length <= 300000); const value = JSON.parse(text); assert(value && typeof value === 'object' && clean(value)); return value;
}

export function validateExecutionArchive(data: any) {
 for (const table of executionArchiveTables) assert(Array.isArray(data[table]));
 const issues = new Map<string, any>(data.issues.map((row: any) => [row.id, row])), reproducers = new Map<string, any>(), runs = new Map<string, any>(), workflows = new Map<string, any>();
 for (const r of data.reproducers) {
  shape(r, executionTables.reproducers); uuid(r.id); assert(!reproducers.has(r.id) && issues.get(r.issue)?.project === r.project); name(r.event, /^[a-zA-Z0-9._:-]{1,100}$/);
  assert(r.defect_class === 'js-exception-mapped-frame' && ((r.support === 'supported' && r.reason === null) || (r.support === 'unsupported' && typeof r.reason === 'string' && /^[a-z_]{1,40}$/.test(r.reason))));
  const spec = object(r.spec); assert(spec.version === 1 && spec.defectClass === r.defect_class); integer(r.created); reproducers.set(r.id, r);
 }
 for (const r of data.reproducer_runs) {
  shape(r, executionTables.reproducer_runs); uuid(r.id); assert(!runs.has(r.id) && reproducers.get(r.reproducer)?.project === r.project && reproducers.get(r.reproducer).support === 'supported');
  name(r.release); name(r.build); assert(Array.isArray(object(r.modules))); integer(r.created); integer(r.expires); time(r.claimed); time(r.finished);
  const finished = r.state === 'finished';
  assert(['queued', 'claimed', 'finished'].includes(r.state) && (finished ? ['failed', 'not_reproduced', 'reproduced'].includes(r.outcome) && r.finished !== null : r.outcome === null && r.observation === null && r.checks === null && r.finished === null));
  if (finished) { object(r.observation); object(r.checks); } object(r.tools, true); runs.set(r.id, r);
 }
 for (const r of data.fix_workflows) {
  shape(r, executionTables.fix_workflows); uuid(r.id); assert(!workflows.has(r.id) && issues.get(r.issue)?.project === r.project && reproducers.get(r.reproducer)?.project === r.project && runs.get(r.run)?.reproducer === r.reproducer && runs.get(r.run).outcome === 'reproduced');
  name(r.flow, /^[a-zA-Z0-9._:-]{1,100}$/); const grant = object(r.grant_spec); assert(grant.version === 1 && grant.provider === 'github');
  integer(r.revision, 1); integer(r.proposed); integer(r.updated); assert((r.approved === null && r.expires === null) || (Number.isSafeInteger(r.approved) && r.expires > r.approved));
  assert(r.pull_number === null ? r.pull_url === null && r.merged === null : Number.isSafeInteger(r.pull_number) && typeof r.pull_url === 'string' && scrub(r.pull_url) === r.pull_url);
  assert((r.merged === null && r.merge_sha === null) || (Number.isSafeInteger(r.merged) && /^[0-9a-f]{40}$/.test(r.merge_sha)));
  assert(r.head_sha === null || /^[0-9a-f]{40}$/.test(r.head_sha));
  workflows.set(r.id, r);
 }
 for (const r of data.fix_receipts) {
  shape(r, executionTables.fix_receipts); uuid(r.id); assert(workflows.get(r.workflow)?.project === r.project && ['succeeded', 'failed', 'refused'].includes(r.outcome)); if (r.status !== null) integer(r.status);
  for (const text of [r.step, r.method, r.target]) assert(typeof text === 'string' && text.length <= 500 && scrub(text) === text);
  object(r.detail); integer(r.at);
 }
 for (const r of data.exposures) {
  shape(r, executionTables.exposures); assert(data.releases.some((row: any) => row.project === r.project && row.name === r.release));
  name(r.environment, /^[a-zA-Z0-9._:-]{1,100}$/); assert(r.flow === '' || /^[a-zA-Z0-9._:-]{1,100}$/.test(r.flow)); name(r.client, /^[A-Za-z0-9_-]{16,64}$/);
  assert([0, 1].includes(r.capture)); integer(r.reports, 1); integer(r.first); integer(r.last); assert(r.last >= r.first);
 }
 for (const row of data.audit.filter((r: any) => auditKinds[r.kind])) {
  integer(row.created); const detail = JSON.parse(row.detail); shape(detail, auditKinds[row.kind]);
  const owner = row.kind.startsWith('fix_') ? workflows.get(detail.workflow) : reproducers.get(detail.reproducer); assert(owner?.project === row.project);
  if (row.kind !== 'reproducer_recorded' && row.kind.startsWith('reproducer_run')) assert(runs.get(detail.run)?.reproducer === detail.reproducer);
 }
 return { ...Object.fromEntries(Object.entries(data).filter(([table]) => !executionArchiveTables.includes(table))), audit: data.audit.filter((r: any) => !auditKinds[r.kind]) };
}
