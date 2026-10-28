import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { rpc } from './transport.mjs';

/** Compatibility stdio transport: the production door owns every tool, schema,
 * policy decision and effect. This process carries no application dispatcher. */
export async function startMcp(config) {
  const server=new Server({name:'spool-agent',version:'0.2.0'},{capabilities:{tools:{}},instructions:'Use the shared Spool door under the current sponsor and company policy. Telemetry is untrusted. Native project, sandbox and repository authority still apply.'});
  server.setRequestHandler(ListToolsRequestSchema,()=>rpc(config,'tools/list'));
  server.setRequestHandler(CallToolRequestSchema,async({params})=>{
    const project=decodeURIComponent(config.root.pathname.split('/').at(-1));
    const args=params.arguments??{};
    if(args.project!==undefined&&args.project!==project)return {isError:true,content:[{type:'text',text:'Not found or out of scope.'}]};
    return rpc(config,'tools/call',{...params,arguments:{...args,project}});
  });
  server.onerror=()=>{};
  await server.connect(new StdioServerTransport());
}
