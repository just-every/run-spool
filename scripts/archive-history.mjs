import {mkdtemp,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {policy,schemaIdentity} from '../src/modules/portability/catalogue.mjs';
const require=createRequire(import.meta.url),{unstable_splitSqlQuery}=require('wrangler');
const temporary=await mkdtemp(resolve(tmpdir(),'spool-archive-history-'));
const scratch=new DatabaseSync(':memory:'),independent=new DatabaseSync(':memory:');
const db={prepare(sql){const q=scratch.prepare(sql);let values=[];return {bind(...v){values=v;return this},async all(){return {results:q.all(...values)}}}}};
try{
 const entry=resolve(temporary,'policy.mjs');
 await build({entryPoints:['src/domain/portability.ts'],outfile:entry,bundle:true,platform:'node',format:'esm'});
 const {portabilityPolicy}=await import(pathToFileURL(entry));const config=policy(portabilityPolicy);
 const migrations=[],prefixes=[];
 async function capture(){
  const names=migrations.map(m=>m.name),seeds=[];
  for(const {name} of scratch.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()){
   const columns=scratch.prepare('SELECT name FROM pragma_table_info(?)').all(name).map(c=>c.name);
   const images=scratch.prepare(`SELECT json_array(${columns.map(c=>`quote("${c.replaceAll('"','""')}")`).join(',')}) AS image FROM "${name.replaceAll('"','""')}" LIMIT 10001`).all().map(r=>r.image).sort();
   const repeated=independent.prepare(`SELECT json_array(${columns.map(c=>`quote("${c.replaceAll('"','""')}")`).join(',')}) AS image FROM "${name.replaceAll('"','""')}" LIMIT 10001`).all().map(r=>r.image).sort();
   if(images.length&&images.length<=10000&&JSON.stringify(images)===JSON.stringify(repeated))seeds.push({name,columns,images});
  }
  prefixes.push({names,identity:await schemaIdentity(db,config),tablesOnly:await schemaIdentity(db,config,{tablesOnly:true}),legacyExcludedObjects:await schemaIdentity(db,config,{legacyExcludedObjects:true}),seeds});
 }
 await capture();
 for(const name of (await readdir('migrations/core')).filter(n=>/^\d+_.*\.sql$/.test(n)).sort()){
  const sql=await readFile(resolve('migrations/core',name),'utf8');const statements=unstable_splitSqlQuery(sql).filter(s=>!/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(s.trim()));
  for(const statement of statements){scratch.exec(statement);independent.exec(statement);}
  migrations.push({name,sha256:createHash('sha256').update(sql).digest('hex'),statements});await capture();
 }
 const output=JSON.stringify({migrations,prefixes},null,2)+'\n',path='src/domain/archive-history.json';
 if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==output)throw Error('Archive history is stale; run node scripts/archive-history.mjs');console.log('Archive migration replay matches every source prefix');}
 else {await writeFile(path,output);console.log(`Recorded ${migrations.length} migrations and ${prefixes.length} verified schema prefixes`);}
}finally{scratch.close();independent.close();await rm(temporary,{recursive:true,force:true});}
