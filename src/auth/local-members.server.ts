// Only server.dev imports this policy. The hosted entry registers no dev admission.
import type { Bindings } from './bindings';
import type { DevCredential } from '../modules/operator-auth/dev-admission.mjs';

export async function localMemberCredential(_request: Request, env: Bindings, credential: DevCredential): Promise<boolean> {
 // Auth has already verified the token/session lifetime, version and identity.
 // Require this product's invitation custody too; a member proof never opens
 // one-click accounts, owner personas or unrelated dev credentials.
 const witness = credential.type === 'invite'
  ? { sql: "t.token_hash=? AND t.consumed_at IS NULL AND i.state='invited' AND o.status='invited'", args: [credential.digest] }
  : { sql: "o.id=? AND o.status='active' AND EXISTS(SELECT 1 FROM oa_sessions a WHERE a.id=? AND a.operator_id=o.id AND a.source_token_id=t.id AND a.kind='dev')", args: [credential.operatorId, credential.id] };
 const row = await env.DB.prepare(`SELECT 1 FROM spool_local_invite_links l
  JOIN spool_member_invites i ON i.id=l.invite
  JOIN spool_members m ON m.id=i.member
  JOIN oa_operators o ON o.id=m.operator_id
  JOIN oa_tokens t ON t.id=l.token_id AND t.operator_id=o.id
  WHERE m.state='active' AND o.role='member' AND t.kind='invite' AND ${witness.sql}`)
  .bind(...witness.args).first();
 return !!row;
}
