import {readFile} from 'node:fs/promises';
import {readArchive,makePart,canonicalJson,sha256} from '../../src/modules/portability/index.mjs';
import {ContentVerifier,ArchiveVerifier} from '../../src/modules/portability/format.mjs';

// The inventory an installation recorded before migration 0103 rewrote the two
// relay audit triggers. The earlier text is read from migration 0099, which still
// holds it; SQLite records a trigger as `CREATE TRIGGER <name> ...` without IF NOT EXISTS.
export async function beforeRelayPrivacy(manifest){
 if(manifest.migrations)manifest.migrations=manifest.migrations.filter(name=>name!=='0103_agent_door_relay_privacy.sql'&&name!=='0102_agent_retired_refs.sql');
 if(!manifest.schemaObjects)return;
 const migration=await readFile(new URL('../../migrations/core/0099_agent_custody_replay_relay.sql',import.meta.url),'utf8');
 const earlier=name=>/^CREATE TRIGGER IF NOT EXISTS ([a-z_]+)[\s\S]*?\nEND;$/m.exec(migration.slice(migration.indexOf('CREATE TRIGGER IF NOT EXISTS '+name)))[0].replace('IF NOT EXISTS ','').replace(/;$/,'');
 const triggers={agent_door_relay_audit_insert:earlier('agent_door_relay_audit_insert'),agent_door_relay_audit_update:earlier('agent_door_relay_audit_update')};
 manifest.schemaObjects=manifest.schemaObjects.map(object=>triggers[object.name]?{...object,sql:triggers[object.name]}:object);
}

// The archive an earlier release exports: the same items under a manifest edited by `edit`, with its schema,
// content and archive hashes signed again (the schema as the table-only identity every earlier archive carries).
export async function rebuiltArchive(text,edit){
 const records=[];for await(const record of readArchive(new Response(text).body))records.push(record);
 const [manifest]=records,items=records.filter(record=>record.kind==='part').flatMap(part=>part.items);
 await edit(manifest);
 const parts=[];for(let offset=0;offset<items.length;offset+=500)parts.push(await makePart(parts.length,items.slice(offset,offset+500)));
 const earlier={...manifest,partCount:parts.length,schema:await sha256(canonicalJson(manifest.tables.map(({name,sql})=>({name,sql}))))};
 const verifier=new ContentVerifier(earlier),binding=new ArchiveVerifier(earlier);for(const item of items)verifier.add(item);for(const part of parts)binding.add(part);
 return [earlier,...parts,{kind:'closing',partCount:parts.length,contentHash:verifier.digest(),archiveHash:binding.digest()}].map(record=>canonicalJson(record)+'\n').join('');
}
