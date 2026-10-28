import type { Bindings } from '../../auth/bindings';
import { spoolAgentDoor } from './index.server';
import { spoolPeople } from './people';

/** Native person actions use the same retained resource vocabulary as tools.
 * This observes a successful native commit; it never repeats the action. */
export async function emitPersonChange(request:Request,env:Bindings,response:Response) {
 if(['GET','HEAD','OPTIONS'].includes(request.method)||!response.ok||request.headers.has('authorization'))return;
 const match=/^\/api\/projects\/([^/]+)\/(issues|grouping-proposals|repairs|reproducers|fixes|releases|deployments)(?:\/([^/]+))?/.exec(new URL(request.url).pathname);
 if(!match)return;
 const person=await spoolPeople(env).session(request);if(!person?.active)return;
 let result:any;try{result=await response.clone().json();}catch{return;}
 const id=result.id??result.name??match[3];if(!id)return;
 const uri=`spool://projects/${match[1]}/${match[2]}/${encodeURIComponent(String(id))}`;
 await spoolAgentDoor(env).emit({type:`${match[2]}.changed`,uri,person,data:{source:'native-person'}});
}
