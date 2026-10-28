import { scrub } from '../privacy';
import { repairLink } from './input';

export const repairArchiveTables = ['repair_checks', 'repairs'];
const repairFields = ['id', 'project', 'issue', 'snapshot_revision', 'snapshot_events', 'snapshot_release_seq', 'link', 'note', 'approved', 'merged', 'deployed_release', 'deployed_seq', 'deployed', 'exercised', 'exercise_note', 'revision', 'created', 'updated'];
const checkFields = ['id', 'repair', 'project', 'name', 'outcome', 'note', 'recorded'];
const auditFields: Record<string, string[]> = { repair_recorded: ['repair', 'issue'], repair_check_recorded: ['repair', 'check', 'revision'], repair_fact: ['repair', 'fact', 'revision'] };
function assert(ok: unknown): asserts ok { if (!ok) throw new Error('Invalid repair archive'); }
function shape(row: any, fields: string[]) { assert(row && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).sort().join() === [...fields].sort().join()); }
const integer = (value: any, min = 0) => assert(Number.isSafeInteger(value) && value >= min);
const time = (value: any) => value === null || integer(value);
const uuid = (value: any) => assert(typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value));
const safe = (value: any, max: number, required = false) => assert(typeof value === 'string' && value.length <= max && scrub(value) === value && (!required || value.length > 0));

// Validate repair rows before restore, then hand Spool's strict v1/v2 validator
// only the tables and audit kinds it already knows.
export function validateRepairArchive(data: any) {
 assert(Array.isArray(data.repairs) && Array.isArray(data.repair_checks));
 const issues = new Map<string, any>(data.issues.map((row: any) => [row.id, row])), repairs = new Map<string, any>(), checks = new Set<string>();
 for (const r of data.repairs) {
  shape(r, 'recorded_by' in r?[...repairFields,'recorded_by']:repairFields); if('recorded_by' in r)safe(r.recorded_by,500,true); uuid(r.id); assert(!repairs.has(r.id) && issues.get(r.issue)?.project === r.project && ['js-frame-v1','python-frame-v1','go-frame-v1','sentry-chain-v1'].includes(issues.get(r.issue).algorithm));
  integer(r.snapshot_revision); integer(r.snapshot_release_seq); integer(r.revision, 1); integer(r.created); integer(r.updated);
  const events = JSON.parse(r.snapshot_events); assert(Array.isArray(events) && events.length <= 10 && events.every((id: any) => typeof id === 'string' && /^[a-zA-Z0-9._:-]{1,100}$/.test(id)));
  assert(repairLink(r.link) === r.link); safe(r.note, 1000); time(r.approved); time(r.merged);
  if (r.deployed === null) assert(r.deployed_release === null && r.deployed_seq === null && r.exercised === null);
  else { integer(r.deployed); assert(data.releases.some((row: any) => row.project === r.project && row.name === r.deployed_release && row.seq === r.deployed_seq)); }
  if (r.exercised === null) assert(r.exercise_note === null);
  else { integer(r.exercised); assert(r.exercised >= r.deployed); safe(r.exercise_note, 1000, true); }
  repairs.set(r.id, r);
 }
 for (const issue of issues.keys()) assert(data.repairs.filter((r: any) => r.issue === issue).length <= 20);
 for (const c of data.repair_checks) {
  shape(c, checkFields); uuid(c.id); assert(!checks.has(c.id) && repairs.get(c.repair)?.project === c.project);
  safe(c.name, 80, true); assert(['passed', 'failed', 'not_run'].includes(c.outcome)); safe(c.note, 300); integer(c.recorded); checks.add(c.id);
 }
 for (const id of repairs.keys()) assert(data.repair_checks.filter((c: any) => c.repair === id).length <= 10);
 for (const row of data.audit.filter((r: any) => r.kind.startsWith('repair_'))) {
  assert(auditFields[row.kind]); integer(row.created); const detail = JSON.parse(row.detail); shape(detail, auditFields[row.kind]);
  assert(repairs.get(detail.repair)?.project === row.project);
  if (row.kind === 'repair_recorded') assert(repairs.get(detail.repair).issue === detail.issue);
  if (row.kind === 'repair_check_recorded') { assert(checks.has(detail.check)); integer(detail.revision, 2); }
  if (row.kind === 'repair_fact') { assert(['approved', 'merged', 'deployed', 'exercised'].includes(detail.fact)); integer(detail.revision, 2); }
 }
 return { ...Object.fromEntries(Object.entries(data).filter(([name]) => !repairArchiveTables.includes(name))), audit: data.audit.filter((r: any) => !r.kind.startsWith('repair_')) };
}
