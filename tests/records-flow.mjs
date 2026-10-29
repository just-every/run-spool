import { archiveProjection } from './archive.mjs';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
// [API-001] Public retained-record reads, exact project grant, pagination and removal.
import assert from 'node:assert/strict';
import { followErasure } from './project-erasure/follow.mjs';
export async function recordReadFlow({ req, json, db }) {
 const p = await json('/api/projects', 'POST', { id: 'synthetic-spool-records', name: 'Checkout record reads' }), root = `/api/projects/${p.id}`;
 await json(root + '/releases', 'POST', { name: 'synthetic-spool-checkout@1', build: 'web' });
 const alias = new URL(p.dsn).pathname;
 for (let i = 0; i < 30; i++) {
  const eventId = i.toString(16).padStart(32, '0');
  const response = await req(`/api/ingest/${p.id}`, 'POST', { version: 1, eventId, release: 'synthetic-spool-checkout@1', build: 'web', environment: 'production', type: 'TypeError', message: 'Checkout confirmation failed', frames: [{ file: 'checkout.js', function: 'confirm', line: 12, column: 0 }], breadcrumbs: [] }, { Cookie: '', Authorization: `Bearer ${p.ingestKey}` });
  assert.equal(response.status, 201);
  assert.equal((await req(`/api${alias}/envelope/?sentry_key=${new URL(p.dsn).username}&sentry_version=7`, 'POST', '{}\n{"type":"user_report"}\n' + JSON.stringify({ event_id: eventId, comments: 'Checkout report ' + i }), { Cookie: '' })).status, 200);
 }
 const [issue] = await json(root + '/issues'); assert.equal(issue.count, 30);
 const grant = await json(root + '/keys', 'POST', { kind: 'agent' }), auth = { Cookie: '', Authorization: `Bearer ${grant.key}` };
 // Registration timestamps are not caller-controlled. Pin only the fixture clock
 // column so every public read must traverse a full page of tied ordering keys.
 for (let i = 1; i < 30; i++) await json(root + '/releases', 'POST', { name: 'synthetic-spool-release-' + i, build: i % 2 ? 'web' : 'worker' });
 await db.prepare('UPDATE releases SET created=? WHERE project=?').bind(1793232000000, p.id).run();
 const paginate = async (path, headers = auth) => {
  const rows = []; let cursor = null, pages = 0, total;
  do { assert.ok(pages < 10, 'record traversal terminates'); const response = await req(path + (cursor ? (path.includes('?') ? '&' : '?') + 'cursor=' + encodeURIComponent(cursor) : ''), 'GET', undefined, headers); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); const page = await response.json(); assert.equal(page.version, 1); assert.ok(page.rows.length <= page.bounds.pageSize); total = page.total; rows.push(...page.rows); cursor = page.next; pages++; } while (cursor);
  assert.equal(new Set(rows.map(row => row.id ?? row.name)).size, rows.length, 'cursor pages never repeat a retained record');
  assert.equal(rows.length, total); return { rows, pages, total };
 };
 for (const path of [root + '/occurrences', root + `/issues/${issue.id}/occurrences`, root + '/feedback-reports']) {
  const read = await paginate(path); assert.equal(read.total, 30); assert.equal(read.pages, 2);
  assert.deepEqual(read.rows, (await paginate(path, {})).rows, 'read-only projection reconciles with owner reads');
  const first = await (await req(path, 'GET', undefined, auth)).json();
  assert.equal((await req(path + '?order=oldest&cursor=' + encodeURIComponent(first.next), 'GET', undefined, auth)).status, 400, 'a cursor never crosses a query/order');
 }
 assert.equal((await json(root + `/issues/${issue.id}/events`)).total, (await paginate(root + '/occurrences')).total, 'occurrence total equals the issue detail');
 assert.equal((await json(root + '/feedback')).total, (await paginate(root + '/feedback-reports')).total, 'report total equals the feedback inbox');
 const releaseRead = await paginate(root + '/release-records'); assert.equal(releaseRead.pages, 2); assert.equal(releaseRead.total, 30);
 assert.equal(new Set(releaseRead.rows.map(row => row.created)).size, 1, 'release traversal exercises tied creation times');
 const core = ({project,name,seq,build,created}) => ({project,name,seq,build,created}), byName = rows => rows.map(core).sort((a,b)=>a.name.localeCompare(b.name));
 assert.deepEqual(byName(releaseRead.rows), byName(await json(root + '/releases')), 'release records reconcile with the unchanged owner release list');
 assert.deepEqual((await paginate(root + '/release-records', {})).rows, releaseRead.rows);
 assert.deepEqual((await paginate(root + '/release-records?order=oldest')).rows, [...releaseRead.rows].reverse());
 const filteredReleases = await paginate(root + '/release-records?build=worker'); assert.equal(filteredReleases.total, 14); assert.ok(filteredReleases.rows.every(row=>row.build==='worker'));
 const firstRelease = await (await req(root + '/release-records', 'GET', undefined, auth)).json();
 for (const query of ['order=oldest', 'build=web', 'release=synthetic-spool-release-1']) assert.equal((await req(root + '/release-records?' + query + '&cursor=' + encodeURIComponent(firstRelease.next), 'GET', undefined, auth)).status, 400);
 for (const cursor of ['not-a-cursor', btoa('{}'), 'a'.repeat(4097), '']) assert.equal((await req(root + '/release-records?cursor=' + encodeURIComponent(cursor), 'GET', undefined, auth)).status, 400);
 assert.equal((await req(root + '/occurrences?cursor=' + encodeURIComponent(firstRelease.next), 'GET', undefined, auth)).status, 400, 'a release cursor never crosses record surfaces');
 const other = await json('/api/projects', 'POST', { id: 'synthetic-spool-records-other', name: 'Foreign read scope' });
 const foreign = await json(`/api/projects/${other.id}/keys`, 'POST', { kind: 'agent' }), deploy = await json(root + '/keys', 'POST', { kind: 'deploy' });
 for (const path of [root + '/occurrences', root + `/issues/${issue.id}/occurrences`, root + '/feedback-reports', root + '/release-records']) {
  const denied = [];
  for (const key of [foreign.key, deploy.key, p.ingestKey]) { const r = await req(path, 'GET', undefined, { Cookie: '', Authorization: `Bearer ${key}` }); denied.push([r.status, await r.json()]); }
  assert.deepEqual(denied[0], denied[1]); assert.deepEqual(denied[1], denied[2]); assert.equal(denied[0][0], 401);
 }
 await projectAuditReadFlow({req,json,p,root,auth,foreign});
 const foreignRead = `/api/projects/${other.id}/release-records`;
 assert.equal((await req(foreignRead + '?cursor=' + encodeURIComponent(firstRelease.next), 'GET', undefined, {Cookie:'',Authorization:`Bearer ${foreign.key}`})).status, 400, 'release cursors are project-bound even for a separately authorized reader');
 await json(root + '/keys/' + grant.hash, 'DELETE');
 assert.equal((await req(root + '/release-records', 'GET', undefined, auth)).status, 401);
 assert.equal((await req(root + '/release-records', 'GET', undefined, {Cookie:''})).status, 401);
 assert.equal((await req(root + '/release-records', 'GET', undefined, {Authorization:'Bearer synthetic-spool-invalid'})).status, 401, 'a malformed bearer cannot borrow owner authority');
 const replacement = await json(root + '/keys', 'POST', {kind:'agent'}); auth.Authorization = `Bearer ${replacement.key}`;
 assert.deepEqual((await paginate(root + '/release-records')).rows, releaseRead.rows, 'denied and revoked reads change no records');
 const report = (await paginate(root + '/feedback-reports')).rows[0]; await json(root + '/feedback/' + report.id, 'DELETE');
 assert.equal((await paginate(root + '/feedback-reports')).total, 29); assert.ok(!(await paginate(root + '/feedback-reports')).rows.some(r => r.id === report.id));
 // Reporting definitions recompute retained values and lose only erased-project widgets.
 const from=Date.now()-60000,to=Date.now()+1000,widget=project=>({project,name:'Retained event volume',config:{metric:'count',q:'',from,to}});
 const me=await json('/api/organization/me');if(!me.organization)await json('/api/organization','POST',{id:'synthetic-records-org',name:'Record custody organization'});
 let spanning=await json('/api/reporting/items','POST',{kind:'dashboard',name:'Project custody report',widgets:[widget(p.id),widget(other.id)]});
 const sole=await json('/api/reporting/items','POST',{kind:'dashboard',name:'Sole project custody',widgets:[widget(p.id)]});
 assert.equal(spanning.widgets[0].data.value,30);
 spanning=await json('/api/reporting/items/'+spanning.id+'/shares','PUT',{revision:spanning.revision,shares:[{kind:'role',target:'read-only'}]});
 const archive=await archiveProjection(await req('/api/archive')),restored=await startTestWorker(15560);
 assert.deepEqual(byName(archive.data.releases.filter(row=>row.project===p.id)), byName(releaseRead.rows), 'private archive contains exactly the paginated release registrations');
 try {
  const cookie=await signIn(restored.origin),response=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Cookie:cookie,Origin:restored.origin,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:archive.text});
  assert.equal(response.status,200,await response.text());
  const itemResponse=await fetch(restored.origin+'/api/reporting/items/'+spanning.id,{headers:{Cookie:cookie}});assert.equal(itemResponse.status,200);const item=await itemResponse.json();
  assert.equal(item.author,'[erased]');assert.ok(item.shares.length>0&&item.shares.every(share=>!share.active),'private restore never revives reporting shares');assert.equal(item.widgets.find(row=>row.project===p.id).data.value,30,'restored definitions run the retained restored evidence');
  assert.equal((await fetch(restored.origin+'/api/reporting/items/'+spanning.id)).status,401,'a restored shared id supplies no authority');
  const restoredReleases = []; let cursor;
  do {const page=await (await fetch(restored.origin+root+'/release-records'+(cursor?'?cursor='+encodeURIComponent(cursor):''),{headers:{Cookie:cookie}})).json();restoredReleases.push(...page.rows);cursor=page.next} while(cursor);
  assert.deepEqual(restoredReleases, releaseRead.rows, 'private restore preserves every release record');
 } finally {await restored.stop()}

 const retained=await json(root+'/retention','POST',{cutoff:Date.now(),apply:true});
 assert.equal(retained.events,30,'Retention removes the reporting fixture occurrences');
 assert.equal((await json('/api/reporting/items/'+spanning.id)).widgets.find(row=>row.project===p.id).data.value,0,'Saved widgets retain no expired event-derived cache');
 const plan = await json(root + '/erasure'); await followErasure(json, await json(root + '/erasure', 'POST', { confirm: p.id, planHash: plan.planHash }));
 const surviving=await json('/api/reporting/items/'+spanning.id);assert.deepEqual(surviving.widgets.map(row=>row.project),[other.id]);
 assert.equal((await req('/api/reporting/items/'+sole.id)).status,404,'A sole-project definition leaves with project erasure');
 await json('/api/reporting/items/'+spanning.id,'DELETE',{revision:surviving.revision});
 assert.equal((await req(root + '/occurrences')).status, 404); assert.equal((await req(root + '/feedback-reports')).status, 404);
 assert.equal((await req(root + '/occurrences', 'GET', undefined, auth)).status, 401, 'erasure retires the read grant too');
 assert.equal((await req(root + '/release-records')).status, 404); assert.equal((await req(root + '/release-records', 'GET', undefined, auth)).status, 401);
 console.log('[API-001] occurrence, feedback and tied release pages reconcile with owner reads and private restore; cursor, scope and revocation refusals, withdrawal and erasure passed');
}

