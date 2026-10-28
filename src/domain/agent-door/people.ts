import { operatorAuthPeople, type PeopleAdapter } from '../../modules/agent-door/index.ts';
import { createBusinessSettings, type TeamAdapter, type ManagedMember } from '../../modules/business-settings/index.ts';
import { operatorAuth } from '../../auth/session.server';
import type { Bindings } from '../../auth/bindings';

/** Roster email is used only for first reconciliation. Every subsequent
 * document follows the stored native id, including after email reassignment.
 * Native invitations and project grants remain the team's existing lifecycle. */
function team(env: Bindings): TeamAdapter {
 const db=env.DB;
 return {
  async ownerEmail() { return (await db.prepare("SELECT email FROM oa_operators WHERE role='owner' AND status='active'").first<{email:string}>())?.email??null; },
  async prepare({members,managed}) {
   const rows: ManagedMember[]=[];
   for (const member of members) {
    const prior=managed.find(row=>row.businessId && row.businessId===member.id)??managed.find(row=>row.email===member.email);
    const native=await db.prepare(`SELECT o.id,o.status,m.state FROM oa_operators o JOIN spool_members m ON m.operator_id=o.id
     WHERE ${prior?.operatorId?'o.id=?':'o.email=?'} AND o.role<>'owner'`)
     .bind(prior?.operatorId??member.email).first<{id:string;status:string;state:string}>();
    rows.push({email:member.email,operatorId:native?.id??prior?.operatorId??null,invite:member.invite,
     state:!native?'conflict':native.status==='inactive'||native.state!=='active'?'inactive':native.status==='invited'?'invited':'active'});
   }
   for(const prior of managed) if(!members.some(member=>member.email===prior.email)) rows.push({...prior,state:'inactive'});
   return {statements:[],rows,async afterCommit(){}};
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
 return {...base,person,async sponsor(claims){
  const mapped=await base.sponsor(claims); if(!mapped)return null;
  const active=await env.DB.prepare("SELECT 1 FROM bs_team WHERE business_id=? AND operator_id=? AND state='active'").bind(claims.sub,mapped.id).first();
  const owner=await env.DB.prepare('SELECT 1 FROM bs_settings WHERE owner_id=? AND singleton=1 AND stopped=0').bind(claims.sub).first();
  return active||owner?person(mapped.id):null;
 },async session(request){const p=await base.session(request);return p?person(p.id):null;},
 businessRole:p=>p.role==='owner'?'owner':p.role==='admin'?'editor':null};
}
