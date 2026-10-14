import { Hono } from 'hono';
import { AuthError } from '../modules/operator-auth/index.mjs';
import { ownerSession, ownerWrite } from '../auth/session.server';
import type { Bindings as OwnerBindings } from '../auth/bindings';
import type { AlertEnvironment } from './alerts/types';
import alertRoutes from './alerts/routes';
import groupingRoutes from './operators/grouping';
import policyRoutes from './operators/policies';
import repairRoutes from './repairs/routes';
import { projectErasureRoutes, erasureReceiptRoutes } from './erasure/routes';
import { erasedProjectIdentifier } from './erasure/identifiers';
import { applyRetention } from './retention';
type Bindings = OwnerBindings & AlertEnvironment;
import { normalize, identity, hash, token, scrub, canonical } from './privacy';
import { ownerAlert, ownerIssue } from './stored-text';
import { portability, archiveStream, restoreStream } from './portability';
import { PortabilityError } from '../modules/portability/index.mjs';
import { authorizeIngest, admitEvent, recordIngest, ingestFailure } from './admission';
import deployRoutes from './sentry/deploy-routes';
import sentryRoutes from './sentry/routes';
import otlpRoutes from './otlp/routes';
import sentryImportRoutes from './sentry-import/routes';
import { projectDsn } from './sentry/dsn';
import { browserOrigin, ingestOrigin, requestedHeaders } from './origins';
import { clientDroppedSql, issueAttentionSql, decodeIssueAttention } from './issue-attention';
import { recordDevMint } from './dev-credentials';
import { agentProject, agentReadPath } from './agent-access';
import { deniedResponse } from './denied-response';
import { alertProjection, issueProjection, outcomeProjection } from './agent-projection';
import { issuePacket } from './packet';
import { ownerBatch, ownerDatabase, type OwnerSession } from './owner-authority';

const api = new Hono<{Bindings:Bindings;Variables:{owner:boolean;dev:boolean;project:string|null;minter:{id:string;version:number}|null;session:OwnerSession}}>();
const now=()=>Date.now();
const stmt=(db:D1Database,sql:string,...args:any[])=>db.prepare(sql).bind(...args);
async function body(c:any,limit=32768) { const declared=Number(c.req.header('content-length')??0); if(declared>limit) throw new Error('Body exceeds limit'); const reader=c.req.raw.body?.getReader();if(!reader)throw new Error('Missing body');let size=0,chunks:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error('Body exceeds limit')}chunks.push(value)}const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length}return JSON.parse(new TextDecoder().decode(bytes)) }
const record=(db:D1Database,project:string,reason:string)=>stmt(db,'INSERT INTO outcomes VALUES(?,?,?,1) ON CONFLICT(project,window,reason) DO UPDATE SET count=count+1',project,Math.floor(now()/60000)*60000,reason).run();
const mintCredential=(c:any,keyHash:string,project:string,kind:string)=>{const minter=c.get('minter');return stmt(c.env.DB,'INSERT INTO credentials(hash,project,kind,created,revoked,minted_by,minted_version) VALUES(?,?,?,?,NULL,?,?)',keyHash,project,kind,now(),minter?.id??null,minter?.version??null)};
const audit=(db:D1Database,project:string|null,kind:string,detail:any)=>stmt(db,'INSERT INTO audit VALUES(?,?,?,?,?)',crypto.randomUUID(),project,kind,JSON.stringify(detail),now());
// Owner writes commit only while the session that admitted them still holds owner authority (owner-authority.ts).
const write=(c:any,statements:D1PreparedStatement[])=>ownerBatch(c.env.DB,c.get('session'),statements);
const ownerDb=(c:any)=>ownerDatabase(c.env.DB,c.get('session'));
api.use('*',async(c,next)=>{c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');
  const grant=await agentProject(c.req.raw,c.env.DB);
  c.set('project',grant);
  // This precedes every independently mounted ingest, deploy and import router.
  if(grant&&!agentReadPath(c.req.raw,grant))return deniedResponse(c.req.raw,c.json({error:'Read-only project scope required'},403));
  await next()});
