import { statement, guard, job, PortabilityError } from './storage.mjs';

// Inactivity, not total restore time: the measured 20k-row round trip takes
// 171s (README). Finalize also awaits unbounded product hooks and multipart R2
// work, so the owning request renews every 30s throughout those awaits.
export const IMPORT_LEASE_MS=5*60*1000;
const RENEW_MS=30*1000;
const active=row=>['staging','applying'].includes(row.phase);
const runningMetadata=new WeakMap();
// Only the lease constructor can approve these details. Mutable Error fields,
// prototypes and diagnostic code suffixes cannot establish that provenance.
export const importRunningMetadata=(error,actor)=>{
  const running=runningMetadata.get(error);
  return typeof actor==='string' && actor===running?.actor?running.details:undefined;
};

// Private transfer bookkeeping can be added to already-installed destinations
// without changing product migrations or the archive's schema identity. Keep
// it separate from metadata: staging/normalization compare that JSON by CAS.
export async function ensureImportLeases(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS rer_portability_import_leases (
    job TEXT PRIMARY KEY REFERENCES rer_portability_jobs(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL, holder TEXT
  )`).run();
  // An import left by an older runtime gets one conservative grace period.
  await statement(db,`INSERT OR IGNORE INTO rer_portability_import_leases(job,expires_at)
    SELECT j.id,? FROM rer_portability_jobs j JOIN rer_portability_state s ON s.import_job=j.id
    WHERE j.kind='import' AND j.phase IN ('staging','applying')`,Date.now()+IMPORT_LEASE_MS).run();
}
export const createImportLease=(db,id)=>statement(db,'INSERT INTO rer_portability_import_leases(job,expires_at) VALUES(?,?)',id,Date.now()+IMPORT_LEASE_MS);
const leaseRow=(db,id)=>statement(db,'SELECT * FROM rer_portability_import_leases WHERE job=?',id).first();
export async function importLeaseStatus(db,row) {
  const lease=await leaseRow(db,row.id);
  return {abortableAt:active(row)&&lease?new Date(lease.expires_at).toISOString():null,stale:active(row)&&!!lease&&lease.expires_at<=Date.now()};
}
export async function importRunning(db,id) {
  const error=new PortabilityError('import_running',409),row=await job(db,id,'import');
  error.jobId=id;error.abortableAt=(await importLeaseStatus(db,row)).abortableAt;
  if(typeof id==='string' && id.length>0 && id.length<=100 && !/[^a-zA-Z0-9-]/.test(id)
    && (error.abortableAt===null || typeof error.abortableAt==='string' && Number.isFinite(Date.parse(error.abortableAt))
      && new Date(error.abortableAt).toISOString()===error.abortableAt))
    runningMetadata.set(error,Object.freeze({actor:row.actor,details:Object.freeze({jobId:id,abortableAt:error.abortableAt})}));
  return error;
}

// Upload, finalize and abort each claim one request. Renewal and takeover are
// conditional writes on that claim; an expired request cannot revive itself.
// Every mutating D1 batch is fenced by the same claim, including publication.
export async function withImportLease(context,id,operation,{abort=false,staleOnly=false,soleOperator=false}={}) {
  const db=context.db,holder=crypto.randomUUID(),now=Date.now(),lease=await leaseRow(db,id);
  if(!lease)throw new PortabilityError('import_lease_expired',409);
  if(staleOnly && lease.expires_at>now)throw await importRunning(db,id);
  if(!abort && lease.expires_at<=now)throw new PortabilityError('import_lease_expired',409);
  if(!soleOperator && lease.holder && lease.expires_at>now)throw await importRunning(db,id);
  // Like staging/publication, claim by a transactional SQL guard. Transport
  // adapters need not expose provider-specific UPDATE result metadata.
  try {
    await db.batch([guard(db,`EXISTS(SELECT 1 FROM rer_portability_import_leases WHERE job=? AND expires_at=? AND holder IS ?)
      AND EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job=?)`,id,lease.expires_at,lease.holder,id),
      statement(db,'UPDATE rer_portability_import_leases SET holder=?,expires_at=? WHERE job=?',holder,now+IMPORT_LEASE_MS,id),
      db.prepare('DELETE FROM rer_portability_guard')]);
  }catch(error){
    const current=await leaseRow(db,id);
    if(current?.holder!==lease.holder || current?.expires_at!==lease.expires_at)throw await importRunning(db,id);
    throw error;
  }
  let stopped=false,timer,pending=Promise.resolve(),failure;
  const owned=async()=>{
    const current=await leaseRow(db,id);
    return current?.holder===holder && current.expires_at>Date.now();
  };
  const renew=async()=>{
    const at=Date.now();
    try {
      await db.batch([guard(db,'EXISTS(SELECT 1 FROM rer_portability_import_leases WHERE job=? AND holder=? AND expires_at>?)',id,holder,at),
        statement(db,'UPDATE rer_portability_import_leases SET expires_at=? WHERE job=?',at+IMPORT_LEASE_MS,id),
        db.prepare('DELETE FROM rer_portability_guard')]);
    }catch(error){if(!await owned())throw new PortabilityError('import_lease_expired',409);throw error;}
  };
  const schedule=()=>{
    timer=setTimeout(()=>{
      pending=renew().catch(error=>{failure=error;}).finally(()=>{if(!stopped && !failure)schedule();});
      return pending;
    },RENEW_MS);
  };
  const fence=()=>guard(db,`EXISTS(SELECT 1 FROM rer_portability_import_leases l
    JOIN rer_portability_state s ON s.import_job=l.job WHERE s.id=1 AND l.job=? AND l.holder=? AND l.expires_at>?)`,id,holder,Date.now());
  const native=new WeakMap();
  const batch=async statements=>{
    if(failure)throw failure;
    try {
      const result=await db.batch([fence(),...statements.map(s=>native.get(s)??s),db.prepare('DELETE FROM rer_portability_guard')]);
      return result.slice(1,-1);
    }catch(error){if(!await owned())throw new PortabilityError('import_lease_expired',409);throw error;}
  };
  const prepare=sql=>{
    const wrap=raw=>{const wrapped=new Proxy(raw,{get(target,key){
      if(key==='bind')return (...values)=>wrap(target.bind(...values));
      if(key==='run')return async()=> (await batch([target]))[0];
      const value=target[key];return typeof value==='function'?value.bind(target):value;
    }});native.set(wrapped,raw);return wrapped;};
    return wrap(db.prepare(sql));
  };
  schedule();
  try{return await operation({...context,db:{prepare,batch},importLease:{owned}});}
  finally {
    stopped=true;clearTimeout(timer);await pending;
    await statement(db,'UPDATE rer_portability_import_leases SET holder=NULL WHERE job=? AND holder=?',id,holder).run();
  }
}
