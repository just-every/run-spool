import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {launchBrowser} from './browser-launch.mjs';
import {confirmEmailLink} from './auth.mjs';
import {legacyMailRows} from './legacy-mail.mjs';
import {archiveProjection} from './archive.mjs';
import {runtime} from './owner-erasure/helpers.mjs';

/** ERR-005: the permissioned current lookup over a retained JavaScript stack. */
export async function mappedFramesFlow({req,json,origin,cookie}) {
 const project=await json('/api/projects','POST',{id:'synthetic-spool-mapped',name:'Mapped checkout'}),base='/api/projects/'+project.id;
 const dsn=new URL(project.dsn),intake=`/api${dsn.pathname}/envelope/?sentry_key=${dsn.username}&sentry_version=7`;
 const file='https://synthetic-spool.example/app.js',debug='synthetic-spool-1';
 const frames=Array.from({length:1000},(_,i)=>({filename:file,function:'synthetic_spool_'+(i+1),lineno:i+1,colno:7,in_app:true}));
 frames[1]={...frames[1],filename:'https://synthetic-spool.example/missing.js'};
 frames[2]={...frames[2],filename:'https://synthetic-spool.example/no-debug.js'};
 delete frames[3].colno;
 frames[4]={...frames[4],filename:'https://synthetic-spool.example/mismatch.js'};
 frames[5]={...frames[5],lineno:1001};
 frames[0].vars={quantity:3,local_note:'PRIVATE_MAPPED_LOCAL'};
 frames[6].vars={__traceback_hide__:true};
 const images=[{type:'sourcemap',code_file:file,debug_id:debug},{type:'sourcemap',code_file:frames[1].filename,debug_id:'synthetic-spool-2'},{type:'sourcemap',code_file:frames[4].filename,debug_id:'synthetic-spool-3'}];
 const map={version:3,sources:['checkout.ts'],sourcesContent:['PRIVATE_MAPPED_SOURCE'],names:[],mappings:'AAAK'+';AACA'.repeat(999)};
 await json(base+'/releases','POST',{name:'synthetic-spool-1',build:'web'});
 await json(base+'/releases','POST',{name:'synthetic-spool-2',build:'web'});
 await json(base+'/artifacts','POST',{release:'synthetic-spool-2',build:'web',debugId:'synthetic-spool-3',map});
 const input=(id,release='synthetic-spool-1',dist='web')=>({event_id:id.repeat(32),platform:'javascript',release,dist,exception:{values:[{type:'MappedCheckoutError',value:'synthetic-spool-1',stacktrace:{frames}},{type:'CheckoutWrapper',value:'synthetic-spool-1',stacktrace:{frames:frames.slice(30,65)}}]},debug_meta:{images}});
 const send=async event=>{const response=await req(intake,'POST',JSON.stringify({event_id:event.event_id})+'\n{"type":"event"}\n'+JSON.stringify(event));assert.equal(response.status,200,await response.text());return event.event_id};
 const first=await send(input('a')),issue=(await json(base+'/issues'))[0].id,events=base+'/issues/'+issue+'/events';
 const detail=async id=>{const list=await json(events),row=list.rows.find(row=>row.id===id);assert.ok(row);return json(events+'/'+id+'?'+new URLSearchParams({occurrence:row.occurrence}))};
 const before=await detail(first),pathFor=row=>events+'/'+row.id+'/mapped-frames?'+new URLSearchParams({occurrence:row.occurrence});
 const path=pathFor(before),pagePath=(path,index=0,cursor)=>path+'&'+new URLSearchParams({exception:String(index),...cursor?{cursor}:{}});
 const allPages=async(path,index=0)=>{let cursor,rows=[],pages=0;do{const page=await json(pagePath(path,index,cursor));assert.equal(page.lookup,'current');assert.ok(page.rows.length>0&&page.rows.length<=30);assert.equal(page.start,rows.length);assert.equal(page.exceptionIndex,index);rows.push(...page.rows);cursor=page.next;pages++;}while(cursor);assert.ok(pages>1);return rows};
 const initial=await allPages(path);
 assert.equal(initial.length,1000);assert.deepEqual(initial.map(row=>row.frameIndex),Array.from({length:1000},(_,i)=>i));
 assert.equal(initial[999].status,'missing_artifact');assert.equal(initial[999].generated.line,1000);
 const retainedBefore=(await archiveProjection(await req('/api/archive'))).data.events;
 await json(base+'/artifacts','POST',{release:'synthetic-spool-1',build:'web',debugId:debug,map});
 assert.deepEqual((await archiveProjection(await req('/api/archive'))).data.events,retainedBefore,'late map upload changes no stored event or admission diagnostic');
 const mapped=await allPages(path);
 assert.equal(new Set(mapped.map(row=>row.exceptionIndex+':'+row.frameIndex)).size,1000,'pages have no omitted or duplicate retained indices');
 for(const row of mapped){
  assert.equal(row.exceptionIndex,0);assert.deepEqual(row.generated,initial[row.frameIndex].generated);
  if(![1,2,3,4,5].includes(row.frameIndex)){
   assert.equal(row.status,'mapped');assert.equal(row.original.file,'checkout.ts');assert.equal(row.original.line,row.frameIndex+1);assert.equal(row.original.column,5);assert.equal(row.generated.column,6);
  }
 }
 assert.deepEqual(mapped.slice(1,6).map(row=>row.status),['missing_artifact','missing_debug_id','missing_position','identity_mismatch','unmapped_position']);
 assert.equal(mapped[999].original.line,1000,'the last retained frame is mapped');
 assert.deepEqual((await allPages(path,1)).map(row=>row.frameIndex),Array.from({length:35},(_,i)=>i),'the selected exception has its own stable indices');
 const after=await detail(first);assert.deepEqual(after.atAdmission,before.atAdmission);assert.deepEqual(after.event,before.event);assert.equal(after.occurrence,before.occurrence);assert.equal(after.currentLookup.length,30);
 const second=await send(input('b')),secondDetail=await detail(second);
 assert.ok(secondDetail.atAdmission.every(row=>row.status==='mapped'),'a capture after upload has original admission coordinates');
 for(const [id,release,build] of [['c','synthetic-spool-2','web'],['d','synthetic-spool-1','other']]){
  const captured=await send(input(id,release,build)),rows=await allPages(pathFor(await detail(captured)));
  for(const index of [0,30,999]){assert.equal(rows[index].status,'identity_mismatch');assert.equal(rows[index].original,undefined);assert.deepEqual(rows[index].generated,mapped[index].generated);}
 }
 const snapshot=(await archiveProjection(await req('/api/archive'))).data.events;
 await json(base+'/artifacts','POST',{release:'synthetic-spool-1',build:'web',debugId:'synthetic-spool-2',map});
 assert.deepEqual((await archiveProjection(await req('/api/archive'))).data.events,snapshot,'every occurrence identity and admission snapshot survives another late map');
 assert.equal((await json(pagePath(path))).rows[1].status,'mapped');
 await send(input('a'));assert.deepEqual((await archiveProjection(await req('/api/archive'))).data.events,snapshot,'replayed capture neither rewrites admission nor creates an occurrence');
 const packetPath=base+'/issues/'+issue+'/packet',packet=await json(packetPath),agent=await json(base+'/keys','POST',{kind:'agent'});
 const agentHeaders={Cookie:'',Authorization:'Bearer '+agent.key},agentPacket=await json(packetPath,'GET',undefined,agentHeaders);
 for(const value of [mapped,packet,agentPacket])for(const canary of ['PRIVATE_MAPPED_SOURCE','PRIVATE_MAPPED_LOCAL'])assert.ok(!JSON.stringify(value).includes(canary),'mapped pages and packets exclude source content and local variables');
 for(const row of packet.events){assert.equal(row.event.frames.length,30);assert.equal(row.currentLookup.length,30);assert.equal(row.atAdmission.length,30);}
 const firstPage=await json(pagePath(path)),cursor=firstPage.next;
 const refused=async(url,status,headers)=>{const response=await req(url,'GET',undefined,headers);assert.equal(response.status,status,url);await response.body?.cancel()};
 for(const selector of ['', '-1','1.5','01','2','NaN'])await refused(path+'&exception='+selector,400);
 for(const value of ['not-base64',btoa('{}'),btoa(JSON.stringify({...JSON.parse(atob(cursor)),start:9999}))])await refused(pagePath(path,0,value),400);
 await refused(pagePath(path,1,cursor),400);
 await refused(pagePath(pathFor(secondDetail),0,cursor),400);
 await refused(events+'/'+first+'/mapped-frames?exception=0',400);
 await refused(path.replace(before.occurrence,secondDetail.occurrence)+'&exception=0',404);
 await refused(pagePath(path).replace('/issues/'+issue,'/issues/synthetic-spool-unknown'),404);
 const other=await json('/api/projects','POST',{id:'synthetic-spool-mapped-other',name:'Other mapped project'});
 const foreignDsn=new URL(other.dsn),foreignInput=input('a');
 const foreign=await req(`/api${foreignDsn.pathname}/envelope/?sentry_key=${foreignDsn.username}&sentry_version=7`,'POST','{}\n{"type":"event"}\n'+JSON.stringify(foreignInput));assert.equal(foreign.status,200);await foreign.body?.cancel();
 const foreignIssue=(await json('/api/projects/'+other.id+'/issues'))[0].id,foreignEvents='/api/projects/'+other.id+'/issues/'+foreignIssue+'/events',foreignEvent=(await json(foreignEvents)).rows[0];
 await refused(pagePath(foreignEvents+'/'+first+'/mapped-frames?'+new URLSearchParams({occurrence:foreignEvent.occurrence}),0,cursor),400);
 await refused(pagePath(path),403,agentHeaders);
 await refused(pagePath(path),401,{Cookie:''});
 await refused(pagePath(path),401,{Cookie:'',Authorization:'Bearer '+project.ingestKey});
 const deploy=await json(base+'/keys','POST',{kind:'deploy'});await refused(pagePath(path),401,{Cookie:'',Authorization:'Bearer '+deploy.key});
 await json(base+'/keys/'+agent.hash,'DELETE');await refused(pagePath(path),401,agentHeaders);
 await mappedScreens({origin,cookie,project:project.id,issue,event:first,occurrence:before.occurrence,nextEvent:second});
 assert.deepEqual((await archiveProjection(await req('/api/archive'))).data.events.filter(row=>row.project===project.id),snapshot.filter(row=>row.project===project.id),'refused selectors mutate no retained evidence');
 await mappedMemberProof();
 console.log('PROBE ERR-005 retained pages: public Sentry envelope and current mapped-frame route -> 1,000 unique stored indices, originals through frame 1,000, explicit missing and mismatch reasons');
 console.log('PROBE ERR-005 late maps: public artifact upload and event reads -> every admission snapshot and occurrence unchanged; new captures mapped; replay unchanged');
 console.log('PROBE ERR-005 authority: malformed and cross-stack cursors, foreign selectors, project grants and removed native member -> refused without changing evidence');
 console.log('PROBE ERR-005 legacy privacy: owner and agent packets -> 30 diagnostic frames, no source content or frame locals');
}

