import { createOperatorAuth, createAuthHandler, AuthError } from '../../modules/operator-auth/index.mjs';
import { hashToken } from '../../modules/operator-auth/crypto.mjs';
import { authConfig } from '../../auth/session.server.ts';
import { operatorMail } from '../../auth/mail.server.mjs';
import type { Bindings } from '../../auth/bindings';
import { readInput } from '../../modules/operator-auth/input.mjs';

// This auth instance is private to the successor invitation and its exact
// confirmation. The public administrative invitation/role doors stay closed.
function invitationAuth(env: Bindings) {
 return createOperatorAuth({ db: env.DB, config: authConfig(env), mailSender: operatorMail(env),
  clientIp: (request: Request) => request.headers.get('CF-Connecting-IP') ?? '',
  rolePolicy: ({ actor, action, role }: any) => actor.role === 'owner' && action === 'operators:invite' && role === 'member' });
}
export async function inviteSuccessor(request: Request, env: Bindings, session: any, input: any) {
 if (typeof input?.email !== 'string' || typeof input?.displayName !== 'string' || Object.keys(input).some(key => !['email','displayName'].includes(key))) throw new AuthError('invalid_input');
 const auth = invitationAuth(env);
 await auth.requireStepUp(request, 'owner:transfer');
 const email = input.email.trim().toLowerCase();
 if (email === session.operator.email) throw new AuthError('successor_must_differ', 409);
 const existing = await env.DB.prepare('SELECT id,status,role FROM oa_operators WHERE email=?').bind(email).first<any>();
 if (existing && (existing.status !== 'invited' || existing.role !== 'member')) throw new AuthError('successor_invitation_conflict', 409);
 await auth.invite(request, { ...input, email, role: 'member', returnTo: '/sign-in' });
 const successor = await env.DB.prepare('SELECT id FROM oa_operators WHERE email=?').bind(email).first<any>();
 const rates=await Promise.all(['bootstrap','magic','invite','step-up'].map(scope=>hashToken(env.SESSION_SECRET,'rate',`${scope}:email:${session.operator.email}`)));
 // Native invitation is already fenced on the owner session. This second
// fence prevents a raced revocation from publishing a transfer intention.
 const result = await env.DB.prepare(`INSERT INTO spool_owner_successor(owner_id,successor_id,session_id,owner_version,rate_keys)
 SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND o.id=? AND o.role='owner' AND o.status='active' AND o.version=? AND s.operator_version=o.version AND s.revoked_at IS NULL AND s.expires_at>?)
 ON CONFLICT(owner_id) DO UPDATE SET successor_id=excluded.successor_id,session_id=excluded.session_id,owner_version=excluded.owner_version,rate_keys=excluded.rate_keys`)
 .bind(session.operator.id,successor.id,session.id,session.operator.version,JSON.stringify(rates),session.id,session.operator.id,session.operator.version,Date.now()).run();
 if (!result.meta.changes) throw new AuthError('authority_changed', 409);
 return { status: 'invited' };
}
export async function successorConfirmation(request: Request, env: Bindings): Promise<Response | null> {
 const url = new URL(request.url);
 if (url.pathname !== '/auth/confirm') return null;
 let token: unknown;
 if (request.method === 'GET' || request.method === 'HEAD') token = url.searchParams.get('token');
 else if (request.method === 'POST') {
  try { token = (await readInput(request.clone())).token; } catch { return null; }
 }
 if (typeof token !== 'string' || token.length > 1024) return null;
 const digest = await hashToken(env.SESSION_SECRET, 'link', token);
 const selected = await env.DB.prepare(`SELECT 1 FROM oa_tokens t JOIN spool_owner_successor x ON x.successor_id=t.operator_id AND x.owner_id=t.issuer_id
 JOIN oa_operators o ON o.id=x.owner_id WHERE t.token_hash=? AND t.kind='invite' AND o.role='owner' AND o.status='active' AND t.issuer_version=o.version AND x.owner_version=o.version`).bind(digest).first();
 return selected ? createAuthHandler(invitationAuth(env))(request) : null;
}
