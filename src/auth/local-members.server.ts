// Loaded only by the product-owned local entry, never by the hosted Worker.
import type { Bindings } from './bindings';
import { configure } from '../modules/operator-auth/config.mjs';
import { readCookie } from '../modules/operator-auth/http.mjs';
import { readInput } from '../modules/operator-auth/input.mjs';
import { hashToken, validToken } from '../modules/operator-auth/crypto.mjs';
import { authConfig } from './session.server';

const invitations = new WeakMap<Request, Promise<boolean>>();
export async function localInvitationWitness(env: Bindings, digest: string): Promise<boolean> {
 const row = await env.DB.prepare(`SELECT 1 FROM spool_local_invite_links l
  JOIN spool_member_invites i ON i.id=l.invite JOIN spool_members m ON m.id=i.member
  JOIN oa_operators o ON o.id=m.operator_id JOIN oa_tokens t ON t.id=l.token_id AND t.operator_id=o.id
  WHERE t.token_hash=? AND m.state='active' AND o.role='member' AND o.status='invited'
   AND i.state='invited' AND t.kind='invite' AND t.consumed_at IS NULL AND t.revoked_at IS NULL
   AND t.expires_at>? AND t.operator_version=o.version`).bind(digest, Date.now()).first();
 return !!row;
}
// Cache the original request's bounded token before native auth consumes its body.
// The WeakMap keeps concurrent confirmations separate; no token enters a header
// or cookie, and native auth still checks issuer authority and consumes it once.
export async function prepareLocalMemberRequest(request: Request, env: Bindings): Promise<void> {
 if (new URL(request.url).pathname !== '/auth/confirm' || request.headers.has('authorization')) return;
 const proof = (async () => {
  try {
   const token = request.method === 'GET' || request.method === 'HEAD'
    ? new URL(request.url).searchParams.get('token')
    : request.method === 'POST' ? (await readInput(request.clone())).token : null;
   return validToken(token) && await localInvitationWitness(env, await hashToken(env.SESSION_SECRET, 'link', token));
  } catch { return false; }
 })();
 invitations.set(request, proof);
 await proof;
}
export async function localMemberAdmission(request: Request, env: Bindings): Promise<boolean> {
 // Explicit credentials choose their own authority. Member cookies never admit
 // bearer grants, one-click accounts, owner personas or the owner gate.
 if (request.headers.has('authorization')) return false;
 const path = new URL(request.url).pathname;
 if (path === '/auth/confirm') return await invitations.get(request) ?? false;
 if (path === '/auth/one-click' || path === '/signin' || path.startsWith('/auth/dev/') || path.startsWith('/__dev/')) return false;
 const token = readCookie(request, configure(authConfig(env)));
 if (!token) return false;
 const digest = await hashToken(env.SESSION_SECRET, 'session', token);
 const row = await env.DB.prepare(`SELECT 1 FROM oa_sessions a
  JOIN oa_operators o ON o.id=a.operator_id JOIN spool_members m ON m.operator_id=o.id
  JOIN spool_local_invite_links l ON l.token_id=a.source_token_id
  JOIN spool_member_invites i ON i.id=l.invite AND i.member=m.id
  WHERE a.token_hash=? AND a.kind='dev' AND a.revoked_at IS NULL AND a.expires_at>?
   AND a.operator_version=o.version AND o.status='active' AND o.role='member' AND m.state='active'`)
  .bind(digest, Date.now()).first();
 return !!row;
}
