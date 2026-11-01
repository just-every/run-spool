import { all,statement,quote,insist,PortabilityError } from './storage.mjs';
import { projectedColumns,encodedRow,mapRow,bindCell,writableColumns } from './catalogue.mjs';
import { canonicalJson, utf8 } from './hash.mjs';
import { generatedCopySQL } from './generated.mjs';

export const sidecar=copy=>copy+'_meta';
export function copyRowid(table) {
  const alias=['rowid','_rowid_','oid'].find(a=>!table.columns.some(c=>c.name.toLowerCase()===a));
  insist(alias,'unsupported_copy_rowid:'+table.name);return quote(alias);
}
const keys=table=>table.columns.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk);
const order=table=>keys(table).length?keys(table).map(c=>quote(c.name)).join(','):quote(table.rowidAlias);
const sum=terms=>terms.length<2?(terms[0]??'0'):`(${sum(terms.slice(0,terms.length>>1))}+${sum(terms.slice(terms.length>>1))})`;
export function createCopy(db,table,copy,snapshot=false) {
  const ordering=order(table),meta=quote(sidecar(copy));
  const columns=writableColumns(table).map(c=>quote(c.name)).join(',');
  const product=table.columns.some(c=>c.generated)
    ?[db.prepare(generatedCopySQL(table,copy)),...(snapshot?[db.prepare(`INSERT INTO ${quote(copy)} SELECT ${columns} FROM ${quote(table.name)} ORDER BY ${ordering}`)]:[])]
    :[db.prepare(`CREATE TABLE ${quote(copy)} AS SELECT ${table.added?columns:'*'} FROM ${quote(table.name)} ${snapshot?'ORDER BY '+ordering:'WHERE 0'}`)];
  return [...product,
    db.prepare(`CREATE TABLE ${meta}(rer_portability_row_order INTEGER PRIMARY KEY,rer_portability_copy_rowid INTEGER NOT NULL UNIQUE,rer_portability_source_rowid INTEGER,rer_portability_tombstone TEXT)`),
    ...(snapshot?[db.prepare(`INSERT INTO ${meta} SELECT ROW_NUMBER() OVER(ORDER BY ${ordering})-1,ROW_NUMBER() OVER(ORDER BY ${ordering}),${table.rowidAlias?quote(table.rowidAlias):'NULL'},NULL FROM ${quote(table.name)}`)]:[])];
}
export async function readCopy(db,table,copy,offset,limit,encoded=false) {
  const columns=projectedColumns(table,encoded);
  const selected=encoded?writableColumns(table):table.columns;
  const from=`FROM ${quote(copy)} s JOIN ${quote(sidecar(copy))} m ON s.${copyRowid(table)}=m.rer_portability_copy_rowid ORDER BY m.rer_portability_row_order LIMIT ? OFFSET ?`;
  // Read sizes first, never discover a large row by overflowing the RPC result.
  // 12x covers JSON control escapes (6x), binary arrays (4x), and whole-string
  // two-byte workerd serialization. Names and scalar framing count separately.
  const overhead=selected.reduce((n,c)=>n+utf8(c.name).length*12+128,256);
  const weight=sum(selected.map(c=>`COALESCE(length(CAST(s.${quote(c.name)} AS BLOB)),0)`));
  const sizes=await all(db,`SELECT (${weight})*12+${overhead} AS bytes ${from}`,limit,offset);
  const raw=[];
  for(let start=0;start<sizes.length;) {
    let end=start,bytes=0;
    while(end<sizes.length && bytes+sizes[end].bytes<30*1024*1024){bytes+=sizes[end].bytes;end++;}
    insist(end>start,'row_part_too_large:'+table.name);
    raw.push(...await all(db,`SELECT ${columns} ${from}`,end-start,offset+start));start=end;
  }
  const meta=await all(db,`SELECT * FROM ${quote(sidecar(copy))} ORDER BY rer_portability_row_order LIMIT ? OFFSET ?`,limit,offset);
  insist(raw.length===meta.length,'copy_inventory:'+table.name);
  return raw.map((row,i)=>({row,meta:meta[i]}));
}
export async function normalizeCopy(context,table,copy) {
  try { return await normalize(context,table,copy); }
  catch(error) {
    if(error instanceof PortabilityError)throw error;
    throw new PortabilityError('copy_normalization_failed',409);
  }
}
async function normalize(context,table,copy) {
  const {db,config}=context,secrets=config.secretColumns[table.name]??[];
  // Generated reads must reflect exactly the base cells a restore will receive.
  if(table.columns.some(c=>c.generated)&&secrets.length)await db.prepare(`UPDATE ${quote(copy)} SET ${secrets.map(name=>quote(name)+'=NULL').join(',')}`).run();
  if(config.exportRow)for(let offset=0;offset<table.count;offset+=500) {
    const statements=[];
    for(const {row,meta} of await readCopy(db,table,copy,offset,500,true)) {
      const before=encodedRow(table,row,secrets),after=mapRow(config,table,before);
      if(canonicalJson(before)===canonicalJson(after))continue;
      const columns=writableColumns(table).filter(c=>!secrets.includes(c.name));
      // The rowid is internal, checked, and literal so a 100-column update needs only 100 bindings.
      insist(Number.isSafeInteger(meta.rer_portability_copy_rowid),'copy_rowid');
      statements.push(statement(db,`UPDATE ${quote(copy)} SET ${columns.map(c=>quote(c.name)+'=?').join(',')} WHERE ${copyRowid(table)}=${meta.rer_portability_copy_rowid}`,...columns.map(c=>bindCell(after[c.name]))));
    }
    if(statements.length)await db.batch(statements);
  }
  const pk=keys(table);if(!pk.length)return;
  const normalizedOrder=pk.map(c=>'s.'+quote(c.name)).join(',')+',m.rer_portability_copy_rowid';
  const temporary=sidecar(copy)+'_sorted';
  await db.batch([db.prepare(`CREATE TABLE ${quote(temporary)} AS SELECT ROW_NUMBER() OVER(ORDER BY ${normalizedOrder})-1 AS rer_portability_row_order,m.rer_portability_copy_rowid,m.rer_portability_source_rowid,m.rer_portability_tombstone FROM ${quote(copy)} s JOIN ${quote(sidecar(copy))} m ON s.${copyRowid(table)}=m.rer_portability_copy_rowid`),
    db.prepare(`DROP TABLE ${quote(sidecar(copy))}`),db.prepare(`ALTER TABLE ${quote(temporary)} RENAME TO ${quote(sidecar(copy))}`)]);
}
export function restoreCopy(db,table,copy) {
  const columns=writableColumns(table).map(c=>quote(c.name)),names=columns.join(','),projection=table.columns.some(c=>c.generated)?columns.map(c=>'s.'+c).join(','):'s.*',meta=quote(sidecar(copy));
  const from=`FROM ${quote(copy)} s JOIN ${meta} m ON s.${copyRowid(table)}=m.rer_portability_copy_rowid ORDER BY m.rer_portability_row_order`;
  // SQLite's implicit insert list contains only writable columns. Keeping it
  // implicit also avoids repeating long column names within D1's SQL limit.
  // A bridged table names its archived columns so later ones take defaults.
  const into=quote(table.name)+(table.added?` (${names})`:'');
  if(!table.rowidAlias)return [db.prepare(`INSERT INTO ${into} SELECT ${projection} ${from}`)];
  if(columns.length<100&&!table.columns.some(c=>c.generated))return [db.prepare(`INSERT INTO ${quote(table.name)} (${names},${quote(table.rowidAlias)}) SELECT ${projection},m.rer_portability_source_rowid ${from}`)];
  // Avoid selecting 101 columns or repeating generated-table base column names.
  // Restore rowids in the same atomic batch using temporary negative ids below
  // both the destination and source ranges.
  const alias=quote(table.rowidAlias),base=`(SELECT MIN(0,MIN(rer_portability_source_rowid))-COUNT(*) FROM ${meta})`;
  return [db.prepare(`INSERT INTO ${into} SELECT ${projection} ${from}`),
    db.prepare(`UPDATE ${quote(table.name)} SET ${alias}=${base}-${alias}`),
    db.prepare(`UPDATE ${quote(table.name)} AS t SET ${alias}=(SELECT rer_portability_source_rowid FROM ${meta} WHERE rer_portability_row_order=${base}-t.${alias}-1)`)];
}
