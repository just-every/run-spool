import {registerLegacyMail} from './legacy-mail.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { authBindings } from './auth.mjs';
import { emittedWorkerOptions } from './worker-options.mjs';

const require = createRequire(import.meta.url);
const miniflare = require(require.resolve('miniflare', {paths: [require.resolve('wrangler/package.json')]}));
const {Miniflare, convertV4MiniflareOptions, Log, LogLevel} = miniflare;
const {unstable_splitSqlQuery} = require('wrangler');
export async function freePort() {
 const server = createServer();
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const port = server.address().port;
 await new Promise(resolve => server.close(resolve));
 return port;
}

/** Run the emitted application with real local D1 and all committed migrations. */
export async function admissionRuntime(extra = {}, {port, deferClaimMigration = false, hostedMail = false} = {}) {
 port ??= await freePort();
 const origin = `http://127.0.0.1:${port}`;
 const {worker: emitted, database, triggers} = await emittedWorkerOptions(resolve('dist/server/wrangler.json'), miniflare);
 const temporary = await mkdtemp(resolve(tmpdir(), 'spool-admission-'));
 let worker;
 const trustedOrigin=hostedMail?'https://spool.example':origin;
 const mailBindings=hostedMail?{AUTH_ORIGIN:trustedOrigin,AUTH_LOCAL:'false',MAIL_PROVIDER:'resend',MAIL_API_KEY:'synthetic-provider-key',RER_OWNER_CLAIM_APP_ORIGIN:trustedOrigin}:{};
 if(hostedMail){
  const entry=resolve(temporary,'hosted-mail.mjs');
  await writeFile(entry,`import application from ${JSON.stringify(emitted.modules[1].path)};
export default {...application,fetch(request,env,ctx){const url=new URL(request.url),headers=new Headers(request.headers);if(headers.get('origin')===${JSON.stringify(origin)})headers.set('origin',${JSON.stringify(trustedOrigin)});headers.set('host','spool.example');return application.fetch(new Request(${JSON.stringify(trustedOrigin)}+url.pathname+url.search,{method:request.method,headers,body:request.body,redirect:'manual'}),env,ctx)}};`);
  emitted.modules.unshift({type:'ESModule',path:entry});
  emitted.outboundService=async request=>{
   if(request.url!=='https://api.resend.com/emails')throw new Error('Unexpected test network destination');
   const message=await request.json(),id=request.headers.get('idempotency-key');
   const db=await worker.getD1Database(database.binding);
   await db.prepare('INSERT INTO rer_mail_development_outbox(id,created_at,message) VALUES(?,?,?)').bind(id,Date.now(),JSON.stringify({...message,deliveryId:id})).run();
   return Response.json({id});
  };
 }

 const start = async () => {
  // Use the same emitted graph and Worker-first asset ownership as deployment.
  const options = convertV4MiniflareOptions({
   ...emitted, log: new Log(LogLevel.ERROR),
   bindings: {...emitted.bindings, ...authBindings(origin), ...extra, ...mailBindings},
   resourcePersistencePath: resolve(temporary, 'state'), host: '127.0.0.1', port,
   unsafeTriggerHandlers: triggers.length > 0,
  });
  if (triggers.length) options.workers[0].config.triggers = triggers;
  worker = new Miniflare(options);
  await worker.ready;
 };
 const apply = async files => {
  const db = await worker.getD1Database(database.binding);registerLegacyMail(origin,db);
  for (const file of files) {
   const sql = await readFile(resolve('migrations/core', file), 'utf8');
   const queries = unstable_splitSqlQuery(sql).filter(sql => !/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(sql.trim()));
   await db.batch(queries.map(sql => db.prepare(sql)));
  }
 };
 try {
  await start();
  const files = (await readdir('migrations/core')).filter(file => file.endsWith('.sql')).sort();
  await apply(files.filter(file => !deferClaimMigration || !file.includes('owner_claim')));
  const db = await worker.getD1Database(database.binding);registerLegacyMail(origin,db);
  const call = (path, value, headers = {}, method = value === undefined ? 'GET' : 'POST') => fetch(origin + path, {
   method, redirect: 'manual', headers: {Origin: origin, ...(value === undefined ? {} : {'Content-Type': 'application/json'}), ...headers},
   ...(value === undefined ? {} : {body: JSON.stringify(value)}),
  });
  const runtime = {origin, DB: db, call,
   applyClaimMigration: () => apply(files.filter(file => file.includes('owner_claim'))),
   restart: async () => {await worker.dispose(); await start(); runtime.DB = await worker.getD1Database(database.binding);},
   close: async () => {await worker.dispose(); await rm(temporary, {recursive: true, force: true});},
  };
  return runtime;
 } catch (error) {await worker?.dispose(); await rm(temporary, {recursive: true, force: true}); throw error;}
}
