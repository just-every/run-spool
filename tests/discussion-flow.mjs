import {openSection} from './navigation.mjs';
import {busyMemberWrites} from './busy-member-writes.mjs';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {legacyMailRows} from './legacy-mail.mjs';
import assert from 'node:assert/strict';

const status=async pending=>{const response=await pending;await response.arrayBuffer();return response.status;};
const denied=async pending=>assert.ok([401,403,404].includes(await status(pending)));

/** Extends the existing team journey after its shared-project grant change. */
export async function discussionFlow(owner,first,second,reader,projects,issues,billing,admin) {
 const root='/api/projects/'+projects[0].id,base=root+'/issues/'+issues[0].id;
 const outboxBefore=await legacyMailRows(owner.origin);
 const read=()=>first.json(base+'/discussion');
 let current=await read();
 const initialPriority=await first.json(base+'/priority');
 await denied(reader.req(base+'/priority','PUT',{priority:'low',version:initialPriority.version}));
 assert.equal((await read()).revision,current.revision,'read-only priority refusal does not mutate the issue');
 const priority=await first.json(base+'/priority','PUT',{priority:'low',version:initialPriority.version});
 assert.ok(priority);
 current=await read();
 assert.equal(await status(first.req(base+'/comments','POST',{revision:current.revision,body:'x'.repeat(4001)})),400);
 const longNote='Investigation detail. '.repeat(70);
 const created=await first.json(base+'/comments','POST',{revision:current.revision,body:longNote+'Investigating with @synthetic-spool-2. password=synthetic-spool-secret'});
 assert.equal(created.revision,current.revision+1);
 current=await read();
 const comment=current.comments.find(row=>row.id===created.id);assert.ok(comment);
 assert.ok(comment.body.startsWith(longNote),'a comment beyond the default scrubber bound is preserved');
 assert.ok(!comment.body.includes('synthetic-spool-secret'),'comments scrub secrets before storage');
 assert.equal(comment.mentions.length,1);assert.match(comment.mentions[0],/^audit:[a-f0-9]{32}$/);
 let recipient=await second.json(base+'/discussion');
 assert.equal(recipient.subscription.subscribed,true);assert.ok(recipient.subscription.reasons.includes('mention'));
 assert.equal(recipient.comments.find(row=>row.id===created.id).canEdit,false);
 await denied(second.req(base+'/comments/'+created.id,'PATCH',{revision:recipient.revision,version:created.version,body:'Cannot replace another member’s comment'}));
 const denialSnapshot=await read();
 const readerView=await reader.json(base+'/discussion');assert.equal(readerView.canWrite,false);
 await denied(reader.req(base+'/comments','POST',{revision:current.revision,body:'Reader cannot post'}));
 await denied(first.req('/api/projects/'+projects[1].id+'/issues/'+issues[1].id+'/discussion'));
 await denied(first.req(base+'/comments','POST',{revision:current.revision,body:'Cross origin'},{Origin:'https://foreign.example.test'}));
 await denied(owner.req(base+'/discussion','GET',undefined,{Authorization:'Bearer synthetic-spool-invalid'}));
 assert.deepEqual(await read(),denialSnapshot,'denied discussion writes cannot mutate comments, subscriptions, activity or revision');
 if(billing){const known=await billing.req(base+'/discussion'),unknown=await billing.req(base.replace(projects[0].id,'unknown-project')+'/discussion');assert.equal(known.status,404);assert.equal(unknown.status,404);assert.deepEqual(await known.json(),await unknown.json());}
 const plain=await first.json(base+'/comments','POST',{revision:current.revision,body:'@synthetic-spool-unknown @synthetic-spool-4'});
 current=await read();
 const plainComment=current.comments.find(row=>row.id===plain.id);
 assert.equal(plainComment.body,'@synthetic-spool-unknown @synthetic-spool-4');assert.deepEqual(plainComment.mentions,[],'unknown and inaccessible handles stay ordinary text');
 recipient=await second.json(base+'/discussion');
 await second.json(base+'/subscription','PUT',{revision:recipient.revision,subscribed:false,version:recipient.subscription.version});
 current=await read();
 const edited=await first.json(base+'/comments/'+created.id,'PATCH',{revision:current.revision,version:created.version,body:'Updated investigation with @synthetic-spool-2'});
 recipient=await second.json(base+'/discussion');
 assert.equal(recipient.subscription.subscribed,false,'later mentions respect explicit unsubscribe');
 assert.equal(recipient.subscription.explicit,'unsubscribed');
 await second.json(base+'/subscription','PUT',{revision:recipient.revision,subscribed:true,version:recipient.subscription.version});
 assert.equal((await second.json(base+'/discussion')).subscription.subscribed,true);
 current=await read();
 const race=await Promise.all([first,second].map(actor=>status(actor.req(base+'/comments','POST',{revision:current.revision,body:'Concurrent discussion'}))));
 assert.deepEqual(race.toSorted(),[201,201],'independent new comments do not conflict against the issue revision');
 current=await read();
 assert.equal(current.revision,recipient.revision+3);
 assert.ok(current.activity.some(row=>row.kind==='comment_added'&&row.actor_kind==='member'));
 assert.ok(current.activity.some(row=>row.kind==='comment_edited'));
 assert.ok(current.activity.some(row=>row.kind==='unsubscribed'));
 await (admin??owner).json(base+'/comments/'+created.id,'DELETE',{revision:current.revision,version:edited.version});
 current=await read();assert.ok(!current.comments.some(row=>row.id===created.id),'an administrator can delete a comment');
 const browser=await chromium.launch({headless:true});try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies(first.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:owner.origin.replace('http:','https:'),secure:true})));const page=await context.newPage();
  await page.goto(owner.origin+'/projects/'+projects[0].id+'/issues/'+issues[0].id);await page.getByLabel('Priority',{exact:true}).waitFor();await openSection(page,'Discussion');await page.getByLabel('Comment',{exact:true}).waitFor();
  await Promise.all([page.waitForResponse(response=>response.url().endsWith('/priority')&&response.ok()),page.waitForResponse(response=>response.url().endsWith('/discussion')&&response.ok()),page.getByLabel('Priority',{exact:true}).selectOption('medium')]);
  await page.getByLabel('Comment',{exact:true}).fill('Confirmation retries preserve the payment acknowledgment.');await Promise.all([page.waitForResponse(response=>response.url().endsWith('/comments')&&response.status()===201),page.getByRole('button',{name:'Post comment',exact:true}).click()]);
  const note=page.locator('.timeline li').filter({hasText:'Confirmation retries preserve the payment acknowledgment.'});await note.getByRole('button',{name:'Edit comment',exact:true}).click();await page.getByLabel('Edit comment',{exact:true}).fill('Confirmation retries preserve the payment acknowledgment after deployment.');await page.getByRole('button',{name:'Save comment',exact:true}).click();await page.getByText('Confirmation retries preserve the payment acknowledgment after deployment.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Unsubscribe',exact:true}).click();await page.getByRole('button',{name:'Subscribe',exact:true}).waitFor();await page.getByRole('button',{name:'Subscribe',exact:true}).click();await page.getByRole('button',{name:'Unsubscribe',exact:true}).waitFor();
  const accessibility=await new AxeBuilder({page}).include('.issue-page').analyze();assert.deepEqual(accessibility.violations.filter(row=>['serious','critical'].includes(row.impact)),[]);await context.close();
 }finally{await browser.close()}
 let bounded=await read();
 for(let index=bounded.comments.length;index<bounded.limit;index++){const note=await first.json(base+'/comments','POST',{revision:bounded.revision,body:'Retained investigation note '+index});bounded.revision=note.revision;}
 const atCapacity=await read();assert.equal(await status(first.req(base+'/comments','POST',{revision:atCapacity.revision,body:'Beyond capacity'})),409);assert.deepEqual(await read(),atCapacity,'comment capacity refusal changes nothing');
 const packet=JSON.stringify(await first.json(base+'/packet'));
 assert.ok(!packet.includes('Concurrent discussion'),'discussion stays outside evidence packets');
 assert.deepEqual(await legacyMailRows(owner.origin),outboxBefore,'discussion, mentions and subscriptions send nothing');
 await busyMemberWrites(owner,first,second,reader,projects[0]);
 console.log('[TEAM-003] member priority, scoped scrubbed discussion, mention subscriptions, explicit unsubscribe, author/admin moderation and stale-write refusal passed');
}
