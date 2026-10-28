import { operatorAuthPeople } from '../../modules/agent-door/index.ts';
import type { PeopleAdapter, Person } from '../../modules/agent-door/types.ts';
import type { ManagedMember, TeamAdapter } from '../../modules/business-settings/types.ts';
import { operatorAuth } from '../../auth/session.server';
import type { Bindings } from '../../auth/bindings';

export function spoolPeople(env: Bindings): PeopleAdapter {
 const native = operatorAuthPeople({ db: env.DB, session: request => operatorAuth(env).getSession(request) });
 async function person(id: string): Promise<Person | null> {
  const found = await native.person(id);
  if (!found?.active) return null;
  if (found.role === 'owner') return found;
  const member = await env.DB.prepare("SELECT role FROM spool_members WHERE operator_id=? AND state='active'").bind(id).first<{role: string}>();
  return member ? { ...found, role: member.role } : null;
 }
 return {
  person,
  async sponsor({sub}) {
   const state=await env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{owner_id:string|null}>();
   if(state?.owner_id===sub) {const mapped=await env.DB.prepare('SELECT native_id FROM spool_business_owner_binding WHERE business_id=?').bind(sub).first<{native_id:string}>();return mapped?person(mapped.native_id):null;}
   if(!state)return null;
   const mapped=await env.DB.prepare("SELECT operator_id FROM bs_team WHERE business_id=? AND state='active'").bind(sub).first<{operator_id:string|null}>();
   return mapped?.operator_id?person(mapped.operator_id):null;
  },
  async session(request) { const session = await operatorAuth(env).getSession(request); return session ? person(session.operator.id) : null; },
  async businessMember(person) {
   const state=await env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{owner_id:string|null}>();
   if(!state)return null;
   if(state.owner_id && await env.DB.prepare('SELECT 1 FROM spool_business_owner_binding WHERE business_id=? AND native_id=?').bind(state.owner_id,person.id).first())return {id:state.owner_id,role:'owner'};
   const row=await env.DB.prepare("SELECT business_id,business_role FROM bs_team WHERE operator_id=? AND state='active' AND business_id IS NOT NULL").bind(person.id).first<{business_id:string;business_role:string}>();
   return row?{id:row.business_id,role:row.business_role==='admin'?'editor':null}:null;
  },
  businessRole: person => person.role === 'owner' ? 'owner' : person.role === 'admin' ? 'editor' : null,
 };
}

/** Signed roster input binds existing native members. It never grants projects,
 * promotes a member or transfers an established Business id to a reused email. */
export function spoolTeam(env: Bindings): TeamAdapter {
 return {
  async ownerEmail() { return (await env.DB.prepare("SELECT email FROM oa_operators WHERE role='owner' AND status='active'").first<{email:string}>())?.email ?? null; },
  async prepare({ members, managed }) {
   const rows: ManagedMember[] = [];
   for (const entry of members) {
    const previous = managed.find(row => entry.id && row.businessId === entry.id) ?? managed.find(row => row.email === entry.email);
    const operator = previous?.operatorId
     ? await env.DB.prepare('SELECT id,status FROM oa_operators WHERE id=?').bind(previous.operatorId).first<{id:string;status:string}>()
     : await env.DB.prepare("SELECT o.id,o.status FROM oa_operators o JOIN spool_members m ON m.operator_id=o.id WHERE lower(o.email)=? AND m.state='active' AND o.role<>'owner'").bind(entry.email.toLowerCase()).first<{id:string;status:string}>();
    rows.push({ email: entry.email, operatorId: operator?.id ?? previous?.operatorId ?? null, invite: entry.invite,
     state: operator?.status === 'active' ? 'active' as const : 'conflict' as const, businessId: entry.id ?? previous?.businessId, businessRole: entry.role });
   }
   // Retain removed identities so a later roster address cannot steal a binding.
   for (const row of managed) if (!rows.some(next => next.businessId && next.businessId === row.businessId || next.email === row.email)) rows.push({ ...row, state: 'inactive' as const });
   return { statements: [], rows, async afterCommit() {} };
  },
 };
}
