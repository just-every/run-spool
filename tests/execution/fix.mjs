import assert from 'node:assert/strict';
const p='/api/projects/shop';
const workflow=async(app,issue,id)=>(await app.json(`${p}/fixes?issue=${issue}`)).workflows.find(row=>row.id===id);

// #17 without an owner credential: the exact grant can be approved, and the
// workflow stops there with no provider call and no receipt.
export async function awaitingConnection(app,github,{issue,reproducer,run}){
 const refused=await app.request(`${p}/fixes`,'POST',{reproducer:reproducer.id,run:reproducer.runs.find(r=>r.outcome==='not_reproduced').id,repository:'just-every/run-spool',flow:'checkout'});
 assert.equal(refused.status,409,'only a run Spool confirmed as reproduced can start a fix branch');await refused.body?.cancel();
 const proposed=await app.json(`${p}/fixes`,'POST',{reproducer:reproducer.id,run:run.id,repository:'just-every/run-spool',base:'main',flow:'checkout',durationMinutes:120});
 assert.equal(proposed.status,'proposed');assert.equal(proposed.connection.state,'not_configured');
 assert.deepEqual(proposed.grant.permissions,{contents:'write',pull_requests:'write',checks:'read'});
 assert.match(proposed.grant.branch,/^spool\/fix-[0-9a-f]{8}$/);assert.equal(proposed.grant.file.path,`.spool/reproducers/${reproducer.id}.json`);
 const cross=await fetch(app.origin+`${p}/fixes/${proposed.id}/approve`,{method:'POST',headers:{Cookie:app.cookie,Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({revision:proposed.revision})});
 assert.equal(cross.status,403,'approval requires a same-origin owner write');await cross.body?.cancel();
 const anonymous=await fetch(app.origin+`${p}/fixes?issue=${issue}`);assert.equal(anonymous.status,401);await anonymous.body?.cancel();
 const approved=await app.json(`${p}/fixes/${proposed.id}/approve`,'POST',{revision:proposed.revision});
 assert.equal(approved.status,'approved_awaiting_connection');assert.equal(approved.states.approved.expires-approved.states.approved.at,120*60_000,'the grant expires when approved');
 const waiting=await app.request(`${p}/fixes/${proposed.id}/advance`,'POST',{revision:approved.revision});assert.equal(waiting.status,409,'no fake success without a connection');
 const body=await waiting.json();assert.match(body.error,/awaiting connection/);
 assert.deepEqual([body.workflow.receipts.length,github.requests.length],[0,0],'no receipt and no provider request');
 return {id:proposed.id,status:approved.status,error:body.error};
}

// #17 with the owner's GitHub App: branch, data-only reproducer file, draft
// pull request, merged and deployed observed independently, every call receipted.
export async function connectedWorkflow(app,github,{issue,reproducer,run},id){
 const before=await workflow(app,issue,id);assert.equal(before.status,'approved');assert.equal(before.connection.state,'configured');
 const opened=await app.json(`${p}/fixes/${id}/advance`,'POST',{revision:before.revision});
 assert.equal(opened.status,'pull_request_open');const number=opened.states.pullRequest.number;
 assert.deepEqual(opened.receipts.map(r=>[r.step,r.outcome]),[['mint_token','succeeded'],['read_base','succeeded'],['create_branch','succeeded'],['commit_file','succeeded'],['open_draft_pull_request','succeeded'],['revoke_token','succeeded']]);
 assert.equal(github.live(),0,'the installation token was revoked');
 const minted=github.requests.find(r=>r.path.endsWith('/access_tokens'));assert.deepEqual(minted.body,{repositories:['run-spool'],permissions:{contents:'write',pull_requests:'write',checks:'read'}},'least privilege asked of GitHub');
 const file=github.file(opened.grant.branch,opened.grant.file.path),record=JSON.parse(file);
 assert.equal(github.sha256(file),opened.grant.file.sha256,'the committed file is exactly the approved one');
 assert.deepEqual([record.kind,record.call.input,record.run.outcome],['spool-reproducer',[{}],'reproduced']);
 assert.equal(github.state.pulls[number-1].draft,true);assert.equal(github.requests.filter(r=>r.method!=='GET'&&r.path.includes('/git/refs')).every(r=>/^refs\/heads\/spool\/fix-[0-9a-f]{8}$/.test(r.body.ref)),true,'only fix branches are written');assert.equal(github.state.refs.get('heads/main')===github.requests.find(r=>r.path.endsWith('/git/refs')).body.sha,true,'the base branch is unchanged');
 // A provider answer broader than the grant is refused and revoked unused.
 github.state.broaden=true;const broad=await app.request(`${p}/fixes/${id}/advance`,'POST',{revision:opened.revision});github.state.broaden=false;
 assert.equal(broad.status,409);const broadBody=await broad.json();
 assert.deepEqual(broadBody.workflow.receipts.slice(-3).map(r=>[r.step,r.outcome]),[['mint_token','succeeded'],['revoke_token','succeeded'],['mint_token','refused']]);assert.equal(github.live(),0);
 const proposedOnly=await workflow(app,issue,id);assert.equal(proposedOnly.states.merged,null,'merged is never inferred');
 // The owner merges on GitHub; Spool observes it through a receipt.
 const merge=github.merge(number),merged=await app.json(`${p}/fixes/${id}/advance`,'POST',{revision:broadBody.workflow.revision});
 assert.equal(merged.status,'merged');assert.equal(merged.states.merged.commit,merge);assert.equal(merged.states.merged.source,'provider_receipt');assert.equal(merged.states.deployed,null);
 assert.deepEqual(merged.ci.runs,[{name:'test',status:'completed',conclusion:'success'}]);
 return {merge,receipts:merged.receipts.length,states:Object.fromEntries(Object.entries(merged.states).map(([key,value])=>[key,value?'recorded':null]))};
}

export async function deployedWorkflow(app,issue,id,fixedRelease){
 const deployed=await workflow(app,issue,id);
 assert.equal(deployed.status,'deployed');assert.deepEqual([deployed.states.deployed.release,deployed.states.deployed.source],[fixedRelease,'deployment_manifest']);
 return deployed;
}

// An expired grant refuses the next step without contacting GitHub; renewal is a new approval.
export async function expiredGrant(app,github,{issue,reproducer,run}){
 const short=await app.json(`${p}/fixes`,'POST',{reproducer:reproducer.id,run:run.id,repository:'just-every/run-spool',flow:'checkout',durationMinutes:1});
 const approved=await app.json(`${p}/fixes/${short.id}/approve`,'POST',{revision:short.revision});
 assert.equal(approved.status,'pull_request_open','a connected approval opens the branch at once');
 return async()=>{
  const wait=approved.states.approved.expires-Date.now()+1000;if(wait>0)await new Promise(r=>setTimeout(r,wait));
  const requests=github.requests.length,current=await workflow(app,issue,short.id);
  const expired=await app.request(`${p}/fixes/${short.id}/advance`,'POST',{revision:current.revision});assert.equal(expired.status,409);
  const body=await expired.json();assert.equal(body.workflow.status,'grant_expired');
  assert.deepEqual([body.workflow.receipts.at(-1).outcome,body.workflow.receipts.at(-1).detail.sent],['refused',false]);
  assert.equal(github.requests.length,requests,'an expired grant sends nothing');
  const renewed=await app.json(`${p}/fixes/${short.id}/approve`,'POST',{revision:body.workflow.revision});assert.ok(renewed.states.approved.expires>Date.now());
  return {expired:body.workflow.status,renewed:renewed.status};
 };
}
