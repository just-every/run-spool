import type { Bindings } from '../../auth/bindings';
import { spoolAgentDoor } from './index.server';
import { spoolPeople } from './people';

/** Observe a successful native person commit without repeating its action. */
export async function emitPersonChange(request:Request,env:Bindings,response:Response) {
 if(['GET','HEAD','OPTIONS'].includes(request.method)||!response.ok||request.headers.has('authorization'))return;
 const path=new URL(request.url).pathname,person=await spoolPeople(env).session(request);if(!person?.active)return;
 let result:any;try{result=await response.clone().json();}catch{return;}
 const project=/^\/api\/projects\/([^/]+)\/(.*)$/.exec(path);
 let uri:string|undefined,type:string|undefined;
 if(project){
  const p=project[1],parts=project[2].split('/'),area=parts[0];
  if(['issues','grouping-proposals','repairs','reproducers','fixes','releases','deployments'].includes(area)){
   const id=area==='reproducers'?result.reproducer??parts[1]??result.id:area==='deployments'&&result.manifest?`${result.release}:${result.manifest.environment}`:result.id??result.name??parts[1];if(id){uri=`spool://projects/${p}/${area}/${encodeURIComponent(String(id))}`;type=area;}
  }else if(area==='corrections'){for(const move of result.moves??[])for(const id of new Set([move.from,move.to]))await spoolAgentDoor(env).emit({type:'issues.changed',uri:`spool://projects/${p}/issues/${encodeURIComponent(String(id))}`,person,data:{source:'native-person'}});
  }else if(area==='alerting'&&parts[1]==='rules'){
   const id=result.id??parts[2];if(id){uri=`spool://projects/${p}/alerts/${encodeURIComponent(String(id))}`;type='alerts';}
  }else if(area==='retention-policy'||area==='follow-up'){uri=`spool://projects/${p}/${area}`;type=area;}
  else if(area==='keys'&&parts[1]){uri=`spool://credentials/${encodeURIComponent(parts[1])}`;type='credentials';}
 }else{
  if(path==='/api/projects'&&result.id){uri=`spool://projects/${encodeURIComponent(String(result.id))}`;type='projects';}
  const member=/^\/api\/organization\/members\/([^/]+)$/.exec(path);if(member){uri=`spool://people/${member[1]}`;type='people';}
 }
 if(uri)await spoolAgentDoor(env).emit({type:`${type}.changed`,uri,person,data:{source:'native-person'}});
}