api.onError((err,c)=>{
  if(['REVIEW_FINGERPRINT_MISMATCH','NATIVE_EDIT_CONFLICT','OPERATION_KEY_CONFLICT','DUPLICATE_SOURCE_CONFLICT','IMPORT_ATOMIC_GUARD','REVERSAL_MODE_CONFLICT','UNDO_REQUIRES_COMPLETED_IMPORT'].includes(err.message))return c.json({error:err.message},409);
  if(err instanceof AuthError)return c.json({error:err.code},err.status as any);
  if(err instanceof PortabilityError)return c.json({error:err.code},err.status as any);
  if(err.message.includes('restore_in_progress'))return c.json({error:'Restore in progress'},409);
  const storage=err.message.startsWith('D1')&&!/(SQLITE_CONSTRAINT|constraint failed)/i.test(err.message);
  if(storage)return c.req.path.startsWith('/api/ingest/')?c.json({outcome:'unavailable',reason:'transaction_not_confirmed'},503):c.json({error:'Storage operation not confirmed'},503);
  return c.json({error:err.message.startsWith('D1')?'Storage operation failed':scrub(err.message)},400);
});
// The scheduler's last run is public on purpose: it holds no project or credential data and shows whether the cron ticks.
api.get('/health',async c=>{await c.env.DB.prepare('SELECT COUNT(*) FROM projects').first();const scheduler=await c.env.DB.prepare('SELECT last_run FROM alert_scheduler WHERE id=1').first<{last_run:number|null}>();return c.json({status:'ok',ok:true,deployment:{sourceSha:c.env.RER_DEPLOY_SOURCE,fingerprint:c.env.RER_DEPLOY_FINGERPRINT,versionId:c.env.RER_VERSION?.id},alerts:{lastScheduledRun:scheduler?.last_run?new Date(scheduler.last_run).toISOString():null}})});
api.options('/api/ingest/:project',async c=>{
  c.header('Vary','Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  const project=c.req.param('project'),origin=c.req.header('origin');
  const known=await stmt(c.env.DB,'SELECT 1 FROM projects WHERE id=?',project).first();
  if(!known||!origin||c.req.header('access-control-request-method')!=='POST'||!requestedHeaders(c.req.header('access-control-request-headers')))return c.json({error:'Preflight not allowed'},403);
  const policy=await ingestOrigin(c.env.DB,project,origin,c.env.AUTH_ORIGIN);
  if(!policy.allowed)return c.json({error:'Origin not allowed'},403);
  c.header('Access-Control-Allow-Origin',origin);c.header('Access-Control-Allow-Methods','POST');c.header('Access-Control-Allow-Headers','Authorization, Content-Type');c.header('Access-Control-Max-Age','60');return c.body(null,204);
});
api.post('/api/ingest/:project',async c=>{
  const auth=await authorizeIngest(c,c.req.param('project'),c.req.header('authorization')?.replace(/^Bearer /,''));if('response' in auth)return auth.response;
  try{const raw=await body(c);return admitEvent(c,auth.scope,normalize(raw),await hash(canonical(raw)))}catch(error){try{await recordIngest(c,auth.scope,(error as Error).message.includes('exceeds')?'oversized':'invalid')}catch(failure){return ingestFailure(c,auth.scope,failure)}return c.json({outcome:'rejected',reason:scrub((error as Error).message)},400)}
});
api.route('/api/projects',deployRoutes);
api.route('/api',sentryRoutes);
api.route('/api/otlp',otlpRoutes);
api.route('/api/imports/sentry',sentryImportRoutes);
api.route('/api/projects/:project/erasure',projectErasureRoutes);
api.route('/api/erasures',erasureReceiptRoutes);
api.use('/api',async(c,next)=>{if(!await ownerSession(c.req.raw,c.env))return c.json({error:'Sign in required'},401);await next()});
api.use('/api/*',async(c,next)=>{
  if(c.req.path.startsWith('/api/ingest/'))return next();
  if(c.get('project')){c.set('owner',false);c.set('dev',false);c.set('minter',null);return next()}
  const session=await ownerSession(c.req.raw,c.env);
  c.set('owner',!!session);c.set('dev',session?.kind==='dev');
  // Keys minted here record this person and their identity fence (credential-fence.ts).
  c.set('minter',session?{id:session.operator.id,version:session.operator.version}:null);
  if(session){c.set('session',session);if(!['GET','HEAD'].includes(c.req.method)&&!ownerWrite(c.req.raw,c.env))return c.json({error:'Same-origin required'},403);return next()}
  return c.json({error:'Sign in required'},401);
});
api.route('/api/projects',groupingRoutes);
api.route('/api/projects',policyRoutes);
api.route('/api/projects/:project/alerting',alertRoutes);
api.route('/api/projects/:project/repairs',repairRoutes);
api.get('/api/projects',async c=>c.json((await stmt(c.env.DB,'SELECT * FROM projects ORDER BY created').all()).results));
api.post('/api/projects',async c=>{const b=await body(c);const id=identity(b.id,'project');if(typeof b.name!=='string'||!b.name.trim())throw new Error('Name required');if(await erasedProjectIdentifier(c.env.DB,id))return c.json({error:'This identifier belonged to an erased project. Choose another identifier.'},409);const name=scrub(b.name);const key=token();await write(c,[stmt(c.env.DB,'INSERT INTO projects VALUES(?,?,?)',id,name,now()),mintCredential(c,await hash(key),id,'ingest'),...c.get('dev')?[recordDevMint(c.env.DB,await hash(key))]:[],audit(c.env.DB,id,'project_created',{id})]);return c.json({id,name,ingestKey:key,dsn:await projectDsn(c.env.DB,c.env.AUTH_ORIGIN,id,key)},201)});
api.get('/api/projects/:project/releases',async c=>c.json((await stmt(c.env.DB,`SELECT releases.*,(SELECT json_group_array(json_object('environment',environment,'commitSha',commit_sha,'repository',repository,'deployedAt',deployed_at)) FROM deployment_manifests d WHERE d.project=releases.project AND d.release=releases.name) deployments FROM releases WHERE project=? ORDER BY seq DESC`,c.req.param('project')).all()).results));
api.get('/api/projects/:project/keys',async c=>c.json((await stmt(c.env.DB,'SELECT hash,kind,created,revoked FROM credentials WHERE project=?',c.req.param('project')).all()).results));
api.post('/api/projects/:project/keys',async c=>{const b=await body(c);if(!['ingest','agent','deploy'].includes(b.kind))throw new Error('Invalid grant kind');const t=token(),h=await hash(t);await write(c,[mintCredential(c,h,c.req.param('project'),b.kind),...c.get('dev')?[recordDevMint(c.env.DB,h)]:[],audit(c.env.DB,c.req.param('project'),'key_created',{hash:h,kind:b.kind})]);return c.json({key:t,hash:h,kind:b.kind,...b.kind==='ingest'?{dsn:await projectDsn(c.env.DB,c.env.AUTH_ORIGIN,c.req.param('project'),t)}:{}},201)});
api.delete('/api/projects/:project/keys/:hash',async c=>{await write(c,[stmt(c.env.DB,'UPDATE credentials SET revoked=? WHERE project=? AND hash=?',now(),c.req.param('project'),c.req.param('hash')),audit(c.env.DB,c.req.param('project'),'key_revoked',{hash:c.req.param('hash')})]);return c.json({ok:true})});
api.get('/api/projects/:project/browser-origins',async c=>c.json((await stmt(c.env.DB,'SELECT origin,created FROM browser_origins WHERE project=? ORDER BY created,origin',c.req.param('project')).all()).results));
api.on(['POST','DELETE'],'/api/projects/:project/browser-origins',async c=>{
  const project=c.req.param('project'),b=await body(c,2048);
  if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).join()!=='origin')throw new Error('Exactly one origin field is required');
  const origin=browserOrigin(b.origin);if(!await stmt(c.env.DB,'SELECT 1 FROM projects WHERE id=?',project).first())return c.json({error:'Project not found'},404);
  const add=c.req.method==='POST',id=crypto.randomUUID(),time=now();
  const implicit=origin===c.env.AUTH_ORIGIN;
  if(implicit&&add)return c.json({origin,changed:false,allowed:true,implicit:true},add?201:200);
  try{const result=await write(c,[add?stmt(c.env.DB,'INSERT INTO browser_origins VALUES(?,?,?) ON CONFLICT(project,origin) DO NOTHING',project,origin,time):stmt(c.env.DB,'DELETE FROM browser_origins WHERE project=? AND origin=?',project,origin),stmt(c.env.DB,'INSERT INTO audit SELECT ?,?,?,?,? WHERE changes()=1',id,project,add?'browser_origin_added':'browser_origin_removed',JSON.stringify({origin}),time)]);return c.json({origin,changed:result[0].meta.changes>0,allowed:add||implicit,implicit},add?201:200)}catch(error){if(String((error as Error).message).includes('browser_origin_budget'))return c.json({error:'browser_origin_budget'},429);throw error}
});
api.get('/api/projects/:project/issues',async c=>{
  const state=c.req.query('state')??'all',limitParam=c.req.query('limit')??'100',limit=Number(limitParam);
  if(!['open','all'].includes(state))throw new Error('Issue state must be open or all');
  if(!/^[1-9]\d*$/.test(limitParam)||!Number.isSafeInteger(limit)||limit>100)throw new Error('Issue limit must be an integer from 1 to 100');
  const rows=(await stmt(c.env.DB,`SELECT i.*, ${issueAttentionSql}, ${clientDroppedSql}, (SELECT release FROM events WHERE issue=i.id AND project=i.project ORDER BY received DESC,id DESC LIMIT 1) last_release, (SELECT json_group_array(DISTINCT release) FROM events WHERE issue=i.id AND project=i.project) releases FROM issues i WHERE i.project=? AND (?='all' OR i.state=?) ORDER BY CASE json_extract(attention,'$.kind') WHEN 'regression' THEN 2 WHEN 'new_issue' THEN 1 ELSE 0 END DESC,last_seen DESC,id DESC LIMIT ?`,c.req.param('project'),state,state,limit).all<any>()).results;
  return c.json(rows.map(decodeIssueAttention).map(row=>c.get('project')?issueProjection(row):ownerIssue(row)));
});
api.get('/api/projects/:project/outcomes',async c=>c.json({window:'last 24 hours, server admission only',coverage:'Unknown before transport; no complete exposure denominator',rows:(await stmt(c.env.DB,'SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? GROUP BY reason',c.req.param('project'),now()-86400000).all<any>()).results.map(outcomeProjection)}));
api.get('/api/projects/:project/alerts',async c=>c.json((await stmt(c.env.DB,"SELECT a.*,(SELECT COUNT(*) FROM alert_history h WHERE h.project=a.project AND h.alert_id=a.id) delivery_count,CASE WHEN EXISTS(SELECT 1 FROM alert_history h WHERE h.project=a.project AND h.alert_id=a.id) THEN 'configured' ELSE 'not_configured' END routing_state FROM alerts a WHERE a.project=? ORDER BY a.created DESC,a.id LIMIT 100",c.req.param('project')).all<any>()).results.map(row=>c.get('project')?alertProjection(row):ownerAlert(row))));
api.patch('/api/projects/:project/issues/:issue',async c=>{
  const b=await body(c);if(!['open','acknowledged','resolved','suppressed'].includes(b.state)||!Number.isSafeInteger(b.revision))throw new Error('Invalid triage');
  const issue=await stmt(c.env.DB,'SELECT * FROM issues WHERE project=? AND id=?',c.req.param('project'),c.req.param('issue')).first<any>();if(!issue)return c.json({error:'Issue not found'},404);
  const results=await write(c,[stmt(c.env.DB,`UPDATE issues SET state=?,resolved_seq=CASE WHEN ?='resolved' THEN COALESCE(latest_release_seq,(SELECT MAX(seq) FROM releases WHERE project=issues.project),0) ELSE NULL END,latest_release_seq=COALESCE(latest_release_seq,(SELECT MAX(seq) FROM releases WHERE project=issues.project),0),revision=revision+1 WHERE id=? AND revision=? RETURNING revision`,b.state,b.state,issue.id,b.revision),stmt(c.env.DB,"INSERT INTO audit SELECT ?,?,'triage',?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM issues WHERE id=? AND revision=? AND state=?)",crypto.randomUUID(),issue.project,JSON.stringify({issue:issue.id,state:b.state,revision:b.revision+1}),now(),issue.id,b.revision+1,b.state)]);const result=results[0].results[0] as any;
  if(!result)return c.json({error:'Revision conflict'},409);
  return c.json({state:b.state,...result});
});
api.get('/api/projects/:project/issues/:issue/packet',async c=>{
  const packet=await issuePacket(c.env.DB,c.req.param('project'),c.req.param('issue'));
  return packet===null?c.json({error:'Issue not found'},404):c.body(packet,200,{'Content-Type':'application/json; charset=UTF-8'});
});
api.get('/api/archive',async c=>new Response(await archiveStream(await portability(c.env.DB)),{headers:{'Content-Type':'application/x-ndjson','Content-Disposition':'attachment; filename=errors-private-archive.jsonl','Cache-Control':'no-store'}}));
api.post('/api/restore',async c=>{
 if(c.req.header('x-confirm-restore')!=='yes')return c.json({error:'Confirm restore explicitly'},400);
 if(!c.req.raw.body)throw new Error('Missing archive');
 await restoreStream(await portability(ownerDb(c)),c.req.raw.body);
 return c.json({restored:true,credentials:'excluded; create new project grants'});
});
api.post('/api/projects/:project/retention',async c=>{
 const p=c.req.param('project'),b=await body(c);if(!Number.isSafeInteger(b.cutoff)||b.cutoff<0||b.cutoff>now()||typeof b.apply!=='boolean')throw new Error('Invalid retention cutoff');
 const affected=await stmt(c.env.DB,'SELECT COUNT(*) total FROM events WHERE project=? AND received<?',p,b.cutoff).first<any>();
 if(!b.apply)return c.json({dryRun:true,events:affected.total,cutoff:b.cutoff,deduplication:'Event IDs before cutoff can be admitted again; retry horizon is retained data only'});
 const removed=await applyRetention(ownerDb(c),p,b.cutoff);
 return c.json({applied:true,events:removed,cutoff:b.cutoff,coverage:'Historical evidence deleted; comparisons across cutoff are incomplete'});
});
export default api;
