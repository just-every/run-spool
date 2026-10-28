import {shopFixture} from '../execution/fixture.mjs';
import {runSandbox,sandboxVersion} from '../../scripts/reproduce/sandbox.mjs';

/** Ordinary native owner, project, capture and isolated-runner lifecycle only.
 * The verifier owns its signer and the paid/network edge; no fixture SQL. */
export default async function({request,origin,claim,displayName,returnTo}){
 const response=await request(origin+claim.path,{method:'POST',redirect:'manual',headers:{Origin:origin,'content-type':'application/json'},body:JSON.stringify({token:claim.token,displayName,returnTo})});
 if(response.status!==303)throw Error('Native signed owner claim failed');
 const cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const json=async(path,method='GET',body,headers={})=>{
  const result=await request(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,...body===undefined?{}:{'content-type':'application/json'},...headers},...body===undefined?{}:{body:JSON.stringify(body)}});
  if(!result.ok)throw Error(`Native initialization ${path} HTTP ${result.status}`);return result.json();
 };
 await json('/api/organization','POST',{id:'agent-company',name:'Harbor Shop'});
 const project=await json('/api/projects','POST',{id:'agent-door',name:'Checkout failures'});
 await json('/api/projects','POST',{id:'foreign-project',name:'Private foreign project'});
 await json('/api/organization/invites','POST',{email:'triage-fixture@synthetic.invalid',name:'Riley Engineer',role:'member',grants:[{project:'agent-door',role:'member'}]});
 const p='/api/projects/agent-door',fixture=await shopFixture();
 await json(p+'/releases','POST',{name:'1.0.0',build:'web-1'});
 await json(p+'/artifacts','POST',{release:'1.0.0',build:'web-1',debugId:'cart-map',map:fixture.broken});
 let issue;
 for(const eventId of ['cart-1','cart-2'])issue=(await json('/api/ingest/agent-door','POST',{version:1,eventId,release:'1.0.0',build:'web-1',environment:'production',type:fixture.type,message:fixture.message,frames:fixture.frames,breadcrumbs:[]},{Authorization:`Bearer ${project.ingestKey}`})).issue;
 const recipe=await json(p+'/reproducers','POST',{event:'cart-1',input:[{}]});
 const queued=await json(p+'/reproducers/'+recipe.id+'/runs','POST',{});
 const job=await json(new URL(queued.url).pathname,'GET',undefined,{Authorization:`Bearer ${queued.token}`});
 const observation=await runSandbox(job);
 const result=await json(new URL(queued.url).pathname+'/observation','POST',{protocol:1,tools:{workerd:await sandboxVersion(),node:process.version,runner:'spool-runner/1'},observation},{Authorization:`Bearer ${queued.token}`});
 if(result.outcome!=='reproduced')throw Error('The native sandbox did not reproduce the captured failure');
 for(let i=0;i<4;i++)await json(p+'/keys','POST',{kind:'agent'});
 const live=await json(p+'/alerting/destinations','POST',{label:'Live fixture destination',recipient:'live@synthetic.invalid'});
 const tested=await json(p+'/alerting/destinations/'+live.id+'/test','POST',{});
 if(tested.state!=='passing')throw Error('The declared mail network edge is unavailable');
 await json(p+'/alerting/destinations/'+live.id+'/review','POST',{testId:tested.id});
 await json(p+'/alerting/destinations','POST',{label:'Separate destination test',recipient:'test@synthetic.invalid'});
 await json(p+'/alerting/rules','POST',{name:'Checkout failures',enabled:false,channel:'mail',destination:live.id,kinds:['new_issue'],windowMs:60000,threshold:2});
 return response;
}
