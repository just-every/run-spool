// Server door: a background read by a signed-in owner leaves no audit row; a foreground read, a denied read and a credential read still do.
import {launch,openContext,signedPage,origin,save} from './lib.mjs';
const b=await launch();const c=await openContext(b,'demo-after.log');await signedPage(c,'/projects/cedar-market/settings').then(p=>p.close());
const get=async(path,headers={})=>{const r=await c.request.fetch(origin+path,{headers});return {status:r.status(),body:await r.json().catch(()=>null)}};
const count=async()=>{const rows=(await get('/api/audit?limit=100',{'X-Spool-Background':'1'})).body.rows;return {audit_read:rows.filter(r=>r.action==='audit.read').length,grouping_proposals:rows.filter(r=>r.action==='grouping.proposals').length}};
const out={};
out.start=await count();
for(let i=0;i<3;i++){await get('/api/audit',{'X-Spool-Background':'1'});await get('/api/projects/cedar-market/grouping-proposals',{'X-Spool-Background':'1'})}
out.afterThreeBackgroundPairs=await count();
for(let i=0;i<3;i++){await get('/api/audit');await get('/api/projects/cedar-market/grouping-proposals')}
out.afterThreeForegroundPairs=await count();
save('after','quiet-read.json',out);console.log(JSON.stringify(out));await b.close();
