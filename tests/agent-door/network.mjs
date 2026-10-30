// Test-only provider edge. Native grants, signatures, persistence, leases and
// custody stay in the application. No request is forwarded to a real provider.
export default {async fetch(request,{fixture}){
 const u=new URL(request.url),repo=fixture?.repository??'synthetic/spool-door',root=`/repos/${repo}`;
 if(u.origin!=='https://api.github.com')return new Response('Undeclared edge',{status:502});
 if(request.method==='POST'&&/^\/app\/installations\/\d+\/access_tokens$/.test(u.pathname))return Response.json({token:'synthetic-test-token',expires_at:new Date(Date.now()+300000).toISOString(),permissions:{contents:'write',pull_requests:'write',checks:'read'},repositories:[{full_name:repo}]},{status:201});
 if(request.method==='DELETE'&&u.pathname==='/installation/token')return new Response(null,{status:204});
 if(!u.pathname.startsWith(root+'/'))return new Response('Undeclared repository',{status:502});
 const p=u.pathname.slice(root.length),sha='a'.repeat(40),head='b'.repeat(40);
 if(request.method==='GET'&&p==='/git/ref/heads/main')return Response.json({object:{sha}});
 if(request.method==='POST'&&p==='/git/refs'){const b=await request.json();return Response.json({ref:b.ref,object:{sha:b.sha}},{status:201});}
 if(request.method==='PUT'&&p.startsWith('/contents/.spool/reproducers/'))return Response.json({commit:{sha:head},content:{path:p.slice(10)}},{status:201});
 if(request.method==='POST'&&p==='/pulls'){const b=await request.json();if(b.draft!==true)return new Response('Draft required',{status:422});return Response.json({number:17,html_url:`https://github.com/${repo}/pull/17`,head:{sha:head}},{status:201});}
 if(request.method==='GET'&&p==='/pulls/17')return Response.json({number:17,state:'open',draft:true,merged:false,head:{sha:head}});
 if(request.method==='GET'&&p===`/commits/${head}/check-runs`)return Response.json({total_count:1,check_runs:[{name:'data schema',status:'completed',conclusion:'success'}]});
 return new Response('Undeclared provider operation',{status:502});
}};
