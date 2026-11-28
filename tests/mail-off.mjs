import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,realpath,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {createInstallerModel,readSetupManifestBytes} from '@runeditrun/rer/setup-manifest';
import {requireProductionAuth} from '@runeditrun/rer/internal/cli/production-auth.mjs';
import {productionMail} from '@runeditrun/rer/internal/cli/production-mail.mjs';
import {ownerPlan} from '@runeditrun/rer/modules/deploy-kit/owner';
import {secretBindings} from '@runeditrun/rer/internal/modules/deploy-kit/worker.mjs';
import {signinCommand} from '@runeditrun/rer/internal/cli/signin.mjs';
import {validateConfiguration} from '../scripts/operations-config.mjs';
import {commandAdapter} from '../scripts/installer/local.mjs';
import {inspectRequiredLoops} from '@runeditrun/rer/internal/operations/project-operations.mjs';
import {inspectOperations} from '@runeditrun/rer/operations';
import {operatorMail} from '../src/auth/mail.server.mjs';
import {admissionRuntime} from './admission-runtime.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {testOwner,testSetupToken,testDevKey} from './auth.mjs';
import {event,rule} from './alerts/runtime.mjs';

export async function mailOffConfiguration() {
 const root=process.cwd(),declaration=JSON.parse(await readFile('deploy.json','utf8'));
 const manifest=readSetupManifestBytes(await readFile('rer-setup.json'),await readFile(new URL('../node_modules/@runeditrun/rer/onboarding/schema/SETUP.schema.json',import.meta.url)));
 const model=createInstallerModel(manifest,{}, {ownerBootstrap:true});
 const input={OWNER_EMAIL:testOwner,displayName:'Synthetic Spool',MAIL_PROVIDER:'none'};
 model.validateInput(input);
 const env={...input,SESSION_SECRET:'synthetic-spool-session-secret-long-enough',SETUP_TOKEN:testSetupToken,ALERT_DESTINATIONS:'[]',ALERT_DESTINATION_HASH_KEY:Buffer.alloc(32,45).toString('base64'),AUTH_LOCAL:'false',AUTH_ORIGIN:'https://spool.example'};
 await validateConfiguration(env);
 assert.equal((await inspectOperations(root,env)).ok,true,'native operations accepts mail off without a sender');
 const operations=JSON.parse(await readFile('OPERATIONS.json','utf8'));
 const mailLoop=operations.loops.find(loop=>loop.type==='mail');mailLoop.enabled=true;
 assert.equal(inspectRequiredLoops(operations,env).find(loop=>loop.id===mailLoop.id).status,'optional-disabled','optional mail can be deliberately off');
 mailLoop.required=true;
 assert.equal(inspectRequiredLoops(operations,env).find(loop=>loop.id===mailLoop.id).status,'disabled-required','mail off never satisfies a required delivery loop');
 const context={root,declaration,env,setupManifest:manifest,adapter:commandAdapter,declarationPath:'deploy.json'};
 assert.equal((await requireProductionAuth(context)).mailOff.signIn,'rer signin');
 assert.equal((await requireProductionAuth({...context,options:{dryRun:true,verb:'deploy'}})).mailOff.signIn,'rer signin');
 assert.equal(operatorMail(env),undefined,'the runtime has no sending transport');
 const target={project:declaration.project,environment:'production',worker:'spool-production',origin:env.AUTH_ORIGIN};
 const plan=ownerPlan(target,declaration,{migrations:[]},{env});
 const settings=await secretBindings({},plan.worker,plan,env,false);
 assert.equal(settings.bindings.find(b=>b.name==='MAIL_PROVIDER').text,'none','deployment applies the explicit selection');
 assert.equal(settings.bindings.some(b=>b.name==='MAIL_API_KEY'),false,'no sending credential is bound');
 for(const provider of ['rer','resend','sendgrid','cloudflare']) {
  const enabled={...env,MAIL_PROVIDER:provider,MAIL_FROM:'Synthetic Spool <synthetic-spool-1@mail.runeditrun.com>',MAIL_API_KEY:'synthetic-spool-provider',...(provider==='cloudflare'?{MAIL_ACCOUNT_ID:'1'.repeat(32)}:{}),...(provider==='rer'?{MAIL_RELAY_URL:'https://relay.example.test/send'}:{})};
  await validateConfiguration(enabled);await requireProductionAuth({...context,env:enabled});
  for(const name of ['MAIL_FROM','MAIL_API_KEY',...(provider==='cloudflare'?['MAIL_ACCOUNT_ID']:[]),...(provider==='rer'?['MAIL_RELAY_URL']:[])]) {
   const missing={...enabled};delete missing[name];
   await assert.rejects(validateConfiguration(missing),'enabled providers require their inputs');
   await assert.rejects(requireProductionAuth({...context,env:missing}),'production preflight refuses missing enabled inputs');
  }
  assert.throws(()=>model.validateInput({...input,MAIL_PROVIDER:provider}),'setup requires enabled provider inputs');
 }
 for(const name of ['MAIL_API_KEY','SENDGRID_API_KEY','RESEND_API_KEY','MAIL_PROVIDER_API_KEY','MAIL_ACCOUNT_ID','MAIL_RELAY_URL']) {
  const conflicting={...env,[name]:'synthetic-spool-credential'};
  await assert.rejects(validateConfiguration(conflicting),/mail_off_conflict/);
  // The declared bindings, rather than ambient credentials, are the preflight boundary.
  if(declaration.secrets.some(s=>s.environment===name))await assert.rejects(requireProductionAuth({...context,env:conflicting}));
 }
 for(const selection of [undefined,'later','direct']) {
  const missing={...env,MAIL_PROVIDER:selection};
  await assert.rejects(validateConfiguration(missing));
  assert.equal((await productionMail(root,declaration,missing,'deploy.json',commandAdapter)).off,false);
  await assert.rejects(requireProductionAuth({...context,env:missing}));
 }
 console.log('mailOffConfiguration passed: native setup, declaration binding, operations and production preflight; missing enabled inputs and contradictory mail-off credentials refuse.');
}

