import { defineErasure, ErasureError } from '../../modules/erasure/index.mjs';
import { capturePlan, captureStatements, ownerIdentifiers, ownerCaptureColumns, sqlQuote } from './owner-capture';
import { portability } from '../portability';
import { importCustodyRoots, unsupportedOwnerSurface } from './owner-scope';
import { erasureCompletionFact } from './audit-fact';

const child = (table: string, column = 'operator_id') => ({table,from:'oa_operators',on:{[column]:'id'}});
const sessionChild = (table: string) => ({table,from:'oa_sessions',on:{session_id:'id'}});
export const ownerExceptions = [
 'Exact known self identifiers are removed from supported native text and JSON values where they stand as whole tokens; one found only inside a longer word or address causes a hold. Unknown aliases and future captures are outside this operation.',
 'Project ingest keys keep working; only their record of who minted them is cleared. Agent and deploy keys minted by the owner are deleted.',
 'Structural identifiers and shared import custody cause a refusal; no co-located records are discarded to hide those limits.',
 'Installation claim markers remain retired and cannot bootstrap another owner. The verified successor becomes the sole owner.',
 'Downloaded archives, delivered mail, provider records, configuration secrets, D1 Time Travel and external backups must be removed separately.',
 'An empty installation needs the later erasure journal to reject an older archive. Raw database imports bypass product fences.',
];
const guard = (db: D1Database, sql: string, ...values: any[]) => db.prepare(`INSERT INTO rer_erasure_guard(value,scope) SELECT 1,CASE WHEN (${sql}) THEN 1 ELSE 0 END`).bind(...values);

