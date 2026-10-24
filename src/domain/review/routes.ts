import {ownerProjectRouter,ownerWrites,jsonBody} from '../owner-router';
import {reviewQuery} from './model';
import {auditCommit} from '../audit';
export const reviewRoutes=ownerProjectRouter();
reviewRoutes.get('/views',async c=>c.json({views:(await c.env.DB.prepare('SELECT id,query FROM review_views WHERE project=? ORDER BY id').bind(c.req.param('project')!).all<any>()).results.map(r=>({id:r.id,query:JSON.parse(r.query)})),limit:25}));
reviewRoutes.post('/views',async c=>{
 const b=await jsonBody(c.req.raw,4000),query=reviewQuery(b),db=c.env.DB,p=c.req.param('project')!,id=crypto.randomUUID();
 try{await ownerWrites(c,[db.prepare('INSERT INTO review_views VALUES(?,?,?,?)').bind(p,id,crypto.randomUUID(),JSON.stringify(query)),auditCommit(db)]);}catch(error){if(String(error).includes('review_view_capacity'))return c.json({error:'At most 25 saved views per project'},409);throw error}
 return c.json({id,query},201);
});
reviewRoutes.delete('/views/:id',async c=>{const db=c.env.DB;await ownerWrites(c,[db.prepare('DELETE FROM review_views WHERE project=? AND id=?').bind(c.req.param('project')!,c.req.param('id')!),auditCommit(db,'changes()>0')]);return c.json({deleted:true})});
