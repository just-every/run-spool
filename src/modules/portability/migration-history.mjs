import { policy, schemaIdentity } from './catalogue.mjs';

// Replays a chosen set of the destination's migrations, in its applied order,
// into a scratch database and returns the resulting archive schema identity.
// Node runners only: restore uses it to place an older archive within the
// destination's history (see bridge.mjs). plan: [{name,statements,sha256?}],
// sha256 being the migration file's hash where the runner read the file.
export function migrationReplay(plan,input,{dataOnly=[]}={}) {
  const config=policy(input),sqlite='node:sqlite';
  return {names:plan.map(migration=>migration.name),dataOnly,aliases:name=>plan.find(m=>m.name===name).aliases,statements:name=>plan.find(m=>m.name===name).statements,sha256:name=>plan.find(m=>m.name===name).sha256,async schemaAfter(names,options) {
    const {DatabaseSync}=await import(sqlite);
    const scratch=new DatabaseSync(':memory:');
    const db={prepare:sql=>{const query=scratch.prepare(sql);let values=[];return {bind(...args){values=args;return this;},async all(){return {results:query.all(...values)};}};}};
    try {
      for(const migration of plan.filter(m=>names.includes(m.name)))for(const sql of migration.statements)scratch.exec(sql);
      return await schemaIdentity(db,config,options);
    }finally{scratch.close();}
  },
  // The rows the whole replay leaves in each requested table, as sorted images (legacy-safety.mjs).
  // A table the replay lacks, or one holding more than `limit` rows, has no entry.
  async rowImages(requests,limit) {
    const {DatabaseSync}=await import(sqlite);
    const scratch=new DatabaseSync(':memory:'),found=new Map();
    try {
      for(const migration of plan)for(const sql of migration.statements)scratch.exec(sql);
      for(const {name,columns} of requests) {
        try {
          const rows=scratch.prepare(`SELECT json_array(${columns.map(c=>`quote("${c.replaceAll('"','""')}")`).join(',')}) AS image FROM "${name.replaceAll('"','""')}" LIMIT ?`).all(limit+1).map(r=>r.image);
          if(rows.length<=limit)found.set(name,rows.sort());
        }catch{}
      }
      return found;
    }finally{scratch.close();}
  }};
}
