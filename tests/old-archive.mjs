import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {nativeArchive,archiveProjection,assertLegacyUpgrade} from './archive.mjs';
import {startTestWorker} from './worker.mjs';
import {freePort} from './admission-runtime.mjs';
import {signIn} from './auth.mjs';
import {platformTable} from '../src/modules/portability/bookkeeping.mjs';
import {base32,prefixBase} from '../src/domain/short-ids/format.ts';

const fixture='tests/fixtures/archive-fc75a7ac.ndjson';
// The released data must not acquire advice, authority or optional capture work
// merely by crossing a restore or additive-upgrade door.
const emptyAdditions=['grouping_proposals','spool_organizations','spool_members','spool_project_teams','spool_project_grants','spool_member_invites','spool_service_accounts','spool_service_scopes','spool_team_digest_settings','spool_team_snoozes','spool_team_mail','spool_reporting_items','spool_reporting_projects','spool_reporting_widgets','spool_reporting_shares','issue_activity','issue_comments','issue_subscriptions','recurrence_policies','issue_suppressions','loader_settings','review_stamps','review_views','retention_policies','identity_policies','event_identities','project_identity_keys','health_sessions','health_aggregates','slack_delivery_meta','suspect_decisions'];
async function assertNoInventedWork(data,request){
 for(const table of emptyAdditions)assert.deepEqual(data[table],[],'legacy recovery invents no advice, authority, automation or optional capture: '+table);
 // Operational connection secrets are excluded from archives. Their public
 // settings doors must still show that recovery created no connection.
 for(const project of data.projects){
  const base='/api/projects/'+project.id;
  const connections=await request(base+'/check-in-routes');assert.equal(connections.status,200);
  assert.deepEqual((await connections.json()).connections,[],'legacy recovery leaves check-in forwarding off');
  const response=await request(base+'/alerting/destinations');assert.equal(response.status,200);
  const destinations=await response.json();assert.equal(destinations.configuration,'available');
  assert.ok(destinations.rows.every(row=>row.kind!=='slack'),'legacy recovery connects no Slack destination');
 }
}
const canonicalRows=rows=>rows.map(row=>JSON.stringify(Object.fromEntries(Object.entries(row).sort()))).sort();
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const rows=async(db,sql)=>(await db.prepare(sql).all()).results;
const records=text=>text.trim().split('\n').map(line=>JSON.parse(line));
const legacyData=text=>{
 const wire=records(text),data=Object.fromEntries(wire[0].tables.filter(table=>!platformTable(table.name)).map(table=>[table.name,[]]));
 for(const part of wire)for(const item of part.items??[])if(item.kind==='row'&&item.table in data)data[item.table].push(item.row);
 return data;
};
function numbering(data){
 const bases=new Map(),byTime=field=>(a,b)=>a[field]-b[field]||(a.id<b.id?-1:a.id>b.id?1:0),prefixes=[],ids=[];
 for(const project of [...data.projects].sort(byTime('created'))){
  const base=prefixBase(project.id),number=(bases.get(base)??0)+1,prefix=number===1?base:base+'_'+number;
  bases.set(base,number);
  const issues=data.issues.filter(row=>row.project===project.id).sort(byTime('first_seen'));
  prefixes.push({prefix,project:project.id,next:issues.length+1,created:project.created});
  issues.forEach((issue,index)=>ids.push({short_id:prefix+'-'+base32(index+1),project:project.id,issue:issue.id,assigned:issue.id,number:index+1,created:issue.first_seen}));
 }
 return {prefixes,ids};
}
function assertNumbering(data){
 const {prefixes,ids}=numbering(data);
 assert.deepEqual(canonicalRows(data.short_id_prefixes),canonicalRows(prefixes),'every old project gets its deterministic prefix and next number');
 assert.deepEqual(canonicalRows(data.issue_short_ids),canonicalRows(ids),'every old issue keeps its first-seen, per-project short-ID mapping');
}

export async function releasedArchive({req,reset}){
 // A released archive crosses the current HTTP restore door; compare every table,
 // including empty ones, rather than accepting a matching subset of four tables.
 const legacy=await readFile(fixture,'utf8'),expected=legacyData(legacy);
 assert.equal((await req('/api/restore','POST',legacy,{'X-Confirm-Restore':'yes'})).status,200);
 const upgraded=await archiveProjection(await req('/api/archive'));
 for(const [table,data] of Object.entries(expected))assert.deepEqual(canonicalRows(upgraded.data[table]),canonicalRows(data),'released archive retains every row: '+table);
 assertNumbering(upgraded.data);await assertNoInventedWork(upgraded.data,req);
 assert.equal((await req('/api/restore','POST',legacy,{'X-Confirm-Restore':'yes'})).status,409);
 // The earlier native JSON format still crosses the same current restore door.
 const v1=nativeArchive(upgraded.data,1);
 await reset();
 assert.equal((await req('/api/restore','POST',v1,{'X-Confirm-Restore':'yes'})).status,200);
 const v1Restored=await archiveProjection(await req('/api/archive'));
 assertLegacyUpgrade(v1Restored.data,v1.data);
 assertNumbering(v1Restored.data);
}

