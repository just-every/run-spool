import { ownerProjectRouter, ownerWrites, jsonBody } from '../owner-router';
import { auditCommit } from '../audit/context';
import { mintedByCurrentPerson } from '../credential-fence';
import { readKeyRate } from './model';

export const keyRateRoutes = ownerProjectRouter();
keyRateRoutes.use('*',async(c,next)=>{
 const session=c.get('ownerSession');
 if(session.operator.role!=='owner'&&session.membership?.role!=='admin')return c.json({error:'Owner or admin required'},403);
 if(!await c.env.DB.prepare(`SELECT 1 FROM credentials WHERE project=? AND hash=? AND kind='ingest' AND revoked IS NULL AND ${mintedByCurrentPerson}`).bind(c.req.param('project')!,c.req.param('hash')!).first())return c.json({error:'Active capture key required'},404);
 await next();
});
keyRateRoutes.get('/',async c=>c.json(await readKeyRate(c.env.DB,c.req.param('project')!,c.req.param('hash')!)));
keyRateRoutes.put('/',async c=>{
 let input:any;
 try{
  input=await jsonBody(c.req.raw,1024);
  if(Object.keys(input).sort().join()!=='limit,period,revision'||!Number.isSafeInteger(input.revision)||input.revision<0||input.revision>=Number.MAX_SAFE_INTEGER||
   !(input.limit===null||Number.isSafeInteger(input.limit)&&input.limit>0)||!['minute','hour'].includes(input.period))throw new Error('Expected current revision, a positive integer limit or null, and minute or hour');
 }catch(error){return c.json({error:(error as Error).message},400)}
 const project=c.req.param('project')!,key=c.req.param('hash')!;
 const result=await ownerWrites(c,[
  c.env.DB.prepare(`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM credentials WHERE project=? AND hash=? AND kind='ingest' AND revoked IS NULL AND ${mintedByCurrentPerson}) THEN 1 ELSE 0 END`).bind(project,key),
  c.env.DB.prepare(`INSERT INTO key_rate_limits(project,key_hash,revision,event_limit,period_seconds,updated)
   SELECT ?,?,?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM key_rate_limits WHERE project=? AND key_hash=? AND revision=?)
   ON CONFLICT(project,key_hash) DO UPDATE SET revision=excluded.revision,event_limit=excluded.event_limit,period_seconds=excluded.period_seconds,updated=excluded.updated
   WHERE key_rate_limits.revision=? RETURNING revision`).bind(project,key,input.revision+1,input.limit,input.period==='minute'?60:3600,Date.now(),input.revision,project,key,input.revision,input.revision),
  auditCommit(c.env.DB,'changes()=1'),
 ]);
 if(!result[1].results.length)return c.json({error:'key_rate_revision_conflict',...await readKeyRate(c.env.DB,project,key)},409);
 return c.json(await readKeyRate(c.env.DB,project,key));
});
