import { AuthError } from '../../modules/operator-auth/index.mjs';
import { normalizeEmail } from '../../modules/operator-auth/policy.mjs';
import { operatorAuth } from '../../auth/session.server';
import { ownerBatch } from '../owner-authority';
import { auditCommit } from '../audit/context';
import { fields, name, role, version, grants, check } from './input';
import { s, type TeamSession } from './model';
import { mintedByCurrentPerson } from '../credential-fence';
import type { Bindings } from '../../auth/bindings';

export async function invite(request: Request, env: Bindings, session: TeamSession, organization: string, input: any) {
 fields(input,['email','name','role','grants']);
 const email=normalizeEmail(input.email), displayName=name(input.name), memberRole=role(input.role), access=await grants(env.DB,organization,input.grants);
 if (memberRole==='billing'&&access.length) throw new AuthError('Billing has no project grants',400);
 const existing=await s(env.DB,'SELECT * FROM spool_members WHERE email=?',email).first<any>();
 if (existing?.state==='active') throw new AuthError('Member already invited',409);
 const native=await s(env.DB,'SELECT id,status,role FROM oa_operators WHERE email=?',email).first<any>();
 if (native?.role==='owner') throw new AuthError('Owner already belongs to this organization',409);
 if (native?.status==='inactive') {
  // A fresh native invitation, rather than reactivation, proves the person
  // again. The cancellation witness never revives an old session or key.
  await ownerBatch(env.DB,session,[s(env.DB,'INSERT OR REPLACE INTO oa_invitation_cancellations(operator_id,operator_version) SELECT id,version FROM oa_operators WHERE id=? AND status=\'inactive\'',native.id)]);
 }
 if (native?.status!=='active') await operatorAuth(env,true).invite(request,{email,displayName,role:'member',returnTo:'/'});
 const person=await s(env.DB,'SELECT id,status FROM oa_operators WHERE email=?',email).first<any>();
 if (!person) throw new AuthError('Invitation not confirmed',503);
 const id=existing?.id??crypto.randomUUID(), time=Date.now();
 await ownerBatch(env.DB,session,[
  check(env.DB,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status IN ('invited','active'))",person.id),
  s(env.DB,`INSERT INTO spool_members(id,organization,operator_id,email,name,role,state,version,created) VALUES(?,?,?,?,?,?,'active',1,?)
   ON CONFLICT(id) DO UPDATE SET operator_id=excluded.operator_id,name=excluded.name,role=excluded.role,state='active',version=spool_members.version+1`,id,organization,person.id,email,displayName,memberRole,time),
  s(env.DB,'DELETE FROM spool_project_grants WHERE member=?',id),
  ...access.map(g=>s(env.DB,'INSERT INTO spool_project_grants VALUES(?,?,?,?)',id,g.project,g.role,time)),
  s(env.DB,'INSERT INTO spool_member_invites VALUES(?,?,?,?)',crypto.randomUUID(),id,time,person.status==='active'?'accepted':'invited'),auditCommit(env.DB),
 ]);
 return {id,status:person.status==='active'?'accepted':'invited'};
}

export async function updateMember(env: Bindings, session: TeamSession, organization: string, id: string, input: any, remove: boolean) {
 fields(input,remove?['version']:['version','role','grants']);
 const expected=version(input.version), member=await s(env.DB,'SELECT m.*,o.role native_role FROM spool_members m LEFT JOIN oa_operators o ON o.id=m.operator_id WHERE m.id=? AND m.organization=?',id,organization).first<any>();
 if (!member) throw new AuthError('Member not found',404);
 if (member.native_role==='owner'||member.operator_id===session.operator.id) throw new AuthError('Use owner transfer or another administrator',409);
 if (member.state!=='active'||member.version!==expected) throw new AuthError('Membership changed',409);
 const memberRole=remove?member.role:role(input.role), access=remove?[]:await grants(env.DB,organization,input.grants);
 if (memberRole==='billing'&&access.length) throw new AuthError('Billing has no project grants',400);
 const time=Date.now();
 await ownerBatch(env.DB,session,[
  check(env.DB,"EXISTS(SELECT 1 FROM spool_members m WHERE m.id=? AND m.version=? AND m.state='active' AND NOT EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=m.operator_id AND o.role='owner'))",id,expected),
  s(env.DB,"UPDATE spool_members SET role=?,state=?,version=version+1 WHERE id=?",memberRole,remove?'removed':'active',id),
  s(env.DB,'DELETE FROM spool_project_grants WHERE member=?',id),
  ...access.map(g=>s(env.DB,'INSERT INTO spool_project_grants VALUES(?,?,?,?)',id,g.project,g.role,time)),
  // A narrowed grant is permanent retirement of the old key, so restoring a
  // grant later cannot resurrect a credential from before the change.
  s(env.DB,`UPDATE credentials SET revoked=COALESCE(revoked,?) WHERE minted_by=? AND NOT ${mintedByCurrentPerson}`,time,member.operator_id),
  ...(remove?[
   s(env.DB,"UPDATE oa_operators SET status='inactive' WHERE id=? AND role<>'owner'",member.operator_id),
   s(env.DB,'UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=?',time,member.operator_id),
   s(env.DB,'UPDATE oa_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=? OR issuer_id=?',time,member.operator_id,member.operator_id),
   s(env.DB,'UPDATE oa_credentials SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=?',time,member.operator_id),
   s(env.DB,"UPDATE spool_service_accounts SET state='removed',version=version+1 WHERE sponsor=? AND state='active'",member.operator_id),
   s(env.DB,"UPDATE spool_member_invites SET state='cancelled' WHERE member=? AND state='invited'",id),
  ]:[]),auditCommit(env.DB),
 ]);
 return {ok:true,version:expected+1};
}
