import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {admissionRuntime} from '../admission-runtime.mjs';
import {signIn,testDevKey} from '../auth.mjs';
import {agentScreens} from './screens.mjs';

/** An unpaired installation keeps agent work closed until its native owner answers. */
export async function nativeSetup(){
 const app=await admissionRuntime();let screens;
 try{
  const cookie=await signIn(app.origin);
  const json=async(path,body,method)=>{
   const response=await app.call(path,body,{Cookie:cookie},method);
   assert.ok(response.ok,path+' HTTP '+response.status);return response.json();
  };
  const project='synthetic-spool-setup',foreign='synthetic-spool-other';
  const created=await json('/api/projects',{id:project,name:'Native setup qualification'});
  const other=await json('/api/projects',{id:foreign,name:'Other private project'});
  for(const id of [project,foreign])await json('/api/projects/'+id+'/releases',{name:'1.0.0',build:'web-1'});
  // Captures use their own ingest grants, never the owner's ambient session.
  const capture=async(id,key,eventId)=>{
   const response=await app.call('/api/ingest/'+id,{version:1,eventId,release:'1.0.0',build:'web-1',environment:'production',type:'TypeError',message:eventId,frames:[{file:'https://checkout.example/app.js',line:1,column:0,function:'total'}],breadcrumbs:[]},{Authorization:'Bearer '+key});
   const value=await response.json();assert.equal(response.status,201,JSON.stringify(value));return value;
  };
  const admitted=await capture(project,created.ingestKey,'synthetic-spool-1');
  await capture(foreign,other.ingestKey,'synthetic-spool-2');
  const grant=await json('/api/projects/'+project+'/keys',{kind:'agent'});
  let rpcId=0;
  const mcp=async(method,params={},expectedStatus=200)=>{
   const response=await app.call('/mcp',{jsonrpc:'2.0',id:++rpcId,method,params},{Authorization:'Bearer '+grant.key,'x-rer-dev-key':testDevKey,Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25','Mcp-Method':method,...params.name?{'Mcp-Name':params.name}:{}});
   assert.equal(response.status,expectedStatus,method+' transport status');return response.json();
  };
  const call=(target=project,status=200)=>mcp('tools/call',{name:'spool.issues.list',arguments:{project:target}},status);
  const error=answer=>answer.result?._meta?.['com.runeditrun/error'];
  const before=await json('/api/projects/'+project+'/issues');
  assert.ok(before.some(issue=>issue.id===admitted.issue),'Refusal proof uses a populated project');
  const initial=await json('/agents/api/policy');
  assert.deepEqual(initial,{document:null,revision:null,complete:false});
  const state=await json('/agents/api/state');assert.equal(state.paired,false);
  // A valid native agent credential cannot answer the standalone person's questions.
  const complete={schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'all',class:'*',do:'autonomous'}],spend:{none:true}};
  for(const suppliedCookie of ['',cookie]){
   const refused=await app.call('/agents/api/policy',{document:complete},{Cookie:suppliedCookie,Authorization:'Bearer '+grant.key},'PUT');
   assert.equal(refused.status,403);assert.equal((await refused.json()).code,'person_session_required');
   assert.deepEqual(await json('/agents/api/policy'),initial);assert.deepEqual(await json('/api/projects/'+project+'/issues'),before);
  }
  console.log('PROBE BASE-AGENT-008 acceptance-2-policy: native policy PUT with real project agent key, with and without owner cookie -> 403 and unchanged policy and native records; subsequent owner UI save succeeds');

  const first=await call();assert.equal(first.result.isError,true);assert.equal(error(first)?.code,'policy_unset');
  const setup=new URL(error(first).setup_url);
  assert.equal(setup.href,app.origin+'/agents','The first scoped call links to this installation native setup');
  assert.deepEqual((await mcp('tools/list')).result.tools,[],'No operations are offered before setup');
  console.log('PROBE SURFACE-005 native-link: authenticated exact-project MCP read -> policy_unset and native /agents setup URL');

  const manifest=JSON.parse(await readFile(new URL('../../agent-surface.json',import.meta.url),'utf8'));
  const declared=[...new Set(manifest.tools.flatMap(tool=>tool.classes))].sort();
  assert.ok(declared.length>0);assert.deepEqual([...state.policy.unanswered].sort(),declared);
  const unchanged=async()=>{
   assert.deepEqual(await json('/agents/api/policy'),initial,'Incomplete answers save no policy or revision');
   const refused=await call();assert.equal(refused.result.isError,true);assert.equal(error(refused)?.code,'policy_unset');
   assert.deepEqual(await json('/api/projects/'+project+'/issues'),before,'Unanswered policy leaves captured records unchanged');
   const audit=await json('/agents/api/audit');assert.ok(audit.rows.length>0);
   assert.ok(audit.rows.every(row=>row.outcome==='refused'),'No agent operation completed while setup was unanswered');
  };
  screens=await agentScreens({origin:app.origin,cookie});
  await screens.capture('native-setup-unanswered',setup.pathname,null,async page=>{
   const questions=await page.locator('[data-policy-class]').evaluateAll(selects=>selects.map(select=>({
    id:select.dataset.policyClass,value:select.value,label:select.labels?.[0]?.textContent.trim(),
    help:document.getElementById(select.getAttribute('aria-describedby'))?.textContent.trim(),
    visible:select.getBoundingClientRect().height>0,
   })));
   assert.deepEqual(questions.map(question=>question.id).sort(),declared,'Every currently declared class has one displayed question');
   assert.ok(questions.every(question=>question.value===''&&question.label&&question.help&&question.visible),'Each labelled class question starts unanswered');
   assert.equal(new Set(questions.map(question=>question.label)).size,declared.length,'Questions have distinct accessible labels');
   assert.equal(await page.locator('input[name="paidAI"]:checked').count(),0,'Paid AI has no preselected answer');
   const firstChoice=page.locator('[data-policy-class]').first();await firstChoice.focus();
   await page.keyboard.press('Tab');
   assert.ok(await page.locator('[data-policy-class]').nth(1).evaluate(select=>select===document.activeElement),'Keyboard reaches the next question');
  });
  console.log('PROBE SURFACE-005 unanswered-controls: native owner setup -> every declared class and paid AI unanswered; labelled keyboard controls, Axe and desktop and phone proof');

  await screens.capture('native-setup-incomplete',setup.pathname,null,async page=>{
   let saves=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/agents/api/policy'&&request.method()==='PUT')saves++;});
   const form=page.locator('[data-create-policy]'),choices=form.locator('[data-policy-class]'),save=form.getByRole('button',{name:'Save policy',exact:true});
   await save.focus();await page.keyboard.press('Enter');
   assert.ok(await choices.first().evaluate(select=>select===document.activeElement),'Blank submission focuses its first unanswered question');
   await unchanged();
   for(let i=0;i<declared.length-1;i++)await choices.nth(i).selectOption('blocked');
   await save.click();
   assert.ok(await choices.last().evaluate(select=>select===document.activeElement),'Incomplete submission focuses the unanswered class');
   await unchanged();
   await choices.last().selectOption('blocked');await save.click();
   assert.ok(await form.locator('input[name="paidAI"]').first().evaluate(input=>input===document.activeElement),'An unanswered paid-AI choice also prevents saving');
   await unchanged();assert.equal(saves,0,'Blank and incomplete quick-form submissions send no policy write');
   // The server also refuses an incomplete document when a client bypasses form validation.
   const draft=JSON.parse(await page.locator('#policy-document').inputValue());
   for(const rules of [[],declared.slice(1).map(cls=>({id:cls,class:cls,do:'blocked'}))]){
    const rejected=await app.call('/agents/api/policy',{document:{...draft,rules}},{Cookie:cookie},'PUT');
    assert.equal(rejected.status,409);assert.equal((await rejected.json()).code,'policy_incomplete');await unchanged();
   }
  });
  console.log('PROBE SURFACE-005 incomplete-refusal: blank form, omitted class, unanswered paid AI and incomplete native PUT -> no policy saved and no MCP operation admitted');

  await screens.capture('native-setup-answered',setup.pathname,null,async page=>{
   const form=page.locator('[data-create-policy]');
   for(const cls of declared)await form.locator('[data-policy-class="'+cls+'"]').selectOption(cls==='standard'?'autonomous':'blocked');
   const paid=form.locator('input[name="paidAI"][value="no"]');await paid.focus();await page.keyboard.press('Space');
   const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/agents/api/policy'&&response.request().method()==='PUT');
   await form.getByRole('button',{name:'Save policy',exact:true}).click();assert.equal((await saved).status(),200);
   await page.locator('[data-create-policy]').waitFor({state:'detached'});
   await page.locator('[data-policy-editor]').waitFor();
  });
  const saved=await json('/agents/api/policy');assert.equal(saved.complete,true);assert.equal(saved.revision,1);
  assert.deepEqual(saved.document.rules.map(rule=>({class:rule.class,do:rule.do})).sort((a,b)=>a.class.localeCompare(b.class)),declared.map(cls=>({class:cls,do:cls==='standard'?'autonomous':'blocked'})));
  assert.deepEqual(saved.document.spend,{none:true});
  const tools=(await mcp('tools/list')).result.tools;
  assert.deepEqual([...new Set(tools.flatMap(tool=>tool._meta['com.runeditrun/classes']))].sort(),declared,'Displayed questions reconcile with the runtime tool declarations');
  const allowed=await call();assert.equal(allowed.result.isError,false);
  const nativeRead=await app.call('/api/projects/'+project+'/issues',undefined,{Authorization:'Bearer '+grant.key,'x-rer-dev-key':testDevKey});
  assert.equal(nativeRead.status,200);
  assert.deepEqual(allowed.result.structuredContent.items,await nativeRead.json(),'MCP returns the complete scoped HTTP projection after explicit setup');
  assert.deepEqual(allowed.result.structuredContent.items.map(issue=>issue.id),[admitted.issue],'The scoped read reaches the known captured issue');
  assert.deepEqual(await json('/api/projects/'+project+'/issues'),before,'Policy setup and scoped reads preserve native captured records');
  const denied=await call(foreign);assert.equal(denied.result.isError,true);assert.equal(error(denied)?.code,'not_found');
  assert.ok(!JSON.stringify(denied).includes('synthetic-spool-2'),'Native setup never widens the grant to another project');
  await json('/api/projects/'+project+'/keys/'+grant.hash,undefined,'DELETE');
  assert.equal((await call(project,401)).error.code,-32001,'Revocation still fences the scoped read after setup');
  console.log('PROBE SURFACE-005 explicit-choice: owner answers all classes and No paid AI -> revision 1, exact-project MCP read succeeds, foreign-project read and revoked key refused');
 }finally{await screens?.close();await app.close();}
}
