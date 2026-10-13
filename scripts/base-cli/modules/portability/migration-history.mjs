import { DatabaseSync } from 'node:sqlite';
import { policy, schemaIdentity } from './catalogue.mjs';

// Replays a chosen set of the destination's migrations, in its applied order,
// into a scratch database and returns the resulting archive schema identity.
// Node runners only: restore uses it to place an older archive within the
// destination's history (see bridge.mjs). plan: [{name,statements}].
export function migrationReplay(plan,input) {
  const config=policy(input);
  return {names:plan.map(migration=>migration.name),statements:name=>plan.find(m=>m.name===name).statements,async schemaAfter(names) {
    const scratch=new DatabaseSync(':memory:');
    const db={prepare:sql=>{const query=scratch.prepare(sql);let values=[];return {bind(...args){values=args;return this;},async all(){return {results:query.all(...values)};}};}};
    try {
      for(const migration of plan.filter(m=>names.includes(m.name)))for(const sql of migration.statements)scratch.exec(sql);
      return await schemaIdentity(db,config);
    }finally{scratch.close();}
  }};
}
