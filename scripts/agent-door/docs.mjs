import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {catalogue,agentCapabilities,resourceTemplates} from '../../src/domain/agent-door/catalogue.mjs';

const start='<!-- spool:agent-inventory -->',end='<!-- spool:agent-inventory:end -->';
export const agentDocumentationFiles=['src/domain/agent-door/catalogue.mjs','scripts/agent-door/docs.mjs'];

/** Publish only capabilities offered by the native door, after policy setup. */
export function agentInventoryMarkdown(){
 const tools=agentCapabilities.includes('tools')?catalogue.filter(tool=>tool.exposure!=='invoke').sort((a,b)=>a.name.localeCompare(b.name)):[];
 const resources=agentCapabilities.includes('resources')?[...resourceTemplates].sort():[];
 const lines=[
  '## Offered MCP tools','',
  'This inventory is generated from the native catalogue and capability declaration. It describes the native MCP door after company setup with an authorized sponsor token. A project agent key retains its limited evidence and inert-proposal scopes. Each call still checks the current person, project authority and company policy.','',
 ];
 for(const job of [...new Set(tools.map(tool=>tool.name.split('.')[1]))]){
  lines.push(`### ${job[0].toUpperCase()+job.slice(1)}`,'');
  for(const tool of tools.filter(tool=>tool.name.split('.')[1]===job))lines.push(`- \`${tool.name}\` — scope \`${tool.scope}\`.`);
  lines.push('');
 }
 lines.push('## Resource templates','');
 if(agentCapabilities.includes('resources')){
  for(const uri of resources)lines.push(`- \`${uri}\``);
  if(!resources.length)lines.push('The resource-template inventory is empty (`[]`).');
 }else lines.push('Unavailable. The resource-template inventory is empty (`[]`): the native door does not declare the resources capability.');
 const unavailable=['events','prompts','subscriptions'].filter(capability=>!agentCapabilities.includes(capability));
 if(unavailable.length)lines.push('',`Currently unavailable capabilities: ${unavailable.join(', ')}.`);
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
