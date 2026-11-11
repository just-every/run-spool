import {readFile} from 'node:fs/promises';
import {readArchive,makePart,canonicalJson,sha256} from '../../src/modules/portability/index.mjs';
import {ContentVerifier,ArchiveVerifier} from '../../src/modules/portability/format.mjs';
import {schemaIdentityOf} from '../../src/modules/portability/schema-identity.mjs';

// The inventory an installation recorded before migrations 0102 (retired references), 0103 (which rewrote the two
// relay audit triggers) and 0104 (roster digests). The earlier trigger text is read from migration 0099, which still
// holds it; SQLite records a trigger as `CREATE TRIGGER <name> ...` without IF NOT EXISTS.
export async function beforeRelayPrivacy(manifest){
 if(manifest.migrations)manifest.migrations=manifest.migrations.filter(name=>!['0102_agent_retired_refs.sql','0103_agent_door_relay_privacy.sql','0104_business_retired.sql'].includes(name));
 // The two tombstone tables of 0102 and 0104 had no place in an archive before them.
 manifest.tables=manifest.tables.filter(table=>!['agent_door_retired_refs','bs_retired'].includes(table.name));
 if(!manifest.schemaObjects)return;
 const migration=await readFile(new URL('../../migrations/core/0099_agent_custody_replay_relay.sql',import.meta.url),'utf8');
 const earlier=name=>/^CREATE TRIGGER IF NOT EXISTS ([a-z_]+)[\s\S]*?\nEND;$/m.exec(migration.slice(migration.indexOf('CREATE TRIGGER IF NOT EXISTS '+name)))[0].replace('IF NOT EXISTS ','').replace(/;$/,'');
 const triggers={agent_door_relay_audit_insert:earlier('agent_door_relay_audit_insert'),agent_door_relay_audit_update:earlier('agent_door_relay_audit_update')};
 manifest.schemaObjects=manifest.schemaObjects.map(object=>triggers[object.name]?{...object,sql:triggers[object.name]}:object);
}

// The archive an earlier release exports: the same items under a manifest edited by `edit`, with its schema,
// content and archive hashes signed again (the schema as the table-only identity every earlier archive carries).
// The previous release's own format: no ledger, its tables and complete object inventory (relay triggers as 0103 wrote
// them) and none of the two erasure tombstone tables that 0102 and 0104 added to the archive.
export async function beforeTombstoneTables(manifest){
 manifest.tables=manifest.tables.filter(table=>!['agent_door_retired_refs','bs_retired'].includes(table.name));
}

export async function rebuiltArchive(text,edit,{objectIdentity=false}={}){
 const records=[];for await(const record of readArchive(new Response(text).body))records.push(record);
 const [manifest]=records;let items=records.filter(record=>record.kind==='part').flatMap(part=>part.items);
 await edit(manifest);
 items=items.filter(item=>item.kind!=='row'||manifest.tables.some(table=>table.name===item.table));
 const parts=[];for(let offset=0;offset<items.length;offset+=500)parts.push(await makePart(parts.length,items.slice(offset,offset+500)));
 const earlier={...manifest,partCount:parts.length,schema:objectIdentity?await schemaIdentityOf(manifest.tables,manifest.schemaObjects):await sha256(canonicalJson(manifest.tables.map(({name,sql})=>({name,sql}))))};
 const verifier=new ContentVerifier(earlier),binding=new ArchiveVerifier(earlier);for(const item of items)verifier.add(item);for(const part of parts)binding.add(part);
 return [earlier,...parts,{kind:'closing',partCount:parts.length,contentHash:verifier.digest(),archiveHash:binding.digest()}].map(record=>canonicalJson(record)+'\n').join('');
}