export async function ownerDeclaration(db: D1Database) {
 const columns=(await db.prepare('PRAGMA table_info(credentials)').all()).results as any[];
 const attributed=columns.some(column=>column.name==='minted_by');
 return defineErasure({entity:'installation-owner',root:{table:'oa_operators'},
 edges:[
  child('issue_comments'),child('issue_subscriptions'),
  child('spool_members'),
  {table:'spool_team_digest_settings',from:'spool_members',on:{member:'id'}},
  {table:'spool_team_snoozes',from:'spool_members',on:{creator:'id'}},
  {table:'spool_team_mail',from:'spool_members',on:{member:'id'}},
  {table:'spool_follow_up_alternates',from:'spool_members',on:{member:'id'}},
  {table:'spool_project_grants',from:'spool_members',on:{member:'id'}},
  {table:'spool_member_invites',from:'spool_members',on:{member:'id'}},
  child('spool_service_accounts','sponsor'),
  {table:'spool_service_scopes',from:'spool_service_accounts',on:{service:'id'}},
  {table:'credentials',from:'spool_service_accounts',where:'hash IN (SELECT hash FROM spool_service_credentials WHERE service=?)',params:['id']},
  {table:'spool_service_credentials',from:'spool_service_accounts',on:{service:'id'}},
  {table:'spool_service_credentials',from:'credentials',on:{hash:'hash'}},
  child('suspect_decisions'),...['source_map_builds','source_map_build_files'].map(table=>({table,from:'oa_operators',where:'? IS NOT NULL',params:['id']})),{table:'artifact_storage_settings',from:'oa_operators',where:'? IS NOT NULL',params:['id']},...['retention_runs','review_stamps','review_views','retention_policies','identity_policies','event_identities','project_identity_keys','health_sessions','health_aggregates','slack_destinations','slack_delivery_meta','alert_provider_events','rer_mail_event_receipts','rer_mail_event_states','alert_scheduled_mail','alert_digest_settings','alert_snoozes','alert_suppressed','alert_destination_tests'].map(table=>({table,from:'oa_operators',where:'? IS NOT NULL',params:['id']})),{table:'grouping_proposals',from:'oa_operators',where:'? IS NOT NULL',params:['id']},child('audit_actor_links','owner_id'),{table:'deployment_actors',from:'oa_operators',where:'? IS NOT NULL',params:['id']},child('oa_tokens'),child('oa_tokens','issuer_id'),child('oa_sessions'),
  {table:'oa_sessions',from:'oa_tokens',on:{source_token_id:'id'}},
  ...['oa_owner_signins','oa_external_identities','oa_invitation_cancellations','oa_step_up_challenges','oa_credentials'].map(table => child(table)),
  ...['oa_provider_sessions','oa_provider_session_pins'].map(sessionChild),
  child('oa_setup_links','owner_id'),child('rer_dependency_pending','approved_by'),child('spool_owner_successor','owner_id'),
  {table:'oa_limits',from:'spool_owner_successor',where:'key IN (SELECT value FROM json_each(?))',params:['rate_keys']},
  // Agent and deploy keys are personal; ingest keys are project rows that keep every deployed SDK reporting.
  {table:'credentials',from:'oa_operators',where:attributed?"kind IN ('agent','deploy') AND (minted_by=? OR minted_by IS NULL)":"kind IN ('agent','deploy') AND ? IS NOT NULL",params:['id']},
  {table:'oa_dev_credentials',from:'credentials',where:"credential='credentials' AND id=?",params:['hash']},
  {table:'sessions',from:'oa_operators',where:'? IS NOT NULL',params:['id']},
  {table:'oa_dev_credentials',from:'oa_tokens',where:"credential='oa_tokens' AND id=?",params:['id']},
  {table:'rer_mail_development_outbox',from:'oa_tokens',where:"json_valid(message) AND json_extract(message,'$.deliveryId')=?",params:['id']},
  {table:'rer_mail_development_outbox',from:'oa_step_up_challenges',where:"json_valid(message) AND json_extract(message,'$.deliveryId')=?",params:['id']},
 ],
 redact:[
  {table:'spool_reporting_items',from:'oa_operators',on:{author:'id'},set:{author:null},reason:'Reporting definitions remain with their author displayed as [erased].'},
  {table:'oa_bootstrap',from:'oa_operators',on:{claim_id:'id'},set:{claim_id:'retired-owner-claim'},reason:'Claimed installation marker remains without the former identity.'},
  {table:'oc_owner_claims',from:'oa_operators',on:{operator_id:'id'},set:{email:'',operator_id:'',session_id:'',jti:'retired-owner-claim'},reason:'Managed claim is irreversibly retired; initialization never reopens.'},
 ],
 audit:[{table:'oa_auth_audit',column:'actor_id',of:'oa_operators',clear:{value:''}}],
 retain:[{table:'key_rate_limits',reason:'Project capture key limits remain without personal attribution, as the ingest keys do.'},{table:'key_rate_usage',reason:'Bounded project key counters remain so erasing a person cannot reset capture limits.'},{table:'restored_work',reason:'Destination custody keeps only project and work identifiers, with no person attribution; retaining it prevents historical authority from becoming live after owner erasure.'},{table:'issue_activity',reason:'Project history retains safe actor aliases; personal text is covered by capture redaction.'},{table:'spool_audit_events',reason:'Permanent safe facts remain under random labels; the former owner bindings are deleted.'},{table:'oa_domain_rules',reason:'Domain policy with personal creator attribution causes a hold until it can be transferred safely.'},
  {table:'oc_idp_grants',reason:'Provider claim uniqueness remains with personal claim values retired.'},
  {table:'rer_erasure_operations',reason:'Completed receipts contain only counts and times.'}],
 hold:async ({db,subject}: any) => {
  const competing = await db.prepare("SELECT 1 FROM rer_erasure_operations WHERE phase<>'complete' AND NOT(entity='installation-owner' AND json_extract(subject,'$.id')=?) LIMIT 1").bind(subject.id).first();
  if(competing)return 'erasure_in_progress';
  if(await db.prepare('SELECT 1 FROM oa_domain_rules WHERE created_by=?').bind(subject.id).first())return 'domain_creator_attribution';
  if(await db.prepare('SELECT 1 FROM oa_tokens WHERE issuer_id=? AND operator_id<>? AND operator_id NOT IN (SELECT successor_id FROM spool_owner_successor WHERE owner_id=?) AND NOT EXISTS(SELECT 1 FROM spool_members m JOIN oa_operators recipient ON recipient.id=oa_tokens.operator_id WHERE m.operator_id=recipient.id OR (m.operator_id IS NULL AND m.email=recipient.email))').bind(subject.id,subject.id,subject.id).first())return 'shared_invitation_provenance';
  const successor = await db.prepare(`SELECT 1 FROM spool_owner_successor x JOIN oa_operators o ON o.id=x.successor_id WHERE x.owner_id=? AND o.role='member' AND o.status='active' AND EXISTS(SELECT 1 FROM oa_sessions s WHERE s.operator_id=o.id AND s.kind='native' AND s.revoked_at IS NULL AND s.expires_at>? AND s.operator_version=o.version)`).bind(subject.id,Date.now()).first();
  return successor ? null : 'verified_successor_required';
 },
 beforeStatements:async ({db,subject}: any) => {
  const intent = await db.prepare('SELECT * FROM spool_owner_successor WHERE owner_id=?').bind(subject.id).first();
  if(!intent?.capture_hash)throw new ErasureError('confirmation_required',409);
  const needles=await ownerIdentifiers(db,subject.id), captured=await capturePlan(db,needles);
  if(captured.hold || captured.hash!==intent.capture_hash || await unsupportedOwnerSurface(db,needles))throw new ErasureError('plan_changed',409);
  const transfer=await portability(db);
  return [
   ...importCustodyRoots.map(table=>guard(db,`NOT EXISTS(SELECT 1 FROM ${sqlQuote(table)})`)),
   guard(db,`(SELECT count(*) FROM oa_operators WHERE role='owner' AND status='active')=1 AND EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND o.id=? AND o.role='owner' AND o.status='active' AND o.version=? AND s.operator_version=o.version AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))`,intent.session_id,subject.id,intent.owner_version),
   guard(db,`EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.version=? AND o.status='active' AND o.role='member' AND EXISTS(SELECT 1 FROM oa_sessions s WHERE s.id=? AND s.operator_id=o.id AND s.kind='native' AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND s.operator_version=o.version))`,intent.successor_id,intent.successor_version,intent.successor_session),
   ...captureStatements(db,captured.changes),...await transfer.redactionStatements(),
   db.prepare("UPDATE credentials SET minted_by=NULL,minted_version=NULL WHERE kind='ingest' AND minted_by=?").bind(subject.id),
   db.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(intent.successor_id),
   db.prepare("UPDATE oa_operators SET role='member',status='inactive' WHERE id=?").bind(subject.id),
   db.prepare(`UPDATE oc_idp_grants SET subject='',jti=lower(hex(randomblob(16))),sector_id='' WHERE EXISTS(SELECT 1 FROM oa_external_identities e WHERE e.operator_id=? AND e.issuer=oc_idp_grants.issuer AND e.subject=oc_idp_grants.subject)`).bind(subject.id),
  ];
 },
 statements:async ({db,subject}: any) => {
  const needles=await ownerIdentifiers(db,subject.id);
  // Also test JSON-decoded leaves: escaped Unicode must not evade completion. Under the plan's token rule every
  // whole-token occurrence is redacted and any other occurrence holds the plan, so none may remain at all.
  return [await erasureCompletionFact(db),...importCustodyRoots.map(table=>guard(db,`NOT EXISTS(SELECT 1 FROM ${sqlQuote(table)})`)),...Object.entries(ownerCaptureColumns).flatMap(([table,columns])=>columns.map(column=>guard(db,
   `NOT EXISTS(SELECT 1 FROM ${sqlQuote(table)} r WHERE EXISTS(SELECT 1 FROM json_each(?) n WHERE instr(CAST(r.${sqlQuote(column)} AS TEXT),n.value)>0 OR EXISTS(SELECT 1 FROM json_tree(CASE WHEN json_valid(r.${sqlQuote(column)}) THEN r.${sqlQuote(column)} ELSE 'null' END) j WHERE typeof(j.atom)='text' AND instr(j.atom,n.value)>0)))`,JSON.stringify(needles))))];
 },
 });
}
