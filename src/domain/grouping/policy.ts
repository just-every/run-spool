import { emptyGroupingPolicy,validateGroupingSnapshot,type GroupingSnapshot } from './rules';
export async function readGroupingPolicy(db:D1Database,project:string):Promise<GroupingSnapshot>{
 const row=await db.prepare('SELECT revision,policy FROM grouping_policies WHERE project=?').bind(project).first<any>();
 return row?validateGroupingSnapshot({revision:row.revision,policy:JSON.parse(row.policy)}):{revision:0,policy:emptyGroupingPolicy()};
}
export const groupingPolicyFence=(db:D1Database,project:string,revision:number)=>db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN COALESCE((SELECT revision FROM grouping_policies WHERE project=?),0)=? THEN 1 ELSE 0 END').bind(project,revision);
