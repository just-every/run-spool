import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(resolve('package.json'));
const {Miniflare,convertV4MiniflareOptions,Log,LogLevel}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler/package.json')]}));
const {unstable_splitSqlQuery}=require('wrangler');
const migrations=JSON.parse(await readFile('management/integration/deployment-spec.json','utf8')).migrations;
const prior=migrations.filter(m=>m.name<'0110_sentry_roster_proposals.sql'),upgrade=migrations.find(m=>m.name==='0110_sentry_roster_proposals.sql');
assert.ok(upgrade&&prior.at(-1).name==='0109_feedback_review.sql');
const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {}',log:new Log(LogLevel.ERROR),d1Databases:{DB:'populated-0110'}}));
const canonical=rows=>rows.map(row=>JSON.stringify(Object.fromEntries(Object.entries(row).sort()))).sort();
try{
 const db=await runtime.getD1Database('DB');
 const execute=async sql=>db.batch(unstable_splitSqlQuery(sql).filter(s=>!/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(s.trim())).map(s=>db.prepare(s)));
 for(const migration of prior)await execute(migration.sql);
 await db.batch([
  db.prepare("INSERT INTO projects VALUES('upgrade-project','Synthetic project',1)"),
  db.prepare("INSERT INTO spool_organizations VALUES('upgrade-org','Synthetic organization',1)"),
  db.prepare("INSERT INTO spool_members VALUES('upgrade-member','upgrade-org',NULL,'synthetic-upgrade@example.test','Synthetic member','member','active',1,1)"),
  db.prepare("INSERT INTO spool_project_grants VALUES('upgrade-member','upgrade-project','member',1)"),
  db.prepare("INSERT INTO spool_service_accounts VALUES('upgrade-service','upgrade-org','Synthetic service','upgrade-member','active',1,1)"),
  db.prepare("INSERT INTO spool_service_scopes VALUES('upgrade-service','upgrade-project','agent')"),
  ...['project','release','issue','event'].map(kind=>db.prepare('INSERT INTO sentry_import_targets VALUES(?,?,?,?)').bind(kind,kind==='project'?'upgrade-project':'synthetic-'+kind,'revision-'+kind,JSON.stringify({organization:'synthetic-upgrade',project:'checkout',id:kind}))),
 ]);
 const tables=(await db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results;
 const rows=async name=>(await db.prepare('SELECT * FROM "'+name+'"').all()).results;
 const before=new Map(await Promise.all(tables.map(async t=>[t.name,canonical(await rows(t.name))])));
 await execute(upgrade.sql);
 for(const table of tables){
  assert.deepEqual(canonical(await rows(table.name)),before.get(table.name),'0110 preserves every populated pre-existing row: '+table.name);
  if(table.name!=='sentry_import_targets')assert.equal((await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").bind(table.name).first()).sql,table.sql,'0110 preserves inherited table schema: '+table.name);
 }
 assert.deepEqual(await rows('spool_import_proposals'),[],'upgrade creates no review record or authority');
 assert.equal((await rows('sentry_import_targets')).length,4);
 assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results,[]);
 await db.prepare('INSERT INTO spool_import_proposals VALUES(?,?,?,?,?,?,?)').bind('synthetic-proposal','upgrade-project','ownership','{"enabled":false}','pending',1,1).run();
 await db.prepare('INSERT INTO sentry_import_targets VALUES(?,?,?,?)').bind('import-proposal','synthetic-proposal','revision-proposal','{}').run();
 assert.equal((await rows('spool_import_proposals')).length,1,'new review schema accepts an inert proposal');
 const receipt={synthetic:true,test:'populated0109To0110',priorMigrations:prior.length,migration:upgrade.name,preservedTables:tables.length,preservedRows:[...before.values()].reduce((n,rows)=>n+rows.length,0),beforeAndAfterProvenance:4,beforeAndAfterProjectGrants:1,beforeAndAfterServiceScopes:1,proposalsImmediatelyAfterUpgrade:0,afterNewProposal:1,foreignKeyViolations:0,passed:true};
 await writeFile(new URL('populated-0110.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt));
}finally{await runtime.dispose()}