// The public rer signin command runs against a network-edge Cloudflare fake.
// D1 queries reach the actual migrated application database; no auth rows are
// synthesized and the real CLI validates the recorded deployment and credentials.
async function ownerCli(app) {
 const root=await mkdtemp(join(await realpath(tmpdir()),'synthetic-spool-signin-'));
 const account=randomBytes(16).toString('hex'),credential='synthetic-spool-provider-credential';
 const version=randomUUID(),deployment=randomUUID(),etag='synthetic-spool-etag',database=randomUUID();
 const record={version:1,kind:'rer-deploy-owner-state',accountId:account,project:'just-every/spool',environment:'production',worker:'spool-production',owned:{worker:{status:'created'},d1:{DB:{status:'created',id:database}},r2:{},kv:{},queues:{}},receipt:{origin:'https://spool.example',provider:{versionId:version,deploymentId:deployment,etag}}};
 await mkdir(join(root,'.rer/deploy'),{recursive:true});
 await writeFile(join(root,'deploy.json'),await readFile('deploy.json'));
 const recordPath=join(root,'.rer/deploy/production.json'),envPath=join(root,'signin.env');
 const save=()=>writeFile(recordPath,JSON.stringify(record),{mode:0o600});await save();
 const credentials=()=>writeFile(envPath,`CLOUDFLARE_ACCOUNT_ID=${account}\nCLOUDFLARE_API_TOKEN=${credential}\n`,{mode:0o600});await credentials();
 let writes=0,replaced=false;
 const edge=async(input,init)=>{
  const url=new URL(input);
  assert.equal(url.origin,'https://api.cloudflare.com');
  assert.equal(new Headers(init.headers).get('authorization'),'Bearer '+credential);
  assert.ok(url.pathname.startsWith('/client/v4/accounts/'+account+'/'),'account binding is exact');
  const path=url.pathname.split('/accounts/'+account)[1];let result;
  if(path==='/workers/scripts/spool-production/settings')result={bindings:[]};
  else if(path==='/workers/scripts/spool-production/deployments')result={deployments:[{id:deployment,versions:[{version_id:version,percentage:100}]}]};
  else if(path==='/workers/scripts/spool-production/versions/'+version)result={id:version,resources:{script:{etag:replaced?'synthetic-replaced-worker':etag}}};
  else if(path===`/d1/database/${database}/query`) {
   const {sql}=JSON.parse(init.body);if(/^INSERT/.test(sql))writes++;
   const value=await app.DB.prepare(sql).all();result=[{success:true,results:value.results,meta:value.meta}];
  } else throw new Error('Unexpected provider request');
  return Response.json({success:true,result});
 };
 const project={root,profile:'first-party',adapter:commandAdapter};
 const run=()=>signinCommand(project,{environment:'production',envFile:'signin.env',json:true},{human(){throw new Error('Private link must not be logged')}},{fetch:edge});
 return {run,get writes(){return writes},async refusals(){
  const before=writes;
  await rm(recordPath);await assert.rejects(run(),/No deployment/);await save();
  for(const [name,value] of [['accountId',randomBytes(16).toString('hex')],['project','synthetic/other'],['environment','other'],['worker','other-production']]){
   const old=record[name];record[name]=value;await save();await assert.rejects(run());record[name]=old;await save();
  }
  await writeFile(envPath,`CLOUDFLARE_ACCOUNT_ID=${account}\nCLOUDFLARE_API_TOKEN=\n`,{mode:0o600});await assert.rejects(run(),/Cloudflare credentials/);await credentials();
  replaced=true;await assert.rejects(run(),{code:'safety_refusal'});replaced=false;
  assert.equal(writes,before,'all custody refusals leave the real auth ledger unchanged');
 },async close(){await rm(root,{recursive:true,force:true})}};
}

