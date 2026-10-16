import { RPC_LIMIT, rpcSize, rpcSizeBytes } from '../d1-transport/index.mjs';
import { canonicalJson } from './hash.mjs';
import { statement, save, readPart, insist } from './storage.mjs';
import { checkPart } from './format.mjs';

const combine=(a,b)=>({utf8:a.utf8+b.utf8-2,units:a.units+b.units-2,hasWide:a.hasWide||b.hasWide});
const guardSql=`INSERT INTO rer_portability_guard(value) SELECT CASE WHEN (
  EXISTS(SELECT 1 FROM rer_portability_jobs WHERE id=? AND phase='staging' AND completed=? AND metadata=?)
  AND (SELECT import_job FROM rer_portability_state WHERE id=1)=?
) THEN 1 ELSE 0 END`;

// Rows and the archived JSON share the same durable cursor. Each checkpoint
// commits with its writes; retries cannot duplicate rows, even after a lost ACK.
// Product tables remain untouched until finalizeImport's atomic publication.
export async function stagePart(context,row,part,queries,stagedCounts) {
  const {db,config}=context;
  const pending=row.metadata.pendingPart;
  insist(!pending || (pending.index===part.index && pending.sha256===part.sha256),'part_conflict',409);
  let next=pending?.next??0;
  while(next<queries.length) {
    const before=canonicalJson(row.metadata),chunk=[];
    // Reserve the largest cursor for this part before admitting any data.
    row.metadata.pendingPart={index:part.index,sha256:part.sha256,next:queries.length};
    const guard={sql:guardSql,params:[row.id,row.completed,before,row.id]};
    const checkpoint={sql:'UPDATE rer_portability_jobs SET phase=?,completed=?,metadata=? WHERE id=?',params:[row.phase,row.completed,canonicalJson(row.metadata),row.id]};
    let size=rpcSize([guard,checkpoint,{sql:'DELETE FROM rer_portability_guard'}]),end=next;
    for(;end<queries.length;end++) {
      const candidate=combine(size,rpcSize([queries[end]]));
      if(rpcSizeBytes(candidate)>RPC_LIMIT)break;
      size=candidate;chunk.push(queries[end]);
    }
    insist(end>next,'D1_RPC_TRANSPORT_LIMIT',413);
    row.metadata.pendingPart.next=end;
    await db.batch([statement(db,guard.sql,...guard.params),...chunk.map(q=>statement(db,q.sql,...q.params)),save(db,row),db.prepare('DELETE FROM rer_portability_guard')]);
    next=end;
  }
  // Authenticate the reassembled stored bytes before acknowledging the part.
  const stored=await readPart(db,row.id,part.index);
  await checkPart(stored,part.index,config.partBytes);insist(stored.sha256===part.sha256,'part_checksum');
  const before=canonicalJson(row.metadata),completed=row.completed;
  delete row.metadata.pendingPart;row.metadata.stagedCounts=stagedCounts;row.completed++;
  await db.batch([statement(db,guardSql,row.id,completed,before,row.id),
    statement(db,'INSERT INTO rer_portability_parts VALUES(?,?,?)',row.id,part.index,part.sha256),
    save(db,row),db.prepare('DELETE FROM rer_portability_guard')]);
}
