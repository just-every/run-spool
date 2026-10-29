import { date } from './shared';

/** Move in's state and every sentence it says: pure functions of the owner's
 * session (`useDraft('move-in')`), the door's answers and its `history[]`. */

export const PART_BYTES = 65_536, FILE_LIMIT = 2 * 1024 * 1024;
export const kinds = [['projects', 'Projects'], ['releases', 'Releases'], ['issues', 'Issues'], ['events', 'Events']] as const;
const kindNames: Record<string, string> = { projects: 'Project', releases: 'Release', issues: 'Issue', events: 'Event' };
export const kindName = (kind: string) => kindNames[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const when = (value: string) => { const time = Date.parse(value); return Number.isFinite(time) ? date(time) : value; };
export const size = (bytes: number) => bytes < 1024 ? plural(bytes, 'byte') : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1048576).toFixed(2)} MiB`;

export type Labels = Record<string, string>;
export type Job = { id?: string; state: string; checkpoint: number; total: number; error?: string | null };
type Blocker = { reasonCode: string; kind: string; label: string | null; labelReasonCode: string | null };
export type Undo = { available: boolean; blockers: Blocker[] };
export type Rejected = { kind: string; sourceId: string; reasonCode: string; label: string | null; labelReasonCode: string | null };
export type Plan = {
  planId: string; fingerprint: string; bundleSha256: string;
  summary: { created: number; updated: number; unchanged: number; gone: number };
  counts: { input: number; unique: number; duplicates: number; effects: number; byKind: Record<string, number> };
  rejected: Rejected[]; diagnostics: { code: string; kind?: string; sourceId?: string; field?: string }[];
  differences: Record<'additions' | 'replacements' | 'unchanged' | 'gone', string[]>; reasonLabels: Labels;
};
export type Approval = { approved_at: string; approval_id: string; reviewer: string };
export type Reconcile = {
  ok: boolean; sourceIds: { kind: string; sourceId: string; status: string }[]; counts: { byKind: Record<string, number> };
  projectIds: string[] | null; projectIdsReasonCode: string | null; undo: Undo; reasonLabels: Labels;
};
export type HistoryRow = {
  planId: string; jobId: string; namespace: string; fingerprint: string; state: string; failureCode: string | null;
  approvedAt: string; approvalRecordId: string; reviewer: string; organization: string | null;
  counts: { effects: number } | null; countsReasonCode: string | null; rejected: Rejected[] | null; undo: Undo;
};
export type Imports = { configured: boolean; enabled: boolean; keys: { kid: string; revoked: boolean; name: string | null }[]; history: HistoryRow[]; reasonLabels: Labels };
export type FileFacts = { name: string; size: number; slug: string; region: string; start: string; end: string; omissions: string[] };
/** A refusal in words: its title, its detail, the next step and the file control that takes it. */
type Notice = { title: string; text?: string; next?: string; technical?: string; action?: 'choose' | 'replan' | 'chooseAgain' };

export type Step = 'empty' | 'chosen' | 'uploading' | 'planning' | 'review' | 'refused' | 'changed' | 'applying' | 'failed'
  | 'imported' | 'undoing' | 'undone' | 'rolling_back' | 'rolled_back';
/** One Move in session. The file (F) lives only here; a reload loses it, and
 * the page then resumes from `history[]` (`row`). */
export type Session = {
  step: Step; bytes?: Uint8Array; facts?: FileFacts; namespace?: string; baseline?: HistoryRow;
  planId?: string; fingerprint?: string; plan?: Plan; part?: [number, number]; row?: HistoryRow;
  job?: Job; approval?: Approval; reconcile?: Reconcile; undo?: Undo;
  notice?: Notice; held?: string[]; interrupted?: string; stopped?: boolean;
};
export const empty: Session = { step: 'empty' };

export const words = {
  title: 'Move in from Sentry',
  description: 'Bring Sentry history into Spool from an export file. Nothing changes until you apply a plan you reviewed, and you can undo it.',
  notOwner: 'Only the owner of this Spool installation can move data in, apply or undo imports.',
  unavailable: "Imports are unavailable until this installation's import tables are updated.",
  choose: 'Choose a Sentry organization export. Nothing is uploaded until you start a dry run.',
  limits: "Spool's Sentry export format, up to 2 MiB and 499 Sentry records.",
  nothingUploaded: 'Nothing is uploaded until you start a dry run.',
  startConsequence: 'Uploads the file privately to this installation and plans it. Nothing in Spool changes.',
  replanConsequence: 'Plans the same file again, for a new review.',
  continueApply: 'Continues the same reviewed plan.',
  continueUndo: 'Removes the rest of what this import wrote.',
  writing: 'Spool is writing exactly the plan you reviewed. Undo appears here when it finishes.',
  fingerprint: 'This code names exactly the plan above. Apply sends it back, and Spool writes only the plan with this code. If the file or the plan changed, Spool refuses and writes nothing.',
  checked: "Checked against Spool's own data, not against Sentry's totals.",
  confirmUndo: 'Remove what this import added and restore what it updated?',
  undoUnavailable: "Undo isn't available.",
  keepOrErase: 'Keep the import, or erase the imported projects in Settings to remove it with your edits.',
  undoStopped: 'Undo stopped. Records this import wrote were edited in Spool since, so nothing more was undone.',
  unmapped: "Spool doesn't keep these Sentry fields; the private copy of your file does.",
  inert: 'Imported history is inert: no alerts, emails, webhooks, keys or sessions are created.',
  businessOn: 'Business can upload, plan and apply here. Each apply carries your approval from Business.',
  businessOff: "Business can't send imports. Your own imports work either way.",
  businessUnavailable: "This installation has no RER trust settings (self-hosted installs don't). Your own imports still work.",
  revoke: 'Revoking is permanent. Business requests signed with this key are refused, even unexpired ones.',
};
export const blockerWords: Record<string, [string, string]> = {
  native_edit_conflict: ['Records this import wrote were edited in Spool since. Undo never overwrites your edits.', 'Edited in Spool'],
  import_superseded: ['A newer import of this organization holds these records. Undo the newer import first.', 'Held by a newer import'],
};

/** The browser's own checks (F): the same bytes the door hashes. */
export function readExport(name: string, bytes: Uint8Array): { facts: FileFacts } | { notice: Notice } {
  const unreadable = (text: string, next = "Make the export again in Spool's Sentry format.") => ({ notice: { title: "Spool can't read this file.", text, next, action: 'choose' as const } });
  if (bytes.length > FILE_LIMIT) return unreadable(`This file is ${size(bytes.length)}; the limit is 2 MiB.`, 'Export again with a shorter window or fewer selected events.');
  let bundle: any;
  try { bundle = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return unreadable("This file isn't JSON."); }
  const slug = bundle?.organization?.slug;
  if (typeof slug !== 'string' || !slug.trim()) return unreadable('This file names no Sentry organization.');
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  return { facts: { name, size: bytes.length, slug, region: text(bundle.organization.region), start: text(bundle.window?.start), end: text(bundle.window?.end),
    omissions: Array.isArray(bundle.omissions) ? bundle.omissions.filter((row: unknown) => typeof row === 'string') : [] } };
}

/** The organization's live import, which a new file is compared with (a catch-up):
 * the newest completed import of `sentry-org:<slug>` whose snapshot is held. */
export function baseline(history: HistoryRow[], namespace: string) {
  const head = history.find(row => row.namespace === namespace && row.state === 'completed');
  return head && head.countsReasonCode !== 'snapshot_withdrawn' ? head : undefined;
}

export const caption = (approval: { reviewer: string; approvalRecordId?: string; approval_id?: string }, at: string) =>
  `${approval.reviewer === (approval.approvalRecordId ?? approval.approval_id) ? 'Approved via Business' : 'Approved by you'} · ${when(at)}`;
const failure = (code: string | null | undefined) => code?.endsWith('_constraint') ? 'a database rule refused it' : code?.endsWith('_transient') ? "Spool's database was busy" : 'an error stopped it';
export const failureWords = failure;

/** The status row: the chip and the sentence for each moving or settled state. */
export function status(session: Session): { chip: string; line: string } | null {
  const job = session.job;
  switch (session.step) {
    case 'uploading': return { chip: 'Dry run', line: `Uploading part ${session.part![0]} of ${session.part![1]}…` };
    case 'planning': return { chip: 'Dry run', line: 'Planning… Nothing in Spool has changed.' };
    case 'review': return { chip: 'Dry run', line: 'Nothing in Spool has changed yet.' };
    case 'applying': return { chip: 'Applying', line: `${job!.checkpoint} of ${job!.total} records written. Keep this page open.` };
    case 'imported': return { chip: 'Imported', line: session.approval ? caption(session.approval, session.approval.approved_at) : '' };
    case 'undoing': return { chip: 'Undo in progress', line: `Undoing ${job!.checkpoint} of ${job!.total}…` };
    case 'undone': return { chip: 'Undone', line: 'The records it added are removed and the ones it updated are restored.' };
    case 'rolling_back': return { chip: 'Rolling back', line: `Removing the ${plural(job!.checkpoint, 'record')} this attempt wrote…` };
    case 'rolled_back': return { chip: 'Rolled back', line: 'Nothing from that attempt is left in Spool.' };
    default: return null;
  }
}

/** History's chip per job state. */
export const chips: Record<string, string> = { completed: 'Imported', queued: 'Applying', applying: 'Applying', undoing: 'Undo in progress', undone: 'Undone', failed: 'Failed', rolling_back: 'Rolling back', rolled_back: 'Rolled back' };
export function historyName(row: HistoryRow) {
  if (row.namespace === 'sentry') return `Sentry, sent by Business${row.organization ? ` · ${row.organization}` : ''}`;
  return `Sentry organization ${row.organization ?? row.namespace.replace(/^sentry-org:/, '')}`;
}

/** A stopped job takes the top of a return visit, with its Continue or Roll back. */
export function resumeStep(job: Job, undo: Undo | undefined): Step | null {
  if (['queued', 'applying'].includes(job.state)) return 'applying';
  if (job.state === 'undoing' && undo?.available) return 'undoing';
  if (job.state === 'failed' && job.checkpoint > 0) return 'failed';
  if (job.state === 'rolling_back') return 'rolling_back';
  return null;
}
export const unfinished = (history: HistoryRow[]) => history.filter(row => ['queued', 'applying', 'undoing', 'failed', 'rolling_back'].includes(row.state));

/** Each door refusal, in words (§9), and the state it leaves; without a step,
 * the page keeps its state and the loop that met it stops. */
export function refusal(code: string, httpStatus: number, details: any, facts?: FileFacts): { step?: Step; notice: Notice } {
  const readAgain = (title: string, text?: string, next = 'Export again with a shorter window or fewer selected events.') => ({ step: 'refused' as Step, notice: { title, text, next, action: 'choose' as const } });
  const changed = (title: string) => ({ step: 'changed' as Step, notice: { title, action: 'replan' as const } });
  if (code === 'quota_or_chunk_limit') return readAgain("Spool can't read this file.", facts ? `This file is ${size(facts.size)}; the limit is 2 MiB.` : undefined);
  if (code === 'source_record_limit') return readAgain("Spool can't plan this file.", "It has more than 499 Sentry records, Spool's limit for one file. Nothing in Spool changed.",
    'Export again with a shorter window or fewer selected events. Projects and releases are always exported whole, so a shorter window may not be enough.');
  if (code === 'source_credential') return { step: 'refused', notice: { title: `The file holds a credential Spool can't remove (${details?.field ?? 'a credential'}). The upload was deleted.`, next: 'Remove it from the file and choose it again.', action: 'choose' } };
  if (code.startsWith('source_') && code !== 'source_erased') return httpStatus === 413 ? readAgain("Spool can't plan this file.", details?.reason)
    : { step: 'refused', notice: { title: "Spool can't read this file.", text: details?.reason, next: "Make the export again in Spool's Sentry format.", technical: details?.pointer, action: 'choose' } };
  if (code === 'source_erased') return { step: 'refused', notice: { title: 'This file holds records that were erased from Spool. The upload was deleted.', next: 'Export again without them.', action: 'choose' } };
  if (code === 'namespace_has_pending_import') return { step: 'refused', notice: { title: 'A dry run of this organization is waiting.', next: "It was started in another tab or before a reload, and can't be shown here yet." } };
  if (code === 'plan_staging_interrupted_cancel_and_replan') return { step: 'changed', notice: { title: 'The last dry run of this file was interrupted.', next: 'Discard it and run the dry run again.', action: 'replan' } };
  if (code === 'earlier_import_holds_records') return { step: 'refused', notice: { title: 'An earlier import of this organization still holds records this file writes.', next: 'Undo the earlier import first.' } };
  if (code === 'import_door_too_large') return { step: 'refused', notice: { title: `This import is too large for one request: ${details?.reason ?? ''}`.trim() } };
  if (code === 'upload_credentials_withheld') return { step: 'refused', notice: { title: "Spool didn't keep this upload because it held credential values.", action: 'chooseAgain' } };
  if (code === 'owner_required') return { notice: { title: 'Your owner session ended. Nothing was written.' } };
  if (code === 'review_fingerprint_mismatch' || code === 'plan_not_found') return changed('Not applied: the plan changed after you reviewed it, so nothing was written.');
  if (code === 'snapshot_withdrawn' || code === 'erased_during_request') return changed('Not applied: an erasure removed records from this plan while you reviewed it. Nothing was written.');
  if (code === 'native_edit_conflict') return { notice: { title: words.undoStopped, next: words.keepOrErase } };
  if (code === 'import_superseded') return { notice: { title: 'Undo the newer import of this organization first.' } };
  return { notice: { title: 'Spool refused this step.', text: `The import door answered “${code}”.`, action: 'choose' } };
}
export const stoppedNotice = (job: Job, code: string | null | undefined): Notice =>
  ({ title: `Stopped after ${job.checkpoint} of ${job.total} records: ${failure(code)}. This plan can't be applied again.` });

