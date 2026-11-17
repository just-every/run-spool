import {admissionRuntime} from '../tests/admission-runtime.mjs';
import {signIn,gate} from '../tests/auth.mjs';
import {rebuiltArchive,beforeTombstoneTables} from '../tests/fixtures/archive-before-relay-privacy.mjs';
import {readFile,readdir,writeFile} from 'node:fs/promises';
const source=await readFile('/tmp/spool-full-repair-source.ndjson','utf8');async function beforeFeedbackReviewRelease(manifest){
 const {beforeRelayPrivacy}=await import('../tests/fixtures/archive-before-relay-privacy.mjs');await beforeRelayPrivacy(manifest);
 if(manifest.migrations)manifest.migrations=manifest.migrations.filter(name=>name!=='0109_feedback_review.sql');
 if(manifest.migrationLedger)manifest.migrationLedger={...manifest.migrationLedger,entries:manifest.migrationLedger.entries.filter(entry=>entry.name!=='0109_feedback_review.sql')};
 const migration=await readFile('migrations/core/0040_feedback.sql','utf8');const sql=/CREATE TABLE feedback \([\s\S]*?\n\);/.exec(migration)[0].replace(/;$/,'');
 manifest.tables=manifest.tables.map(table=>table.name==='feedback'?{...table,sql,columns:table.columns.filter(column=>column.name!=='private_data')}:table);
}
async function consistentPreviousRelease(manifest){await beforeFeedbackReviewRelease(manifest);manifest.migrations=manifest.migrations.filter(name=>!['0110_member_identity.sql','0111_capture_sources.sql'].includes(name));if(manifest.migrationLedger)manifest.migrationLedger={...manifest.migrationLedger,entries:manifest.migrationLedger.entries.filter(entry=>!['0110_member_identity.sql','0111_capture_sources.sql'].includes(entry.name))};manifest.schemaObjects=manifest.schemaObjects.filter(object=>object.name!=='spool_member_identity');}
const earlier=await rebuiltArchive(source,consistentPreviousRelease);await writeFile('/tmp/spool-consistent-previous-release.ndjson',earlier,{mode:0o600});
const target=await admissionRuntime();try{
 await target.DB.prepare('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();const names=(await readdir('migrations/core')).filter(n=>n.endsWith('.sql')).sort();await target.DB.batch(names.map(name=>target.DB.prepare('INSERT INTO d1_migrations(name) VALUES(?)').bind(name)));
 const cookie=await signIn(target.origin);
 const result=await fetch(target.origin+'/api/restore',{method:'POST',headers:{Origin:target.origin,Cookie:cookie,'x-rer-dev-key':gate.key,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:earlier});console.log('CONSISTENT_PREVIOUS_RELEASE_NATIVE_RESTORE',result.status,await result.text());
}finally{await target.close();}
