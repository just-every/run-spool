import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {launchBrowser} from './browser-launch.mjs';
import AxeBuilder from '@axe-core/playwright';
import {heldOwnerRequest} from './owner-erasure-inflight.mjs';
import {cli} from './agent-handoff/clients.mjs';
import {runtime} from './owner-erasure/helpers.mjs';
import {signIn,confirmEmailLink,emailSignIn,testOwner} from './auth.mjs';
import {legacyMailRows} from './legacy-mail.mjs';

const organization = '/api/organization';
const client = (origin,cookie='') => {
 const req = (path,method='GET',value,headers={}) => fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,...value!==undefined?{'Content-Type':'application/json'}:{},...headers},...value!==undefined?{body:typeof value==='string'?value:JSON.stringify(value)}:{}});
 const json = async (...args) => {const response=await req(...args);assert.ok(response.ok,`${args[0]} HTTP ${response.status}`);return response.json()};
 return {req,json};
};
const status = async pending => {const response=await pending;await response.arrayBuffer();return response.status};
// Project membership deliberately conceals unavailable scopes with 404.
const denied = async (pending,message) => assert.ok([401,403,404].includes(await status(pending)),message);
const projectRoot = project => '/api/projects/'+project.id;
const nativeEvent = id => ({version:1,eventId:id,release:'synthetic-spool-1',build:'web',environment:'production',type:'SyntheticSpoolError',message:'synthetic-spool-1',frames:[{file:'https://synthetic-spool.example/app.js',function:'checkout',line:12,column:0}],breadcrumbs:[]});

async function concealed(actor,path,method='GET',value) {
 const known=await actor.req(path,method,value),unknown=await actor.req(path.replace(/(\/api\/projects\/)[^/]+/,'$1synthetic-spool-unknown'),method,value);
 assert.equal(known.status,404,'an unavailable project or role is concealed');
 assert.equal(unknown.status,404);
 assert.deepEqual(await known.json(),await unknown.json(),'the refusal has exactly the unknown-project shape');
}

const agentEnvironment=(origin,project,key)=>({...process.env,SPOOL_URL:origin+projectRoot(project),SPOOL_AGENT_KEY:key,SPOOL_DEV_KEY:''});
async function mcpDoor(origin,project,key,issue,allowed) {
 const require=createRequire(new URL('../packages/agent/package.json',import.meta.url));
 const {Client}=await import(require.resolve('@modelcontextprotocol/sdk/client/index.js'));
 const {StdioClientTransport}=await import(require.resolve('@modelcontextprotocol/sdk/client/stdio.js'));
 const transport=new StdioClientTransport({command:process.execPath,args:[resolve('packages/agent/bin/spool-agent.mjs'),'mcp'],env:agentEnvironment(origin,project,key),stderr:'pipe'});
 const client=new Client({name:'synthetic-spool-1',version:'1'},{capabilities:{}});
 try {await client.connect(transport);const reply=await client.callTool({name:'get_packet',arguments:{issue}});assert.equal(!!reply.isError,!allowed,'MCP obeys the current project grant');assert.ok(!JSON.stringify(reply).includes(key));}
 finally {await client.close();await transport.close();}
}

async function browserMembers(owner,projects) {
 const browser=await launchBrowser();
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const split=owner.cookie.indexOf('=');
  await context.addCookies([{name:owner.cookie.slice(0,split),value:owner.cookie.slice(split+1),url:owner.origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();
  await page.goto(owner.origin+'/projects/'+projects[0].id+'/settings');
  const members=page.getByRole('region',{name:'Members',exact:true});
  await members.getByRole('heading',{name:'Members',exact:true}).waitFor();
  await members.locator('summary').filter({hasText:/^Invite a member$/}).click();
  const form=members.locator('form').filter({has:page.getByLabel('Email',{exact:true})});
  await form.getByLabel('Email',{exact:true}).fill('synthetic-spool-6@example.test');
  await form.getByLabel('Name',{exact:true}).fill('synthetic-spool-6');
  await form.getByLabel(/^Organization role/).selectOption('read-only');
  await form.getByLabel(new RegExp('^'+projects[0].name)).selectOption('read-only');
  const invited=page.waitForResponse(r=>new URL(r.url()).pathname===organization+'/invites'&&r.request().method()==='POST'&&r.status()===202);
  await form.getByRole('button',{name:'Send invitation',exact:true}).click();await invited;
  await members.getByText('synthetic-spool-6',{exact:true}).first().waitFor();
  // Stored grants contain member/created metadata; writes must send only the input shape.
  await members.getByRole('button',{name:'Details: synthetic-spool-6 access',exact:true}).click();
  const dialog=page.getByRole('dialog'),role=dialog.getByLabel(/^Organization role/),secondProject=dialog.getByLabel(new RegExp('^'+projects[1].name));
  async function saved(select,value) {
   const pending=page.waitForResponse(r=>new URL(r.url()).pathname.startsWith(organization+'/members/')&&r.request().method()==='PUT');
   await select.selectOption(value);const response=await pending;
   assert.equal(response.status(),200,'the real Members request saves');
   for(const grant of response.request().postDataJSON().grants)assert.deepEqual(Object.keys(grant).sort(),['project','role']);
   await expect(select).toHaveValue(value);
   await expect(select).toBeEnabled();
  }
  await saved(role,'member');
  await saved(secondProject,'maintainer');
  // A real intervening update makes this dialog stale: no mocked failure door.
  const data=await owner.json(organization),member=data.members.find(row=>row.email==='synthetic-spool-6@example.test');
  const grants=data.grants.filter(row=>row.member===member.id).map(({project,role})=>({project,role}));
  await owner.json(organization+'/members/'+member.id,'PUT',{version:member.version,role:member.role,grants});
  for(const [select,value,stored] of [[role,'read-only','member'],[secondProject,'read-only','maintainer']]) {
   const pending=page.waitForResponse(r=>new URL(r.url()).pathname===organization+'/members/'+member.id&&r.request().method()==='PUT');
   await select.selectOption(value);assert.equal((await pending).status(),409,'stale save is refused by server validation');
   await expect(select).toHaveValue(stored,'a refused save restores the stored selection');
   await expect(select).toBeEnabled();
  }
  await dialog.getByRole('button',{name:'Close details',exact:true}).click();
  await members.locator('summary').filter({hasText:/^Service accounts$/}).click();
  const services=members.locator('form').filter({has:page.getByLabel('Service account name',{exact:true})});
  await services.getByLabel('Service account name',{exact:true}).fill('synthetic-spool-ui-service');
  await services.getByRole('group',{name:projects[0].name,exact:true}).getByRole('checkbox',{name:'Agent',exact:true}).check();
  const created=page.waitForResponse(r=>new URL(r.url()).pathname===organization+'/services'&&r.request().method()==='POST'&&r.status()===201);
  await services.getByRole('button',{name:'Create service account',exact:true}).click();await created;
  await members.getByText('synthetic-spool-ui-service',{exact:true}).waitFor();
  await members.getByText('Sponsored by Test owner',{exact:true}).waitFor();
  assert.equal(await members.locator('input,select,button,label,p,summary').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).every(n=>parseFloat(getComputedStyle(n).fontSize)>=13)),true);
  const violations=(await new AxeBuilder({page}).include('[aria-label="Members"]').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact));
  assert.deepEqual(violations,[],'Members settings has no serious accessibility violation');
  const folder=process.env.SPOOL_TEAM_EVIDENCE;
  if(folder){await mkdir(folder,{recursive:true});await members.screenshot({path:resolve(folder,'members-1440.png')});}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Members settings fits the desktop viewport');
  await context.close();
 }finally{await browser.close()}
}

