import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {readArchive} from '../src/modules/portability/index.mjs';
const directory=await mkdtemp(resolve(tmpdir(),'spool-fixture-proof-'));
let runtime;
try{
 await build({entryPoints:['src/domain/portability.ts'],outfile:resolve(directory,'portability.mjs'),bundle:true,platform:'node',format:'esm'});
 const fixturePath=resolve('tests/repair-recovery/archive.mjs');
 await build({stdin:{contents:await readFile(fixturePath,'utf8')+'\nexport {beforeFeedbackReviewRelease,rebuiltArchive};\n',sourcefile:fixturePath,resolveDir:resolve('tests/repair-recovery')},outfile:resolve(directory,'fixture.mjs'),bundle:true,platform:'node',format:'esm',define:{'import.meta.url':JSON.stringify(pathToFileURL(fixturePath).href)}});
 const transfer=await import(pathToFileURL(resolve(directory,'portability.mjs')));
 const fixture=await import(pathToFileURL(resolve(directory,'fixture.mjs')));
 const require=createRequire(import.meta.url);
 const {Miniflare,convertV4MiniflareOptions,Log,LogLevel}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
 const {unstable_splitSqlQuery}=require('wrangler');
 runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {}',log:new Log(LogLevel.ERROR),d1Databases:{SOURCE:'source',TARGET:'target'}}));
 const migrations=JSON.parse(await readFile('management/integration/deployment-spec.json','utf8')).migrations;
 const old=[];for await(const row of readArchive(new Response(await readFile('tests/fixtures/archive-fc75a7ac.ndjson','utf8')).body))old.push(row);
 const ledger=old[0].tables.find(t=>t.name==='rer_migrations');
 async function target(name){const db=await runtime.getD1Database(name);const statements=unstable_splitSqlQuery(migrations.map(m=>m.sql).join('\n')).filter(sql=>!/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(sql.trim()));await db.batch(statements.map(sql=>db.prepare(sql)));if(process.argv.includes('--platform')){await db.prepare(ledger.sql).run();await db.batch(migrations.map(m=>db.prepare('INSERT INTO rer_migrations(name,sha256) VALUES(?,?)').bind(m.name,m.sha256)));}else{await db.prepare('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,state TEXT,sha256 TEXT)').run();await db.batch(migrations.map(m=>db.prepare("INSERT INTO d1_migrations(name,state,sha256) VALUES(?,'applied',?)").bind(m.name,m.sha256)));};return db;}
 const source=await target('SOURCE'),destination=await target('TARGET');
 const archive=await new Response(await transfer.archiveStream(await transfer.portability(source))).text();
 const earlier=await fixture.rebuiltArchive(archive,fixture.beforeFeedbackReviewRelease);
 let reason;
 try{await transfer.restoreStream(await transfer.portability(destination),new Response(earlier).body);}catch(error){reason=error.code??error.message;}
 const repaired=process.argv.includes('--repaired');
 if(repaired)assert.equal(reason,undefined,'the corrected historical fixture restores through the real D1 portability engine');
 else assert.equal(reason,'schema_mismatch:migration_history','the unchanged fixture has inconsistent recorded history');
 console.log(JSON.stringify({fixture:'beforeFeedbackReviewRelease',migrations:migrations.length,repaired,ledger:process.argv.includes('--platform')?'rer_migrations':'tracked d1_migrations',restore:reason??'success'}));
}finally{await runtime?.dispose();await rm(directory,{recursive:true,force:true});}
