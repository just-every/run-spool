import {createServer} from 'node:http';
import {createHash,createVerify,generateKeyPairSync,randomBytes} from 'node:crypto';
// The GitHub REST API at the network edge, in memory. It checks the App JWT
// signature, issues installation tokens scoped to the requested repository and
// permissions, and refuses any token used outside that scope or after revocation.
export async function githubDouble({appId='42',installationId='7',repository='just-every/run-spool'}={}){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 const sha=()=>randomBytes(20).toString('hex'),requests=[],tokens=new Map();
 const state={refs:new Map([['heads/main',sha()]]),files:new Map(),pulls:[],checks:new Map(),broaden:false,reported:'exact'};
 const send=(response,status,body)=>{response.writeHead(status,{'Content-Type':'application/json'});response.end(JSON.stringify(body));};
 function appAuthorized(header){
  const [head,payload,signature]=(header??'').replace(/^Bearer /,'').split('.');
  if(!signature||!createVerify('RSA-SHA256').update(`${head}.${payload}`).verify(publicKey,Buffer.from(signature,'base64url')))return false;
  const claims=JSON.parse(Buffer.from(payload,'base64url'));const now=Math.floor(Date.now()/1000);
  return claims.iss===appId&&claims.iat<=now&&claims.exp>now&&claims.exp-claims.iat<=600;
 }
 // How the answer names the token's repositories: as asked, omitted, empty, or wider.
 const entry=full=>({name:full.split('/')[1],full_name:full}),reported=full=>state.reported==='missing'?{}:state.reported==='empty'?{repositories:[]}:state.reported==='wider'?{repositories:[...full,repository.split('/')[0]+'/other'].map(entry)}:{repositories:full.map(entry)};
 const server=createServer(async(request,response)=>{
  let body='';for await(const chunk of request)body+=chunk;
  if(state.delay)await new Promise(resolve=>setTimeout(resolve,state.delay));
  const url=new URL(request.url,'http://double'),path=url.pathname,token=(request.headers.authorization??'').replace(/^Bearer /,'');
  requests.push({method:request.method,path,body:body?JSON.parse(body):null,token:token.startsWith('ghs_')?'installation':token?'app-jwt':'none'});
  if(request.method==='POST'&&path===`/app/installations/${installationId}/access_tokens`){
   if(!appAuthorized(request.headers.authorization))return send(response,401,{message:'Bad credentials'});
   const asked=JSON.parse(body),value='ghs_'+randomBytes(18).toString('hex');
   const permissions={...asked.permissions,metadata:'read',...state.broaden?{administration:'write'}:{}};
   // GitHub names are case-insensitive; answers carry the canonical full_name.
   const canonical=name=>name.toLowerCase()===repository.split('/')[1].toLowerCase()?repository:repository.split('/')[0]+'/'+name;
   tokens.set(value,{repositories:asked.repositories.map(canonical),permissions,expires:Date.now()+3600_000});
   return send(response,201,{token:value,expires_at:new Date(Date.now()+3600_000).toISOString(),permissions,repository_selection:'selected',...reported(asked.repositories.map(canonical))});
  }
  const grant=tokens.get(token);
  if(!grant||grant.expires<Date.now())return send(response,401,{message:'Bad credentials'});
  if(request.method==='DELETE'&&path==='/installation/token'){tokens.delete(token);response.writeHead(204);return response.end();}
  const prefix=`/repos/${repository}/`;
  if(!path.toLowerCase().startsWith(prefix.toLowerCase())||!grant.repositories.includes(repository))return send(response,404,{message:'Not Found'});
  const rest=path.slice(prefix.length),needs=level=>(name)=>({read:1,write:2})[grant.permissions[name]]>=({read:1,write:2})[level];
  if(request.method==='GET'&&rest.startsWith('git/ref/')){const ref=state.refs.get(decodeURIComponent(rest.slice(8)));return ref?send(response,200,{ref:'refs/'+rest.slice(8),object:{sha:ref}}):send(response,404,{message:'Not Found'});}
  if(request.method==='POST'&&rest==='git/refs'){if(!needs('write')('contents'))return send(response,403,{message:'Resource not accessible by integration'});const input=JSON.parse(body),name=input.ref.replace(/^refs\//,'');if(state.refs.has(name))return send(response,422,{message:'Reference already exists'});state.refs.set(name,input.sha);return send(response,201,{ref:input.ref,object:{sha:input.sha}});}
  if(request.method==='PUT'&&rest.startsWith('contents/')){if(!needs('write')('contents'))return send(response,403,{message:'Resource not accessible by integration'});const input=JSON.parse(body),ref='heads/'+input.branch;if(!state.refs.has(ref))return send(response,404,{message:'Branch not found'});const commit=sha();state.refs.set(ref,commit);const file=decodeURIComponent(rest.slice(9));state.files.set(input.branch+':'+file,Buffer.from(input.content,'base64').toString());return send(response,201,{content:{path:file},commit:{sha:commit}});}
  if(request.method==='POST'&&rest==='pulls'){if(!needs('write')('pull_requests'))return send(response,403,{message:'Resource not accessible by integration'});const input=JSON.parse(body),number=state.pulls.length+1;const pull={number,draft:input.draft===true,title:input.title,body:input.body,head:input.head,base:input.base,state:'open',merged:false,merge_commit_sha:null,merged_at:null};state.pulls.push(pull);return send(response,201,{number,html_url:`https://github.com/${repository}/pull/${number}`,draft:pull.draft,head:{sha:state.refs.get('heads/'+input.head)}});}
  if(request.method==='GET'&&/^pulls\/\d+$/.test(rest)){const pull=state.pulls[Number(rest.slice(6))-1];if(!pull)return send(response,404,{message:'Not Found'});return send(response,200,{number:pull.number,state:pull.state,merged:pull.merged,merged_at:pull.merged_at,merge_commit_sha:pull.merge_commit_sha,head:{sha:state.refs.get('heads/'+pull.head)}});}
  if(request.method==='GET'&&/^commits\/[0-9a-f]{40}\/check-runs$/.test(rest)){if(!needs('read')('checks'))return send(response,403,{message:'Resource not accessible by integration'});const runs=state.checks.get(rest.split('/')[1])??[];return send(response,200,{total_count:runs.length,check_runs:runs});}
  if(request.method==='GET'&&rest.startsWith('compare/')){const [base,head]=rest.slice(8).split('...');return send(response,200,{status:state.descendants?.[head]===base?'ahead':'diverged',ahead_by:1,behind_by:0});}
  return send(response,404,{message:'Not Found'});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 return {origin,requests,state,
  connection:JSON.stringify({appId,installationId,privateKey,apiOrigin:origin}),
  file:(branch,path)=>state.files.get(branch+':'+path),
  sha256:text=>createHash('sha256').update(text).digest('hex'),
  // The owner merges the pull request on GitHub; CI reports one check on its head.
  merge(number){const pull=state.pulls[number-1],head=state.refs.get('heads/'+pull.head);state.checks.set(head,[{name:'test',status:'completed',conclusion:'success'}]);pull.state='closed';pull.merged=true;pull.merged_at=new Date().toISOString();pull.merge_commit_sha=sha();state.refs.set('heads/'+pull.base,pull.merge_commit_sha);return pull.merge_commit_sha;},
  later(base){const head=sha();state.descendants={...state.descendants,[head]:base};return head;},
  live:()=>tokens.size,
  async stop(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
