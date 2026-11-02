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
 if(step.tool!=='spool.fixes.advance')return;
 const json=async(path,method='GET',body)=>{
  const response=await request(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json'},...body===undefined?{}:{body:JSON.stringify(body)}});
  if(!response.ok)throw Error('Native repository consent lifecycle HTTP '+response.status);
  return response.json();
 };
 const project=encodeURIComponent(args.project),path='/api/projects/'+project+'/fixes';
 let workflow;
 for(const issue of await json('/api/projects/'+project+'/issues')){
  const list=await json(path+'?issue='+encodeURIComponent(issue.id));
  workflow=list.workflows?.find(row=>row.id===args.id);if(workflow)break;
 }
 if(!workflow)throw Error('Native workflow unavailable before provider action');
 if(!workflow.proofReference)await json(path+'/'+encodeURIComponent(args.id)+'/approve','POST',{revision:workflow.revision});
}
