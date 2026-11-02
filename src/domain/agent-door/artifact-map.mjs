// Native adaptation of the erasure custody reference at Base 8b925fa5ffaa577df9f2e4ebab6ede8af5155baa, default-seed/src/agent-door/erasure.ts.
// Native identifiers are exact JSON values, not common display-name substrings.
// Resource URIs have the native project's path boundary, never an ID substring.
const sourceId = "CASE WHEN subject.type='object' THEN json_extract(subject.value,'$.sourceUserId') END"
const recordedName = "CASE WHEN subject.type='object' THEN json_extract(subject.value,'$.name') END"
const textValue = `coalesce((${sourceId}),(${recordedName}))`
const tokenCharacter = "'[A-Za-z0-9_@.+/:-]'"
// Preserve identifier/URI/version tokens. A sentence's final period delimits a
// name, but the period within version 1.0 or another token does not. Colons
// delimit recorded names while remaining part of source identifiers. Non-ASCII
// letters also continue a name; Unicode spaces/punctuation delimit it.
const boundary = (position, outward) => {
  const char = `substr(text,${position},1)`, next = `substr(text,(${position})+(${outward}),1)`
  return `(${char} NOT GLOB ${tokenCharacter} OR ((${recordedName}) IS NOT NULL AND (${char}=':' OR (${char}='.' AND ${next} NOT GLOB ${tokenCharacter}))))
    AND NOT ((${recordedName}) IS NOT NULL AND coalesce(unicode(${char}),0)>127 AND ${char} NOT GLOB '[\u00a0\u2000-\u206f\u2e00-\u2e7f\u3000-\u303f]')`
}
// Check every literal occurrence, including one after an embedded occurrence.
const textMention = (column) => `EXISTS(
  WITH RECURSIVE hits(text,source,pos) AS (
    SELECT content.value,(${textValue}),instr(content.value,(${textValue}))
    FROM json_tree(CASE WHEN json_valid(${column}) THEN ${column} ELSE json_quote(${column}) END) content
    WHERE content.type='text'
    UNION ALL
    SELECT text,source,pos+instr(substr(text,pos+1),source) FROM hits
    WHERE pos>0 AND instr(substr(text,pos+1),source)>0
  )
  SELECT 1 FROM hits WHERE pos>0
    AND ${boundary('pos-1', -1)}
    AND ${boundary('pos+length(source)', 1)}
)`
export const mentions=(table,columns)=>`EXISTS(SELECT 1 FROM json_each(?1) subject WHERE ${columns.map(column=>{
 const value=table+'.'+column;
 return `(subject.type='text' AND EXISTS(SELECT 1 FROM json_tree(CASE WHEN json_valid(${value}) THEN ${value} ELSE json_quote(${value}) END) cell WHERE cell.type='text' AND (cell.value=subject.value OR cell.value='person:'||subject.value OR (instr(subject.value,'@')>0 AND instr(cell.value,subject.value)>0) OR (substr(subject.value,1,8)='spool://' AND (cell.value=subject.value OR instr(cell.value,subject.value||'/')=1))))) OR (subject.type='object' AND ${textMention(value)})`;
}).join(' OR ')})`;
const calls=mentions('agent_door_calls',['key','outcome']);
const approvals=mentions('agent_door_approvals',['saved','approvals','result']);
const reviews=mentions('agent_door_reviews',['saved','marked_by']);
const audits=mentions('agent_door_audit',['row','evidence']);
const decisions=`SELECT decision_id FROM agent_door_calls WHERE ${calls} UNION SELECT json_extract(saved,'$.decision_id') FROM agent_door_approvals WHERE ${approvals} UNION SELECT json_extract(saved,'$.decision_id') FROM agent_door_reviews WHERE ${reviews} UNION SELECT id FROM agent_door_audit WHERE ${audits}`;
const match=(sql)=>({sql,params:['values']});
export function nativeAgentArtifacts(operator=false) {return {artifacts:[
 {table:'agent_door_state',columns:['id','envelope','local_document','local_revision','local_paused','decision_lock','decision_until'],unrelated:'Installation policy without selected-subject references is retained. The native hook retires matching references in the same transaction; revision, Pause and admission-lease metadata remain.'},
 {table:'agent_door_agents',columns:['id','name','specialist','sponsor','sponsor_name','revoked','window','requests','tombstone'],...operator?{match:match(mentions('agent_door_agents',['sponsor','sponsor_name']))}:{unrelated:'Non-person agent identities and native sponsors belong to installation authority, not the erased project.'}},
 {table:'agent_door_calls',columns:['agent','key','digest','decision_id','created_at','state','outcome','expires_at'],match:match(`decision_id IN (${decisions})`)},
 {table:'agent_door_audit',columns:['sequence','id','at','agent','classes','row','evidence'],match:match(`id IN (${decisions}) OR json_extract(row,'$.decision_id') IN (${decisions}) OR json_extract(row,'$.replay_of') IN (${decisions})`)},
 {table:'agent_door_approvals',columns:['id','state','saved','approvals','result','version'],match:match(`json_extract(saved,'$.decision_id') IN (${decisions}) OR ${approvals}`)},
 {table:'agent_door_reviews',columns:['id','state','saved','marked_by','marked_at'],match:match(`json_extract(saved,'$.decision_id') IN (${decisions}) OR ${reviews}`)},
 {table:'agent_door_events',columns:['sequence','id','uri','event'],match:match(`${mentions('agent_door_events',['uri','event'])} OR json_extract(event,'$.decision_id') IN (${decisions})`)},
 {table:'agent_door_usage',columns:['decision_id','at','seed','specialist','agent','classes'],match:match(`decision_id IN (${decisions})`)},
 {table:'agent_door_replay_aliases',columns:['agent','alias','call_id','tombstone'],unrelated:'Installation-private HMAC aliases and value-free tombstones only; native exports and restore exclude this custody.'},
 {table:'agent_door_relay',columns:['sequence','decision_id','business'],unrelated:'Value-free decision IDs and installation Business ID; projections are read from the erasure-aware audit. Business custody is external and retires through tombstone pulls, stop, authority and unreachable rules.'},
]};}
export const projectAgentArtifacts=nativeAgentArtifacts();
export const operatorAgentArtifacts=nativeAgentArtifacts(true);
export const retainedAgentArtifacts=projectAgentArtifacts.artifacts.filter(({table})=>!['agent_door_calls','agent_door_replay_aliases','agent_door_relay'].includes(table)).map(({table})=>({table,reason:'Selected native subject payloads are redacted in place under the erasure transaction. Unrelated native people and peer records remain unchanged; value-free chronology and policy accounting remain without the selected subject payload, confirming digest or execution authority.'}));

