import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { sentryOrganization } from '../../scripts/fixtures/sentry-organization.mjs';
import { exportCapture, nextPage } from '../../scripts/sentry-export.mjs';

export async function schemaPages() {
 for(const profile of ['baseline','scaled']) {
  const original=sentryOrganization(profile);
  assert.deepEqual(sentryOrganization(profile),original,'fixed fixture generation has no clock or random input');
  const expected=exportCapture(original);
  const routes=new Map(original.collections.flatMap(c=>c.responses.map(p=>[new URL(p.url).pathname+new URL(p.url).search,p])));
  let origin;
  const server=createServer((req,res)=>{
   const page=routes.get(req.url);if(!page){res.writeHead(404);res.end();return}
   res.writeHead(page.status,{'Content-Type':'application/json',...page.link?{Link:page.link.replaceAll('https://sentry.invalid',origin)}:{}});res.end(page.body);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
  try {
   const acquired=structuredClone(original);
   for(const collection of acquired.collections) {
    const singles=['events','ownership'].includes(collection.kind),responses=[];
    let next=new URL(collection.responses[0].url.replace('https://sentry.invalid',origin));
    for(let page=0;next;page++) {
     assert.ok(page<1000,'bounded API acquisition');
     const response=await fetch(next,{redirect:'error'});assert.equal(response.status,200);
     const body=await response.text(),link=response.headers.get('link');responses.push({url:next.href,status:response.status,body,...link?{link}:{}});
     next=singles?(collection.kind==='events'&&collection.responses[page+1]?new URL(collection.responses[page+1].url.replace('https://sentry.invalid',origin)):null):nextPage(link,next);
    }
    collection.responses=responses;
   }
   assert.deepEqual(exportCapture(acquired),expected,'locally acquired documented responses preserve exact body hashes and accounting');
  } finally {await new Promise(resolve=>server.close(resolve))}
 }
 const source=sentryOrganization();
 const refusal=(edit,pattern)=>{const bad=structuredClone(source);edit(bad);assert.throws(()=>exportCapture(bad),pattern)};
 refusal(c=>c.collections[0].responses.pop(),/incomplete_page_chain/);
 refusal(c=>c.collections[0].responses[0].link=c.collections[0].responses[0].link.replace('sentry.invalid','elsewhere.invalid'),/cross_scope_link/);
 refusal(c=>c.collections[0].responses[0].link=c.collections[0].responses[0].link.replace('results="true"','results="false"'),/incomplete_page_chain/);
 refusal(c=>c.collections[0].responses[1].url=c.collections[0].responses[0].url,/repeated_page/);
 refusal(c=>c.collections[0].responses[0].body='[',/invalid_json/);
 refusal(c=>c.collections[0].responses[0].status=403,/http_response/);
 refusal(c=>c.collections[0].kind='not-a-sentry-endpoint',/unsupported_collection_scope|endpoint_mismatch/);
 const key=source.collections.find(c=>c.kind==='keys').responses[0],rows=JSON.parse(key.body),secret='local-'+Array.from({length:32},(_,i)=>String.fromCharCode(65+i%26)).join('');
 rows[0].secret=secret;rows[0].dsn.secret='https://synthetic:'+secret+'@ingest.invalid/42?access_token='+secret;key.body=JSON.stringify(rows);
 const redacted=exportCapture(source);
 assert.ok(!JSON.stringify(redacted).includes(secret),'credential is removed before an upload can be constructed');
 assert.ok(redacted.receipt.redactions.some(r=>r.path.endsWith('/secret')));
 rows[0].reflection=secret;key.body=JSON.stringify(rows);
 const reflected=exportCapture(source);assert.ok(!JSON.stringify(reflected).includes(secret));
 assert.ok(reflected.receipt.redactions.some(r=>r.path.endsWith('/reflection')),'reflected values are removed and named before upload');
 rows[0][secret]='unsafe key';key.body=JSON.stringify(rows);assert.throws(()=>exportCapture(source),/reflected_credential_key/);
 const across=sentryOrganization(),later=across.collections.find(c=>c.kind==='keys').responses[0];
 const laterRows=JSON.parse(later.body);laterRows[0].secret=secret;later.body=JSON.stringify(laterRows);
 const earlier=across.collections.find(c=>c.kind==='projects').responses[0],earlierRows=JSON.parse(earlier.body);
 earlierRows[0].name='Repeated '+encodeURIComponent(secret);earlier.body=JSON.stringify(earlierRows);
 const scrubbed=exportCapture(across);
 assert.equal(scrubbed.bundle.collections.find(c=>c.kind==='projects').pages[0].response[0].name,'[removed]','a credential discovered later is removed from earlier responses');
 assert.ok(scrubbed.receipt.redactions.some(row=>row.path.endsWith('/name')));
 across.organization.id=secret;
 assert.throws(()=>exportCapture(across),/reflected_credential_metadata/,'metadata cannot retain credentials removed from response pages');
 console.log('Sentry schemaPages: deterministic local API acquisition, opaque Link completion, singleton responses and pre-upload redaction passed.');
}
