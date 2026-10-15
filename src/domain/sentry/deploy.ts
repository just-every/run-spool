import { ownerSession, ownerWrite } from '../../auth/session.server';
import { hash } from '../privacy.ts';
import { mintAdmission } from '../dev-credentials';
import { mintedByCurrentPerson } from '../credential-fence';
/** Both upload handlers call this themselves, even when invoked without middleware. */
export async function authorizeDeploy(c:any,project:string):Promise<{guard:()=>D1PreparedStatement}|{response:Response}>{
  const session=await ownerSession(c.req.raw,c.env);
  if(session){
    if(!ownerWrite(c.req.raw,c.env))return {response:c.json({error:'Same-origin required'},403)};
    return {guard:()=>c.env.DB.prepare("INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND s.operator_version=o.version AND o.status='active' AND o.role='owner') THEN 1 ELSE 0 END").bind(session.id,session.operator.id)};
  }
  const match=/^Bearer ([a-zA-Z0-9_]{1,128})$/.exec(c.req.header('authorization')??'');
  if(!match)return {response:c.json({error:'Owner session or project deploy key required'},401)};
  const digest=await hash(match[1]);
  const grant=await c.env.DB.prepare(`SELECT project,kind FROM credentials WHERE hash=? AND kind IN ('agent','deploy') AND revoked IS NULL AND ${mintedByCurrentPerson} AND ${await mintAdmission(c.req.raw)}`).bind(digest).first();
  if(!grant)return {response:c.json({error:'Invalid deploy key'},401)};
  // These routes precede the normal agent guard; preserve its read-only denial.
  if(grant.kind==='agent')return {response:c.json({error:'Agent keys are read-only and limited to their project.'},403)};
  if(grant.project!==project)return {response:c.json({error:'Deploy project scope required'},403)};
  return {guard:()=>c.env.DB.prepare(`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM credentials WHERE hash=? AND project=? AND kind='deploy' AND revoked IS NULL AND ${mintedByCurrentPerson}) THEN 1 ELSE 0 END`).bind(digest,project)};
}
export async function deployBatch(c:any,authorization:{guard:()=>D1PreparedStatement},statements:D1PreparedStatement[]){
  return c.env.DB.batch([authorization.guard(),...statements,authorization.guard(),c.env.DB.prepare('DELETE FROM spool_authority_guards')]);
}