const keyKind = (key: string) => { try { return String(JSON.parse(key)[0]); } catch { return ''; } };
const count = (keys: string[], kind: string) => keys.filter(key => keyKind(key) === kind).length;
/** The kind × outcome table of a review: differences and rejections by the kind in each `["kind","sourceId"]` key. */
export function reviewTable(plan: Plan) {
  return kinds.map(([kind, label]) => ({ kind, label, created: count(plan.differences.additions, kind), updated: count(plan.differences.replacements, kind),
    unchanged: count(plan.differences.unchanged, kind), rejected: plan.rejected.filter(row => row.kind === kind).length }));
}
/** Records gone from the export since the last import, by kind; Spool keeps them. */
export const goneByKind = (plan: Plan) => [...new Set(plan.differences.gone.map(keyKind))].map(kind => `${kinds.find(([name]) => name === kind)?.[1] ?? kindName(kind)} · ${count(plan.differences.gone, kind)}`);
export function totals(plan: Plan, catchup: boolean) {
  const rejected = plan.rejected.length;
  return catchup
    ? `Applying adds ${plural(plan.summary.created, 'record')}, updates ${plan.summary.updated} and leaves ${plan.summary.unchanged} unchanged. ${rejected} ${rejected === 1 ? 'is' : 'are'} not imported.`
    : `Applying adds ${plural(plan.summary.created, 'record')}. ${rejected} ${rejected === 1 ? 'is' : 'are'} not imported.`;
}
/** What was imported: reconcile's source IDs by kind. The door also explains a
 * record it wrote with Sentry fields Spool doesn't keep, so a record counts as not
 * imported only when this plan refused it, or it is unchanged and so kept no target. */
