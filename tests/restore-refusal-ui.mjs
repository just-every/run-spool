import assert from 'node:assert/strict';

async function restorePage(browser,origin,cookie) {
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:origin}]);
 const page=await context.newPage();await page.goto(origin+'/setup');await page.getByRole('button',{name:'Restore a private archive',exact:true}).click();return {context,page};
}
async function refuse(page,text,code) {
 await page.getByLabel('Archive to restore · max 16 MiB').setInputFiles({name:'private-archive.jsonl',mimeType:'application/x-ndjson',buffer:Buffer.from(text)});
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/restore'&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Restore into empty installation',exact:true}).click();const result=await response;assert.equal(result.status(),400);assert.equal((await result.json()).error,code,'The server keeps its refusal');
 const notice=page.getByRole('alert');await notice.waitFor();const message=await notice.innerText();assert.ok(!message.includes(code),'Restore notice hides its internal reason');assert.equal(await notice.getByRole('link',{name:/sign in again/i}).count(),0,'File refusal offers no unrelated sign-in action');return message;
}
async function screenshots(page,output,state) {
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:`${output}/restore-${state}-${width}.png`,fullPage:true});}await page.setViewportSize({width:1440,height:900});
}
export async function damagedRestoreUI(browser,origin,cookie,archive,output) {
 const {context,page}=await restorePage(browser,origin,cookie);
 try{
  const records=archive.trim().split('\n').map(JSON.parse);records.find(record=>record.kind==='part').sha256='0'.repeat(64);
  const message=await refuse(page,records.map(JSON.stringify).join('\n')+'\n','part_checksum');assert.match(message,/damaged|corrupt|incomplete/i);assert.match(message,/download|replace|another/i);
  assert.deepEqual(await(await context.request.get(origin+'/api/projects')).json(),[],'Damaged archive creates no projects');await screenshots(page,output,'damaged');
 }finally{await context.close();}
}
export async function erasedRestoreUI(browser,origin,cookie,archive,output) {
 const headers={Cookie:cookie,Origin:origin,'Content-Type':'application/json'};
 const request=async(path,method='GET',body)=>{const response=await fetch(origin+path,{method,headers,...body?{body:JSON.stringify(body)}:{}});assert.ok(response.ok,await response.clone().text());return response.json();};
 for(const project of await request('/api/projects')){const root='/api/projects/'+project.id+'/erasure',plan=await request(root);let receipt=await request(root,'POST',{confirm:project.id,planHash:plan.planHash});for(let attempt=0;receipt.phase!=='complete'&&attempt<100;attempt++)receipt=await request('/api/erasures/'+receipt.id+'/resume','POST',{});assert.equal(receipt.phase,'complete');}
 assert.deepEqual(await request('/api/projects'),[]);
 const {context,page}=await restorePage(browser,origin,cookie);
 try{
  const message=await refuse(page,archive,'erasure_epoch');assert.match(message,/erased/i);assert.match(message,/after erasure/i);assert.match(message,/new project/i);assert.deepEqual(await request('/api/projects'),[],'Pre-erasure archive creates no projects');await screenshots(page,output,'erased');
 }finally{await context.close();}
}
