import type { Erasure } from '../../modules/erasure/index.mjs';

// Base opens its receipt before its first atomic deletion batch. A refused
// first batch must not strand that receipt and the product's write freeze.
// The conditional DELETE competes with Base's atomic step guard: whichever
// commits first wins. Never discard a committed step, scope or blob work.
async function discardUncommitted(db: D1Database, id: string) {
 const operation=await db.prepare("SELECT subject FROM rer_erasure_operations WHERE id=? AND entity='installation-owner'").bind(id).first<{subject: string | null}>();
 if(!operation?.subject)return;
 const owner=JSON.parse(operation.subject).id;
 await db.batch([
  db.prepare(`DELETE FROM rer_erasure_operations WHERE id=? AND entity='installation-owner'
   AND phase='deleting' AND step=0 AND committed_at IS NULL AND completed_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM json_each(deleted)) AND blobs_deleted=0
   AND NOT EXISTS(SELECT 1 FROM rer_erasure_scope WHERE operation=?)
   AND NOT EXISTS(SELECT 1 FROM rer_erasure_blobs WHERE operation=?)`).bind(id,id,id),
  db.prepare(`UPDATE spool_owner_successor SET capture_hash=NULL,successor_version=NULL,successor_session=NULL
   WHERE owner_id=? AND changes()>0`).bind(owner),
 ]);
}

export function recoverableOwnerErasure(db: D1Database, service: Erasure): Erasure {
 return {...service,async run(id,options) {
  try {return await service.run(id,options);}
  catch(error) {await discardUncommitted(db,id);throw error;}
 }};
}
