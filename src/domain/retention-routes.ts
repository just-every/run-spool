import {ownerProjectRouter,ownerWrites,jsonBody} from './owner-router';
import {retentionWindows,readRetentionPolicy,retentionPreview,retentionPolicyFence} from './retention-policy';
import {hash,canonical,scrub} from './privacy';
export const retentionPolicyRoutes=ownerProjectRouter();
retentionPolicyRoutes.get('/',async c=>c.json({...await readRetentionPolicy(c.env.DB,c.req.param('project')!),lastRun:await c.env.DB.prepare('SELECT last_run,status,remaining FROM retention_runs WHERE project=?').bind(c.req.param('project')!).first(),preview:await retentionPreview(c.env.DB,c.req.param('project')!,(await readRetentionPolicy(c.env.DB,c.req.param('project')!)).windows)}));
retentionPolicyRoutes.post('/preview',async c=>{const b=await jsonBody(c.req.raw,3000);return c.json(await retentionPreview(c.env.DB,c.req.param('project')!,retentionWindows(b.windows)))});
retentionPolicyRoutes.put('/',async c=>{
 const b=await jsonBody(c.req.raw,4000),p=c.req.param('project')!,db=c.env.DB,current=await readRetentionPolicy(db,p),windows=retentionWindows(b.windows),preview=await retentionPreview(db,p,windows,b.at);
 if(b.revision!==current.revision||b.token!==preview.token)return c.json({error:'Retention preview changed; preview again'},409);
 if(preview.shortening&&b.confirmation!=='SHORTEN RETENTION')return c.json({error:'Type SHORTEN RETENTION before shortening a window'},400);
 const revision=current.revision+1,time=Date.now();
 await ownerWrites(c,[retentionPolicyFence(db,p,current.generation),db.prepare('INSERT INTO retention_policies VALUES(?,?,?,?,?,?,?) ON CONFLICT(project) DO UPDATE SET generation=excluded.generation,revision=excluded.revision,windows=excluded.windows,held=excluded.held,reason=excluded.reason,updated=excluded.updated').bind(p,crypto.randomUUID(),revision,JSON.stringify(windows),Number(current.held),current.reason,time),db.prepare('UPDATE retention_runs SET last_day=NULL WHERE project=?').bind(p),db.prepare("INSERT INTO audit VALUES(?,?,'retention_policy_changed',?,?)").bind(crypto.randomUUID(),p,JSON.stringify({revision,windowsDigest:await hash(canonical(windows))}),time)]);
 return c.json(await readRetentionPolicy(db,p));
});
retentionPolicyRoutes.put('/hold',async c=>{
 const b=await jsonBody(c.req.raw,3000),p=c.req.param('project')!,db=c.env.DB,current=await readRetentionPolicy(db,p);
 if(typeof b.held!=='boolean'||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000)throw new Error('A reason is required to set or release a legal hold');
 if(b.revision!==current.revision)return c.json({error:'Retention policy changed; reload'},409);
 const reason=scrub(b.reason.trim()),revision=current.revision+1,time=Date.now();
 await ownerWrites(c,[retentionPolicyFence(db,p,current.generation),db.prepare('INSERT INTO retention_policies VALUES(?,?,?,?,?,?,?) ON CONFLICT(project) DO UPDATE SET generation=excluded.generation,revision=excluded.revision,held=excluded.held,reason=excluded.reason,updated=excluded.updated').bind(p,crypto.randomUUID(),revision,JSON.stringify(current.windows),Number(b.held),reason,time),db.prepare('UPDATE retention_runs SET last_day=NULL WHERE project=?').bind(p),db.prepare("INSERT INTO audit VALUES(?,?,'retention_hold_changed',?,?)").bind(crypto.randomUUID(),p,JSON.stringify({revision,held:Number(b.held),reason}),time)]);
 return c.json(await readRetentionPolicy(db,p));
});
