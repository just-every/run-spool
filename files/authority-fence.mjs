import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(resolve('package.json'));
const {build}=require('esbuild');
const {Miniflare,convertV4MiniflareOptions,Log,LogLevel}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
const {unstable_splitSqlQuery}=require('wrangler');
const temporary=await mkdtemp(resolve(tmpdir(),'spool-authority-fence-'));
let runtime;
try{
 const modulePath=resolve(temporary,'targets.mjs');
 await build({entryPoints:['src/domain/sentry-import/targets.ts'],outfile:modulePath,bundle:true,platform:'node',format:'esm'});
 const {sentryTargets}=await import(pathToFileURL(modulePath));
 runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {}',log:new Log(LogLevel.ERROR),d1Databases:{DB:'authority-fence'}}));
 const db=await runtime.getD1Database('DB');
 const migrations=JSON.parse(await readFile('management/integration/deployment-spec.json','utf8')).migrations;
 for(const migration of migrations)await db.batch(unstable_splitSqlQuery(migration.sql).filter(s=>!/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(s.trim())).map(s=>db.prepare(s)));
 await db.batch([
  db.prepare("INSERT INTO projects VALUES('authority-project','Synthetic authority project',1)"),
  db.prepare("INSERT INTO sentry_import_targets VALUES('project','authority-project','imported-revision',?)").bind('{"id":"source-project","organization":"synthetic-org","project":"checkout"}'),
  db.prepare("INSERT INTO spool_organizations VALUES('authority-org','Synthetic organization',1)"),
  db.prepare("INSERT INTO spool_members VALUES('authority-member','authority-org',NULL,'synthetic-authority@example.test','Synthetic member','member','active',1,1)"),
  db.prepare("INSERT INTO spool_service_accounts VALUES('authority-service','authority-org','Synthetic service','authority-member','active',1,1)"),
 ]);
 const expected=await sentryTargets.read(db,'spool-owner','project','authority-project');
 assert.equal(expected.revision,'imported-revision');
 const matches=async()=>{const guard=sentryTargets.matches(expected,'spool-owner','project','authority-project');return (await db.prepare('SELECT CASE WHEN ('+guard.sql+') THEN 1 ELSE 0 END admitted').bind(...guard.params).first()).admitted};
 assert.equal(await matches(),1,'unchanged imported project is reversible before native authority');
 const facts=[];
 for(const kind of ['member-grant','service-scope']){
  if(kind==='member-grant')await db.prepare("INSERT INTO spool_project_grants VALUES('authority-member','authority-project','member',1)").run();
  else await db.prepare("INSERT INTO spool_service_scopes VALUES('authority-service','authority-project','agent')").run();
  const observed=await sentryTargets.read(db,'spool-owner','project','authority-project');
  assert.equal(observed.revision,'authorized:imported-revision');
  assert.equal(await matches(),0,'native authority fences the prior imported snapshot');
  const guard=sentryTargets.matches(expected,'spool-owner','project','authority-project');
  await db.prepare('DELETE FROM projects WHERE id=? AND ('+guard.sql+')').bind('authority-project',...guard.params).run();
  assert.ok(await db.prepare("SELECT 1 FROM projects WHERE id='authority-project'").first(),'guarded reversal preserves project');
  const table=kind==='member-grant'?'spool_project_grants':'spool_service_scopes';
  assert.equal((await db.prepare('SELECT count(*) n FROM '+table).first()).n,1,'guarded reversal preserves native authority');
  facts.push({kind,readRevisionFenced:true,sqlGuardRefused:true,projectPreserved:true,nativeAuthorityPreserved:true});
  await db.prepare('DELETE FROM '+table).run();
 }
 assert.equal(await matches(),1,'positive control restores the exact reversible state');
 const receipt={test:'sentryTargetsAuthorityFence',synthetic:true,unchangedControl:true,cases:facts,passed:true};
 await writeFile(new URL('authority-fence.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt));
}finally{await runtime?.dispose();await rm(temporary,{recursive:true,force:true})}
