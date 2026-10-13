import { lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { RerError, refuse } from '@runeditrun/rer/errors';
import { inspectExistingState } from './recovery.mjs';
export function spoolPortability() {
 async function transfer({ root, path, journal, store, signal, operationToken }, direction) {
  await inspectExistingState({ root });
  if (direction === 'export' && await lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; })) throw refuse('Export requires a new archive path.');
  await store.run('Applying local data migrations', 'pnpm', ['exec','wrangler','d1','migrations','apply','errors-local','--local','--persist-to','.wrangler/state','--config','wrangler.jsonc'], { cwd: root, signal, env: { ...process.env, RER_LOCAL_OPERATION: operationToken, WRANGLER_SEND_METRICS: 'false' } });
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
 return { export: context => transfer(context, 'export'), import: context => transfer(context, 'import') };
}
