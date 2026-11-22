import { AuthStore } from '../../modules/operator-auth/accounts/store.mjs';
import { hashToken, opaqueToken } from '../../modules/operator-auth/crypto.mjs';
import { sessionCookie, readCookie } from '../../modules/operator-auth/http.mjs';
import { AuthError, type Session } from '../../modules/operator-auth/index.mjs';
import { personaSessions } from '../../modules/operator-auth/dev/persona-entry.mjs';
import { configure } from '../../modules/operator-auth/config.mjs';
import { authConfig } from '../session.server';
import type { Bindings } from '../bindings';

type SavedPasskey = { operator_id: string; credential_id: string; public_key: string; counter: number; operator_version: number };
const table = 'spool_local_owner_passkeys';

export function enrolledPasskey(env: Bindings, operatorId: string | null = null) {
 return env.DB.prepare(`SELECT p.operator_id,p.credential_id,p.public_key,p.counter,o.version AS operator_version
  FROM ${table} p JOIN oa_operators o ON o.id=p.operator_id
  WHERE p.credential_id IS NOT NULL AND o.role='owner' AND o.status='active'
  AND (?1 IS NULL OR p.operator_id=?1) ORDER BY p.operator_id LIMIT 1`).bind(operatorId).first<SavedPasskey>();
}

export async function savePasskey(request: Request, env: Bindings, session: Session, proof: number,
 credential: { id: string; publicKey: Uint8Array; counter: number } | null) {
 const config = configure(authConfig(env));
 const token = readCookie(request, config);
 if (!token) throw new AuthError('unauthorized', 401);
 const store = new AuthStore(env.DB);
 const now = Date.now();
 const fence = store.actorFence({ ...session, hash: await hashToken(config.SESSION_SECRET, 'session', token) }, now);
 if (!credential) {
  await store.run(`UPDATE ${table} SET credential_id=NULL,public_key=NULL,counter=0,last_proof_at=?
   WHERE operator_id=? AND ${fence.sql}`, [now, session.operator.id, ...fence.args]);
  return;
 }
 const publicKey = btoa(String.fromCharCode(...credential.publicKey));
 const saved = await store.first(`INSERT INTO ${table}(operator_id,credential_id,public_key,counter,last_proof_at)
  SELECT ?,?,?,?,? WHERE ${fence.sql}
  ON CONFLICT(operator_id) DO UPDATE SET credential_id=excluded.credential_id,public_key=excluded.public_key,
  counter=excluded.counter,last_proof_at=excluded.last_proof_at
  WHERE ${table}.credential_id IS NULL AND ${table}.last_proof_at<excluded.last_proof_at RETURNING operator_id`,
 [session.operator.id, credential.id, publicKey, credential.counter, proof, ...fence.args]);
 if (!saved) throw new AuthError('passkey_changed', 409);
}

export async function passkeySession(env: Bindings, passkey: SavedPasskey, proof: number, counter: number) {
 const now = Date.now(), config = configure(authConfig(env));
 const store = new AuthStore(env.DB);
 const accepted = await store.first(`UPDATE ${table} SET counter=?,last_proof_at=?
  WHERE operator_id=? AND credential_id=? AND public_key=? AND counter=? AND last_proof_at<?
  AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active' AND version=?)
  RETURNING operator_id`,
 [counter, proof, passkey.operator_id, passkey.credential_id, passkey.public_key, passkey.counter, proof, passkey.operator_id, passkey.operator_version]);
 if (!accepted) throw new AuthError('passkey_changed', 409);
 const token = opaqueToken();
 const session = { id: crypto.randomUUID(), hash: await hashToken(config.SESSION_SECRET, 'session', token),
  expiresAt: now + config.sessionSeconds * 1000 };
 if (!await store.issue({ operatorId: passkey.operator_id, session, now, kind: 'dev', expectedVersion: passkey.operator_version })) {
  throw new AuthError('passkey_changed', 409);
 }
 // Bind only this authenticated session. This cookie cannot switch personas or admit a project key.
 const scoped = personaSessions(env.RER_DEV_KEY, env.AUTH_ORIGIN);
 return [sessionCookie(token, config), await scoped.cookie(session.id, config.sessionSeconds)];
}
