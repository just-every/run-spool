import {shopFixture} from '../execution/fixture.mjs';
import {runSandbox,sandboxVersion} from '../../scripts/reproduce/sandbox.mjs';
/** Ordinary signed claim and native setup, using only this disposable runtime. */
export default async function initialize({request,origin,claim,displayName}) {
 const response=await request(origin+claim.path,{method:'POST',headers:{Origin:origin,'content-type':'application/json'},body:JSON.stringify({token:claim.token,displayName})});
 if(response.status!==303)return response;
 const cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 const native=async(path,body)=>{
  const reply=await request(origin+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json'},body:JSON.stringify(body)});
  if(!reply.ok)throw new Error('Native conformance setup refused');return reply.json();
 };
 const fixture=await shopFixture();
 const project=await native('/api/projects',{id:'door-fixture',name:'Checkout investigation'});
 await native('/api/projects/door-fixture/releases',{name:'door-release',build:'web'});
 await native('/api/projects/door-fixture/artifacts',{release:'door-release',build:'web',debugId:'cart-map',map:fixture.broken});
 const captured=await request(origin+'/api/ingest/door-fixture',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+project.ingestKey},body:JSON.stringify({version:1,eventId:'door-capture',release:'door-release',build:'web',environment:'production',type:fixture.type,message:fixture.message,frames:fixture.frames,breadcrumbs:[]})});
 if(captured.status!==201)throw new Error('Native capture refused');await captured.body?.cancel();
 const recipe=await native('/api/projects/door-fixture/reproducers',{event:'door-capture',input:[{}]});
 const queued=await native('/api/projects/door-fixture/reproducers/'+recipe.id+'/runs',{});
 const jobResponse=await request(origin+'/api/sandbox/runs/'+queued.run,{headers:{Authorization:'Bearer '+queued.token}});
 if(!jobResponse.ok)throw new Error('Native sandbox claim refused');
 const observation=await runSandbox(await jobResponse.json());
 const reported=await request(origin+'/api/sandbox/runs/'+queued.run+'/observation',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+queued.token},body:JSON.stringify({protocol:1,observation,tools:{workerd:await sandboxVersion(),node:process.version,runner:'spool-runner/1'}})});
 if(!reported.ok||(await reported.json()).outcome!=='reproduced')throw new Error('Native sandbox did not confirm the reproduction');
 await native('/api/organization',{id:'door-organization',name:'Checkout company'});
 await native('/api/organization/invites',{email:'synthetic-spool-member@example.test',name:'Morgan Engineer',role:'member',grants:[{project:'door-fixture',role:'member'}]});
 await native('/api/projects/door-fixture/keys',{kind:'agent'});
 const destination=await native('/api/projects/door-fixture/alerting/destinations',{label:'Checkout team',recipient:'synthetic-base-1@example.com'});
 const tested=await native('/api/projects/door-fixture/alerting/destinations/'+destination.id+'/test',{});
 if(tested.state!=='passing')throw new Error('Native mail provider edge is unavailable');
 await native('/api/projects/door-fixture/alerting/destinations/'+destination.id+'/review',{testId:tested.id});
 for(const enabled of [false,true])await native('/api/projects/door-fixture/alerting/rules',{name:enabled?'Checkout live errors':'Checkout draft errors',enabled,channel:'mail',destination:destination.id,kinds:['new_issue'],windowMs:60000,threshold:2});
 await native('/api/projects',{id:'door-erasure',name:'Disposable erasure target'});
 return response;
}