async function invite(owner,origin,input) {
 const previousIds=(await legacyMailRows(origin)).map(row=>row.id);
 assert.equal(await status(owner.req(organization+'/invites','POST',input)),202);
 const pending=(await owner.json(organization)).members.find(row=>row.email===input.email);
 assert.ok(pending);assert.equal(pending.operatorStatus,'invited');
 const cookie=await confirmEmailLink(origin,input.email,{previousIds});
 const member=(await owner.json(organization)).members.find(row=>row.id===pending.id);
 assert.equal(member.operatorStatus,'active');
 return {...client(origin,cookie),cookie,member};
}

async function policyAuthority(owner,maintainer,member,reader,projects) {
 const root=projectRoot(projects[0]),foreign=projectRoot(projects[1]);
 const filters=await maintainer.json(root+'/inbound-filters'),policy=structuredClone(filters.policy);
 policy.filters.messages.enabled=true;policy.filters.messages.values=['*synthetic-spool-filter*'];
 await maintainer.json(root+'/inbound-filters/preview','POST',{policy});
 await maintainer.json(root+'/inbound-filters','PUT',{revision:filters.revision,policy});
 const grouping={version:1,stack:'',fingerprint:'error.type:SyntheticSpoolError -> synthetic-spool-1'};
 const current=await maintainer.json(root+'/grouping-rules');
 await maintainer.json(root+'/grouping-rules/preview','POST',{policy:grouping});
 await maintainer.json(root+'/grouping-rules','PUT',{revision:current.revision,policy:grouping});
 // Valid bodies and current revisions prove authorization rather than input validation.
 const memberFilters=await owner.json(foreign+'/inbound-filters'),memberGrouping=await owner.json(foreign+'/grouping-rules');
 for(const [actor,p,filterRevision,groupRevision] of [[member,foreign,memberFilters.revision,memberGrouping.revision],[reader,root,filters.revision+1,current.revision+1],[maintainer,foreign,memberFilters.revision,memberGrouping.revision]]) {
  await concealed(actor,p+'/inbound-filters/preview','POST',{policy});
  await denied(actor.req(p+'/inbound-filters','PUT',{revision:filterRevision,policy}),'member, reader and wrong-project maintainer cannot change filters');
  await denied(actor.req(p+'/grouping-rules/preview','POST',{policy:grouping}),'only a project maintainer previews grouping policy');
  await denied(actor.req(p+'/grouping-rules','PUT',{revision:groupRevision,policy:grouping}),'member, reader and wrong-project maintainer cannot change grouping');
 }
 assert.deepEqual((await owner.json(foreign+'/inbound-filters')).policy,memberFilters.policy);
 assert.equal((await owner.json(foreign+'/grouping-rules')).revision,memberGrouping.revision);
}

async function concurrentTriage(owner,first,second,reader,projects,issues) {
 const paths=projects.map((project,index)=>projectRoot(project)+'/issues/'+issues[index].id);
 const results=await Promise.all([first.req(paths[0],'PATCH',{revision:issues[0].revision,state:'acknowledged'}),second.req(paths[1],'PATCH',{revision:issues[1].revision,state:'acknowledged'})].map(status));
 assert.deepEqual(results,[200,200],'simultaneous members triage their disjoint projects');
 await denied(reader.req(paths[0],'PATCH',{revision:issues[0].revision+1,state:'resolved'}),'a read-only collaborator cannot triage');
 const row=(await owner.json(organization)).members.find(row=>row.id===second.member.id);
 const grants=[{project:projects[0].id,role:'member'},{project:projects[1].id,role:'member'}];
 await owner.json(organization+'/members/'+row.id,'PUT',{version:row.version,role:'member',grants});
 const shared=(await first.json(projectRoot(projects[0])+'/issues')).find(row=>row.id===issues[0].id);
 const race=await Promise.all([first.req(paths[0],'PATCH',{revision:shared.revision,state:'resolved'}),second.req(paths[0],'PATCH',{revision:shared.revision,state:'open'})].map(status));
 assert.deepEqual(race.toSorted(),[200,409],'one concurrent writer commits and the stale revision refuses');
 const after=(await owner.json(projectRoot(projects[0])+'/issues')).find(row=>row.id===shared.id);
 assert.equal(after.revision,shared.revision+1,'the stale contender makes no second change');
 assert.ok(['resolved','open'].includes(after.state));
}

