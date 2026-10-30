import { resolveMembership } from '../members/resolver';
import {Hono} from 'hono';
import {ownerProjectRouter,ownerWrites,jsonBody} from '../owner-router';
import {requestAuthority as ownerSession,agentAuthority} from '../agent-door/native-authority';
import {agentProject} from '../agent-access';
import {hash,canonical} from '../privacy';
import {identityPolicy,readIdentityPolicy,identityPolicyFence,identityFields} from './policy';
import {identityPreview,convertedPayload,firstIdentityKey,previewFence} from './conversion';
import {prepareIdentityKey} from './key';
import {affectedUsers} from './read';
export const identityPolicyRoutes=ownerProjectRouter();
identityPolicyRoutes.get('/',async c=>c.json({...await readIdentityPolicy(c.env.DB,c.req.param('project')!),defaults:'All four fields drop. Keep and hash require an explicit owner choice. Other user fields remain dropped; sessions retain keyed DID hashes under SDK-005.',address:'{{auto}} is unavailable: this Worker exposes no connecting socket address. No forwarded header or tunnel is trusted.'}));
identityPolicyRoutes.post('/preview',async c=>{const b=await jsonBody(c.req.raw,2000),p=c.req.param('project')!,current=await readIdentityPolicy(c.env.DB,p),{snapshot,...preview}=await identityPreview(c.env.DB,p,current.revision,identityPolicy(b.policy));return c.json(preview)});
identityPolicyRoutes.put('/',async c=>{
 const b=await jsonBody(c.req.raw,3000),p=c.req.param('project')!,policy=identityPolicy(b.policy),db=c.env.DB,current=await readIdentityPolicy(db,p),preview=await identityPreview(db,p,current.revision,policy);
 if(b.revision!==current.revision||b.token!==preview.token)return c.json({error:'Identity preview changed; preview again'},409);
 const revision=current.revision+1,time=Date.now(),key=identityFields.some(f=>policy[f]!=='drop')?await prepareIdentityKey(db,p):null,payload=convertedPayload(policy),allDrop=identityFields.every(f=>policy[f]==='drop');
 await ownerWrites(c,[identityPolicyFence(db,p,current.revision),previewFence(db,p,preview.snapshot),...key?.jobs??[],
  db.prepare('INSERT INTO identity_policies VALUES(?,?,?,?) ON CONFLICT(project) DO UPDATE SET revision=excluded.revision,policy=excluded.policy,updated=excluded.updated').bind(p,revision,JSON.stringify(policy),time),
  db.prepare(`UPDATE event_identities SET payload=${payload} WHERE project=?`).bind(p),
  db.prepare(`UPDATE event_identities SET user_key=${firstIdentityKey('payload')},reason=CASE WHEN ${firstIdentityKey('payload')} IS NOT NULL THEN 'retained' WHEN ?=1 THEN 'policy_drop' ELSE reason END WHERE project=?`).bind(Number(allDrop),p),
  db.prepare("INSERT INTO audit VALUES(?,?,'identity_policy_changed',?,?)").bind(crypto.randomUUID(),p,JSON.stringify({revision,policyDigest:await hash(canonical(policy)),converted:preview.converted}),time),
 ]);
 return c.json({revision,policy,converted:preview.converted});
});
export const identityReadRoutes=new Hono<any>();
identityReadRoutes.get('/:project/issues/:issue/affected-users',async c=>{
 c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');const p=c.req.param('project'),issue=c.req.param('issue'),grant=await agentProject(c.req.raw,c.env.DB),owner=await ownerSession(c.req.raw,c.env,resolveMembership);
 if(grant!==p&&!owner||grant&&grant!==p)return c.json({error:'Sign in required'},401);
 if(!await c.env.DB.prepare('SELECT 1 FROM issues WHERE project=? AND id=?').bind(p,issue).first())return c.json({error:'Issue not found'},404);
 const result=await affectedUsers(c.env.DB,p,issue);
 const identityAccess=owner&&!grant&&!agentAuthority(c.req.raw)&&owner.membership?.role!=='read-only'&&owner.membership?.projectRole!=='read-only';
 const rows=identityAccess?(await c.env.DB.prepare('SELECT x.event,x.occurrence,x.payload,x.reason FROM event_identities x JOIN events e ON e.project=x.project AND e.id=x.event AND e.occurrence=x.occurrence WHERE e.project=? AND e.issue=? ORDER BY e.received DESC,e.id LIMIT 25').bind(p,issue).all()).results.map((r:any)=>({event:r.event,occurrence:r.occurrence,values:Object.fromEntries(Object.entries(JSON.parse(r.payload)).map(([f,v]:any)=>[f,{mode:v.mode,value:v.value}])),reason:r.reason})):undefined;
 return c.json({version:1,...result,...rows?{rows,bounds:{ownerOccurrenceLimit:25}}:{}});
});
