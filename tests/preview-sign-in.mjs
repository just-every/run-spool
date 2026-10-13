import assert from 'node:assert/strict';
import {assertSignInForm,openGate,outboxFetch} from './auth.mjs';

// Read only the public listing before stopping dev, so preview must supply a
// new message. Message identities and private command output stay in memory.
export async function outboxMessageIds(origin) {
 try {
  const response=await outboxFetch(origin);
  assert.equal(response.status,200,'public development outbox is available');
  const html=await response.text();
  const ids=new Set([...html.matchAll(/\?message=([^"&]+)"/g)].map(match=>decodeURIComponent(match[1])));
  assert.ok(ids.size>0,'dev has ordinary sign-in messages before preview');
  return ids;
 } catch {throw new Error('Outbox snapshot failed; private auth details withheld');}
}

// Consume the ordinary link requested by rer preview. This is deliberately
// separate from firstProjectJourney's fresh native form POST at both widths.
export async function browserPreviewSignIn(page,origin,output,before) {
 let magicLinkRequests=0;
 const observe=request=>{if(new URL(request.url()).pathname==='/auth/magic-link')magicLinkRequests++;};
 page.on('request',observe);
 try {
  const ready=output.split('\n').flatMap(line=>{try{const event=JSON.parse(line);return event.event==='ready'?[event]:[];}catch{return [];}});
  assert.equal(ready.length,1,'preview prints one health-gated ready event');
  assert.equal(ready[0].url===origin&&ready[0].signInUrl===origin+'/__dev/outbox',true,'preview prints its public outbox URL');
  await page.goto(origin+'/sign-in');await assertSignInForm(page);
  assert.equal((await page.context().request.get(origin+'/api/projects')).status(),401,'preview browser starts unauthenticated');
  await openGate(page.context(),origin);
  await page.goto(ready[0].signInUrl);
  const message=page.getByRole('link',{name:'Read message',exact:true}).first();
  const id=new URL(await message.getAttribute('href'),origin).searchParams.get('message');
  assert.ok(id&&!before.has(id),'preview supplies a fresh ordinary outbox message');
  await message.click();
  const opened=page.waitForResponse(response=>new URL(response.url()).pathname==='/auth/confirm'&&response.request().method()==='GET');
  await page.getByRole('link',{name:'Open this link',exact:true}).click();
  assert.equal((await opened).status(),200,'fresh preview link opens its confirmation document');
  assert.equal((await page.context().request.get(origin+'/api/projects')).status(),401,'confirmation GET does not establish an owner session');
  const nativeForm=await page.locator('form[action="/auth/confirm"]').evaluate(form=>form.method.toLowerCase()==='post'&&new URL(form.action).origin===location.origin);
  assert.equal(nativeForm,true,'preview confirmation uses a same-origin native POST form');
  const confirmed=page.waitForResponse(response=>new URL(response.url()).pathname==='/auth/confirm'&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  const response=await confirmed;
  assert.equal(response.status(),303,'native preview confirmation establishes the owner session once');
  assert.equal(response.headers().location==='/setup',true,'preview confirmation preserves the native owner destination');
  await page.waitForURL(origin+'/');
  assert.equal((await page.context().request.get(origin+'/api/projects')).status(),200,'confirmed preview owner can read private projects');
  await page.goto(ready[0].signInUrl);
  assert.equal(new URL(await message.getAttribute('href'),origin).searchParams.get('message')===id,true,'reuse checks the same preview message');
  await message.click();
  const reused=page.waitForResponse(response=>new URL(response.url()).pathname==='/auth/confirm'&&response.request().method()==='GET');
  await page.getByRole('link',{name:'Open this link',exact:true}).click();
  assert.equal((await reused).status(),400,'consumed preview confirmation cannot be reused');
  await page.goto(origin+'/');
  assert.equal(magicLinkRequests,0,'preview sign-in consumes its CLI message without requesting another link');
 } catch {throw new Error('Preview outbox sign-in journey failed; private auth details withheld');}
 finally {page.off('request',observe);}
}
