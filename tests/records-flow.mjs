import { archiveProjection } from './archive.mjs';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
// [API-001] Public retained-record reads, exact project grant, pagination and removal.
import assert from 'node:assert/strict';
import { followErasure } from './project-erasure/follow.mjs';
export async function recordReadFlow({ req, json }) {
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
 const paginate = async (path, headers = auth) => {
  const rows = []; let cursor = null, pages = 0, total;
  do { const response = await req(path + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''), 'GET', undefined, headers); assert.equal(response.status, 200); const page = await response.json(); assert.equal(page.version, 1); total = page.total; rows.push(...page.rows); cursor = page.next; pages++; } while (cursor);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'cursor pages never repeat a retained record');
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
 const other = await json('/api/projects', 'POST', { id: 'synthetic-spool-records-other', name: 'Foreign read scope' });
 const foreign = await json(`/api/projects/${other.id}/keys`, 'POST', { kind: 'agent' }), deploy = await json(root + '/keys', 'POST', { kind: 'deploy' });
 for (const path of [root + '/occurrences', root + `/issues/${issue.id}/occurrences`, root + '/feedback-reports']) {
  const denied = [];
  for (const key of [foreign.key, deploy.key, p.ingestKey]) { const r = await req(path, 'GET', undefined, { Cookie: '', Authorization: `Bearer ${key}` }); denied.push([r.status, await r.json()]); }
  assert.deepEqual(denied[0], denied[1]); assert.deepEqual(denied[1], denied[2]); assert.equal(denied[0][0], 401);
 }
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
 try {
  const cookie=await signIn(restored.origin),response=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Cookie:cookie,Origin:restored.origin,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:archive.text});
  assert.equal(response.status,200,await response.text());
  const itemResponse=await fetch(restored.origin+'/api/reporting/items/'+spanning.id,{headers:{Cookie:cookie}});assert.equal(itemResponse.status,200);const item=await itemResponse.json();
  assert.equal(item.author,'[erased]');assert.ok(item.shares.length>0&&item.shares.every(share=>!share.active),'private restore never revives reporting shares');assert.equal(item.widgets.find(row=>row.project===p.id).data.value,30,'restored definitions run the retained restored evidence');
  assert.equal((await fetch(restored.origin+'/api/reporting/items/'+spanning.id)).status,401,'a restored shared id supplies no authority');
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
 console.log('[API-001] occurrence and feedback pages reconcile with owner UI reads; scope refusals, withdrawal and erasure passed');
}
