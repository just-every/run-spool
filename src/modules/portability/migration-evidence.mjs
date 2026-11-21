import { sha256 } from './hash.mjs';
import { quote } from './storage.mjs';
import { dataStatement, triggerBodies } from './migration-statements.mjs';
import { sqliteTokens } from './sqlite-tokens.mjs';

// Date functions can default to 'now', so even fixed arguments are
// conservatively excluded from seeded-row evidence.
const variable = sql => /\b(?:random|randomblob|date|time|datetime|julianday|strftime|unixepoch|sqlite_version|sqlite_source_id)\s*\(|\bcurrent_(?:date|time|timestamp)\b/i
 .test(sqliteTokens(sql).map(token => token.value).join(' '));

export function migrationRecorder(scratch) {
 const unstable = new Set(), applied = [];
 return {
  apply(file) {
   for (const sql of file.statements) {
    const data = dataStatement(sql);
    if (data) {
     const writers = new Set([data.target]);
     for (const name of writers) for (const target of triggerBodies(applied, name)) writers.add(target);
     const definitions = scratch.all('SELECT name,sql FROM sqlite_master WHERE sql IS NOT NULL');
     if (variable(sql) || data.names.some(name => unstable.has(name))
       || definitions.some(row => writers.has(row.name.toLowerCase()) && variable(row.sql))
       || applied.some(statement => variable(statement) && triggerBodies([statement], data.target).some(name => writers.has(name)))) {
      for (const name of writers) unstable.add(name);
     }
    }
    scratch.exec(sql);
    applied.push(sql);
   }
  },
  inventory() {
   const objects = scratch.all("SELECT name,sql,type,tbl_name FROM sqlite_master WHERE sql IS NOT NULL AND substr(lower(name),1,7)<>'sqlite_' AND substr(lower(name),1,4)<>'_cf_' ORDER BY name,type");
   const kinds = scratch.all('PRAGMA table_list').filter(table => table.type === 'shadow').map(({ name, type }) => ({ name, type }));
   return { objects, kinds };
  },
  async seeds(objects) {
   const seeds = [];
   for (const { name } of objects.filter(object => object.type === 'table')) {
    const columns = scratch.all(`PRAGMA table_info(${quote(name)})`).map(column => column.name);
    const rows = scratch.all(`SELECT json_array(${columns.map(column => `quote(${quote(column)})`).join(',')}) image FROM ${quote(name)} LIMIT 10001`);
    if (rows.length > 10000 || unstable.has(name.toLowerCase()) && rows.length) continue;
    seeds.push({ name, columns, hashes: (await Promise.all(rows.map(row => sha256(row.image)))).sort() });
   }
   return seeds;
  },
 };
}