async function memberDeployment(owner,member,project) {
 const root=projectRoot(project),release='synthetic-spool-2';
 await member.json(root+'/releases','POST',{name:release,build:'web'});
 const destination=await owner.json(root+'/alerting/destinations','POST',{label:'synthetic-spool-1',recipient:'synthetic-spool-10@example.test'});
 const now=Date.now(),sha='a'.repeat(40),body={id:'synthetic-spool-1',release,build:'web',environment:'production',repository:'https://example.test/synthetic-spool-1',commitSha:sha,includedCommits:[sha],startedAt:new Date(now).toISOString(),deadline:new Date(now+3600000).toISOString(),destination:destination.id};
 assert.equal(await status(member.req(root+'/deployments','POST',body)),201,'a scoped member records the actual deployment lifecycle');
 await member.json(root+'/deployments/'+body.id+'/callbacks','POST',{callback:'synthetic-spool-1',state:'succeeded',exposure:100,at:new Date(now+1000).toISOString()});
 const run=(await member.json(root+'/deployments')).rows.find(row=>row.id===body.id);
 assert.equal(run.steps.at(-1).state,'succeeded');
}

async function revokedAuthority(owner,removed,remaining,projects,issue) {
 const root=projectRoot(projects[1]),keys={};
 for(const kind of ['agent','deploy','ingest'])keys[kind]=await removed.json(root+'/keys','POST',{kind});
 const bearer=kind=>({Cookie:'',Authorization:'Bearer '+keys[kind].key});
 assert.equal(await status(owner.req(root+'/issues/'+issue.id+'/packet','GET',undefined,bearer('agent'))),200);
 assert.equal(await status(owner.req(root+'/releases','POST',{name:'synthetic-spool-3',build:'web'},bearer('deploy'))),201);
 assert.equal(await status(owner.req('/api/ingest/'+projects[1].id,'POST',nativeEvent('synthetic-spool-1'),bearer('ingest'))),201);
 const origin=owner.origin,agentEnv=agentEnvironment(origin,projects[1],keys.agent.key);
 assert.equal((await cli(['packet',issue.id,'--format','json'],agentEnv)).code,0);
 await mcpDoor(origin,projects[1],keys.agent.key,issue.id,true);
 const before=(await owner.json(root+'/issues')).find(row=>row.id===issue.id);
 const pending=await heldOwnerRequest({origin,cookie:removed.cookie,request:path=>remaining.req(path)},root+'/issues/'+issue.id,{revision:before.revision,state:'resolved'},{method:'PATCH'});
 const member=(await owner.json(organization)).members.find(row=>row.id===removed.member.id);
 await owner.json(organization+'/members/'+member.id,'DELETE',{version:member.version});
 try{const response=await pending.release();assert.equal(response.status,409);assert.deepEqual(response.body,{error:'authority_changed'});}finally{pending.close()}
 const after=(await owner.json(root+'/issues')).find(row=>row.id===issue.id);assert.deepEqual({state:after.state,revision:after.revision},{state:before.state,revision:before.revision},'the pre-removal triage commits no late state or revision');
 assert.notEqual((await cli(['packet',issue.id,'--format','json'],agentEnv)).code,0,'the same CLI grant is denied immediately after removal');
 await mcpDoor(origin,projects[1],keys.agent.key,issue.id,false);
 for(const path of ['/auth/session',organization+'/me','/api/projects',root+'/issues',root+'/issues/'+issue.id+'/packet',root+'/issue-export?format=json',root+'/sentry-uploads'])await denied(removed.req(path),'removal denies the old session on every private transport');
 const document=await removed.req('/projects/'+projects[1].id+'/issues/'+issue.id);assert.equal(document.status,303);assert.equal(new URL(document.headers.get('location'),owner.origin).pathname,'/sign-in');await document.body?.cancel();
 await denied(removed.req(root+'/keys','POST',{kind:'agent'}),'removed session cannot mint another grant');
 await denied(owner.req(root+'/issues/'+issue.id+'/packet','GET',undefined,bearer('agent')),'removal revokes minted agent evidence authority');
 await denied(owner.req(root+'/releases','POST',{name:'synthetic-spool-4',build:'web'},bearer('deploy')),'removal revokes minted deploy authority');
 await denied(owner.req('/api/ingest/'+projects[1].id,'POST',nativeEvent('synthetic-spool-2'),bearer('ingest')),'removal revokes minted ingest authority');
 for(const path of [root+'/issue-export?format=json',root+'/issue-export?format=csv',root+'/issues/'+issue.id+'/occurrences'])await denied(owner.req(path,'GET',undefined,bearer('agent')),'removal fences each agent export door');
 await denied(owner.req('/api/0/organizations/synthetic-spool-1/chunk-upload/','GET',undefined,bearer('deploy')),'removal fences SDK artifact management');
 const dsn=new URL(projects[1].dsn);
 await denied(removed.req(`/api/0/projects/synthetic-spool-1/${projects[1].id}/releases/`,'POST',{version:'synthetic-spool-5'}),'removal denies the CLI management transport');
 await denied(owner.req(`/api${dsn.pathname}/store/?sentry_key=${keys.ingest.key}&sentry_version=7`,'POST',{event_id:'3'.repeat(32),message:'synthetic-spool-2'},{Cookie:''}),'SDK intake rejects the removed member key');
 assert.ok((await remaining.json('/api/projects')).some(row=>row.id===projects[0].id),'another simultaneous contributor remains admitted');
}

