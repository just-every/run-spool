import { agentErasureStatements, checkAgentArtifacts, operatorPolicyRefs, type Tombstone } from '../../modules/agent-door/index.ts';
import { portability } from '../portability';
import { catalogue } from './catalogue.mjs';
import { ownerIdentifiers } from '../erasure/owner-capture';

import { mentions, projectAgentArtifacts, operatorAgentArtifacts } from './artifact-map.mjs';
export { retainedAgentArtifacts } from './artifact-map.mjs';

export async function eraseNativeAgentArtifacts(db:D1Database,secret:string,kind:'project'|'operator',id:string,operation?:{id:string;at:string}) {
 if(!operation)throw new Error('native_erasure_operation_required');
 const values:Array<string|{name:string}>=kind==='operator'?(await ownerIdentifiers(db,id)).filter(value=>value===id||value.includes('@')):[id,`spool://projects/${encodeURIComponent(id)}`];
 if(kind==='project'){
  // Resolve all real native targets before their graph leaves. Child-only
  // approvals and review/Undo are selected through the same durable IDs.
  for(const table of ['issues','grouping_proposals','grouping_corrections','reproducers','reproducer_runs','repairs','fix_workflows','alert_rules','alert_destinations']){
   const rows=(await db.prepare(`SELECT id FROM ${table} WHERE project=?`).bind(id).all<{id:string}>()).results;values.push(...rows.map(row=>row.id));
  }
 }else{
  const owner=await db.prepare('SELECT display_name FROM oa_operators WHERE id=?').bind(id).first<{display_name:string}>();
  if(owner?.display_name)values.push({name:owner.display_name});
  const paired=await db.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1').first<{owner_id:string|null}>();if(paired?.owner_id)values.push(paired.owner_id);
  const members=(await db.prepare('SELECT business_id FROM bs_team WHERE operator_id=? AND business_id IS NOT NULL').bind(id).all<{business_id:string}>()).results;values.push(...members.map(row=>row.business_id));
  const agents=(await db.prepare('SELECT id FROM agent_door_agents WHERE sponsor=?').bind(id).all<{id:string}>()).results;values.push(...agents.map(row=>row.id));
 }
 const map=kind==='operator'?operatorAgentArtifacts:projectAgentArtifacts;
 await checkAgentArtifacts(db,map);
 const transfer=await portability(db),subject:Record<string,string>={values:JSON.stringify([...new Set(values)])};
 // The operator recipe: the person's policy references also retire them from the Business-signed roster.
 if(kind==='operator')subject.policyRefs=JSON.stringify(await operatorPolicyRefs(db,id));
 let checkpointed=false;
 const out=await agentErasureStatements({db,map,subject,secret,tombstone:{erasure_id:operation.id,at:operation.at} as Tombstone,checkpoint:async()=>{checkpointed=true;return transfer.redactionStatements();}});
 if(!checkpointed)out.push(...await transfer.redactionStatements());
 // Native policy hook first: it empties a policy that names the subject before the retired-reference step rewrites its references.
 const policyMention=mentions('agent_door_state',['envelope','local_document']);
 out.unshift(db.prepare(`UPDATE agent_door_state SET envelope=NULL,local_document=NULL,local_revision=local_revision+1,local_paused=1,decision_lock=NULL,decision_until=NULL WHERE ${policyMention}`).bind(subject.values));
 // Local Business overrides the person authored leave with them (the roster step may already have marked their attribution).
 if(kind==='operator')out.push(db.prepare('DELETE FROM bs_overrides WHERE actor IN (SELECT value FROM json_each(?)) OR actor=?').bind(JSON.stringify(values.filter((value):value is string=>typeof value==='string'&&(value===id||value.includes('@')))),'person:erased:'+operation.id));
 if(kind==='operator')out.push(db.prepare('UPDATE bs_settings SET document=NULL,owner_id=NULL,stopped=1,token=? WHERE singleton=1').bind(crypto.randomUUID()));
 return out;
}

export async function nativeErasureFence(db:D1Database,_name:string,args:Record<string,unknown>) {
 // Native erasure management returns count-only receipts and must remain
 // resumable. Other doors cannot capture a subject during its native operation.
 if(['privacy','erasure-resume'].includes(String(catalogue.find(tool=>tool.name===_name)?.route??'')))return false;
 return !!await db.prepare(`SELECT 1 FROM rer_erasure_operations WHERE phase='deleting' AND
 (entity='installation-owner' OR (entity='project' AND (? IS NULL OR json_extract(subject,'$.id')=? OR EXISTS(SELECT 1 FROM rer_erasure_scope s WHERE s.operation=rer_erasure_operations.id AND json_extract(s.key_json,'$.id')=?)))) LIMIT 1`).bind(typeof args.project==='string'?args.project:null,typeof args.project==='string'?args.project:null,typeof args.id==='string'?args.id:null).first();
}
