import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {agentCapabilities,agentLimits,resourceTemplates} from '../../src/domain/agent-door/catalogue.mjs';
import {offeredTools,classComputation,specialist} from '../../src/domain/agent-door/documentation.mjs';

const start='<!-- spool:agent-inventory -->',end='<!-- spool:agent-inventory:end -->';
export const agentDocumentationFiles=['src/domain/agent-door/catalogue.mjs','src/domain/agent-door/documentation.mjs','scripts/agent-door/docs.mjs'];

/** Publish only capabilities offered by the native door, after policy setup. */
export function agentInventoryMarkdown(){
 const tools=offeredTools();
 const resources=agentCapabilities.includes('resources')?[...resourceTemplates].sort():[];
 const lines=[
  '## Offered MCP tools','',
  'This inventory is generated from the native catalogue and capability declaration. It describes the native MCP door after company setup with an authorized sponsor token. A project agent key retains its limited evidence and inert-proposal scopes. Each call still checks the current person, project authority and company policy.','',
  `Specialist: **${specialist}**. Read issue packets and capture-loss context, propose inert grouping advice, inspect isolated reproductions and record repair claims separately from observed outcomes. Native repository consent and company policy govern draft data pull requests; they never merge or deploy.`,'',
  'Classes below are the complete possible native classes, not policy dispositions. Standard fixed classifications use measure one. Conditional classifications and their public-door proof journeys are named beside the affected tool. Caller-supplied class, approval and count flags do not grant authority.','',
 ];
 for(const job of [...new Set(tools.map(tool=>tool.name.split('.')[1]))]){
  lines.push(`### ${job[0].toUpperCase()+job.slice(1)}`,'');
  for(const tool of tools.filter(tool=>tool.name.split('.')[1]===job)){
   lines.push(`- \`${tool.name}\` — scope \`${tool.scope}\`; classes ${tool.classes.map(kind=>'`'+kind+'`').join(', ')}.`);
   const computed=classComputation[tool.name];
   if(computed)lines.push(`  ${computed.summary} Proof: [${computed.journey}](../${computed.test}).`);
  }
  lines.push('');
 }
 lines.push('## Resource templates','');
 if(agentCapabilities.includes('resources')){
  for(const uri of resources)lines.push(`- \`${uri}\``);
  if(!resources.length)lines.push('The resource-template inventory is empty (`[]`).');
 }else lines.push('Unavailable. The resource-template inventory is empty (`[]`): the native door does not declare the resources capability.');
 const unavailable=['events','prompts','subscriptions'].filter(capability=>!agentCapabilities.includes(capability));
 if(unavailable.length)lines.push('',`Currently unavailable capabilities: ${unavailable.join(', ')}.`);
 lines.push('','## Capacity and errors','',
  `Requests per minute per agent: \`${agentLimits.requestsPerMinute}\`. Maximum request body bytes: \`${agentLimits.maxBodyBytes}\`. A rate refusal returns HTTP 429 with Retry-After; an oversized body returns HTTP 413. These limits protect transport capacity. Provider-spend caps are not enforced.`,
  '',
  'Transport refusals include HTTP 401 with an OAuth resource-metadata challenge for missing or invalid authority, HTTP 403 for insufficient scope or a foreign origin, and HeaderMismatch or UnsupportedProtocolVersion for incompatible transport metadata.',
  '',
  'Tool failures expose a stable code in result error metadata. Common codes are `policy_unset`, `policy_unavailable`, `policy_blocked`, `agents_paused`, `approval_required`, `approval_rejected`, `approval_expired`, `approval_evidence_changed`, `native_proof_required`, `self_escalation`, `idempotency_key_required`, `idempotency_conflict`, `revision_conflict`, `invalid_arguments`, `not_found`, `insufficient_scope`, `subject_erased`, `call_in_progress`, `decision_busy` and `output_invalid`. Native services can return additional refusal codes. A missing resource, prompt, event or subscription capability returns `capability_not_declared`.',
  '',
  'Follow the returned native person URL for setup, consent, approvals or review. An approval flag cannot complete a person step. Retry a mutation with the same idempotency key and arguments; changed arguments conflict. Never treat a recorded repair claim as an independently observed fix.');
 return lines.join('\n').trimEnd();
}

export function agentDocs(markdown,{publish=false}={}){
 const first=markdown.indexOf(start),last=markdown.indexOf(end);
 if(first<0||last<first||markdown.indexOf(start,first+start.length)!==-1||markdown.indexOf(end,last+end.length)!==-1)throw Error('Agent documentation needs exactly one inventory marker pair.');
 return markdown.slice(0,first)+(publish?'':start+'\n\n')+agentInventoryMarkdown()+'\n\n'+(publish?'':end)+markdown.slice(last+end.length);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const path='docs/agents.md',current=await readFile(path,'utf8'),generated=agentDocs(current);
 if(process.argv.includes('--check')){
  if(current!==generated)throw Error('Run node scripts/agent-door/docs.mjs to refresh the offered MCP inventory.');
  console.log('Offered MCP documentation is current.');
 }else await writeFile(path,generated);
}