async function teamRiders(owner,first,second,reader,projects) {
 const root=projectRoot(projects[0]),foreign=projectRoot(projects[1]),controls=root+'/alerting';
 const settings={member:first.member.id,timezone:'America/New_York',daily:true,weekly:true,hour:0};
 await first.json(controls+'/team-digests','PUT',settings);
 await concealed(reader,controls+'/team-digests','PUT',{...settings,member:reader.member.id});
 await owner.json(organization+'/projects/'+projects[1].id,'PUT',{team:projects[0].id});
 await concealed(first,controls+'/team-snoozes','POST',{scope:'team',target:projects[0].id,until:Date.now()+60000});
 assert.equal(await status(owner.req(controls+'/team-snoozes','POST',{scope:'team',target:projects[0].id})),400,'team snooze refuses a missing expiry');
 const snooze=await owner.json(controls+'/team-snoozes','POST',{scope:'team',target:projects[0].id,until:Date.now()+60000});
 let destination;
 for(const [index,project] of projects.entries()){
  const base=projectRoot(project)+'/alerting';
  const target=await owner.json(base+'/destinations','POST',{label:'synthetic-spool-'+(20+index),recipient:'synthetic-spool-'+(20+index)+'@example.test'});
  const test=await owner.json(base+'/destinations/'+target.id+'/test','POST',{});
  await owner.json(base+'/destinations/'+target.id+'/review','POST',{testId:test.id});
  await owner.json(base+'/rules','POST',{name:'synthetic-spool-'+(20+index),enabled:true,channel:'mail',destination:target.id,kinds:['new_issue'],windowMs:60000,threshold:2});
  const event={...nativeEvent('synthetic-spool-rider-'+index),type:'SyntheticSpoolRider'+index,frames:[{file:'https://synthetic-spool.example/rider'+index+'.js',function:'rider'+index,line:1,column:0}]};
  assert.equal(await status(owner.req('/api/ingest/'+project.id,'POST',event,{Cookie:'',Authorization:'Bearer '+project.ingestKey})),201);
  const held=await owner.json(base+'/controls');assert.ok(held.held.some(row=>row.snooze_id===snooze.id&&!row.released_at),'a team snooze durably lists each held project alert');
  if(index===0)destination=target.id;
 }
 assert.equal(await status(owner.req('/api/ingest/'+projects[0].id,'POST',{version:'invalid'},{Cookie:'',Authorization:'Bearer '+projects[0].ingestKey})),400,'capture loss has a real refused public request');
 await owner.json(root+'/follow-up/alternate-member','PUT',{member:first.member.id});
 const now=Date.now(),sha='b'.repeat(40),deployment={id:'synthetic-spool-overdue',release:'synthetic-spool-1',build:'web',environment:'production',repository:'https://example.test/synthetic-spool-1',commitSha:sha,includedCommits:[sha],startedAt:new Date(now).toISOString(),deadline:new Date(now+60000).toISOString(),destination};
 await first.json(root+'/deployments','POST',deployment);
 const local=time=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(time).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 let tick;for(let n=1;n<=48;n++){const candidate=(Math.floor(now/3600000)+n)*3600000;if(local(candidate).hour==='00'){tick=candidate+1000;break}}assert.ok(tick);
 const schedule=async time=>{const response=await fetch(owner.origin+'/cdn-cgi/local/scheduled?time='+time+'&cron=*+*+*+*+*&format=json');const text=await response.text();assert.equal(response.status,200,text)};
 await schedule(tick);await schedule(tick);
 const state=await first.json(controls+'/team-controls');
 assert.equal(state.snoozes.find(row=>row.id===snooze.id).suppressed,1,'team controls count suppression only for the admitted project');
 assert.ok(state.mail.some(row=>row.kind==='daily'&&row.state==='accepted'));
 const ownerState=await owner.json(controls+'/team-controls');
 assert.equal(ownerState.mail.filter(row=>row.kind==='resumption').length,1,'overlapping expiry ticks retain one durable team resumption notice for its accountable creator');
 const messages=(await legacyMailRows(owner.origin)).map(row=>JSON.parse(row.message));
 const daily=messages.find(message=>message.subject==='Spool daily team error digest'&&message.to.includes(first.member.email));
 assert.ok(daily);assert.match(daily.text,/Timezone: America\/New_York/);assert.ok(daily.text.includes('Project '+projects[0].id+':'));assert.ok(!daily.text.includes('Project '+projects[1].id+':'),'the same team never widens a digest recipient’s project grants');
 assert.match(daily.text,/new \d+; regressed \d+; unowned \d+/);
 assert.match(daily.text,/invalid 1/);assert.match(daily.text,/held alerts 1/);
 let attention=await first.json(root+'/follow-up');
 const overdue=attention.rows.find(row=>row.source==='deployment'&&row.source_id===deployment.id);assert.ok(overdue);assert.equal(overdue.notices.length,1);assert.equal(overdue.notices[0].destination,'member:'+first.member.id);
 const actor=(await owner.json(organization)).members.find(row=>row.id===first.member.id);
 await owner.json(organization+'/members/'+actor.id,'PUT',{version:actor.version,role:'read-only',grants:[{project:projects[0].id,role:'read-only'}]});
 await schedule(tick+60000);await schedule(tick+60000);
 attention=await owner.json(root+'/follow-up');assert.equal(attention.alternate.state,'broken');
 const broken=attention.rows.find(row=>row.source_id==='alternate:'+first.member.id);assert.ok(broken);assert.equal(broken.notices.length,0,'a broken alternate creates visible work without recursively notifying itself');
 assert.equal(attention.rows.find(row=>row.id===overdue.id).notices.length,1,'overdue follow-up stays deduplicated');
 await owner.json(organization+'/members/'+actor.id,'PUT',{version:actor.version+1,role:'member',grants:[{project:projects[0].id,role:'maintainer'}]});
 // A later completed buyer week includes the original capture day; no fixture edits the clock or database.
 let week;for(let n=1;n<=24*8;n++){const candidate=tick+n*3600000,parts=local(candidate),weekday=new Date(parts.year+'-'+parts.month+'-'+parts.day+'T12:00:00Z').getUTCDay();if(weekday===1&&Number(parts.hour)>=9){week=candidate;break}}assert.ok(week);
 await schedule(week);await schedule(week);
 assert.ok((await first.json(controls+'/team-controls')).mail.some(row=>row.kind==='weekly'&&row.state==='accepted'),'the completed buyer week produces its one accepted team digest across DST');
 await owner.json(organization+'/projects/'+projects[1].id,'PUT',{team:projects[1].id});
 console.log('[TEAM-001] team timezone digests, scoped recipients, expiring snooze and durable resumption, loss/backlog, member deployment deadline, accountable broken alternate and nonrecursive deduplication passed');
}