export async function mailOffSignIn(output) {
 let app,browser,cli;
 try {
  app=await admissionRuntime({}, {hostedMail:true});
  console.log('mail-off: hosted fixture ready');
  const call=(path,value,cookie)=>app.call(path,value,{'CF-Connecting-IP':'192.0.2.1',...(cookie?{Cookie:cookie}:{})});
  const json=async(path,value,cookie)=>{const response=await call(path,value,cookie);assert.ok(response.ok,`${path}: HTTP ${response.status}`);return response.json()};
  assert.equal((await call('/auth/bootstrap',{token:testSetupToken,displayName:'Synthetic Spool'})).status,303);
  console.log('mail-off: native owner bootstrap completed');
  cli=await ownerCli(app);await cli.refusals();console.log('mail-off: deployment custody refusals passed');
  const entered=await cli.run(),token=new URL(entered.link).searchParams.get('token');
  const confirmed=await call('/auth/owner-signin',{token});
  assert.equal(confirmed.status,303,'the account-guarded CLI opens the real native owner session');
  const cookie=confirmed.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/auth/owner-signin',{token})).status,400,'the CLI grant is single-use');
  const project=await json('/api/projects',{id:'synthetic-spool-1',name:'Synthetic Spool'},cookie),base='/api/projects/'+project.id;
  await json(base+'/releases',{name:'r1',build:'b1'},cookie);
  await json('/api/organization',{id:'synthetic-spool-1',name:'Synthetic Spool'},cookie);
  const destination=await json(base+'/alerting/destinations',{label:'Synthetic Spool',recipient:'synthetic-spool-2@example.test'},cookie);
  const tested=await json(base+'/alerting/destinations/'+destination.id+'/test',{},cookie);assert.equal(tested.state,'passing');
  await json(base+'/alerting/destinations/'+destination.id+'/review',{testId:tested.id},cookie);
  const r=rule('mail',{destination:destination.id});
  const preview=await json(base+'/alerting/rules/preview',r,cookie);
  await json(base+'/alerting/rules',{...r,previewToken:preview.token},cookie);
  const invitedEmail='synthetic-spool-member@example.test';
  await json('/api/organization/invites',{email:invitedEmail,name:'Synthetic member',role:'member',grants:[]},cookie);
  const existingInvites=(await json('/api/organization',undefined,cookie)).invites;
  assert.equal(existingInvites.length,1,'enabled mail still admits and sends a native invitation');
  console.log('mail-off: destination and alert rule prepared through HTTP');
  await app.setMailProvider('none');
  console.log('mail-off: runtime restarted with provider none');
  // A second CLI entry proves owner access after mail is actually off.
  const offEntry=await cli.run();const admitted=await call('/auth/owner-signin',{token:new URL(offEntry.link).searchParams.get('token')});assert.equal(admitted.status,303);
  const offCookie=admitted.headers.get('set-cookie').split(';')[0];
  const emails=[testOwner,invitedEmail,'synthetic-spool-unknown@example.test'];
  const mailResults=[],inviteResults=[];
  for(const email of emails){
   const response=await call('/auth/magic-link',{email});assert.equal(response.status,503);mailResults.push(await response.json());
   const invite=await call('/api/organization/invites',{email,name:'Synthetic Spool',role:'member',grants:[]},offCookie);assert.equal(invite.status,503);inviteResults.push(await invite.json());
  }
  for(const result of [...mailResults,...inviteResults])assert.deepEqual(result,{error:'mail_unavailable'},'known, invited and unknown addresses receive the same unavailable result');
  assert.equal((await app.DB.prepare('SELECT COUNT(*) n FROM spool_local_invite_links').first()).n,0,'hosted mail-off never exposes a local invitation link');
  for(const path of ['/auth/dev/enter?as=owner','/auth/local/cli-session','/__dev/key']){
   for(const value of [undefined,{}]){
    const response=await app.call(path,value,{'x-rer-dev-key':testDevKey});
    assert.ok([400,401,403,404,405].includes(response.status),'no hosted local entry, even with a dev key');assert.equal(response.headers.get('set-cookie'),null);await response.body?.cancel();
   }
  }
  const forged=await call('/auth/owner-signin',{token:randomBytes(32).toString('base64url')});assert.equal(forged.status,400);assert.equal(forged.headers.get('set-cookie'),null);
  console.log('mail-off: uniform auth and shortcut refusals passed');
  const before=(await app.DB.prepare('SELECT COUNT(*) n FROM rer_mail_development_outbox').first()).n;
  const foreign=await app.call('/api/ingest/'+project.id,event('synthetic-spool-refused-origin'),{
   Authorization:'Bearer '+project.ingestKey,Origin:'https://unregistered.example.test',
  });
  assert.equal(foreign.status,403,'the hosted capture credential does not admit an unregistered origin');
  assert.equal(foreign.headers.get('access-control-allow-origin'),null);
  await foreign.body?.cancel();
  const ingest=await app.call('/api/ingest/'+project.id,event('synthetic-spool-off-1'),{Authorization:'Bearer '+project.ingestKey});assert.ok(ingest.ok,'capture HTTP '+ingest.status);await ingest.body?.cancel();
  // Drain native scheduled work and inspect its public delivery history.
  assert.equal((await call('/__fixture/schedule',{time:Date.now()})).status,200);
  const issues=await json(base+'/issues',undefined,offCookie);assert.equal(issues.length,1,'capture and issue reads work without mail');
  const history=await json(base+'/alerting/deliveries',undefined,offCookie);
  assert.ok(history.some(row=>row.channel==='mail'&&row.state==='blocked'&&row.attempts===0),'mail alert is visibly held before sending');
  assert.ok(history.every(row=>!['accepted','delivered'].includes(row.state)),'no alert is reported as sent');
  assert.equal((await app.DB.prepare('SELECT COUNT(*) n FROM rer_mail_development_outbox').first()).n,before,'mail-off makes no provider send');
  assert.deepEqual((await json('/api/organization',undefined,offCookie)).invites,existingInvites,'refused mail-off invitations change no invitation or expose a local link');
  for(const path of [base+'/issues','/api/projects'])assert.equal((await call(path)).status,401,'private APIs stay protected');
  for(const path of ['/app','/projects/'+project.id+'/settings'])assert.equal((await call(path)).status,303,'private documents stay protected');
  console.log('mail-off: blocked delivery and non-mail work passed');
  browser=await launchBrowser();const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:900},javaScriptEnabled:false});
  try{
   const page=await context.newPage();await page.goto(app.origin+'/sign-in?login_hint='+encodeURIComponent(testOwner));
   assert.equal(await page.getByRole('textbox').count(),0,'mail-off offers no email-link form');
   assert.equal(await page.locator('main').innerText().then(text=>text.includes('rer signin')),true,'the deploying owner gets the guarded CLI guidance');
   assert.equal(await page.locator('a[href*="/auth/dev/"]').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'mail-off guidance fits the sign-in screen');
   await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:resolve(output,'sign-in-mail-off-1440.png'),fullPage:true});
   await page.setViewportSize({width:390,height:900});await page.screenshot({path:resolve(output,'sign-in-mail-off-390.png'),fullPage:true});
   assert.equal((await call('/projects/'+project.id+'/settings',undefined,offCookie)).status,200,'settings work with the native CLI owner session');
  }finally{await context.close()}
  console.log('mailOffSignIn passed: guarded CLI admission and custody refusals; uniform unavailable links/invitations; held alert; capture, issues and settings; anonymous and shortcut refusals; 1440/390 sign-in proof.');
 }finally{await browser?.close();await cli?.close();await app?.close()}
}
