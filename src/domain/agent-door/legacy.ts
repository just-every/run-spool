import { spoolAgentDoor, localAgent } from './index.server';
import type { Bindings } from '../../auth/bindings';

/** Retained project API aliases enter the canonical MCP decision path. Machine
 * ingest, deploy, import and runner credentials keep their original purposes. */
export async function legacyAgentResponse(request:Request,env:Bindings):Promise<Response|null> {
 const local=await localAgent(request,env);if(!local)return null;
 const path=new URL(request.url).pathname;
 const match=/^\/api\/projects\/([^/]+)\/(issues|outcomes|grouping-proposals)(?:\/([^/]+)\/(packet))?$/.exec(path);
 if(!match)return Response.json({code:'agent_door_required'},{status:403});
 const project=decodeURIComponent(match[1]);
 let name:string;
 if(match[4])name='spool.packets.read';
 else if(match[2]==='issues'&&request.method==='GET')name='spool.issues.list';
 else if(match[2]==='outcomes'&&request.method==='GET')name='spool.outcomes.read';
 else if(match[2]==='grouping-proposals')name=request.method==='GET'?'spool.proposals.list':'spool.proposals.create';
 else return Response.json({code:'agent_door_required'},{status:403});
 const args:Record<string,unknown>={project};
 if(match[3])args.issue=decodeURIComponent(match[3]);
 if(request.method==='POST')Object.assign(args,await request.json(),{project,idempotency_key:request.headers.get('idempotency-key')});
 else for(const [key,value] of new URL(request.url).searchParams)args[key]=key==='limit'?Number(value):value;
 const headers=new Headers(request.headers);headers.set('content-type','application/json');headers.set('accept','application/json, text/event-stream');headers.set('MCP-Protocol-Version','2025-11-25');
 const response=await spoolAgentDoor(env).handle(new Request(new URL('/mcp',env.AUTH_ORIGIN),{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args}})}));
 if(!response)return Response.json({code:'agent_door_unavailable'},{status:503});
 const message=await response.json() as any;
 if(message.result?.isError)return Response.json(message.result._meta?.['com.runeditrun/error']??{code:'agent_refused'},{status:403});
 if(message.error)return Response.json({code:'agent_refused'},{status:response.ok?403:response.status});
 return Response.json(message.result?.structuredContent??{code:'agent_pending'}, {status:200});
}
