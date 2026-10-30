import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {noSecrets} from './packet.mjs';
import {createRequire} from 'node:module';
const entry=resolve('packages/agent/bin/spool-agent.mjs');
export function clientEnvironment(app,key){return {...process.env,SPOOL_URL:app.origin+'/api/projects/a',SPOOL_AGENT_KEY:key,SPOOL_DEV_KEY:app.devKey};}
export async function cli(args,env,input){
 const child=spawn(process.execPath,[entry,...args],{env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='',timer;
 child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
 const closed=new Promise((accept,reject)=>{child.once('error',reject);child.once('close',code=>accept({code,stdout,stderr}));});
 try{
  const argumentsText=execFileSync('ps',['-p',String(child.pid),'-o','command='],{encoding:'utf8'});
  const key=env.SPOOL_AGENT_KEY??input?.trim();if(key)assert.ok(!argumentsText.includes(key),'key absent from process arguments');
  child.stdin.end(input);
  const result=await Promise.race([closed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('CLI deadline')),20000);})]);
  for(const secret of [key,env.SPOOL_DEV_KEY].filter(Boolean)){assert.ok(!result.stdout.includes(secret));assert.ok(!result.stderr.includes(secret));}noSecrets(result.stdout+result.stderr);return result;
 }finally{clearTimeout(timer);if(child.exitCode===null)child.kill('SIGKILL');await closed.catch(()=>{});}
}
export function mcpValue(result){
 assert.ok(!result.isError);const text=result.content[0].text;assert.match(text,/^UNTRUSTED TELEMETRY/);
 const fence=/\n(`+)json\n/.exec(text)[1];return JSON.parse(text.split(fence)[1].replace(/^json\n/,''));
}
export async function mcpClient(app,key,project='a'){
 const require=createRequire(new URL('../../packages/agent/package.json',import.meta.url));
 const {Client}=await import(require.resolve('@modelcontextprotocol/sdk/client/index.js'));
 const {StdioClientTransport}=await import(require.resolve('@modelcontextprotocol/sdk/client/stdio.js'));
 const transport=new StdioClientTransport({command:process.execPath,args:[entry,'mcp'],env:{...clientEnvironment(app,key),SPOOL_URL:app.origin+'/api/projects/'+project},stderr:'pipe'});
 const client=new Client({name:'spool-handoff-acceptance',version:'1'},{capabilities:{}});let stderr='';
 transport.stderr?.on('data',b=>stderr+=b);
 try{await client.connect(transport);transport.stderr?.on('data',b=>stderr+=b);}catch(error){await client.close();await transport.close();throw error;}
 return {client,async call(name,args={}){const result=await client.callTool({name,arguments:args});assert.ok(!JSON.stringify(result).includes(key));assert.ok(!stderr.includes(key));assert.ok(!JSON.stringify(result).includes(app.devKey));return result;},async close(){await client.close();await transport.close();}};
}
export async function mcpReadAliases(app,mcp,agent,issue,shortId,mappedIssue,otherIssue){
 const before=(await app.archive()).data;
 const pairs=[
  ['list_issues','spool.issues.read',{},'/api/projects/a/issues?state=all'],
  ['list_issues','spool.issues.read',{state:'all',limit:2},'/api/projects/a/issues?state=all&limit=2'],
  ['list_issues','spool.issues.read',{state:'open',limit:1},'/api/projects/a/issues?state=open&limit=1'],
  ...[issue,shortId.toLowerCase(),mappedIssue].map(id=>['get_packet','spool.issues.read',{issue:id},'/api/projects/a/issues/'+id+'/packet']),
  ['get_outcomes','spool.outcomes.read',{},'/api/projects/a/outcomes'],
 ];
 for(const [legacy,canonical,args,path] of pairs){
  const original=mcpValue(await mcp.call(legacy,args)),alias=mcpValue(await mcp.call(canonical,args));
  assert.deepEqual(alias,original,canonical+' equals the complete '+legacy+' result');
  assert.deepEqual(alias,await app.json(path,'GET',undefined,agent),'both names equal the complete HTTP result');
  if(legacy==='list_issues')assert.ok(alias.length>0,'issue equality uses populated reads');
  noSecrets(alias);
 }
 const foreignResults=[];
 for(const name of ['get_packet','spool.issues.read']){
  const denied=await mcp.call(name,{issue:otherIssue});assert.equal(denied.isError,true);assert.match(denied.content[0].text,/"exitCode": 3/);assert.ok(!JSON.stringify(denied).includes('PROJECT_B_PRIVATE'));
  foreignResults.push(denied);
 }
 assert.deepEqual(foreignResults[1],foreignResults[0],'both packet names return the same complete foreign-issue refusal');
 assert.deepEqual((await app.archive()).data,before,'all legacy and canonical reads preserve archived rows');
 return {readPairs:pairs.length,completeResultsEqual:true,foreignIssueDenied:true};
}
export async function credentialInputs(app,key,directory){
 const env=clientEnvironment(app,key),file=resolve(directory,'agent.key');await writeFile(file,key+'\n',{mode:0o600});
 assert.equal((await cli(['issues','--state','open','--limit','1'],env)).code,0);
 const withoutKey={...env};delete withoutKey.SPOOL_AGENT_KEY;
 const fileResult=await cli(['issues','--state','all','--limit','2','--key-file',file],withoutKey);assert.equal(fileResult.code,0);assert.ok(!fileResult.stdout.includes(key));assert.ok(!fileResult.stderr.includes(key));
 assert.equal((await cli(['outcomes','--key-stdin'],withoutKey,key+'\n')).code,0);
 return env;
}
