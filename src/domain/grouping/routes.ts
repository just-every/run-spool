import { AuthError } from '../../modules/operator-auth/index.mjs';
import { ownerProjectRouter,ownerWrites,jsonBody } from '../owner-router';
import { canonical,hash,normalize,grouping } from '../privacy';
import { captureGrouping } from '../bundle-grouping';
import { sentryGroupingInfo } from '../sentry/grouping';
import { readGroupingPolicy } from './policy';
import { validateGroupingPolicy } from './rules';
export const groupingRoutes=ownerProjectRouter();
groupingRoutes.onError((error,c)=>{if(error instanceof AuthError)return c.json({error:error.code},error.status as any);throw error});
groupingRoutes.get('/',async c=>c.json(await readGroupingPolicy(c.env.DB,c.req.param('project')!)));
groupingRoutes.get('/versions',async c=>{
 const rows=await c.env.DB.prepare("SELECT detail,created FROM audit WHERE project=? AND kind='grouping_rules_changed' ORDER BY json_extract(detail,'$.revision')").bind(c.req.param('project')!).all<any>();
 return c.json({versions:rows.results.map(row=>({...JSON.parse(row.detail),activated:row.created}))});
});
groupingRoutes.post('/preview',async c=>{
 let input:any,policy;
 try{input=await jsonBody(c.req.raw,40000);policy=validateGroupingPolicy(input.policy);if(input.after!==undefined&&(typeof input.after!=='string'||!/^[\w.:-]{0,100}$/.test(input.after)))throw new Error('Invalid preview cursor');}catch(e){return c.json({error:(e as Error).message},400)}
 const project=c.req.param('project')!,snapshot=await readGroupingPolicy(c.env.DB,project);
 const page=await c.env.DB.prepare('SELECT id,occurrence,issue,payload,historical FROM events WHERE project=? AND id>? ORDER BY id LIMIT 101').bind(project,input.after??'').all<any>();
 const rows=await Promise.all(page.results.slice(0,100).map(async row=>{
  const event=normalize(JSON.parse(row.payload));
  if(row.historical)return {event:row.id,occurrence:row.occurrence,issue:row.issue,eligible:false,reason:'Imported history keeps its source grouping'};
  const candidate=event.sentry?normalize({...event,sentry:{...event.sentry,grouping:{revision:snapshot.revision+1,policy}}}):normalize({...event,grouping:{revision:snapshot.revision+1,policy}});
  const explanation=event.sentry?sentryGroupingInfo(candidate.sentry!):grouping(candidate);
  const captured=await captureGrouping(c.env.DB,project,candidate),basis=captured.basis,destination=await hash(project+':'+captured.fingerprint);
  return {event:row.id,occurrence:row.occurrence,issue:row.issue,eligible:true,destination,changed:row.issue!==destination,explanation:{...explanation,basis}};
 }));
 return c.json({revision:snapshot.revision,policy,policyDigest:await hash(canonical(policy)),scanned:rows.length,rows,next:page.results.length>100?rows.at(-1)!.event:null,behavior:'Preview only. Saving changes future intake; retained evidence moves only through an explicit split/merge correction.'});
});
groupingRoutes.put('/',async c=>{
 let input:any,policy;
 try{input=await jsonBody(c.req.raw,40000);policy=validateGroupingPolicy(input.policy);if(!Number.isSafeInteger(input.revision)||input.revision<0||input.revision>=Number.MAX_SAFE_INTEGER)throw new Error('Expected current revision');}catch(e){return c.json({error:(e as Error).message},400)}
 const project=c.req.param('project')!,revision=input.revision+1,time=Date.now();
 const result=await ownerWrites(c,[
 c.env.DB.prepare(`INSERT INTO grouping_policies(project,revision,policy,updated) SELECT ?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM grouping_policies WHERE project=? AND revision=?) ON CONFLICT(project) DO UPDATE SET revision=excluded.revision,policy=excluded.policy,updated=excluded.updated WHERE grouping_policies.revision=? RETURNING revision`).bind(project,revision,JSON.stringify(policy),time,input.revision,project,input.revision,input.revision),
 c.env.DB.prepare("INSERT INTO audit SELECT ?,?,'grouping_rules_changed',?,? WHERE changes()=1").bind(crypto.randomUUID(),project,JSON.stringify({previousRevision:input.revision,revision,policy,policyDigest:await hash(canonical(policy))}),time)
 ]);
 return result[0].results.length?c.json({revision,policy}):c.json({error:'Grouping rule revision conflict',...await readGroupingPolicy(c.env.DB,project)},409);
});
