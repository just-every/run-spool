import { hash } from '../privacy';
import type { ActorKind, AuditActor, SubjectKind } from './types';

export const randomAuditLabel = () => 'audit:' + crypto.randomUUID().replaceAll('-','');
export const authorityHash = (kind: string, authority: string) => hash('spool-audit\u0000' + kind + '\u0000' + authority);
type Binding = { kind: string; authority: string; owner?: string | null; project?: string | null };

// A request admitted before erasure must never recreate a deleted identity
// link afterwards. Bind only while the native owner/project still exists.
function liveBinding(binding: Binding) {
 const conditions:string[]=[],params:string[]=[];
 if(binding.owner){conditions.push("EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')");params.push(binding.owner);}
 if(binding.project){conditions.push('EXISTS(SELECT 1 FROM projects WHERE id=?)');params.push(binding.project);}
 return {predicate:conditions.length?conditions.join(' AND '):'1',params};
}
/** Only call with server-established authority; this function never authorizes. */
export async function auditLabel(db: D1Database, binding: Binding, label = randomAuditLabel()): Promise<string> {
 const [lookup,owner,project] = await Promise.all([
  authorityHash(binding.kind,binding.authority), binding.owner ? authorityHash('owner',binding.owner) : null,
  binding.project ? authorityHash('project',binding.project) : null,
 ]);
 const {predicate,params}=liveBinding(binding);
 const result=await db.batch([
  db.prepare(`INSERT INTO audit_actor_links(kind,lookup_hash,label,owner_hash,project_hash,owner_id,project,created) SELECT ?,?,?,?,?,?,?,? WHERE ${predicate} ON CONFLICT(kind,lookup_hash) DO NOTHING`)
   .bind(binding.kind,lookup,label,owner,project,binding.owner??null,binding.project??null,Date.now(),...params),
  db.prepare(`SELECT label FROM audit_actor_links WHERE kind=? AND lookup_hash=? AND ${predicate}`).bind(binding.kind,lookup,...params),
 ]);
 const row=result[1].results[0] as {label:string}|undefined;
 // Erased or nonexistent authority has no durable mapping. The observation
 // may still be retained under a fresh, intentionally unbound alias.
 return row?.label??randomAuditLabel();
}

export async function auditActor(db: D1Database, binding: Binding & { kind: Exclude<ActorKind,'anonymous'|'unknown'> }): Promise<AuditActor> {
 return {kind:binding.kind,label:await auditLabel(db,{...binding,owner:['owner','member'].includes(binding.kind)?binding.authority:binding.owner})};
}
export function unidentifiedActor(kind: 'anonymous' | 'unknown' = 'anonymous'): AuditActor { return {kind,label:randomAuditLabel()}; }
export const serviceNames = ['scheduled retention','alerts','mail','webhook','slack','erasure','reproducer','fix-provider','portability-cli','business-import','legacy-import','deployment-deadline'] as const;
export const serviceActor = (db: D1Database, service: typeof serviceNames[number]) => auditActor(db,{kind:'service',authority:service});
/** An alias an earlier admitted request bound; reading it creates nothing. */
export async function boundAuditLabel(db: D1Database, binding: Binding): Promise<string | undefined> {
 const {predicate,params}=liveBinding(binding);
 return (await db.prepare(`SELECT label FROM audit_actor_links WHERE kind=? AND lookup_hash=? AND ${predicate}`)
  .bind(binding.kind,await authorityHash(binding.kind,binding.authority),...params).first<{label:string}>())?.label;
}
export const subjectBinding = (kind: SubjectKind, authority: string, project?: string): Binding => ({kind:'subject:'+kind,authority,project});
export const auditSubject = async (db: D1Database, kind: SubjectKind, authority: string, project?: string) =>
 ({kind,label:await auditLabel(db,subjectBinding(kind,authority,project))});
export const projectAuditLabel = (db: D1Database, project: string) => auditLabel(db,{kind:'subject:project',authority:project,project});

/** Include these in the erasure transaction; labels on permanent rows stay unchanged. */
export async function eraseActorLinks(db: D1Database, owner: string): Promise<D1PreparedStatement> {
 return db.prepare('DELETE FROM audit_actor_links WHERE owner_hash=?').bind(await authorityHash('owner',owner));
}
export async function eraseProjectLinks(db: D1Database, project: string): Promise<D1PreparedStatement> {
 return db.prepare('DELETE FROM audit_actor_links WHERE project_hash=?').bind(await authorityHash('project',project));
}