async function mappedMemberProof() {
 // Native hosted admission uses the existing mail edge fixture; local dev
 // deliberately suppresses invitations and cannot qualify member sessions.
 const app=await runtime();
 try{
  const req=(path,method='GET',body,headers={})=>app.call(path,body,{Cookie:app.cookie,...headers},method);
  const json=async(...args)=>{const response=await req(...args);assert.ok(response.ok,args[0]+' HTTP '+response.status);return response.json()};
  await json('/api/organization','POST',{id:'synthetic-spool-mapped',name:'Mapped team'});
  const projects=[];for(const id of ['synthetic-spool-mapped','synthetic-spool-other'])projects.push(await json('/api/projects','POST',{id,name:id}));
  const event={event_id:'f'.repeat(32),platform:'javascript',release:'synthetic-spool-1',dist:'web',exception:{values:[{type:'MappedMemberError',value:'synthetic-spool-1',stacktrace:{frames:Array.from({length:40},(_,i)=>({filename:'https://synthetic-spool.example/app.js',lineno:i+1,colno:1,function:'checkout'}))}}]},debug_meta:{images:[{type:'sourcemap',code_file:'https://synthetic-spool.example/app.js',debug_id:'synthetic-spool-1'}]}};
  const paths=[];
  for(const project of projects){
   const base='/api/projects/'+project.id,dsn=new URL(project.dsn);
   await json(base+'/releases','POST',{name:event.release,build:event.dist});
   await json(base+'/artifacts','POST',{release:event.release,build:event.dist,debugId:'synthetic-spool-1',map:{version:3,sources:['checkout.ts'],names:[],mappings:'AAAA'+';AACA'.repeat(39)}});
   const accepted=await req(`/api${dsn.pathname}/store/?sentry_key=${dsn.username}&sentry_version=7`,'POST',event);assert.equal(accepted.status,200,await accepted.text());
   const issue=(await json(base+'/issues'))[0].id,events=base+'/issues/'+issue+'/events',row=(await json(events)).rows[0];
   paths.push(events+'/'+row.id+'/mapped-frames?'+new URLSearchParams({occurrence:row.occurrence,exception:'0'}));
  }
  const snapshot=(await archiveProjection(await req('/api/archive'))).data.events;
  const email=['synthetic-spool-mapped','example.test'].join('@'),previousIds=(await legacyMailRows(app.origin)).map(row=>row.id);
  await json('/api/organization/invites','POST',{email,name:'Mapped reader',role:'read-only',grants:[{project:projects[0].id,role:'read-only'}]});
  const cookie=await confirmEmailLink(app.origin,email,{previousIds}),headers={Cookie:cookie};
  const first=await json(paths[0],'GET',undefined,headers);assert.equal(first.rows[0].original.line,1);assert.equal(first.rows.length,30);
  const next=paths[0]+'&'+new URLSearchParams({cursor:first.next});assert.equal((await json(next,'GET',undefined,headers)).rows.at(-1).original.line,40);
  const foreign=await req(paths[1],'GET',undefined,headers);assert.equal(foreign.status,404);await foreign.body?.cancel();
  const member=(await json('/api/organization')).members.find(row=>row.email===email);
  await json('/api/organization/members/'+member.id,'DELETE',{version:member.version});
  for(const path of [paths[0],next]){const denied=await req(path,'GET',undefined,headers);assert.equal(denied.status,401);await denied.body?.cancel()}
  assert.equal((await json(paths[0])).rows[0].original.line,1,'the current owner retains access');
  assert.deepEqual((await archiveProjection(await req('/api/archive'))).data.events,snapshot,'foreign and removed-member reads change no stored evidence');
 }finally{await app.close()}
}

