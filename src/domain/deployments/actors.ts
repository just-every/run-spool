import { hash } from '../privacy';
export async function deploymentActor(db:D1Database,project:string,authority:string) {
 const key=await hash(authority);
 await db.prepare('INSERT INTO deployment_actors VALUES(?,?,?) ON CONFLICT(project,authority) DO NOTHING').bind(project,key,'actor-'+crypto.randomUUID()).run();
 return (await db.prepare('SELECT label FROM deployment_actors WHERE project=? AND authority=?').bind(project,key).first<{label:string}>())!.label;
}

/** UI-only resolution. Permanent aliases and archive/API formats stay unchanged. */
export async function deploymentActorReferences(db:D1Database,project:string) {
 const references:Record<string,{kind:string;name?:string}>={
  'service-deployment-deadline':{kind:'service',name:'Spool deployment deadline'}
 };
 const [actors,people,keys]=await Promise.all([
  db.prepare('SELECT authority,label FROM deployment_actors WHERE project=?').bind(project).all<{authority:string;label:string}>(),
  db.prepare("SELECT id,role,display_name name FROM oa_operators WHERE status='active'").all<{id:string;role:string;name:string}>(),
  db.prepare(`SELECT c.hash,s.name FROM credentials c LEFT JOIN spool_service_credentials k ON k.hash=c.hash LEFT JOIN spool_service_accounts s ON s.id=k.service WHERE c.project=? AND c.kind='deploy'`).bind(project).all<{hash:string;name:string|null}>()
 ]);
 const candidates=await Promise.all([
  ...people.results.map(async p=>({authority:await hash((p.role==='owner'?'owner:':'member:')+p.id),reference:p.role==='owner'?{kind:'owner'}:{kind:'member',name:p.name}})),
  ...keys.results.map(async k=>({authority:await hash('deploy:'+k.hash),reference:{kind:'deploy',...(k.name?{name:k.name}:{})}}))
 ]);
 for(const actor of actors.results){const match=candidates.find(c=>c.authority===actor.authority);if(match)references[actor.label]=match.reference;}
 return references;
}