// Seed only the historical fixture and a capture key, apply the actual additive
// migrations to that installation, then read the result through the emitted app.
async function populatedUpgrade(migrationFixture,boundary){
 const app=await startTestWorker(await freePort(),{},migrationFixture?{migrationFixture}:{beforeMigration:boundary});
 try{
  const db=await app.db(),expected=legacyData(await readFile(fixture,'utf8'));
  const seeded=new Set();
  async function seed(table){
   if(seeded.has(table))return;
   seeded.add(table);
   for(const foreign of await rows(db,'PRAGMA foreign_key_list('+quote(table)+')'))if(foreign.table in expected)await seed(foreign.table);
   for(const row of expected[table]){
    const keys=Object.keys(row);
    await db.prepare('INSERT OR IGNORE INTO '+quote(table)+' ('+keys.map(quote).join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').bind(...keys.map(key=>row[key])).run();
   }
  }
  for(const table of Object.keys(expected))await seed(table);
  for(const [table,data] of Object.entries(expected))assert.deepEqual(canonicalRows(await rows(db,'SELECT * FROM '+quote(table))),canonicalRows(data),'historical installation is populated exactly: '+table);
  // A 0068 installation already restored and numbered this older archive.
  if(!migrationFixture){
   const {prefixes,ids}=numbering(expected);
   for(const [table,data] of [['short_id_prefixes',prefixes],['issue_short_ids',ids]])for(const row of data){
    const keys=Object.keys(row);await db.prepare('INSERT INTO '+quote(table)+' ('+keys.map(quote).join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').bind(...keys.map(key=>row[key])).run();
   }
  }
  const project=expected.projects[0].id,key='synthetic-published-upgrade-key';
  const digest=createHash('sha256').update(key).digest('hex');
  await db.prepare("INSERT INTO credentials(hash,project,kind,created,revoked) VALUES(?,?,'ingest',1,NULL)").bind(digest,project).run();
  const schema=await rows(db,"SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name");
  const before=new Map(await Promise.all(schema.map(async({name})=>[name,canonicalRows(await rows(db,'SELECT * FROM '+quote(name)))])));
  const current=JSON.parse(await readFile('management/integration/deployment-spec.json','utf8')).migrations;
  const previous=migrationFixture?JSON.parse(await readFile(migrationFixture,'utf8')).migrations:current.filter(row=>row.name<boundary);
  const added=current.filter(row=>!previous.some(old=>old.name===row.name));
  assert.ok(added.length,'the historical fixture receives actual additive migrations');
  for(const migration of added)await app.migrate(migration.name);
  for(const {name,sql} of schema){
   assert.deepEqual(canonicalRows(await rows(db,'SELECT * FROM '+quote(name))),before.get(name),'populated upgrade preserves every pre-existing row: '+name);
   if(name!=='spool_audit_events')assert.equal((await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").bind(name).first()).sql,sql,'populated upgrade preserves table schema: '+name);
  }
  const cookie=await signIn(app.origin);
  const request=(path,options={})=>fetch(app.origin+path,{...options,headers:{Origin:app.origin,Cookie:cookie,...options.headers}});
  const archive=await archiveProjection(await request('/api/archive'));
  for(const [table,data] of Object.entries(expected))assert.deepEqual(canonicalRows(archive.data[table]),canonicalRows(data),'HTTP export exposes every upgraded legacy row: '+table);
  assertNumbering(archive.data);
  await assertNoInventedWork(archive.data,request);
  const keys=await request('/api/projects/'+project+'/keys');
  assert.equal(keys.status,200);
  assert.deepEqual((await keys.json()).map(row=>({kind:row.kind,revoked:row.revoked})),[{kind:'ingest',revoked:null}],'the owner still sees the same active capture key');
  const settings=await request('/api/projects/'+project+'/keys/'+digest+'/loader');
  assert.equal(settings.status,200);
  const loader=await settings.json();
  assert.equal(loader.settings.enabled,true,'the pre-upgrade capture key remains enabled');
  for(const option of ['tracesSampleRate','replaysSessionSampleRate','replaysOnErrorSampleRate'])assert.equal(loader.settings[option],0,'optional loader sampling starts off: '+option);
  assert.equal(loader.settings.feedback,false,'optional feedback starts off');
  console.log('Populated '+(migrationFixture?'v0.6.0':'0068')+' upgrade passed: '+schema.length+' pre-existing tables unchanged; all legacy rows, exact short IDs and the active key read through HTTP.');
 }finally{await app.stop()}
}

export async function publishedUpgrade(){
 await populatedUpgrade('tests/fixtures/deployment-spec-v0.6.0.json');
 await populatedUpgrade(undefined,'0069_checkin_routes.sql');
}