async function serviceAuthority(owner,projects,issue) {
 const created=await owner.json(organization+'/services','POST',{name:'synthetic-spool-1',scopes:[{project:projects[0].id,kind:'agent'},{project:projects[0].id,kind:'deploy'},{project:projects[0].id,kind:'ingest'}]});
 const service=(await owner.json(organization)).services.find(row=>row.id===created.id);assert.ok(service);
 const keys={};for(const kind of ['agent','deploy','ingest'])keys[kind]=await owner.json(organization+'/services/'+service.id+'/keys','POST',{project:projects[0].id,kind});
 const bearer=kind=>({Cookie:'',Authorization:'Bearer '+keys[kind].key});
 const root=projectRoot(projects[0]),foreign=projectRoot(projects[1]);
 assert.equal((await cli(['packet',issue.id,'--format','json'],agentEnvironment(owner.origin,projects[0],keys.agent.key))).code,0);
 await mcpDoor(owner.origin,projects[0],keys.agent.key,issue.id,true);
 assert.equal(await status(owner.req('/api/0/organizations/synthetic-spool-1/chunk-upload/','GET',undefined,bearer('deploy'))),200,'the service deploy grant reaches SDK artifact management');
 assert.equal(await status(owner.req(root+'/issue-export?format=csv','GET',undefined,bearer('agent'))),200);
 await denied(owner.req('/api/ingest/'+projects[1].id,'POST',nativeEvent('synthetic-spool-outside'),bearer('ingest')),'service capture stays inside its explicit project');
 assert.equal(await status(owner.req(root+'/issues/'+issue.id+'/packet','GET',undefined,bearer('agent'))),200);
 assert.equal(await status(owner.req(root+'/releases','POST',{name:'synthetic-spool-6',build:'web'},bearer('deploy'))),201,'the scoped service deploy key works before removal');
 assert.equal(await status(owner.req('/api/ingest/'+projects[0].id,'POST',nativeEvent('synthetic-spool-4'),bearer('ingest'))),201,'the scoped service ingest key works before removal');
 await denied(owner.req(foreign+'/issues','GET',undefined,bearer('agent')),'service evidence stays inside its explicit project');
 await denied(owner.req(foreign+'/releases','POST',{name:'synthetic-spool-6',build:'web'},bearer('deploy')),'service deploy stays inside its explicit project');
 await denied(owner.req(organization+'/services/'+service.id+'/keys','POST',{project:projects[1].id,kind:'agent'}),'a service cannot mint outside its declared scope');
 await owner.json(organization+'/services/'+service.id,'DELETE',{version:service.version});
 await denied(owner.req(root+'/issues/'+issue.id+'/packet','GET',undefined,bearer('agent')),'service removal revokes its existing agent key');
 await denied(owner.req(root+'/releases','POST',{name:'synthetic-spool-7',build:'web'},bearer('deploy')),'service removal revokes its existing deploy key');
 await denied(owner.req('/api/ingest/'+projects[0].id,'POST',nativeEvent('synthetic-spool-3'),bearer('ingest')),'service removal revokes its existing ingest key');
 const sponsor=await invite(owner,owner.origin,{email:'synthetic-spool-7@example.test',name:'synthetic-spool-7',role:'admin',grants:[]});
 const linked=await sponsor.json(organization+'/services','POST',{name:'synthetic-spool-linked',scopes:[{project:projects[0].id,kind:'agent'},{project:projects[0].id,kind:'deploy'},{project:projects[0].id,kind:'ingest'}]});
 const linkedKeys={};for(const kind of ['agent','deploy','ingest'])linkedKeys[kind]=await sponsor.json(organization+'/services/'+linked.id+'/keys','POST',{project:projects[0].id,kind});
 assert.equal(await status(owner.req(root+'/issues/'+issue.id+'/packet','GET',undefined,{Cookie:'',Authorization:'Bearer '+linkedKeys.agent.key})),200);
 await owner.json(organization+'/members/'+sponsor.member.id,'DELETE',{version:sponsor.member.version});
 assert.equal((await owner.json(organization)).services.find(row=>row.id===linked.id).state,'removed','member removal retires linked service authority');
 await denied(owner.req(root+'/issues/'+issue.id+'/packet','GET',undefined,{Cookie:'',Authorization:'Bearer '+linkedKeys.agent.key}));
 await denied(owner.req(root+'/releases','POST',{name:'synthetic-spool-linked',build:'web'},{Cookie:'',Authorization:'Bearer '+linkedKeys.deploy.key}));
 await denied(owner.req('/api/ingest/'+projects[0].id,'POST',nativeEvent('synthetic-spool-linked'),{Cookie:'',Authorization:'Bearer '+linkedKeys.ingest.key}));
 return [...Object.values(keys),...Object.values(linkedKeys)].map(row=>row.key);
}

