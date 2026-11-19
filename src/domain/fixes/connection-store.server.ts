import type { Bindings } from '../../auth/bindings';
import { decryptJson, encryptJson } from '../../modules/operator-auth/identity/oidc/aes-gcm.mjs';
import { environmentConnection, parseConnection, signingKey, type Connection } from './connection';

const purpose = 'spool-github-app/1';

async function storageKey(env: Bindings) {
 if (!env.SESSION_SECRET) throw new Error('The installation session secret is unavailable.');
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(purpose + '\0' + env.SESSION_SECRET));
 return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function connection(env: Bindings): Promise<Connection> {
 if (env.RER_DEMO === '1') return environmentConnection(env);
 const row = await env.DB.prepare('SELECT envelope FROM spool_github_connection WHERE id=1').first<{envelope:string}>();
 if (!row) return environmentConnection(env);
 try {
  const value = await decryptJson(await storageKey(env), purpose, JSON.parse(row.envelope));
  return parseConnection(value, 'saved');
 } catch {
  return {state:'invalid', source:'saved', reason:'The saved connection could not be opened. Enter the GitHub App credentials again.'};
 }
}

export async function prepareConnection(env: Bindings, input: unknown) {
 const value = parseConnection(input, 'saved');
 if (value.state === 'invalid') throw new Error(value.reason);
 try { await signingKey(value.privateKey); } catch { throw new Error('Enter a valid RSA private key in PEM format.'); }
 const {appId, installationId, privateKey} = value;
 const envelope = await encryptJson(await storageKey(env), purpose, {appId, installationId, privateKey});
 const save = env.DB.prepare('INSERT INTO spool_github_connection(id,envelope) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET envelope=excluded.envelope').bind(JSON.stringify(envelope));
 return {value, save};
}