// The project audit is a public read of the existing permanent chronology.
async function projectAuditReadFlow({req,json,p,root,auth,foreign}) {
 const read=async(path=root+'/audit-records',headers=auth)=>{
  const rows=[];let cursor,pages=0,first;
  do{assert.ok(pages++<100);const response=await req(path+(cursor?(path.includes('?')?'&':'?')+'cursor='+encodeURIComponent(cursor):''),'GET',undefined,headers);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const page=await response.json();first??=page;assert.equal(page.version,1);assert.equal(page.highWater,first.highWater);rows.push(...page.rows);cursor=page.next}while(cursor);
  assert.equal(rows.length,first.total);assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);return {rows,first,pages};
 };
 const history=await read();assert.ok(history.pages>1,'project audit traverses populated pages');
 const label=history.rows[0].project_label;assert.ok(history.rows.every(row=>row.project_label===label));
 assert.ok(history.rows.some(row=>row.action==='release.register'&&row.outcome==='succeeded'));
 const all=await json('/api/audit/export'),atPin=all.rows.filter(row=>row.project_label===label&&row.sequence<=history.first.highWater);
 assert.deepEqual(history.rows,[...atPin].reverse(),'project history equals the organization projection through its fixed high water');
 const old=await read(root+'/audit-records?order=oldest');assert.deepEqual(old.rows.filter(row=>row.sequence<=history.first.highWater),[...history.rows].reverse());
 for(const query of ['action=release.register','outcome=denied']){const filtered=await read(root+'/audit-records?'+query);const [field,value]=query.split('=');assert.ok(filtered.rows.every(row=>row[field]===value));if(field==='action')assert.ok(filtered.rows.length>=30)}
 // Reading the audit appends its own fact; an existing traversal never chases those appends.
 const continued=await req(root+'/audit-records?cursor='+encodeURIComponent(history.first.next),'GET',undefined,auth);assert.equal(continued.status,200);assert.equal((await continued.json()).highWater,history.first.highWater);
 for(const query of ['order=oldest','action=release.register','outcome=succeeded'])assert.equal((await req(root+'/audit-records?'+query+'&cursor='+encodeURIComponent(history.first.next),'GET',undefined,auth)).status,400);
 for(const query of ['cursor=','cursor=broken','action=unknown','outcome=unknown','q=secret','order=newest&order=oldest'])assert.equal((await req(root+'/audit-records?'+query,'GET',undefined,auth)).status,400);
 for(const key of [foreign.key,p.ingestKey,(await json(root+'/keys','POST',{kind:'deploy'})).key,'synthetic-spool-invalid'])assert.equal((await req(root+'/audit-records','GET',undefined,{Authorization:'Bearer '+key})).status,401,'wrong-purpose or foreign bearers cannot borrow owner authority');
 assert.equal((await req('/api/projects/synthetic-spool-records-other/audit-records?cursor='+encodeURIComponent(history.first.next),'GET',undefined,{Cookie:'',Authorization:'Bearer '+foreign.key})).status,400);
 const revoked=await json(root+'/keys','POST',{kind:'agent'});await json(root+'/keys/'+revoked.hash,'DELETE');assert.equal((await req(root+'/audit-records','GET',undefined,{Cookie:'',Authorization:'Bearer '+revoked.key})).status,401);
 const wire=JSON.stringify(history);for(const value of [p.ingestKey,auth.Authorization.slice(7),'lookup_hash','operator_id',p.id+'"'+':'])assert.ok(!wire.includes(value));
 return {label,rows:history.rows};
}
