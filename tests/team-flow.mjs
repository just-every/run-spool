import assert from 'node:assert/strict';
import {startTestWorker} from './worker.mjs';
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
  await denied(actor.req(p+'/inbound-filters/preview','POST',{policy}),'only a project maintainer previews inbound policy');
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
 const member=(await owner.json(organization)).members.find(row=>row.id===removed.member.id);
 await owner.json(organization+'/members/'+member.id,'DELETE',{version:member.version});
 for(const path of ['/auth/session',organization+'/me','/api/projects',root+'/issues',root+'/issues/'+issue.id+'/packet',root+'/issue-export?format=json',root+'/sentry-uploads'])await denied(removed.req(path),'removal denies the old session on every private transport');
 const document=await removed.req('/projects/'+projects[1].id+'/issues/'+issue.id);assert.equal(document.status,303);assert.equal(new URL(document.headers.get('location'),owner.origin).pathname,'/sign-in');await document.body?.cancel();
 await denied(removed.req(root+'/keys','POST',{kind:'agent'}),'removed session cannot mint another grant');
 await denied(owner.req(root+'/issues/'+issue.id+'/packet','GET',undefined,bearer('agent')),'removal revokes minted agent evidence authority');
 await denied(owner.req(root+'/releases','POST',{name:'synthetic-spool-4',build:'web'},bearer('deploy')),'removal revokes minted deploy authority');
 await denied(owner.req('/api/ingest/'+projects[1].id,'POST',nativeEvent('synthetic-spool-2'),bearer('ingest')),'removal revokes minted ingest authority');
 const dsn=new URL(projects[1].dsn);
 await denied(removed.req(`/api/0/projects/synthetic-spool-1/${projects[1].id}/releases/`,'POST',{version:'synthetic-spool-5'}),'removal denies the CLI management transport');
 await denied(owner.req(`/api${dsn.pathname}/store/?sentry_key=${keys.ingest.key}&sentry_version=7`,'POST',{event_id:'3'.repeat(32),message:'synthetic-spool-2'},{Cookie:''}),'SDK intake rejects the removed member key');
 assert.ok((await remaining.json('/api/projects')).some(row=>row.id===projects[0].id),'another simultaneous contributor remains admitted');
}

async function serviceAuthority(owner,projects,issue) {
 const created=await owner.json(organization+'/services','POST',{name:'synthetic-spool-1',scopes:[{project:projects[0].id,kind:'agent'},{project:projects[0].id,kind:'deploy'},{project:projects[0].id,kind:'ingest'}]});
 const service=(await owner.json(organization)).services.find(row=>row.id===created.id);assert.ok(service);
 const keys={};for(const kind of ['agent','deploy','ingest'])keys[kind]=await owner.json(organization+'/services/'+service.id+'/keys','POST',{project:projects[0].id,kind});
 const bearer=kind=>({Cookie:'',Authorization:'Bearer '+keys[kind].key});
 const root=projectRoot(projects[0]),foreign=projectRoot(projects[1]);
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
 return Object.values(keys).map(row=>row.key);
}

/** [TEAM-001] Membership lifecycle through the real emitted Worker and native mail proof. */
export async function teamFlow() {
 const worker=await startTestWorker(15544);
 try {
  const origin=worker.origin,cookie=await signIn(origin,{emailLink:true}),owner={...client(origin,cookie),origin};
  await denied(client(origin).req(organization),'organization administration requires a native session');
  await owner.json(organization,'POST',{id:'synthetic-spool-1',name:'synthetic-spool-1'});
  const projects=[];for(const id of ['synthetic-spool-1','synthetic-spool-2'])projects.push(await owner.json('/api/projects','POST',{id,name:id}));
  for(const project of projects)await owner.json(organization+'/projects/'+project.id,'PUT',{team:project.id});
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
  await denied(first.req(projectRoot(projects[1])+'/issues'),'members cannot read a disjoint project');
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
  await policyAuthority(owner,first,second,reader,projects);
  await memberDeployment(owner,second,projects[1]);
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
  const successor=(await owner.json(organization)).members.find(row=>row.id===admin.member.id);
  await denied(first.req(organization+'/transfer','POST',{member:successor.id,version:successor.version}),'a project maintainer cannot transfer installation ownership');
  await owner.json(organization+'/transfer','POST',{member:successor.id,version:successor.version});
  await denied(owner.req('/auth/session'),'handoff fences the predecessor session');
  const next=client(origin,await emailSignIn(origin,identities[4].email));
  const session=await next.json('/auth/session');assert.equal(session.operator.role,'owner');
  assert.ok((await first.json('/api/projects')).some(row=>row.id===projects[0].id),'owner transfer preserves other active members');
  console.log('[TEAM-001] native invitations and magic sign-in, simultaneous scoped triage, stale revision refusal, maintainer policy, read-only identity projection, billing/admin limits, member deployments, member/service revocation, safe audit and owner transfer passed');
 } finally {await worker.stop()}
}