async function mappedScreens({origin,cookie,project,issue,event,occurrence,nextEvent}) {
 const browser=await launchBrowser();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies(cookie.split('; ').map(value=>{const split=value.indexOf('=');return {name:value.slice(0,split),value:value.slice(split+1),url:origin.replace('http:','https:'),secure:true}}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/projects/'+project+'/issues/'+issue+'?'+new URLSearchParams({event,occurrence}));
  await expect(page.locator('[data-event-id]')).toHaveAttribute('data-event-id',event);
  const summary=page.locator('summary').filter({hasText:'Current source-map lookup · exception 1'});
  await summary.focus();await summary.press('Enter');
  const region=page.getByRole('region',{name:'Current source-map lookup for exception 1',exact:true});
  await expect(region.getByRole('status')).toHaveText('Frames 1–30 of 1000 · current lookup');
  await expect(region.locator('li').first()).toContainText('Original: checkout.ts:1:5');
  await expect(region).toContainText('Frame 7 hidden by __traceback_hide__');await expect(region).not.toContainText('synthetic_spool_7');
  const next=region.getByRole('button',{name:'Next frames',exact:true});await next.focus();await next.press('Enter');
  await expect(region.getByRole('status')).toHaveText('Frames 31–60 of 1000 · current lookup');
  await expect(region.locator('li').first()).toContainText('Frame 31');await expect(region.locator('li').first()).toContainText('Original: checkout.ts:31:5');
  await region.getByRole('button',{name:'Previous frames',exact:true}).click();await expect(region.getByRole('status')).toHaveText('Frames 1–30 of 1000 · current lookup');
  await page.route('**/mapped-frames?**',route=>route.abort('failed'));
  await region.getByRole('button',{name:'Refresh lookup',exact:true}).click();await expect(region.getByRole('alert')).toContainText('Retained lookup below is stale.');
  await page.unroute('**/mapped-frames?**');await region.getByRole('button',{name:'Refresh lookup',exact:true}).click();await expect(region.getByRole('alert')).toHaveCount(0);
  await expect(region.getByRole('status')).toHaveText('Frames 1–30 of 1000 · current lookup');
  // Both exception selectors must resolve their own stored frame indices.
  // Paging one stack must not advance or replace the other stack's lookup.
  const wrapperSummary=page.locator('summary').filter({hasText:'Current source-map lookup · exception 2'});
  await wrapperSummary.focus();await wrapperSummary.press('Enter');
  const wrapper=page.getByRole('region',{name:'Current source-map lookup for exception 2',exact:true});
  await expect(wrapper.getByRole('status')).toHaveText('Frames 1–30 of 35 · current lookup');
  await expect(wrapper.locator('li').first()).toContainText('Frame 1');await expect(wrapper.locator('li').first()).toContainText('Original: checkout.ts:31:5');
  const wrapperNext=wrapper.getByRole('button',{name:'Next frames',exact:true});await wrapperNext.focus();await wrapperNext.press('Enter');
  await expect(wrapper.getByRole('status')).toHaveText('Frames 31–35 of 35 · current lookup');
  await expect(wrapper.locator('li').last()).toContainText('Frame 35');await expect(wrapper.locator('li').last()).toContainText('Original: checkout.ts:65:5');
  await expect(wrapperNext).toBeDisabled();await expect(region.getByRole('status')).toHaveText('Frames 1–30 of 1000 · current lookup');
  await next.focus();await next.press('Enter');await expect(region.getByRole('status')).toHaveText('Frames 31–60 of 1000 · current lookup');
  await expect(wrapper.getByRole('status')).toHaveText('Frames 31–35 of 35 · current lookup');
  // Selecting another occurrence retires both old lookup pages and cursors.
  await page.getByRole('button',{name:'Next event',exact:true}).click();
  await expect(page.locator('[data-event-id]')).toHaveAttribute('data-event-id',nextEvent);
  await expect(region).not.toBeVisible();await expect(wrapper).not.toBeVisible();
  await summary.focus();await summary.press('Enter');
  await expect(region.getByRole('status')).toHaveText('Frames 1–30 of 1000 · current lookup');
  await expect(region.locator('li').first()).toContainText('Original: checkout.ts:1:5');
  await expect(region.getByRole('button',{name:'Previous frames',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Previous event',exact:true}).click();
  await expect(page.locator('[data-event-id]')).toHaveAttribute('data-event-id',event);
  await expect(region).not.toBeVisible();await summary.focus();await summary.press('Enter');
  await expect(region.getByRole('status')).toHaveText('Frames 1–30 of 1000 · current lookup');
  assert.deepEqual((await new AxeBuilder({page}).include('[aria-label="Current source-map lookup for exception 1"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(row=>row.id),[]);
  assert.equal(await region.locator('p,button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).every(n=>parseFloat(getComputedStyle(n).fontSize)>=13)),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'mapped frames reflow at the journey width');
  const folder=process.env.SPOOL_MAPPED_EVIDENCE||'.artifacts/mapped-frames';await mkdir(folder,{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await region.evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:resolve(folder,'mapped-frames-'+width+'.png')});}
  assert.deepEqual(errors,[]);await context.close();
  console.log('PROBE ERR-005 issue view: independent exception paging, occurrence selection reset, keyboard recovery and Axe passed at 1440; mapped screens captured at 1440 and 390');
 }finally{await browser.close()}
}