export function resultTable(report: Reconcile, refused: { rejected: { kind: string; sourceId: string }[]; unchanged?: string[] }) {
  const out = new Set([...refused.rejected.map(row => JSON.stringify([row.kind, row.sourceId])), ...refused.unchanged ?? []]);
  const outcome = (row: Reconcile['sourceIds'][number]) => row.status === 'mismatched' ? 'mismatched' : row.status === 'explained' && out.has(JSON.stringify([row.kind, row.sourceId])) ? 'explained' : 'present';
  const count = (kind: string, state: string) => report.sourceIds.filter(row => row.kind === kind && outcome(row) === state).length;
  return kinds.map(([kind, label]) => ({ kind, label, present: count(kind, 'present'), explained: count(kind, 'explained'), mismatched: count(kind, 'mismatched') }));
}
export const resultSentence = (report: Reconcile) => report.ok ? 'Every record in the file is accounted for in Spool.'
  : `${plural(report.sourceIds.filter(row => row.status === 'mismatched').length, "record doesn't", "records don't")} match Spool's data.`;
/** Undo's reach, from reconcile's native counts (project, release, issue, event). */
export function undoReach(byKind: Record<string, number>) {
  const native = [['project', 'project'], ['release', 'release'], ['issue', 'issue'], ['event', 'event']] as const;
  const other = Object.entries(byKind).filter(([kind]) => !native.some(([name]) => name === kind)).reduce((sum, [, n]) => sum + n, 0);
  return `Removes what this import added and restores what it updated: ${native.map(([kind, name]) => plural(byKind[kind] ?? 0, name)).join(', ')}${other ? ` and ${plural(other, 'other record')}` : ''}. Works with Business imports on or off.`;
}

