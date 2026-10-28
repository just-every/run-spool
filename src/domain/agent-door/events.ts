import type {Bindings} from '../../auth/bindings';
import {operatorAuth} from '../../auth/session.server';
import {spoolPeople} from './people';

/** Native person changes share the same retained resource vocabulary as MCP. */
export async function emitPersonChange(request:Request,response:Response,env:Bindings) {
 if(['GET','HEAD','OPTIONS'].includes(request.method)||!response.ok||request.headers.has('authorization'))return;
 const path=new URL(request.url).pathname;
 const match=/^\/api\/projects\/([^/]+)\/(issues|repairs|reproducers|fixes|releases|deployments|grouping-proposals|alerting|keys|retention-policy|follow-up|corrections)(?:\/([^/]+))?/.exec(path);
 const membership=/^\/api\/organization\/members\/[^/]+$/.test(path);
 if(!match&&!membership)return;
 const session=await operatorAuth(env).getSession(request);if(!session)return;
 const person=await spoolPeople(env).person(session.operator.id);if(!person)return;
 const primary=match&&['issues','repairs','reproducers','fixes','releases','deployments','grouping-proposals'].includes(match[2]);
 let uri='spool://evidence';
 if(primary){let value:any;try{value=await response.clone().json()}catch{return;}
  const target=match[3]??value.id??value.name;if(!target)return;
  uri=`spool://projects/${match[1]}/${match[2]}/${encodeURIComponent(target)}`;
 }
 const aliases:Record<string,string>={'grouping-proposals':'proposals',alerting:'alerts',keys:'credentials','retention-policy':'retention','follow-up':'followups',corrections:'grouping'};
 const family=membership?'access':aliases[match![2]]??match![2];
 const {spoolDoor}=await import('./index.server');
 await spoolDoor(env).emit({type:`spool.${family}.changed`,uri,person});
}
