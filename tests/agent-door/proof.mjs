// Complete only the real native person's exact repository-grant lifecycle.
export default async function({request,args,kind}){
 if(kind!=='repository_grant')throw Error('Unsupported native proof');
 const path=`/api/projects/${encodeURIComponent(args.project)}/fixes`;
 // The native workflow list is bounded and permissioned; no database accessor.
 const issues=await (await request(`/api/projects/${encodeURIComponent(args.project)}/issues`)).json();
 let workflow;
 for(const issue of issues){const value=await (await request(`${path}?issue=${encodeURIComponent(issue.id)}`)).json();workflow=value.workflows?.find(row=>row.id===args.id);if(workflow)break;}
 if(!workflow)throw Error('Native workflow is unavailable');
 if(!workflow.proofReference){const response=await request(`${path}/${encodeURIComponent(args.id)}/approve`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({revision:workflow.revision})});if(!response.ok)throw Error('Native consent refused');workflow=await response.json();}
 return workflow.proofReference;
}
