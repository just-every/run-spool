import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nativeArchive,archiveProjection} from './archive.mjs';

export async function releasedArchive({req,reset}){
 // A released archive crosses the current HTTP restore door; no internal portability calls.
 const legacy=await readFile('tests/fixtures/archive-fc75a7ac.ndjson','utf8');
 assert.equal((await req('/api/restore','POST',legacy,{'X-Confirm-Restore':'yes'})).status,200);
 const upgraded=await archiveProjection(await req('/api/archive'));
 const legacyRows=legacy.trim().split('\n').map(line=>JSON.parse(line)).flatMap(row=>row.items??[]).filter(row=>row.kind==='row');
 for(const table of ['projects','events','artifacts','releases'])for(const item of legacyRows.filter(row=>row.table===table))assert.ok(upgraded.data[table].some(row=>Object.entries(item.row).every(([key,value])=>row[key]===value)),`upgrade preserves ${table}`);
 assert.equal(upgraded.data.issue_short_ids.length,upgraded.data.issues.length,'upgrade numbers each retained issue');
 assert.equal((await req('/api/restore','POST',legacy,{'X-Confirm-Restore':'yes'})).status,409);
 // The earlier native JSON format still crosses the same current restore door.
 const v1=nativeArchive(upgraded.data,1);
 await reset();
 assert.equal((await req('/api/restore','POST',v1,{'X-Confirm-Restore':'yes'})).status,200);
 const v1Restored=await archiveProjection(await req('/api/archive'));
 for(const table of ['projects','events','artifacts','releases'])for(const item of v1.data[table])assert.ok(v1Restored.data[table].some(row=>Object.entries(item).every(([key,value])=>row[key]===value)),`native v1 retains ${table}`);

}
