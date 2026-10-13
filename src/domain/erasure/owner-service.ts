import { createErasure, ErasureError } from '../../modules/erasure/index.mjs';
import { portability } from '../portability';
import { canonical, hash } from '../privacy';
import { ownerDeclaration, ownerExceptions } from './owner-declaration';
import { capturePlan, ownerIdentifiers } from './owner-capture';
import { unsupportedOwnerSurface } from './owner-scope';
import { recoverableOwnerErasure } from './owner-operation';
export function ownerHoldMessage(code: string | null) {
 if(!code)return null;
 const messages: Record<string,string> = {
  verified_successor_required:'Invite a successor and have them complete ordinary email sign-in before erasing your personal data.',
  shared_import_custody:'Shared import originals and immutable importer attribution cannot yet be selectively erased without removing other people’s data. Nothing was erased.',
  credential_authority_migration_required:'Apply the credential authority migration before owner erasure.',
  ambiguous_display_name:'The same captured name belongs to another operator; selective erasure needs unambiguous attribution.',
  identifier_inside_longer_token:'Captured text contains your name, email or ID only inside a longer word or address, which may be someone else’s. Nothing was erased.',
  shared_invitation_provenance:'Other people still have invitation provenance tied to this owner. Selective retirement is required before erasure.',
  domain_creator_attribution:'Domain policy retains this owner’s creator attribution. A supported policy transfer is required first.',
  plan_changed:'The data or successor authority changed. Read a fresh preview and confirm that plan.',
  erasure_in_progress:'Another erasure is still running. Finish it before starting this one.',
  step_up_required:'Complete a fresh email sign-in or the native step-up confirmation before this action.',
 };
 return messages[code] ?? 'Erasure was refused because this data cannot be safely changed under the confirmed plan.';
}

export async function ownerErasureService(db: D1Database) {
 return recoverableOwnerErasure(db,createErasure({db,portability:await portability(db),declarations:[await ownerDeclaration(db)]}));
}
export async function ownerPreview(db: D1Database,id: string) {
 const service=await ownerErasureService(db), native=await service.preview('installation-owner',{id});
 const needles=await ownerIdentifiers(db,id), captured=await capturePlan(db,needles);
 const owner=await db.prepare('SELECT display_name FROM oa_operators WHERE id=?').bind(id).first<any>();
 const ambiguous=!!await db.prepare('SELECT 1 FROM oa_operators WHERE id<>? AND display_name=?').bind(id,owner.display_name).first() && captured.changes.some(change=>Object.values(change.before).some(value=>typeof value==='string'&&value.includes(owner.display_name)));
 const intent=await db.prepare(`SELECT x.successor_id,x.owner_version,o.version AS successor_version,(SELECT s.id FROM oa_sessions s WHERE s.operator_id=o.id AND s.kind='native' AND s.operator_version=o.version AND s.revoked_at IS NULL AND s.expires_at>? ORDER BY s.created_at DESC,s.id LIMIT 1) AS successor_session FROM spool_owner_successor x JOIN oa_operators o ON o.id=x.successor_id WHERE x.owner_id=?`).bind(Date.now(),id).first<any>();
 const credentialColumns=(await db.prepare('PRAGMA table_info(credentials)').all<any>()).results;
 const extraHold=!credentialColumns.some(column=>column.name==='minted_by')?'credential_authority_migration_required':ambiguous?'ambiguous_display_name':captured.hold ?? await unsupportedOwnerSurface(db,needles);
 const planHash=await hash(canonical({native:native.planHash,capture:captured.hash,intent}));
 const hold=extraHold ?? native.hold;
 return {service,native,captured,needles,intent,public:{deleted:native.deleted,redacted:{...native.redacted,...captured.counts},retained:native.retained,exceptions:ownerExceptions,planHash,hold,message:ownerHoldMessage(hold)}};
}
export async function eraseOwner(db: D1Database,session: any,input: any,until: number) {
 const preview=await ownerPreview(db,session.operator.id);
 if(preview.public.planHash!==input.planHash)throw new ErasureError('plan_changed',409);
 if(preview.public.hold)throw new ErasureError('held:'+preview.public.hold,409);
 // Correlated email rate digests are removed; IP aggregates have no identity
 // association and remain. Persist the digest keys in the ordinary erasure
 // graph via a temporary correlation, never as raw email in a receipt.
 await db.batch([
  db.prepare(`INSERT INTO rer_erasure_guard(value,scope) SELECT 1,CASE WHEN EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND o.id=? AND o.role='owner' AND o.status='active' AND o.version=? AND s.operator_version=o.version AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) THEN 1 ELSE 0 END`).bind(session.id,session.operator.id,session.operator.version),
  db.prepare('UPDATE spool_owner_successor SET capture_hash=?,session_id=?,owner_version=?,successor_version=?,successor_session=? WHERE owner_id=?').bind(preview.captured.hash,session.id,session.operator.version,preview.intent.successor_version,preview.intent.successor_session,session.operator.id),
  db.prepare('DELETE FROM rer_erasure_guard'),
 ]);
 const opened=await preview.service.start('installation-owner',{id:session.operator.id},{planHash:preview.native.planHash});
 return preview.service.run(opened.id,{until,rows:500});
}
export function ownerReceipt(receipt: any) {
 const {id,phase,planned,deleted,retained,blobs,requestedAt,committedAt,completedAt,seconds}=receipt;
 return {id,phase,planned,deleted,retained,blobs,requestedAt,committedAt,completedAt,seconds,exceptions:ownerExceptions};
}
