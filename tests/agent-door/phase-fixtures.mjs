import {createHash,randomUUID} from 'node:crypto';
import {shopFixture} from '../execution/fixture.mjs';
import {runSandbox,sandboxVersion} from '../../scripts/reproduce/sandbox.mjs';

// Fresh native records for each policy phase, through ordinary production doors.
export default async function({request,origin,cookie,phase}){
 const json=async(path,method='GET',body,headers={})=>{
  const result=await request(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,...body===undefined?{}:{'content-type':'application/json'},...headers},...body===undefined?{}:{body:JSON.stringify(body)}});
  if(!result.ok)throw Error(`Native phase ${path} HTTP ${result.status}`);
  return result.json();
 };
 const project='phase-'+randomUUID(),created=await json('/api/projects','POST',{id:project,name:'Checkout '+phase});
 const path='/api/projects/'+project;
 const key=await json(path+'/keys','POST',{kind:'agent'}),hash=createHash('sha256').update(key.key).digest('hex');
 const clients={local:{token:key.key,clientId:'spool-key:'+hash,agent:{id:'spool-key:'+hash,name:'Spool project agent',specialist:'triage engineer'}}};
 if(phase==='initial')return {values:{project},clients};
 const invited=await json('/api/organization/invites','POST',{email:'phase-'+randomUUID()+'@synthetic.invalid',name:'Phase triage member',role:'member',grants:[{project,role:'member'}]});
 const roster=await json('/api/organization'),member=roster.members.find(row=>row.id===invited.id);
 const fixture=await shopFixture();
 await json(path+'/releases','POST',{name:'1.0.0',build:'web-1'});
 await json(path+'/artifacts','POST',{release:'1.0.0',build:'web-1',debugId:'cart-map',map:fixture.broken});
 for(const eventId of ['cart-1','cart-2'])await json('/api/ingest/'+project,'POST',{version:1,eventId,release:'1.0.0',build:'web-1',environment:'production',type:fixture.type,message:fixture.message,frames:fixture.frames,breadcrumbs:[]},{Authorization:'Bearer '+created.ingestKey});
 const recipe=await json(path+'/reproducers','POST',{event:'cart-1',input:[{}]});
 const queued=await json(path+'/reproducers/'+recipe.id+'/runs','POST',{});
 const job=await json(new URL(queued.url).pathname,'GET',undefined,{Authorization:'Bearer '+queued.token});
 const observation=await runSandbox(job);
 const result=await json(new URL(queued.url).pathname+'/observation','POST',{protocol:1,tools:{workerd:await sandboxVersion(),node:process.version,runner:'spool-runner/1'},observation},{Authorization:'Bearer '+queued.token});
 if(result.outcome!=='reproduced')throw Error('Native phase sandbox did not reproduce the failure');
 for(let i=0;i<4;i++)await json(path+'/keys','POST',{kind:'agent'});
 const live=await json(path+'/alerting/destinations','POST',{label:'Live phase recipient',recipient:'live@synthetic.invalid'});
 const tested=await json(path+'/alerting/destinations/'+live.id+'/test','POST',{});
 if(tested.state!=='passing')throw Error('Native phase mail edge unavailable');
 await json(path+'/alerting/destinations/'+live.id+'/review','POST',{testId:tested.id});
 await json(path+'/alerting/destinations','POST',{label:'Separate phase test',recipient:'test@synthetic.invalid'});
 await json(path+'/alerting/rules','POST',{name:'Checkout failures',enabled:false,channel:'mail',destination:live.id,kinds:['new_issue'],windowMs:60000,threshold:2});
 return {values:{project,member:member.id,memberVersion:member.version},clients};
}
