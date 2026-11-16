import { canonical, hash } from '../privacy';
import { erasureSearchPlan, erasureSearchStatements, erasureIssueStatements, erasureAlertStatements } from '../identities/erasure-search';
import { identityHash } from '../identities/key';
import { readIdentityPolicy, identityPolicyFence, type IdentityField } from '../identities/policy';
import { portability } from '../portability';
import { state, guard } from '../../modules/portability/storage.mjs';
import { receipt } from '../../modules/erasure/receipt.mjs';
import { receiptView } from './service';
import { erasureCompletionFact } from './audit-fact';
import { importCustodyRoots } from './owner-scope';

export type EndUserSelection = { field: IdentityField; value: string; action: 'remove_identity' | 'delete_events' };
// Code-owned field names only. The HMAC is private and never returned or saved
// in a receipt, audit, URL or erasure subject.
const matches = (field: IdentityField) => `SELECT i.event FROM event_identities i JOIN events e ON e.project=i.project AND e.id=i.event AND e.occurrence=i.occurrence
 WHERE i.project=? AND json_extract(i.payload,'$.${field}.mode') IN ('keep','hash') AND json_extract(i.payload,'$.${field}.hash')=?`;
const noImportCustody=importCustodyRoots.map(table=>`NOT EXISTS(SELECT 1 FROM ${table})`).join(' AND ');
const inventory = "SELECT json_group_array(name) AS inventory FROM (SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'rer_portability_snap_*' OR name GLOB 'rer_portability_stage_*') ORDER BY name)";
export const endUserExceptions = [
 {table:'feedback',reason:'Consented feedback contact, screenshots and replies stay in the feedback inbox. End-user erasure does not match feedback by contact or remove these details by the supplied identity. To remove them, the installation owner must withdraw the report in the feedback inbox. Deleting matching events also deletes reports attached to those exact occurrences.'},
 {table:'attachments',reason:'Attachment ingestion and identity metadata are not retained; there is no attachment identity matching store.'},
 {table:'replays',reason:'Replay ingestion and identity metadata are not retained; there is no replay identity matching store.'},
];

