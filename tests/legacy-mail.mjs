import {readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const databases=new Map();let checkout;
export function registerLegacyMail(origin,db){databases.set(origin,db)}
export function legacyCheckout(root){checkout=root}
// Only legacy archive/erasure fixtures read retained messages. There is no app viewer.
export async function legacyMailRows(origin){
 const db=databases.get(origin);
 if(db)return (await db.prepare('SELECT id,message FROM rer_mail_development_outbox ORDER BY sequence DESC').all()).results;
 if(!checkout)throw new Error('No legacy fixture database');
 const root=resolve(checkout,'.wrangler/state');
 for(const file of await readdir(root,{recursive:true}))if(file.endsWith('.sqlite')){
  const local=new DatabaseSync(resolve(root,file),{readOnly:true});
  try{if(local.prepare("SELECT name FROM sqlite_master WHERE name='rer_mail_development_outbox'").get())return local.prepare('SELECT id,message FROM rer_mail_development_outbox ORDER BY sequence DESC').all()}finally{local.close()}
 }
 throw new Error('No legacy fixture database');
}
export async function plantLegacyAlertMail(root,project){
 const directory=resolve(root,'.wrangler/state');
 for(const file of await readdir(directory,{recursive:true}))if(file.endsWith('.sqlite')){
  const db=new DatabaseSync(resolve(directory,file));
  try{if(db.prepare("SELECT name FROM sqlite_master WHERE name='alert_mail_jobs'").get()){
   db.prepare('INSERT INTO rer_mail_development_outbox(id,created_at,message) SELECT id,?,message FROM alert_mail_jobs WHERE project=? ON CONFLICT(id) DO NOTHING').run(Date.now(),project);return;
  }}finally{db.close()}
 }
 throw new Error('No legacy fixture database');
}
