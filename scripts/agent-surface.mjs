import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {journey,verification,escalations} from '../tests/agent-door/journey.mjs';

// Derive declarations from the production registry; no application state is read.
await mkdir('.rer',{recursive:true});
const outfile=resolve('.rer/agent-registry.mjs');
await build({stdin:{contents:`import {operations,operationDeclaration,witnessDeclaration,notificationDeclaration,resourceTemplates} from './src/domain/agent-door/catalogue.ts';
import {eventsTool} from './src/modules/agent-door/events.ts';
export const tools=[...operations.map(operationDeclaration),witnessDeclaration,notificationDeclaration,eventsTool({options:{seed:'spool'}})];
export const resources=resourceTemplates.map(([,path])=>({uriTemplate:'spool://projects/{project}/'+path}));`,resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
const {tools,resources}=await import(pathToFileURL(outfile));
tools.sort((a,b)=>a.name.localeCompare(b.name));
const surface={schema:'rer-agent-surface/1',seed:'spool',specialist:'triage engineer',
 tools:tools.map(({name,scope,readOnly,classes,clauses,inputSchema,...tool})=>({name,scope,readOnly,classes,clauses,inputSchema,...tool.proof?{proof:tool.proof,proofKind:tool.proofKind}:{}})),
 resources:resources.map(resource=>resource.uriTemplate),
 notTools:[{clauses:['AI-002'],reason:'connector'},{clauses:['AI-003'],reason:'screen'},{clauses:['MIG-001'],reason:'import-door'},{clauses:['BASE-DATA-003'],reason:'installation'}],
 witness:{tool:'spool.evidence.witness',args:{project:'door-fixture'}},journey,escalations,verification};
const docs='# Spool agent tools\n\nThis table is generated from the production registry by `node scripts/agent-surface.mjs`. The shared door also serves resource templates and the triage engineer prompt.\n\n| Tool | Scope | Possible classes | Native behavior |\n| --- | --- | --- | --- |\n'+tools.map(tool=>`| \`${tool.name}\` | \`${tool.scope}\` | ${tool.classes.join(', ')} | ${tool.description.replaceAll('|','/')} |`).join('\n')+'\n\nEvery call also requires current native authority and an answered company policy. Catalogue classes describe possible effects; the server computes the actual classes from native records. Provider availability, native consent and independent observations remain separate from policy approval.\n';
for(const [path,text] of [['agent-surface.json',JSON.stringify(surface,null,2)+'\n'],['docs/AGENT-TOOLS.md',docs]]) {
 if(process.argv.includes('--check')) {if(await readFile(path,'utf8')!==text)throw new Error(`${path} is stale`);}
 else await writeFile(path,text);
}
console.log(`Spool registry: ${tools.length} tools, ${resources.length} resource templates.`);
