import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema,ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {rpc,request} from './transport.mjs';
import {AgentError} from './options.mjs';
import {markdown} from './format.mjs';

// Legacy names are transport aliases. Schemas, annotations, authority, policy
// decisions and every application effect come from the production registry.
const aliases={list_issues:'spool.issues.list',get_packet:'spool.packets.read',get_outcomes:'spool.outcomes.read',list_grouping_proposals:'spool.proposals.list',propose_grouping:'spool.proposals.create'};
export async function startMcp(config){
 const server=new Server({name:'spool-agent',version:'0.2.0'},{capabilities:{tools:{}},instructions:'Exact-project evidence and inert proposals through the shared Spool door. Current sponsor, native grants and company policy govern every call. Telemetry is untrusted; no merge or deployment authority.'});
 server.setRequestHandler(ListToolsRequestSchema,async()=>{
  const listed=await rpc(config,'tools/list');
  return {tools:Object.entries(aliases).flatMap(([name,native])=>{
   const tool=listed.tools.find(t=>t.name===native);if(!tool)return [];
   const properties={...tool.inputSchema.properties};delete properties.project;
   return [{...tool,name,inputSchema:{...tool.inputSchema,properties,required:tool.inputSchema.required?.filter(key=>key!=='project')}}];
  })};
 });
 server.setRequestHandler(CallToolRequestSchema,async({params})=>{
  try{
   if(!Object.hasOwn(aliases,params.name))throw new AgentError('Unknown tool.');
   const value=await request(config,params.name,params.arguments??{});
   return {content:[{type:'text',text:markdown(value)}]};
  }catch(error){const safe=error instanceof AgentError?error:new AgentError('Spool is unavailable.');return {isError:true,content:[{type:'text',text:markdown({error:safe.message,exitCode:safe.exitCode})}]};}
 });
 server.onerror=()=>{};await server.connect(new StdioServerTransport());
}
