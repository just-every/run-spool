import { operatorAuthPeople, type PeopleAdapter } from '../../modules/agent-door/index.ts';
import { createBusinessSettings, type TeamAdapter, type ManagedMember } from '../../modules/business-settings/index.ts';
import { operatorAuth } from '../../auth/session.server';
import type { Bindings } from '../../auth/bindings';

/** Only current native identities bound by signed Business settings establish
 * an internal recipient. An address domain or display text proves nothing. */
export async function internalRecipient(env: Bindings, email: string): Promise<boolean> {
 const row=await env.DB.prepare(`SELECT 1 FROM oa_operators o JOIN bs_settings b ON b.singleton=1
 WHERE b.stopped=0 AND o.status='active' AND lower(o.email)=lower(?) AND (
  (o.role='owner' AND b.owner_id IS NOT NULL AND EXISTS(SELECT 1 FROM oa_bootstrap a WHERE a.singleton=1 AND a.claim_id=o.id))
  OR EXISTS(SELECT 1 FROM bs_team t JOIN spool_members m ON m.operator_id=o.id
   WHERE t.operator_id=o.id AND t.business_id IS NOT NULL AND t.state='active' AND m.state='active' AND lower(t.email)=lower(o.email))
 )`).bind(email).first();
 return !!row;
}

/** Roster email is used only for first reconciliation. Every subsequent
 * document follows the stored native id, including after email reassignment.
 * Native invitations and project grants remain the team's existing lifecycle. */
function team(env: Bindings): TeamAdapter {
 const db=env.DB;
 return {
  async ownerEmail() { return (await db.prepare("SELECT email FROM oa_operators WHERE role='owner' AND status='active'").first<{email:string}>())?.email??null; },
  async prepare({members,managed}) {
   const rows: ManagedMember[]=[],gone=new Set<string>();
   // A stored row whose operator no longer exists was erased by an earlier release: the module retires it with this revision.
   const erased=async(id:string|null|undefined)=>!!id&&!await db.prepare('SELECT 1 FROM oa_operators WHERE id=?').bind(id).first();
   for (const member of members) {
    const prior=managed.find(row=>row.businessId && row.businessId===member.id)??managed.find(row=>row.email===member.email);
    if(await erased(prior?.operatorId)){gone.add(prior!.operatorId!);continue;}
    const native=await db.prepare(`SELECT o.id,o.status,m.state FROM oa_operators o JOIN spool_members m ON m.operator_id=o.id
     WHERE ${prior?.operatorId?'o.id=?':'o.email=?'} AND o.role<>'owner'`)
     .bind(prior?.operatorId??member.email).first<{id:string;status:string;state:string}>();
    rows.push({email:member.email,operatorId:native?.id??prior?.operatorId??null,invite:member.invite,
     state:!native?'conflict':native.status==='inactive'||native.state!=='active'?'inactive':native.status==='invited'?'invited':'active'});
   }
   for(const prior of managed) if(!members.some(member=>member.email===prior.email)){
    if(await erased(prior.operatorId)){gone.add(prior.operatorId!);continue;}
    rows.push({...prior,state:'inactive'});
   }
   return {statements:[],rows,gone:[...gone],async afterCommit(){}};
  },
 };
}
export function businessSettings(env: Bindings) {
 return createBusinessSettings({db:env.DB,trust:env.RER_BUSINESS_TRUST,
  business:{settings:1,values:['display_name'],team:{roles:{admin:'admin',member:'member'}}},team:team(env)});
}

export function spoolPeople(env: Bindings): PeopleAdapter {
 const base=operatorAuthPeople({db:env.DB,session:request=>request.headers.has('authorization')?Promise.resolve(null):operatorAuth(env).getSession(request)});
 const person: PeopleAdapter['person']=async id=>{
  const p=await base.person(id); if(!p) return null;
  const membership=p.role==='owner'?null:await env.DB.prepare("SELECT role FROM spool_members WHERE operator_id=? AND state='active'").bind(id).first<{role:string}>();
  return {...p,active:p.active&&(p.role==='owner'||!!membership),role:p.role==='owner'?'owner':membership?.role??'inactive'};
 };
 return {...base,person,async businessStopped(){
  // Fail closed: only a stored settings row that is positively running answers false.
  const settings=await env.DB.prepare('SELECT stopped FROM bs_settings WHERE singleton=1').first<{stopped:number}>();
  return settings?.stopped!==0;
 },async sponsor(claims){
  const owner=await env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1').first<{owner_id:string|null}>();
  if(owner?.owner_id===claims.sub){
   const claimed=await env.DB.prepare('SELECT claim_id FROM oa_bootstrap WHERE singleton=1').first<{claim_id:string}>();
   return claimed?person(claimed.claim_id):null;
  }
  const row=await env.DB.prepare("SELECT operator_id FROM bs_team WHERE business_id=? AND state='active'").bind(claims.sub).first<{operator_id:string|null}>();
  return row?.operator_id?person(row.operator_id):null;
 },async businessMember(p){
  const owner=await env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1').first<{owner_id:string|null}>();
  const claimed=await env.DB.prepare('SELECT claim_id FROM oa_bootstrap WHERE singleton=1').first<{claim_id:string}>();
  if(owner?.owner_id&&claimed?.claim_id===p.id)return {id:owner.owner_id,role:'owner'};
  const row=await env.DB.prepare("SELECT business_id,business_role FROM bs_team WHERE operator_id=? AND state='active' AND business_id IS NOT NULL").bind(p.id).first<{business_id:string;business_role:string}>();
  return row?{id:row.business_id,role:row.business_role==='admin'?'editor':null}:null;
 },async session(request){const p=await base.session(request);return p?person(p.id):null;},
 businessRole:p=>p.role==='owner'?'owner':p.role==='admin'?'editor':null};
}
