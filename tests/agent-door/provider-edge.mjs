// Test network boundary only. It owns no application state or credentials.
export default {
 async fetch(request,{fixture}) {
  const url=new URL(request.url);
  if(url.origin!=='https://api.github.com'||!fixture?.repository)return Response.json({message:'No configured provider fixture'},{status:502});
  const repo='/repos/'+fixture.repository+'/';
  if(!url.pathname.startsWith(repo)&&!url.pathname.startsWith('/app/installations/')&&url.pathname!=='/installation/token')return Response.json({message:'Repository outside fixture authority'},{status:403});
  if(url.pathname==='/installation/token'&&request.method==='DELETE')return new Response(null,{status:204});
  // Only explicit request/response fixtures supplied by the native journey can
  // admit a provider operation. Undeclared methods and paths stay unavailable.
  const expected=fixture.responses?.[request.method+' '+url.pathname];
  if(!expected)return Response.json({message:'Provider operation unavailable'},{status:502});
  const body=request.method==='GET'?null:await request.json().catch(()=>null);
  if(expected.body&&JSON.stringify(body)!==JSON.stringify(expected.body))return Response.json({message:'Exact provider payload mismatch'},{status:422});
  return Response.json(expected.response,{status:expected.status??200});
 },
};
