import { hash } from '../privacy';
export async function deploymentActor(db:D1Database,project:string,authority:string) {
 const key=await hash(authority);
 await db.prepare('INSERT INTO deployment_actors VALUES(?,?,?) ON CONFLICT(project,authority) DO NOTHING').bind(project,key,'actor-'+crypto.randomUUID()).run();
 return (await db.prepare('SELECT label FROM deployment_actors WHERE project=? AND authority=?').bind(project,key).first<{label:string}>())!.label;
}