export async function endUserPlan(db: D1Database, project: string, selection: EndUserSelection) {
 const {field,value,action}=selection, current=await readIdentityPolicy(db,project);
 const secret=await db.prepare('SELECT key FROM project_identity_keys WHERE project=?').bind(project).first<{key:string}>();
 const digest=secret?await identityHash(secret.key,value):null;
 // Session DID uses the very same project HMAC. A literal equality can be
 // matched, but there is no inferred relationship between different DID/email
 // aliases, or between anonymous aggregates and a person.
 const predicate=matches(field);
 const query=db.prepare(`SELECT
  (SELECT COUNT(*) FROM events WHERE project=?) retained,
  (SELECT COUNT(*) FROM event_identities WHERE project=? AND json_extract(payload,'$.${field}.mode') IN ('keep','hash')) correlatable,
  (SELECT COUNT(*) FROM (${predicate})) matched,
  (SELECT COUNT(*) FROM health_sessions WHERE project=? AND user_hash=?) sessions,
  (SELECT COUNT(*) FROM health_sessions WHERE project=?) sessionRetained,
  (SELECT COUNT(*) FROM feedback WHERE project=? AND event_id IN (${predicate})) feedback,
  (SELECT COUNT(*) FROM event_grouping WHERE project=? AND event IN (${predicate})) grouping,
  (SELECT COUNT(*) FROM event_suppressions WHERE project=? AND event IN (${predicate})) suppressions`)
 .bind(project,project,project,digest,project,digest,project,project,project,digest,project,project,digest,project,project,digest);
 const search=await erasureSearchPlan(db,project,predicate,digest,value,secret?.key??null,action==='delete_events');
 const counts=(await query.first()) as {retained:number;correlatable:number;matched:number;sessions:number;sessionRetained:number;feedback:number;grouping:number;suppressions:number};
 const unavailable=current.policy[field]==='drop'?'This field is dropped by the current policy; discarded identities cannot be recovered.':!secret?'No retained project identity key is available.':null;
 const fence=await db.prepare('SELECT source_identity,epoch,import_job FROM rer_portability_state WHERE id=1').first<{source_identity:string;epoch:number;import_job:string|null}>();
 const copies=await db.prepare(inventory).first<{inventory:string}>();
 const hold=await db.prepare("SELECT 1 FROM rer_erasure_operations WHERE phase<>'complete' LIMIT 1").first()?'Another erasure is still running.':
  !(await db.prepare(`SELECT ${noImportCustody} AS clear`).first<{clear:number}>())!.clear?'Shared import custody cannot be selectively erased by this door.':null;
 const planHash=await hash(canonical([project,field,digest,action,current.revision,counts,search.fingerprint,fence?.source_identity??null,fence?.epoch??0,copies?.inventory??null,hold]));
 const retained=[...endUserExceptions,
  {table:'captured_text',reason:`${search.ambiguousEvents} event records contain only ambiguous partial-token copies; ${search.groupingHeld} event records contain matching content that cannot be redacted without changing immutable grouping provenance. Those copies stay. Unknown aliases, encoded text, exception/stack/context copies and independent derived snapshots cannot be fully correlated by this door.`},
  {table:'health_sessions',reason:'Only session DID hashes equal to the supplied value are matched. Different aliases and anonymous session aggregates cannot be correlated.'},
  {table:'external_copies',reason:'Downloaded archives, delivered messages, provider backups and future incoming captures are outside this installation. A fresh destination needs the later archive as its trusted erasure journal.'},
 ];
 return {current,secret,digest,counts,search,fence,copies:copies?.inventory??null,predicate,query,public:{version:1,operation:'preview_only',planHash,action,hold,
  events:{status:unavailable?'unavailable':'available',count:unavailable?null:counts.matched,retained:counts.retained,
   withoutRetainedEmail:counts.retained-counts.correlatable,withoutRetainedIdentity:counts.retained-counts.correlatable,
   explanation:unavailable??'Exact retained identity matches only. All four identity fields on matching events are removed; events without this field cannot be correlated.'},
  sessions:{status:unavailable?'unavailable':'available',count:unavailable?null:counts.sessions,retained:counts.sessionRetained,
   explanation:'Exact session DID equality only; other aliases and anonymous session aggregates cannot be attributed.'},
  search:{status:unavailable?'unavailable':'available',count:unavailable?null:search.count,explanation:'Exact retained identity copies in project event tags. Ordinary search/facets read those payloads; identity search/facets read the identity projection cleared by this operation.'},
  capturedText:{status:unavailable?'unavailable':'available',count:unavailable?null:search.textEvents,issueTitles:search.issueChanges.length,alertTitles:search.alertChanges.length,ambiguousEvents:search.ambiguousEvents,groupingHeld:search.groupingHeld,explanation:'Whole-token copies in messages, tags and breadcrumbs and captured issue/alert titles are removed where grouping stays valid. Partial identifiers, grouping-sensitive content and unsupported copies remain explicitly listed.'},
  feedback:{status:action==='delete_events'?'attached_records_only':'unavailable',count:action==='delete_events'?counts.feedback:null},
  unavailable:endUserExceptions.map(({table,reason})=>({store:table,reason})),retained}};
}

/** All selected native rows, transfer invalidation, the ERASE-001 receipt and
 * its existing portability redaction checkpoint commit in one owner batch.
 * No value or digest is persisted as a subject, even temporarily. */
