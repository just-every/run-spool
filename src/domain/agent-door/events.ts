import type {Bindings} from '../../auth/bindings';
import {operatorAuth} from '../../auth/session.server';
import {spoolPeople} from './people';

/** Native person changes share the same retained resource vocabulary as MCP. */
export async function emitPersonChange(request:Request,response:Response,env:Bindings) {
 if(['GET','HEAD','OPTIONS'].includes(request.method)||!response.ok||request.headers.has('authorization'))return;
 const match=/^\/api\/projects\/([^/]+)\/(issues|repairs|reproducers|fixes|releases|deployments|grouping-proposals)(?:\/([^/]+))?/.exec(new URL(request.url).pathname);
 if(!match)return;
 const session=await operatorAuth(env).getSession(request);if(!session)return;
 const person=await spoolPeople(env).person(session.operator.id);if(!person)return;
 let value:any;try{value=await response.clone().json()}catch{return;}
 const target=match[3]??value.id??value.name;if(!target)return;
 const uri=`spool://projects/${match[1]}/${match[2]}/${encodeURIComponent(target)}`;
 const {spoolDoor}=await import('./index.server');
 await spoolDoor(env).emit({type:`spool.${match[2]}.changed`,uri,person});
}