async function inertTeamArchive(owner,projects,formerCookie) {
 const before=await owner.json('/api/audit/export?format=json');
 for(const action of ['organization.create','member.invite','member.change','member.remove','member.transfer','team.change','service.create','service.credential','service.remove','alert.digest.settings','alert.snooze','automation.follow_up','notification.attempt','evidence.packet','evidence.export']){
  assert.ok(before.rows.some(row=>row.action===action&&['succeeded','accepted'].includes(row.outcome)),'safe organization history records the truthful new action: '+action);
 }
 assert.ok(before.rows.some(row=>row.actor_kind==='service'&&row.action==='evidence.packet'&&row.outcome==='succeeded'),'scoped service evidence has its own safe actor');
 for(const actor of ['member','service'])assert.ok(before.rows.some(row=>row.actor_kind===actor&&row.outcome==='denied'),'new human and service denials remain truthful audit observations');
 const response=await owner.req('/api/archive');assert.equal(response.status,200);const archive=await response.text();
 const fresh=await runtime();
 try{
  const next={...client(fresh.origin,fresh.cookie),origin:fresh.origin,cookie:fresh.cookie};
  const restoredResponse=await next.req('/api/restore','POST',archive,{'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'}),restoreResult=await restoredResponse.json();
  assert.equal(restoredResponse.status,200,'the private archive restores through the public HTTP door: '+JSON.stringify(restoreResult));
  const restored=await next.json(organization);
  assert.ok(restored.members.length>=6);assert.ok(restored.members.every(row=>row.state==='inert'&&row.operator_id===null&&row.operatorStatus==='inert'));
  assert.ok(restored.grants.length>0);assert.ok(restored.invites.length>0&&restored.invites.every(row=>row.state==='inert'));
  assert.ok(restored.services.length>0&&restored.services.every(row=>row.state==='inert'));
  const base=projectRoot(projects[0]);
  assert.deepEqual(await next.json(base+'/keys'),[],'private restore creates no member or service credential');
  await denied(client(fresh.origin,formerCookie).req(organization+'/me'),'a source member cookie has no authority in the restored installation');
  const controls=await next.json(base+'/alerting/team-controls');
  assert.ok(controls.settings.length>0&&controls.settings.every(row=>!row.daily&&!row.weekly));
  assert.ok(controls.snoozes.length>0&&controls.snoozes.every(row=>row.historical===1));
  assert.ok(controls.mail.length>0&&controls.mail.every(row=>row.state==='historical'));
  const sends=(await legacyMailRows(fresh.origin)).length;
  const tick=await fetch(fresh.origin+'/cdn-cgi/local/scheduled?time='+(Date.now()+14*86400000)+'&cron=*+*+*+*+*&format=json');assert.equal(tick.status,200);await tick.body?.cancel();
  assert.equal((await legacyMailRows(fresh.origin)).length,sends,'restored members, digests and snoozes send no mail');
  const carried=await next.json('/api/audit/export?format=json'),withoutSequence=({sequence,...row})=>row;
  for(const row of before.rows)assert.deepEqual(withoutSequence(carried.rows.find(item=>item.id===row.id)),withoutSequence(row),'organization audit facts retain identity, time, aliases and outcomes after restore');
 }finally{await fresh.close()}
}

