import assert from 'node:assert/strict';
import {noSecrets} from './packet.mjs';
export async function scopeProof(app,grant,issue,otherIssue,project){
 const packet=`/api/projects/a/issues/${issue}/packet`,agent={agent:grant.key};
 assert.equal((await app.request(packet,'GET',undefined,{...agent,dev:false})).status,401,'dev-minted grant needs checkout gate');
 const reads=['/api/projects/a/issues',packet,'/api/projects/a/outcomes','/api/projects/a/alerts'];
 for(const path of reads){const response=await app.request(path,'GET',undefined,agent);assert.equal(response.status,200);noSecrets(await response.json());}
 const cross=['/api/projects/b/issues',`/api/projects/b/issues/${otherIssue}/packet`,'/api/projects/b/outcomes','/api/projects/b/alerts',`/api/projects/a/issues/${otherIssue}/packet`];
 for(const path of cross){const r=await app.request(path,'GET',undefined,agent);assert.ok([403,404].includes(r.status));assert.ok(!(await r.text()).includes('PROJECT_B_PRIVATE'));}
 const ownerPaths=['/api/projects','/api/archive','/api/projects/a/keys','/api/projects/a/releases','/api/projects/a/artifacts','/api/projects/a/browser-origins','/api/projects/a/alerting/rules','/api/projects/a/alerting/deliveries','/api/projects/a/alerting/destinations','/api/projects/a/issues/','/api/projects/a/issues/extra/nested','/api/projects/a/alerts/extra','/api/projects/a/outcomes/extra','/api/projects/a/alerts/','/api/projects/a/outcomes/',packet+'/extra',packet+'/'];
 for(const path of ownerPaths)assert.equal((await app.request(path,'GET',undefined,agent)).status,403,path);
 const before=(await app.archive()).data,keysBefore=await app.json('/api/projects/a/keys');
 const mutations=[
 ['/api/projects','POST',{id:'evil',name:'Bad'}],['/api/projects/a/keys','POST',{kind:'agent'}],['/api/projects/a/keys/'+grant.hash,'DELETE'],
 ['/api/projects/a/releases','POST',{name:'bad',build:'bad'}],['/api/projects/a/artifacts','POST',{release:'z-release',build:'build-z',debugId:'evil',map:{version:3,sources:['x'],names:[],mappings:'AAAA'}}],
 [`/api/projects/a/issues/${issue}`,'PATCH',{state:'resolved',revision:0}],['/api/ingest/a','POST',{version:1}],
 ['/api/projects/a/browser-origins','POST',{origin:'https://evil.example'}],['/api/projects/a/browser-origins','DELETE',{origin:'https://evil.example'}],
 ['/api/projects/a/retention','POST',{cutoff:Date.now(),apply:true}],['/api/projects/a/erase','POST',{confirmation:'a'}],['/api/restore','POST',{}],
 ['/api/1/store/','POST',{}],['/api/1/envelope/','POST',{}],['/api/operator/import/uploads','POST',{}],['/api/operator/import/plan','POST',{}],['/api/operator/import/apply','POST',{}],['/api/operator/import/undo','POST',{}],['/api/imports/sentry/fixture-org/unknown/resume','POST',{}],['/api/imports/sentry/fixture-org/unknown/undo','POST',{}],
 ['/api/projects/a/alerting/rules','POST',{}],['/api/projects/a/alerting/rules/unknown','PUT',{}],['/api/projects/a/alerting/deliveries/unknown/resolve','POST',{}],
 ];
 for(const path of reads)for(const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS'])mutations.push([path,method,method==='HEAD'||method==='OPTIONS'?undefined:{}]);
 for(const [path,method,value] of mutations){const response=await app.request(path,method,value,agent);assert.equal(response.status,403,`${method} ${path}: HTTP ${response.status}`);await response.body?.cancel();}
 assert.deepEqual((await app.archive()).data,before,'all archived rows unchanged after denied mutations');assert.deepEqual(await app.json('/api/projects/a/keys'),keysBefore);
 for(const key of [project.ingestKey,(await app.json('/api/projects/a/keys','POST',{kind:'deploy'})).key])assert.ok([401,403].includes((await app.request(packet,'GET',undefined,{agent:key})).status));
 for(const name of ['key','token','agentKey','api_key'])assert.equal((await app.request(packet+'?'+name+'='+encodeURIComponent(grant.key),'GET',undefined,{headers:{Cookie:''}})).status,401);
 const anonymous=await app.request(packet,'GET',undefined,{headers:{Cookie:''}});assert.equal(anonymous.status,401);
 const member=await fetch(app.origin+'/auth/dev/enter?as=member',{redirect:'manual',headers:{'x-rer-dev-key':app.devKey}});const memberCookie=member.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');await member.body?.cancel();
 assert.ok([401,403].includes((await app.request(packet,'GET',undefined,{headers:{Cookie:memberCookie}})).status));
 return {readRoutes:reads.length,crossProjectRoutes:cross.length,deniedRequests:mutations.length,unchangedArchiveTables:Object.keys(before).length};
}
