import type { Bindings } from '../../auth/bindings';
import { connection } from './connection';

/** Installation credentials stay outside portable product data and public views. */
export async function savedConnection(env: Bindings) {
  const saved = await env.DB.prepare('SELECT value FROM spool_github_connection WHERE id=1').first<{value: string}>();
  return connection(saved ? { ...env, GITHUB_CONNECTION: saved.value } : env);
}
