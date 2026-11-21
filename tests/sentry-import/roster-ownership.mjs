import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect } from '@playwright/test';
import { admissionRuntime } from '../admission-runtime.mjs';
import { signIn, confirmEmailLink } from '../auth.mjs';
import { legacyMailRows } from '../legacy-mail.mjs';
import { archiveProjection } from '../archive.mjs';
import { followErasure } from '../project-erasure/follow.mjs';
import { launchBrowser } from '../browser-launch.mjs';

// Synthetic API responses, not a Sentry account or customer export. The bundle
// envelope carries paginated endpoint responses unchanged; ownership's single
// object is wrapped in a one-row page. Public schemas and every omission are
// documented in docs/SENTRY-ROSTER-IMPORT.md.
const created='2026-01-01T00:00:00Z',updated='2026-02-01T00:00:00Z';
const page=response=>[{cursor:null,nextCursor:null,response}];
const member=(n,orgRole,extra={})=>({id:`synthetic-spool-${n}`,email:`synthetic-spool-${n}@example.test`,name:`Synthetic teammate ${n}`,orgRole,pending:false,expired:false,dateCreated:created,
 user:{id:`synthetic-spool-user-${n}`,isActive:true,has2fa:true,emails:[{email:`synthetic-spool-${n}@example.test`,is_verified:true}]},flags:{'sso:linked':true},inviteStatus:'approved',...extra});
