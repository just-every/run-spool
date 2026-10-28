import { spoolAgentDoor, localAgent } from './index.server';
import type { Bindings } from '../../auth/bindings';

/** Retained exact-project API aliases enter the canonical MCP decision path. */
export async function legacyAgentResponse(request:Request,env:Bindings):Promise<Response|null> {
 const local=await localAgent(request,env);if(!local)return null;
 const parts=new URL(request.url).pathname.split('/');
 if(parts[1]!=='api'||parts[2]!=='projects'||!parts[3])return null;
 const project=decodeURIComponent(parts[3]),tail=parts.slice(4);
 const reads:Record<string,string>={issues:'issues.list',outcomes:'outcomes.read','grouping-proposals':'proposals.list',alerts:'notifications.read','issue-search':'issues.search','issue-export':'issues.export',occurrences:'occurrences.list','feedback-reports':'feedback.read','release-health':'health.read'};
 let name=request.method==='GET'&&tail.length===1?reads[tail[0]]:undefined;
 const args:Record<string,unknown>={project};
 if(request.method==='GET'&&tail.length===3&&tail[0]==='issues'){
  name={packet:'packets.read',occurrences:'occurrences.list','affected-users':'affected.read'}[tail[2]];args.issue=decodeURIComponent(tail[1]);
 }
 if(request.method==='POST'&&tail.join('/')==='grouping-proposals'){
  name='proposals.create';Object.assign(args,await request.json(),{project,idempotency_key:request.headers.get('idempotency-key')});
 }
 if(!name)return Response.json({code:'agent_door_required'},{status:403});
 for(const [key,value]of new URL(request.url).searchParams)args[key]=['limit','from','to'].includes(key)?Number(value):value;
 const headers=new Headers(request.headers);headers.set('content-type','application/json');headers.set('accept','application/json, text/event-stream');headers.set('MCP-Protocol-Version','2025-11-25');
 const response=await spoolAgentDoor(env).handle(new Request(new URL('/mcp',env.AUTH_ORIGIN),{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name:`spool.${name}`,arguments:args}})}));
 if(!response)return Response.json({code:'agent_door_unavailable'},{status:503});
 const message=await response.json() as any;
 if(message.result?.isError){const failure=message.result._meta?.['com.runeditrun/error']??{code:'agent_refused'};return Response.json(failure,{status:failure.code==='not_found'?404:failure.code==='unauthenticated'?401:403});}
 if(message.error)return Response.json({code:message.error.data?.code??'agent_refused'},{status:response.ok?403:response.status});
 return Response.json(message.result?.structuredContent??{code:'agent_pending'});
}
