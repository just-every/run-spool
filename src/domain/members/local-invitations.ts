import type { Bindings } from '../../auth/bindings';
import type { MailMessage, Session } from '../../modules/operator-auth/index.mjs';
import { localDevelopmentEnabled } from '../../auth/local.server.mjs';
import { decryptJson, encryptJson } from '../../modules/operator-auth/identity/oidc/aes-gcm.mjs';
import { s } from './model';

const purpose = 'spool-local-invitation/1';
async function key(env: Bindings) {
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(purpose + '\0' + env.SESSION_SECRET));
 return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const aad = (env: Bindings, invite: string, issuer: string) => JSON.stringify([purpose, env.AUTH_ORIGIN, invite, issuer]);

// Capture only the very same link submitted to the suppressing mail sender.
export async function localInvitation(env: Bindings, session: Pick<Session, 'operator'>, invite: string, message: MailMessage) {
 if (!localDevelopmentEnabled(env) || session.operator.role !== 'owner') return null;
 const token = message.text.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];
 if (!token) return null;
 return { tokenId: message.deliveryId, envelope: JSON.stringify(await encryptJson(await key(env), aad(env, invite, session.operator.id), { token })) };
}

export async function localInvitationLink(env: Bindings, session: Pick<Session, 'operator'>, invite: string) {
 if (!localDevelopmentEnabled(env) || session.operator.role !== 'owner') return null;
 const row = await s(env.DB, `SELECT l.envelope FROM spool_local_invite_links l
  JOIN spool_member_invites i ON i.id=l.invite JOIN spool_members m ON m.id=i.member
  JOIN oa_tokens t ON t.id=l.token_id JOIN oa_operators o ON o.id=t.operator_id
  WHERE l.invite=? AND l.issuer=? AND i.state='invited' AND m.state='active'
   AND m.operator_id=o.id AND o.status='invited' AND t.kind='invite'
   AND t.issuer_id=? AND t.issuer_version=? AND t.operator_version=o.version
   AND t.consumed_at IS NULL AND t.revoked_at IS NULL AND t.expires_at>?`,
  invite, session.operator.id, session.operator.id, session.operator.version, Date.now()).first<{ envelope: string }>();
 if (!row) return null;
 try {
  const { token } = await decryptJson(await key(env), aad(env, invite, session.operator.id), JSON.parse(row.envelope));
  const link = new URL('/auth/confirm', env.AUTH_ORIGIN); link.searchParams.set('token', token);
  return link.href;
 } catch { return null; }
}
