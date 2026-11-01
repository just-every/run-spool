/** Independent specialist readback, after the normal policy phases. Native
 * reproduction and provider steps stay in the normal declared journey. */
export default async function({tool}){
 const answer=await tool('spool.packets.read',{project:'agent-door',issue:'not-a-retained-issue'});
 if(!answer.result?.isError)throw Error('Missing issue must be refused');
 const outcomes=await tool('spool.outcomes.read',{project:'agent-door'});
 if(outcomes.result?.isError||!String(outcomes.result?.structuredContent?.coverage).includes('unknown'))throw Error('Capture loss must retain unknown pre-transport loss');
}

// 0.2.87 calls this hook before taking the held-action no-effect witness.
// Establish the real person's exact native repository consent at that boundary;
// the later proof hook supplies its reference without changing native custody.
export async function beforeStep({step,args,request,origin,cookie}){
 if(!['spool.fixes.advance','spool.alerts.read','spool.followups.update'].includes(step.tool))return;
 const json=async(path,method='GET',body)=>{
  const response=await request(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json'},...body===undefined?{}:{body:JSON.stringify(body)}});
  if(!response.ok)throw Error('Native repository consent lifecycle HTTP '+response.status);
  return response.json();
 };
 // Disabling a person's active configuration is a supported live narrowing,
 // independent of the still-unavailable agent standing-worker setup. Prepare
 // that actual native state before the read/revision and no-effect baselines.
 // The required agent enable/set steps remain unchanged and fail visibly.
 if(step.id==='alert-final'){
  const path='/api/projects/'+encodeURIComponent(args.project)+'/alerting/rules';
  const [rule]=await json(path);
  if(!rule)throw Error('Native alert narrowing fixture is unavailable');
  await json(path+'/'+encodeURIComponent(rule.id),'PUT',{name:rule.name,enabled:true,channel:rule.channel,destination:rule.destination,kinds:JSON.parse(rule.kinds),windowMs:rule.window_ms,threshold:rule.threshold,revision:rule.revision});
  return;
 }
 if(step.id==='followup-reset'){
  const path='/api/projects/'+encodeURIComponent(args.project);
  const [rule]=await json(path+'/alerting/rules');
  if(!rule)throw Error('Native follow-up narrowing fixture is unavailable');
  await json(path+'/follow-up/alternate','PUT',{destination:rule.destination,channel:rule.channel});
  return;
 }
 if(step.tool!=='spool.fixes.advance')return;
 const project=encodeURIComponent(args.project),path='/api/projects/'+project+'/fixes';
 let workflow;
 for(const issue of await json('/api/projects/'+project+'/issues')){
  const list=await json(path+'?issue='+encodeURIComponent(issue.id));
  workflow=list.workflows?.find(row=>row.id===args.id);if(workflow)break;
 }
 if(!workflow)throw Error('Native workflow unavailable before provider action');
 if(!workflow.proofReference)await json(path+'/'+encodeURIComponent(args.id)+'/approve','POST',{revision:workflow.revision});
}
