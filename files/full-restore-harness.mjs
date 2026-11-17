import {admissionRuntime} from '../tests/admission-runtime.mjs';
import {signIn,gate} from '../tests/auth.mjs';
import {rebuiltArchive,beforeTombstoneTables} from '../tests/fixtures/archive-before-relay-privacy.mjs';
import {readFile,readdir,writeFile} from 'node:fs/promises';
const source=await readFile('/tmp/spool-full-repair-source.ndjson','utf8');const earlier=await rebuiltArchive(source,beforeTombstoneTables,{objectIdentity:true});await writeFile('/tmp/spool-full-no-ledger.ndjson',earlier,{mode:0o600});
const target=await admissionRuntime();try{
 await target.DB.prepare('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();const names=(await readdir('migrations/core')).filter(n=>n.endsWith('.sql')).sort();await target.DB.batch(names.map(name=>target.DB.prepare('INSERT INTO d1_migrations(name) VALUES(?)').bind(name)));
 const cookie=await signIn(target.origin);
 const result=await fetch(target.origin+'/api/restore',{method:'POST',headers:{Origin:target.origin,Cookie:cookie,'x-rer-dev-key':gate.key,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:earlier});console.log('FULL_NO_LEDGER_NATIVE_RESTORE',result.status,await result.text());
}finally{await target.close();}
