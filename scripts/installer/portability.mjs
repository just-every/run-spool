import { lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { RerError, refuse } from '@runeditrun/rer/errors';
import { withManagedDataImport } from '@runeditrun/rer/portability';
import { nativeMigrationPreflight } from '@runeditrun/rer/portability-migrations';
import { emptyPreflight } from './empty-preflight.mjs';
import { inspectExistingState } from './recovery.mjs';
export function spoolPortability() {
 async function transfer({ root, path, journal, store, signal, operationToken }, direction) {
  try { await inspectExistingState({ root, allowPlatformLedger: true, ...(direction === 'import' ? { inspectDatabase: db => emptyPreflight(root, db) } : {}) }); }
  catch (error) {
   if (error.status === 409 && error.code?.startsWith('target_not_empty:')) throw new RerError('restore_refused', 'Archive operation refused (target_not_empty).', 4);
   throw error;
  }
  if (direction === 'export' && await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; })) throw refuse('Export requires a new archive path.');
  const proxy = await getPlatformProxy({ configPath: join(root, 'wrangler.jsonc'), persist: { path: join(root, '.wrangler/state/v3') }, remoteBindings: false });
  let nativeApply;
  try { ({ nativeApply } = await nativeMigrationPreflight({ root, db: proxy.env.DB, binding: 'DB' })); }
  finally { await proxy.dispose(); }
  if (nativeApply) await store.run('Applying local data migrations', 'pnpm', ['exec','wrangler','d1','migrations','apply','errors-local','--local','--persist-to','.wrangler/state','--config','wrangler.jsonc'], { cwd: root, signal, env: { ...process.env, RER_LOCAL_OPERATION: operationToken, WRANGLER_SEND_METRICS: 'false' } });
  const child = store.spawn('Transferring private Spool data', process.execPath,
   [fileURLToPath(new URL('./portability-worker.mjs', import.meta.url)), direction, path, ...(journal ? [journal] : [])], { cwd: root, signal, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  let output = ''; child.stdout.on('data', chunk => { output += chunk; });
  const closed = new Promise(resolve => child.once('close', code => resolve(code)));
  await new Promise(resolve => { child.once('exit', resolve); child.once('error', resolve); });
  await store.stop(child); const code = await closed;
  let receipt; try { receipt = JSON.parse(output.trim().split('\n').at(-1)); } catch { throw new RerError('transfer_failed','Local transfer did not return a receipt.',1); }
  if (code !== 0 || !receipt.ok) throw new RerError('transfer_failed',`Archive operation refused (${receipt.reason}).`,receipt.exitCode ?? 1);
  delete receipt.ok; return { target: 'local', ...receipt };
 }
 // A Platform Managed-data ZIP is staged in Base's private sandbox and restored
 // through this same native import; every other input keeps the native reader.
 return { export: context => transfer(context, 'export'), import: context => transfer(context, 'import'),
  managedDataImport: context => withManagedDataImport(context, { policyModule: 'scripts/installer/managed-data-policy.mjs' }, native => transfer(native, 'import')) };
}