export async function endUserStatements(db: D1Database, project: string, selection: EndUserSelection, plan: Awaited<ReturnType<typeof endUserPlan>>) {
 const transfer=await portability(db), before=await state(db), id=crypto.randomUUID().replaceAll('-',''),now=new Date().toISOString();
 const {counts,predicate,digest}=plan, deleting=selection.action==='delete_events';
 const deleted={event_identities:counts.matched,health_sessions:counts.sessions,search_tags:plan.search.count,captured_text_events:plan.search.textEvents,issue_titles:plan.search.issueChanges.length,alert_titles:plan.search.alertChanges.length,...deleting?{events:counts.matched,feedback:counts.feedback,event_grouping:counts.grouping,event_suppressions:counts.suppressions}:{}};
 return {id,statements:[
  identityPolicyFence(db,project,plan.current.revision),
  guard(db,'EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND source_identity=? AND epoch=? AND import_job IS NULL)',before.source_identity,plan.fence?.epoch??0),
  guard(db,`(${inventory}) IS ?`,plan.copies),
  guard(db,`NOT EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase<>'complete') AND ${noImportCustody}`),
  guard(db,'EXISTS(SELECT 1 FROM project_identity_keys WHERE project=? AND key=?)',project,plan.secret!.key),
  // Re-run the exact preview counts in the committing transaction. Intake,
  // conversion, retention and another erasure cannot silently change the plan.
  guard(db,`(SELECT COUNT(*) FROM events WHERE project=?)=? AND (SELECT COUNT(*) FROM (${predicate}))=? AND (SELECT COUNT(*) FROM health_sessions WHERE project=? AND user_hash=?)=? AND (SELECT COUNT(*) FROM feedback WHERE project=? AND event_id IN (${predicate}))=?`,project,counts.retained,project,digest,counts.matched,project,digest,counts.sessions,project,project,digest,counts.feedback),
  ...await transfer.invalidateTransfersStatements(),
  ...await transfer.redactionStatements(),
  ...erasureAlertStatements(db,project,plan.search.alertChanges),
  db.prepare('UPDATE health_sessions SET user_hash=NULL WHERE project=? AND user_hash=?').bind(project,digest),
  ...deleting?[
   db.prepare(`DELETE FROM sentry_import_targets WHERE kind='event' AND id IN (SELECT json_array(?,event) FROM (${predicate}))`).bind(project,project,digest),
   // FK cascades remove exact occurrence identities, grouping, suppressions and
   // attached feedback; the checkpoint fences every pre-erasure archive.
   db.prepare(`WITH victims AS MATERIALIZED (${predicate}) UPDATE issues
    SET count=(SELECT COUNT(*) FROM events WHERE project=issues.project AND issue=issues.id AND id NOT IN (SELECT event FROM victims)),
    title=COALESCE((SELECT json_extract(payload,'$.type')||': '||json_extract(payload,'$.message') FROM events WHERE project=issues.project AND issue=issues.id AND id NOT IN (SELECT event FROM victims) ORDER BY received,id LIMIT 1),'[no retained events]'),revision=revision+1
    WHERE project=? AND id IN (SELECT issue FROM events WHERE project=? AND id IN (SELECT event FROM victims))`).bind(project,digest,project,project),
   db.prepare(`DELETE FROM events WHERE project=? AND id IN (${predicate})`).bind(project,project,digest),
  ]:[...erasureSearchStatements(db,project,plan.search.changes),...erasureIssueStatements(db,project,plan.search.issueChanges),db.prepare(`UPDATE event_identities SET payload='{}',user_key=NULL,reason='sdk_sent_no_permitted_identity' WHERE project=? AND event IN (${predicate})`).bind(project,project,digest)],
  guard(db,`NOT EXISTS(SELECT 1 FROM (${predicate})) AND NOT EXISTS(SELECT 1 FROM health_sessions WHERE project=? AND user_hash=?)`,project,digest,project,digest),
  db.prepare(`INSERT INTO rer_erasure_operations(id,entity,subject,label,phase,step,planned,deleted,retained,requested_at,committed_at,completed_at)
   VALUES(?,'end-user',NULL,?,'complete',1,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))`).bind(id,'erased:'+crypto.randomUUID().replaceAll('-',''),JSON.stringify(deleted),JSON.stringify(deleted),JSON.stringify(plan.public.retained),now,now),
  await erasureCompletionFact(db),db.prepare('DELETE FROM rer_portability_guard'),
 ]};
}
export async function endUserReceipt(db: D1Database,id: string) { return receiptView(await receipt(db,id)); }
