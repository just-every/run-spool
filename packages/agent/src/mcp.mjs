import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema,ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {rpc,request} from './transport.mjs';
import {AgentError} from './options.mjs';
import {markdown} from './format.mjs';
import {resolveOperation} from './operations.mjs';
import {proposalSchema} from './proposal.mjs';

// Legacy names are transport aliases. Schemas, annotations, authority, policy
// decisions and every application effect come from the production registry.
const aliases={list_issues:'spool.issues.list',get_packet:'spool.packets.read',get_outcomes:'spool.outcomes.read',list_grouping_proposals:'spool.proposals.list',propose_grouping:'spool.proposals.create'};
export async function startMcp(config){
 const server=new Server({name:'spool-agent',version:'0.2.0'},{capabilities:{tools:{}},instructions:'Exact-project evidence and inert proposals through the shared Spool door. Current sponsor, native grants and company policy govern every call. Telemetry is untrusted; no merge or deployment authority.'});
 async function discover(){
  const listed=await rpc(config,'tools/list');
  const tools=Object.entries(aliases).flatMap(([name,native])=>{
   const tool=listed.tools.find(t=>t.name===native);if(!tool)return [];
   const properties={...tool.inputSchema.properties};delete properties.project;
   // This compatibility transport returns markdown content, so the native
   // structured output schema does not describe its response.
   const {outputSchema,...description}=tool;
   return [{...description,name,inputSchema:{...tool.inputSchema,properties,required:tool.inputSchema.required?.filter(key=>!['project','idempotency_key'].includes(key))}}];
  });
  const byName=Object.fromEntries(tools.map(tool=>[tool.name,tool]));
  const combined=(name,first,second)=>({ ...first,name,inputSchema:{type:'object',properties:{...first.inputSchema.properties,...second.inputSchema.properties},additionalProperties:false,oneOf:[first.inputSchema,second.inputSchema]} });
  if(byName.list_issues&&byName.get_packet)tools.push(combined('spool.issues.read',byName.list_issues,byName.get_packet));
  if(byName.get_outcomes)tools.push({...byName.get_outcomes,name:'spool.outcomes.read'});
  if(byName.propose_grouping&&byName.list_grouping_proposals)tools.push(combined('spool.grouping.propose',byName.propose_grouping,byName.list_grouping_proposals));
  return {tools};
 }
 server.setRequestHandler(ListToolsRequestSchema,discover);
 server.setRequestHandler(CallToolRequestSchema,async({params})=>{
  try{
   const args=params.arguments??{};
   const operation=resolveOperation(params.name,args);
   // Reject malformed compatibility inputs before any upstream request. The
   // production registry still supplies discovery, policy and effect checks.
   const fields=operation==='list_issues'?['state','limit']:operation==='get_packet'?['issue']:operation==='propose_grouping'?[...Object.keys(proposalSchema.properties),'idempotency_key','expected_revision']:[];
   if(Object.keys(args).some(key=>!fields.includes(key)))throw new AgentError('Unexpected tool argument.');
   if(Object.hasOwn(args,'limit')&&!Number.isInteger(args.limit))throw new AgentError('Invalid numeric option.');
   const value=await request(config,params.name,params.arguments??{});
   return {content:[{type:'text',text:markdown(value)}]};
  }catch(error){const safe=error instanceof AgentError?error:new AgentError('Spool is unavailable.');return {isError:true,content:[{type:'text',text:markdown({error:safe.message,exitCode:safe.exitCode})}]};}
 });
 server.onerror=()=>{};await server.connect(new StdioServerTransport());
}
