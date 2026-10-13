import assert from 'node:assert/strict';
import {readArchive,makePart} from '../../src/modules/portability/index.mjs';
import {ContentVerifier,ArchiveVerifier} from '../../src/modules/portability/format.mjs';
import {canonicalJson,sha256} from '../../src/modules/portability/hash.mjs';
import {canonical} from '../../src/domain/privacy.ts';
// Before 0016 there were neither repair tables nor (0018) erasure receipts nor (0020) the identity link's tables.
const repairTables=['repair_checks','repairs','rer_erasure_operations','rer_dependency_installation','rer_dependency_link'];
// The archive an installation without repair history exports: the same rows in
// the inventory before migration 0016, with Base's own schema and content hashes.
export async function preRepairArchive(text){
 const records=[];for await(const record of readArchive(new Response(text).body))records.push(record);
 const [manifest]=records,data=Object.fromEntries(manifest.tables.map(table=>[table.name,[]]));
 for(const part of records.filter(record=>record.kind==='part'))for(const item of part.items)data[item.table].push(item);
 data.audit=data.audit.filter(item=>!item.row.kind.startsWith('repair_')).map((item,index)=>({...item,index}));
 const tables=manifest.tables.filter(table=>!repairTables.includes(table.name)).map(table=>({...table,count:data[table.name].length}));
 const items=tables.flatMap(table=>data[table.name]),parts=[];
 for(let offset=0;offset<items.length;offset+=500)parts.push(await makePart(parts.length,items.slice(offset,offset+500)));
 // Archives from before 0016 predate the recorded migration list as well.
 const {migrations:_recorded,...previous}=manifest;
 const earlier={...previous,tables,partCount:parts.length,schema:await sha256(canonicalJson(tables.map(({name,sql})=>({name,sql}))))};
 const verifier=new ContentVerifier(earlier),binding=new ArchiveVerifier(earlier);for(const item of items)verifier.add(item);for(const part of parts)binding.add(part);
 return [earlier,...parts,{kind:'closing',partCount:parts.length,contentHash:verifier.digest(),archiveHash:binding.digest()}].map(record=>canonicalJson(record)+'\n').join('');
}
const withoutRepairs=data=>Object.fromEntries(Object.entries(data).filter(([table])=>!repairTables.includes(table)).map(([table,rows])=>[table,(table==='audit'?rows.filter(row=>!row.kind.startsWith('repair_')):rows).map(canonical).sort()]));
// Part 4: a pre-repair archive restores with empty repair tables; a populated
// archive restores repairs, checks and every verdict input intact.
export async function archiveProof(app,{issue,repair,cutoff}){
 const source=await app.archive();assert.ok(source.data.repairs.length&&source.data.repair_checks.length);
 const read=async()=>(await app.json(`/api/projects/a/repairs?issue=${issue}`)).repairs.find(row=>row.id===repair.id);
 const before=await read();
 await app.resetRestore(await preRepairArchive(source.text));
 let restored=await app.archive();assert.deepEqual(restored.data.repairs,[]);assert.deepEqual(restored.data.repair_checks,[]);
 assert.deepEqual(withoutRepairs(restored.data),withoutRepairs(source.data),'pre-repair archive restores every other row');
 await app.resetRestore(source.text);restored=await app.archive();
 for(const table of Object.keys(source.data))assert.deepEqual(restored.data[table].map(canonical).sort(),source.data[table].map(canonical).sort(),'restored '+table);
 const after=await read(),stable=row=>({...row,observation:{...row.observation,evidence:{...row.observation.evidence,window:{start:row.observation.evidence.window.start}}}});
 assert.deepEqual(stable(after),stable(before),'restored repair, checks and computed verdict');
 // Retention keeps the repair and marks its snapshot events that are gone.
 await app.json('/api/projects/a/retention','POST',{cutoff,apply:true});
 const retained=await read();assert.equal(retained.id,repair.id);assert.deepEqual(retained.checks,before.checks);
 assert.ok(retained.snapshot.events.some(row=>row.state==='removed_by_retention'),'snapshot event removed by retention is marked');
 assert.equal(retained.snapshot.events.length,before.snapshot.events.length);assert.equal(retained.observation.verdict,'recurred');
 return {restoredTables:Object.keys(source.data).length,repairs:source.data.repairs.length,checks:source.data.repair_checks.length,snapshot:retained.snapshot.events};
}