/** Not imported, by reason: one group per reason code, each with its records. */
export function reasonGroups(rows: Rejected[]) {
  const groups = new Map<string, Rejected[]>();
  for (const row of rows) groups.set(row.reasonCode, [...groups.get(row.reasonCode) ?? [], row]);
  return [...groups].map(([code, records]) => ({ code, records }));
}
const recordLabel = (row: { kind: string; label: string | null; labelReasonCode: string | null }, labels: Labels) =>
  `${kindName(row.kind)} · ${row.label ?? labels[row.labelReasonCode ?? 'record_label_unavailable'] ?? ''}`;
/** "[Kind] · [label]" per record; records without a safe label read their reason once, with a count. */
export function recordLines(rows: Rejected[], labels: Labels) {
  const missing = new Map<string, number>();
  for (const row of rows) if (row.label === null) missing.set(row.labelReasonCode ?? 'record_label_unavailable', (missing.get(row.labelReasonCode ?? 'record_label_unavailable') ?? 0) + 1);
  return [...rows.filter(row => row.label !== null).map(row => recordLabel(row, labels)), ...[...missing].map(([code, n]) => `${labels[code] ?? ''} · ${plural(n, 'record')}`)];
}
/** Sentry fields and collections the plan maps nowhere. The export's own manifest shows in This
 * file instead, and a catch-up's unchanged records keep what they had, so neither is listed. */
export function unmappedFields(plan: Plan) {
  const unchanged = new Set(plan.differences.unchanged);
  return [...new Set(plan.diagnostics.filter(row => row.code === 'UNMAPPED' && row.kind !== 'manifest' && (row.field || !unchanged.has(JSON.stringify([row.kind, row.sourceId]))))
    .map(row => `${kindName(row.kind ?? '')}${row.field ? ` · ${row.field}` : ''}`))];
}
export const credentialsRemoved = (plan: Plan) => plan.diagnostics.filter(row => row.code === 'CREDENTIAL_REMOVED').length;