const members=[member(1,'owner'),member(2,'admin'),member(3,'billing'),member(4,'member'),member(5,'member',{pending:true,user:null}),member(6,'member',{expired:true,pending:true,user:null}),member(7,'unsupported')];
const team=(n,slug,project)=>({id:`synthetic-spool-team-${n}`,slug,name:`Synthetic ${slug}`,dateCreated:created,projects:[{slug:project}],access:['project:write'],isMember:true,hasAccess:true});
const teams=[team(1,'checkout-team','checkout'),team(2,'api-team','api')];
const fixture=()=>({format:'spool-sentry-org-export',version:1,organization:{id:'synthetic-spool-org',slug:'synthetic-roster',region:'us'},window:{start:created,end:updated},omissions:['Synthetic local member and ownership responses only; no real account or mail.'],collections:[
 {kind:'projects',project:null,pages:page(['checkout','api'].map((slug,n)=>({id:`synthetic-spool-project-${n}`,slug,name:`Synthetic ${slug}`,dateCreated:created,teams:[{id:teams[n].id,slug:teams[n].slug}]})))},
 {kind:'releases',project:null,pages:page([])},
 {kind:'members',project:null,pages:page(members)},
 {kind:'teams',project:null,pages:page(teams)},
 ...teams.map((team,n)=>({kind:'team-members',team:team.slug,project:null,pages:page(members.filter(m=>n===0?['synthetic-spool-1','synthetic-spool-4','synthetic-spool-6'].includes(m.id):m.id==='synthetic-spool-5').map(m=>({...m,teamRole:'member',teamSlug:team.slug})))})),
 {kind:'ownership',project:'checkout',pages:page([{raw:'path:src/* #checkout-team\npath:src/checkout.ts synthetic-spool-4@example.test',schema:{$version:1,rules:[
  {matcher:{type:'path',pattern:'src/*'},owners:[{type:'team',id:teams[0].id,name:teams[0].slug}]},
  {matcher:{type:'path',pattern:'src/checkout.ts'},owners:[{type:'user',id:'synthetic-spool-user-4',name:members[3].email}]},
  {matcher:{type:'codeowners',pattern:'*'},owners:[{type:'user',id:'synthetic-spool-unknown'}]},
 ]},dateCreated:created,lastUpdated:updated,isActive:true,autoAssignment:'Auto Assign to Issue Owner',codeownersAutoSync:true,fallthrough:true}])},
]});
export async function rosterOwnershipFlow(){
 console.log('Roster stage: start');
 const app=await admissionRuntime({}, {hostedMail:true});let browser;
 try{
  console.log('Roster stage: sign in');
  const cookie=await signIn(app.origin,{emailLink:true});
  const req=(path,method='GET',body,headers={})=>app.call(path,body,{Cookie:cookie,...headers},method);
  const json=async(path,method,body,expected=200,headers={})=>{const response=await req(path,method,body,headers);assert.equal(response.status,expected,`${path}: ${await response.clone().text()}`);return response.json()};
  const door=(action,body,expected=200)=>json('/api/operator/import/'+action,'POST',body,expected,{'X-Import-Source':'sentry-org:synthetic-roster'});
  const snapshot=async()=>archiveProjection(await req('/api/archive'));
  await json('/api/organization','POST',{id:'synthetic-spool-native',name:'Synthetic native organization'},201);
  const before=await snapshot(),mailBefore=(await legacyMailRows(app.origin)).length;
  const bytes=Buffer.from(JSON.stringify(fixture())),hash=b=>createHash('sha256').update(b).digest('hex');
  const uploaded=await door('uploads',{name:'synthetic-roster.json',bundleSha256:hash(bytes),totalBytes:bytes.length,totalChunks:1,index:0,chunkSha256:hash(bytes),base64:bytes.toString('base64')});
  console.log('Roster stage: plan');
  const plan=await door('plan',{uploadId:uploaded.uploadId});
  assert.equal(plan.counts.rejected,1,'unsupported source role is named and never broadened');
  assert.equal(plan.rejected.length,1);
  // The merged v2 projection must preserve main's complete pointer ledger,
  // including private inert review data and fields that confer no native trust.
  const leaves=(value,path='')=>value&&typeof value==='object'&&Object.keys(value).length
   ?Object.entries(value).flatMap(([key,child])=>leaves(child,path+'/'+key.replaceAll('~','~0').replaceAll('/','~1'))):[path];
  for(const collection of fixture().collections)for(const page of collection.pages)for(const data of page.response){
   const id=collection.kind==='ownership'?collection.project:data.id;
   const sourceId=JSON.stringify(collection.team?['synthetic-roster',collection.project,collection.team,id]:['synthetic-roster',collection.project,id]);
   const fields=plan.sentry.fields.filter(row=>row.kind===collection.kind&&row.sourceId===sourceId);
   assert.deepEqual(fields.map(row=>row.path).sort(),leaves(data).sort(),'every roster scalar and empty container has exactly one disposition');
   if(collection.kind==='members'&&data.orgRole==='unsupported')assert.ok(fields.every(row=>row.disposition==='rejected'));
  }
  const field=(kind,path)=>plan.sentry.fields.filter(row=>row.kind===kind&&row.path===path);
  assert.ok(field('members','/email').some(row=>row.disposition==='transformed'));
  assert.ok(field('members','/user/emails/0/is_verified').every(row=>['unmapped','rejected'].includes(row.disposition)),'source verification grants no native trust');
  assert.ok(field('teams','/access/0').every(row=>row.disposition==='unmapped'));
  assert.ok(field('team-members','/teamRole').every(row=>row.disposition==='transformed'),'team role contributes only to pending roster scopes');
  assert.equal(field('ownership','/raw')[0].disposition,'mapped');
  assert.equal(field('ownership','/isActive')[0].disposition,'transformed');
  assert.ok(field('ownership','/raw')[0].sourceId.endsWith(',"checkout"]'),'ownership source identity is keyed by project slug under mapping v2');

  assert.deepEqual((await snapshot()).data,before.data,'review has no native effect');
  const apply=async()=>{let result;for(let i=0;i<20;i++){result=await door('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint});if(result.job.state==='completed')return result}assert.fail('resume did not complete')};
  console.log('Roster stage: apply');
  await apply();const first=await snapshot();
  await apply();assert.deepEqual((await snapshot()).data,first.data,'exact apply retry is idempotent');
  const same=await door('plan',{uploadId:uploaded.uploadId});assert.equal(same.fingerprint,plan.fingerprint,'exact re-import names the same reviewed plan');
  const report=await door('reconcile',{planId:plan.planId});assert.equal(report.ok,true);assert.equal(report.counts.present+report.counts.explained,report.counts.sourceRecords);assert.ok(report.counts.byKind['import-proposal']>0);
  assert.equal((await legacyMailRows(app.origin)).length,mailBefore,'import sends no invitation mail');
  assert.deepEqual(first.data.spool_members,before.data.spool_members);assert.deepEqual(first.data.spool_project_grants,before.data.spool_project_grants);assert.deepEqual(first.data.spool_project_teams,before.data.spool_project_teams,'import never binds projects to native teams');assert.deepEqual(first.data.spool_member_invites,before.data.spool_member_invites);
  let proposals=(await json('/api/organization/imports')).proposals;
  assert.equal(proposals.filter(p=>p.kind==='member').length,6);assert.ok(proposals.every(p=>p.state==='pending'));
  const bySource=id=>proposals.find(p=>p.kind==='member'&&p.payload.sourceId===id);
  assert.equal(bySource(members[0].id).payload.role,'admin');assert.equal(bySource(members[2].id).payload.role,'billing');assert.deepEqual(bySource(members[2].id).payload.grants,[]);
  assert.deepEqual(['active','pending','expired'].map(state=>proposals.some(p=>p.payload.sourceState===state)),[true,true,true]);
  const projects=await json('/api/projects'),checkout=projects.find(p=>p.name==='Synthetic checkout'),api=projects.find(p=>p.name==='Synthetic api');
  assert.deepEqual(bySource(members[3].id).payload.grants,[{project:checkout.id,role:'member'}]);assert.deepEqual(bySource(members[4].id).payload.grants,[{project:api.id,role:'member'}]);
  const ownership=proposals.find(p=>p.kind==='ownership');
  assert.equal(ownership.payload.enabled,false);assert.deepEqual(ownership.payload.schema,fixture().collections.at(-1).pages[0].response[0].schema);assert.equal(ownership.payload.sourceRevision,updated);
  const preview=await json(`/api/organization/imports/${ownership.id}/preview`,'POST',{version:1,samples:[{path:'src/checkout.ts'},{path:'other.ts'}]});
  assert.equal(preview.enabled,false);assert.deepEqual(preview.samples[0].matches,[0,1]);assert.equal(preview.samples[0].winner,0);assert.equal(preview.samples[0].overlap,true);assert.equal(preview.samples[1].unmatched,true);assert.equal(preview.rules[2].supported,false);assert.equal(preview.rules[2].owners[0].resolved,false);assert.ok(preview.rules.slice(0,2).every(r=>r.owners.every(o=>o.resolved)));
  for(const [method,path,body,headers] of [
   ['GET','/api/organization/imports',undefined,{Cookie:''}],
   ['POST',`/api/organization/imports/${ownership.id}/preview`,{version:1,samples:[]},{Origin:'https://other.example'}],
  ])assert.ok([401,403,404].includes((await req(path,method,body,headers)).status));
  console.log('Roster stage: exact undo');
  // Unchanged proposals undo with the same journal and can be re-applied later.
  for(let i=0;i<20;i++){const result=await door('undo',{planId:plan.planId});if(result.job.state==='undone')break;assert.ok(i<19)}
  const undoneData=(await snapshot()).data;const withoutReservations=({short_id_prefixes,...data})=>data;assert.deepEqual(withoutReservations(undoneData),withoutReservations(before.data),'unchanged roster and ownership undo exactly; native short ID reservations remain retired');assert.ok(undoneData.short_id_prefixes.every(p=>!undoneData.projects.some(project=>project.id===p.project)));
  const nextBytes=Buffer.concat([bytes,Buffer.from('\n')]),nextUpload=await door('uploads',{name:'synthetic-roster.json',bundleSha256:hash(nextBytes),totalBytes:nextBytes.length,totalChunks:1,index:0,chunkSha256:hash(nextBytes),base64:nextBytes.toString('base64')});
  const nextPlan=await door('plan',{uploadId:nextUpload.uploadId});
  for(let i=0;i<20;i++){const result=await door('apply',{planId:nextPlan.planId,reviewedFingerprint:nextPlan.fingerprint});if(result.job.state==='completed')break;assert.ok(i<19)}
  console.log('Roster stage: browser');
  // Browser uses the same owner session and public settings door. Assertions at
  // 1440; the same changed section is captured once at each required width.
  browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});
  const split=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:app.origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();await page.goto(app.origin+`/projects/${checkout.id}/settings`);
  const region=page.getByRole('region',{name:'Members',exact:true});await region.locator('summary').filter({hasText:/^Imported roster and ownership$/}).click();
  await region.getByRole('button',{name:'Details: Review ownership rules',exact:true}).click();
  await page.getByRole('button',{name:'Preview ownership',exact:true}).click();await expect(page.getByRole('status').filter({hasText:/Proposal rule 1 wins/})).toBeVisible();
  const folder=process.env.SPOOL_ROSTER_EVIDENCE||'.artifacts/sentry-roster';await mkdir(folder,{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:resolve(folder,`ownership-${width}.png`)});if(width===1440)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');}
  await page.getByRole('button',{name:'Close details',exact:true}).click();await page.setViewportSize({width:1440,height:1000});
  await region.getByRole('button',{name:'Details: Review Synthetic teammate 5',exact:true}).click();const invitationReview=page.getByRole('dialog',{name:'Review Synthetic teammate 5',exact:true});await expect(invitationReview).toContainText('Synthetic api · member');for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:resolve(folder,`member-${width}.png`)});}await page.getByRole('button',{name:'Close details',exact:true}).click();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await region.screenshot({path:resolve(folder,`roster-${width}.png`)});}
  await browser.close();browser=null;
  console.log('Roster stage: native invitation');
  const previousIds=(await legacyMailRows(app.origin)).map(r=>r.id),pending=bySource(members[4].id);
  await json(`/api/organization/imports/${pending.id}/invite`,'POST',{version:pending.version+10},409);
  await json(`/api/organization/imports/${pending.id}/invite`,'POST',{version:pending.version},202);
  const memberCookie=await confirmEmailLink(app.origin,members[4].email,{previousIds});
  const actor=(path,method='GET',body)=>req(path,method,body,{Cookie:memberCookie});
  const access=await (await actor('/api/organization/me')).json();assert.deepEqual(access.projects.map(p=>p.id),[api.id]);assert.equal(access.role,'member');
  assert.equal((await actor(`/api/projects/${checkout.id}/issues`)).status,404);assert.equal((await actor('/api/organization/imports')).status,404);
  const beforeUndo=await json('/api/organization');const undone=await req('/api/operator/import/undo','POST',{planId:nextPlan.planId},{'X-Import-Source':'sentry-org:synthetic-roster'});assert.equal(undone.status,409);await undone.arrayBuffer();
  assert.deepEqual((await json('/api/organization')).members,beforeUndo.members,'undo never revokes the subsequently authorized member');assert.equal((await actor('/api/organization/me')).status,200);
  const nativeMember=beforeUndo.members.find(m=>m.email===members[4].email);await json(`/api/organization/members/${nativeMember.id}`,'DELETE',{version:nativeMember.version});assert.ok([401,403].includes((await actor('/api/organization/me')).status),'native removal revokes the imported invitee session');
  assert.equal((await json('/api/owner/erasure')).hold,'shared_import_custody','owner erasure names retained source custody');
  console.log('Roster stage: archive');
  const auditBefore=(await json('/api/audit/export?format=json')).rows;
  const archive=await (await req('/api/archive')).text(),audit=await (await req('/api/audit/export')).text();assert.ok(JSON.parse(audit).rows.some(f=>f.action==='member.invite'),'the separate native authorization records its invitation action');for(const email of members.map(m=>m.email))assert.ok(!audit.includes(email),'portable audit contains no source email');assert.ok(!audit.includes('src/checkout.ts'));
  // Current native archive restores pending proposals, never active members or
  // mail/session/ownership authority. Safe permanent facts survive portability.
  console.log('Roster stage: restore start');
  const restore=await admissionRuntime();try{const restoredCookie=await signIn(restore.origin);console.log('Roster stage: restore apply');
   const restored=await fetch(restore.origin+'/api/restore',{method:'POST',headers:{Origin:restore.origin,Cookie:restoredCookie,'X-Confirm-Restore':'yes','Content-Type':'application/x-ndjson'},body:archive});assert.equal(restored.status,200,await restored.clone().text());await restored.arrayBuffer();
   console.log('Roster stage: restored owner hold');
   const held=await restore.call('/api/owner/erasure',undefined,{Cookie:restoredCookie});assert.ok(['shared_import_custody','ambiguous_identity_attribution'].includes((await held.json()).hold),'restored review data retains an explicit owner-erasure hold; restored owner roster attribution may hold first');
   const restoredData=await archiveProjection(await restore.call('/api/archive',undefined,{Cookie:restoredCookie}));assert.ok(restoredData.data.spool_import_proposals.every(p=>p.state==='pending'));const restoredAudit=(await (await restore.call('/api/audit/export?format=json',undefined,{Cookie:restoredCookie})).json()).rows;const strip=({sequence,...fact})=>fact;for(const fact of auditBefore.filter(f=>!f.action.startsWith('audit.')))assert.ok(restoredAudit.some(r=>JSON.stringify(strip(r))===JSON.stringify(strip(fact))),'portable facts retain their original attribution');
  }catch(error){console.error('Roster restore failure:',error.stack);throw error}finally{await restore.close()}
  // Erasing either project withdraws shared personal roster proposals, raw
  // source custody and original ownership, with only count/time receipts.
  console.log('Roster stage: erasure');
  for(const project of projects){const root=`/api/projects/${project.id}`,plan=await json(root+'/erasure');assert.equal(plan.hold,null);const accepted=await json(root+'/erasure','POST',{confirm:project.id,planHash:plan.planHash},202);const receipt=await followErasure(async(path,method)=>json(path,method),accepted);assert.equal(receipt.phase,'complete');for(const email of members.map(m=>m.email))assert.ok(!JSON.stringify(receipt).includes(email));}
  assert.deepEqual((await json('/api/organization/imports')).proposals,[]);
  const after=await (await req('/api/archive')).text();assert.ok(!after.includes('codeownersAutoSync'));assert.ok(!after.includes('synthetic-spool-user-4'));
  if(process.env.SPOOL_ROSTER_EVIDENCE)await writeFile(resolve(folder,'ROSTER-RECEIPT.json'),JSON.stringify({schema:1,author:'Run Edit Run fleet',at:new Date().toISOString(),head:process.env.SPOOL_CANDIDATE_SHA??null,syntheticOnly:true,sourceRecords:plan.summary.sourceRecords,planCounts:plan.counts,reconciliation:report.counts,before:{projects:before.data.projects.length,members:before.data.spool_members.length,proposals:before.data.spool_import_proposals.length},afterImport:{projects:first.data.projects.length,members:first.data.spool_members.length,proposals:first.data.spool_import_proposals.length},proofs:['no-native-write-preview','no-mail-session-access-effects','active-pending-expired','role-scope-mapping','unsupported-role','exact-reimport','resume-retry','guarded-undo','overlap-unmatched-unsupported-owner-preview','native-invitation-and-removal','safe-portable-audit','inert-archive-restore','project-custody-erasure'],screenshots:['ownership-1440.png','ownership-390.png','roster-1440.png','roster-390.png','member-1440.png','member-390.png'],result:'passed'},null,2)+'\n');
  console.log('Roster/ownership public flow passed: inert role/scopes, named unsupported role, exact retry and undo, ownership overlap/unmatched, native invite/removal, safe portable audit, erasure and 1440/390 UI. Synthetic only.');
 }catch(error){console.error('Roster flow failure:',error.stack);throw error}finally{await browser?.close();await app.close()}
}
if(process.argv[1]===new URL(import.meta.url).pathname)await rosterOwnershipFlow();