/** [TEAM-001] Membership lifecycle through the real emitted Worker and native mail proof. */
export async function teamFlow() {
 const worker=await runtime();
 try {
  const origin=worker.origin,cookie=worker.cookie,owner={...client(origin,cookie),origin,cookie};
  await denied(client(origin).req(organization),'organization administration requires a native session');
  await owner.json(organization,'POST',{id:'synthetic-spool-1',name:'synthetic-spool-1'});
  const projects=[];for(const id of ['synthetic-spool-1','synthetic-spool-2'])projects.push(await owner.json('/api/projects','POST',{id,name:id}));
  for(const project of projects){await owner.json(organization+'/projects/'+project.id,'PUT',{team:project.id});await owner.json(projectRoot(project)+'/releases','POST',{name:'synthetic-spool-1',build:'web'});}
  const identities=[
   {email:'synthetic-spool-1@example.test',name:'synthetic-spool-1',role:'member',grants:[{project:projects[0].id,role:'maintainer'}]},
   {email:'synthetic-spool-2@example.test',name:'synthetic-spool-2',role:'member',grants:[{project:projects[1].id,role:'member'}]},
   {email:'synthetic-spool-3@example.test',name:'synthetic-spool-3',role:'read-only',grants:[{project:projects[0].id,role:'read-only'}]},
   {email:'synthetic-spool-4@example.test',name:'synthetic-spool-4',role:'billing',grants:[]},
   {email:'synthetic-spool-5@example.test',name:'synthetic-spool-5',role:'admin',grants:[]},
  ];
  assert.equal(await status(owner.req(organization+'/invites','POST',identities[0],{Origin:'https://foreign.example.test'})),403);
  const actors=[];for(const identity of identities)actors.push(await invite(owner,origin,identity));
  const [first,second,reader,billing,admin]=actors;
  // A subsequent ordinary sign-in proves membership does not depend on the invitation cookie.
  first.cookie=await emailSignIn(origin,identities[0].email);Object.assign(first,client(origin,first.cookie));
  for(const [actor,expected,role] of [[first,[projects[0].id],'maintainer'],[second,[projects[1].id],'member'],[reader,[projects[0].id],'read-only'],[billing,[],null],[admin,projects.map(row=>row.id),'admin']]) {
   const visible=await actor.json('/api/projects');
   assert.deepEqual(visible.map(row=>row.id).sort(),expected.sort(),'project inventory reflects this current membership');
   assert.ok(visible.every(row=>row.role===role),'visible projects carry the effective permission');
  }
  assert.equal((await first.json(organization+'/me')).role,'member');assert.equal((await billing.json(organization+'/me')).role,'billing');
  await billing.json(organization+'/usage');await admin.json(organization);
  await denied(billing.req(projectRoot(projects[0])+'/issues'),'billing cannot read project evidence');
  await denied(billing.req(organization+'/invites','POST',identities[0]),'billing cannot invite members');
  await denied(reader.req(projectRoot(projects[0])+'/keys','POST',{kind:'agent'}),'read-only collaborators cannot mint keys');
  await concealed(first,projectRoot(projects[1])+'/issues');
  await denied(second.req(projectRoot(projects[0])+'/issue-export?format=json'),'exports obey project membership');
  await denied(admin.req('/api/editor/config'),'organization admin is not installation editor owner');
  const initial=await owner.json(projectRoot(projects[0])+'/identity-policy'),policy={...initial.policy,email:'keep'};
  const preview=await owner.json(projectRoot(projects[0])+'/identity-policy/preview','POST',{policy});
  await owner.json(projectRoot(projects[0])+'/identity-policy','PUT',{revision:initial.revision,policy,token:preview.token});
  const privateIdentity='synthetic-spool-9@example.test',issues=[];
  for(const [index,project] of projects.entries()) {
   const dsn=new URL(project.dsn),event={event_id:String(index+1).repeat(32),release:'synthetic-spool-1',exception:{values:[{type:'SyntheticSpoolError',value:'synthetic-spool-1'}]},...index===0?{user:{email:privateIdentity}}:{}};
   assert.equal(await status(owner.req(`/api${dsn.pathname}/store/?sentry_key=${dsn.username}&sentry_version=7`,'POST',event,{Cookie:''})),200);
   issues.push((await owner.json(projectRoot(project)+'/issues'))[0]);assert.ok(issues[index]);
  }
  const evidence=projectRoot(projects[0])+'/issues/'+issues[0].id;
  const raw=await owner.json(evidence+'/affected-users');assert.ok(JSON.stringify(raw).includes(privateIdentity),'the identity fixture is actually retained for its permitted owner');
  const count=await reader.json(evidence+'/affected-users');assert.equal(count.affectedUsers,1);assert.equal(count.rows,undefined);assert.ok(!JSON.stringify(count).includes(privateIdentity));
  for(const path of [evidence+'/packet',projectRoot(projects[0])+'/issue-export?format=json'])assert.ok(!JSON.stringify(await reader.json(path)).includes(privateIdentity),'read-only evidence and exports omit retained identity values');
  for(const [actor,index] of [[first,0],[second,1],[reader,0]]) {
   const own=projectRoot(projects[index]),foreign=projectRoot(projects[1-index]),issue=issues[index];
   assert.ok((await actor.json(own+'/issue-search?q=synthetic-spool-1')).rows.some(row=>row.id===issue.id));
   await actor.json(own+'/issues/'+issue.id+'/events');
   await actor.json(own+'/issues/'+issue.id+'/packet');
   for(const suffix of ['/issue-search?q=synthetic-spool-1','/issues/'+issues[1-index].id+'/events','/issues/'+issues[1-index].id+'/packet','/issue-export?format=csv'])await concealed(actor,foreign+suffix);
  }
  await policyAuthority(owner,first,second,reader,projects);
  await memberDeployment(owner,second,projects[1]);
  await browserMembers(owner,projects);
  await teamRiders(owner,first,second,reader,projects);
  await concurrentTriage(owner,first,second,reader,projects,issues);
  const serviceKeys=await serviceAuthority(owner,projects,issues[0]);
  await revokedAuthority(owner,second,first,projects,issues[1]);
  const audit=await owner.json('/api/audit/export?format=json');
  assert.ok(audit.rows.some(row=>row.action==='issue.triage'&&row.outcome==='succeeded'&&row.actor_kind==='member'),'committed triage names a member actor');
  assert.ok(audit.rows.some(row=>row.action==='issue.triage'&&row.outcome==='conflict'),'stale concurrent writes have truthful audit outcomes');
  assert.ok(audit.rows.some(row=>row.outcome==='denied'),'role and removal refusals remain visible in the safe audit');
  for(const row of audit.rows){assert.match(row.actor_label,/^audit:[a-f0-9]{32}$/);assert.match(row.subject_label,/^audit:[a-f0-9]{32}$/)}
  for(const value of [testOwner,privateIdentity,...identities.flatMap(row=>[row.email,row.name]),...serviceKeys])assert.ok(!JSON.stringify(audit).includes(value),'safe audit facts omit private identities, names and keys');
  // Transfer uses an accepted native person and fresh owner proof; unrelated contributors remain active.
  const retired=await admin.json(projectRoot(projects[0])+'/keys','POST',{kind:'deploy'});
  const beforeNarrowing=(await owner.json(organization)).members.find(row=>row.id===admin.member.id);
  await owner.json(organization+'/members/'+beforeNarrowing.id,'PUT',{version:beforeNarrowing.version,role:'read-only',grants:[]});
  await denied(owner.req(projectRoot(projects[0])+'/releases','POST',{name:'synthetic-retired-before',build:'web'},{Cookie:'',Authorization:'Bearer '+retired.key}),'demotion below mint authority retires the key');
  await owner.json(organization+'/members/'+beforeNarrowing.id,'PUT',{version:beforeNarrowing.version+1,role:'admin',grants:[]});
  const successor=(await owner.json(organization)).members.find(row=>row.id===admin.member.id);
  await denied(first.req(organization+'/transfer','POST',{member:successor.id,version:successor.version}),'a project maintainer cannot transfer installation ownership');
  const transferKeys={};
  for(const kind of ['agent','deploy'])transferKeys[kind]=await owner.json(projectRoot(projects[0])+'/keys','POST',{kind});
  const successorKey=await admin.json(projectRoot(projects[0])+'/keys','POST',{kind:'deploy'});
  async function captureAfterTransfer(stage) {
   const project=projects[0],base=projectRoot(project),dsn=new URL(project.dsn);
   assert.equal(await status(owner.req('/api/ingest/'+project.id,'POST',nativeEvent('synthetic-transfer-'+stage),{Cookie:'',Authorization:'Bearer '+project.ingestKey})),201,'the SAME native capture key keeps authority across transfer');
   assert.equal(await status(owner.req(`/api${dsn.pathname}/store/?sentry_key=${dsn.username}&sentry_version=7`,'POST',{event_id:(stage==='before'?'b':'c').repeat(32),release:'synthetic-spool-1',exception:{values:[{type:'SyntheticTransfer',value:'synthetic-transfer-'+stage}]}},{Cookie:''})),200,'the SAME Sentry DSN keeps authority across transfer');
   assert.equal(await status(owner.req(base+'/releases','POST',{name:'synthetic-transfer-'+stage,build:'web'},{Cookie:'',Authorization:'Bearer '+transferKeys.deploy.key})),201,'the SAME deploy key keeps authority across transfer');
   assert.equal(await status(owner.req(base+'/issues/'+issues[0].id+'/packet','GET',undefined,{Cookie:'',Authorization:'Bearer '+transferKeys.agent.key})),200,'the SAME agent key keeps authority across transfer');
   assert.equal(await status(owner.req(base+'/releases','POST',{name:'synthetic-successor-'+stage,build:'web'},{Cookie:'',Authorization:'Bearer '+successorKey.key})),201,'the promoted admin keeps existing keys too');
  }
  await captureAfterTransfer('before');
  await owner.json(organization+'/transfer','POST',{member:successor.id,version:successor.version});
  await captureAfterTransfer('after');
  await denied(owner.req(projectRoot(projects[0])+'/releases','POST',{name:'synthetic-retired-after',build:'web'},{Cookie:'',Authorization:'Bearer '+retired.key}),'restoring authority and transferring never revives a retired credential');
  await denied(admin.req('/auth/session'),'handoff also fences the successor session');
  await denied(owner.req('/auth/session'),'handoff fences the predecessor session');
  const nextCookie=await emailSignIn(origin,identities[4].email),next={...client(origin,nextCookie),origin,cookie:nextCookie};
  const session=await next.json('/auth/session');assert.equal(session.operator.role,'owner');
  assert.ok((await next.json(projectRoot(projects[0])+'/keys')).find(row=>row.hash===retired.hash)?.revoked,'the retired credential is listed Revoked');
  assert.ok((await first.json('/api/projects')).some(row=>row.id===projects[0].id),'owner transfer preserves other active members');
  const former=(await next.json(organization)).members.find(row=>row.role==='admin'&&row.email===testOwner);
  await next.json(organization+'/members/'+former.id,'DELETE',{version:former.version});
  const project=projects[0],base=projectRoot(project),dsn=new URL(project.dsn);
  assert.equal(await status(next.req('/api/ingest/'+project.id,'POST',nativeEvent('synthetic-transfer-removed'),{Cookie:'',Authorization:'Bearer '+project.ingestKey})),401,'removing the former owner stops that SAME capture key');
  assert.equal(await status(next.req(`/api${dsn.pathname}/store/?sentry_key=${dsn.username}&sentry_version=7`,'POST',{event_id:'d'.repeat(32),message:'synthetic-transfer-removed'},{Cookie:''})),401,'removal stops the SAME Sentry DSN');
  for(const [kind,path,method,value] of [['deploy',base+'/releases','POST',{name:'synthetic-transfer-removed',build:'web'}],['agent',base+'/issues/'+issues[0].id+'/packet','GET',undefined]])await denied(next.req(path,method,value,{Cookie:'',Authorization:'Bearer '+transferKeys[kind].key}),'removal still retires transferred '+kind+' keys');
  const listed=await next.json(base+'/keys');
  for(const hash of [transferKeys.agent.hash,transferKeys.deploy.hash])assert.ok(listed.find(row=>row.hash===hash)?.revoked,'stopped keys are shown revoked');
  const captureKeys=(await next.json(base+'/outcomes')).captureKeys;
  assert.ok(captureKeys.total>0);assert.equal(captureKeys.active,0,'Capture distinguishes stopped credentials from earlier successful receipts');
  await inertTeamArchive(next,projects,first.cookie);
  console.log('[TEAM-001] native invitations and magic sign-in, simultaneous scoped triage, stale revision refusal, maintainer policy, read-only identity projection, billing/admin limits, member deployments, member/service revocation, safe audit and owner transfer passed');
 } finally {await worker.close()}
}
