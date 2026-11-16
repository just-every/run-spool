import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { runtime, archive, restore } from './owner-erasure/helpers.mjs';
import { archiveText } from './agent-handoff/caps.mjs';

// Run directly, outside push Verify, under the brief's 1200-second alarm.
// GOV-003's 150,000-event door is absent on this main. Prove the public refusal
// above its actual cap, then time erasure at the largest admitted corpus. Never
// plant rows in D1, disable an admission trigger or call erasure internals.
const requestedVolume=150000,retainedVolume=10000;
let source,destination;
try {
 source=await runtime();
 const project='synthetic-spool-volume-27',value='synthetic-spool-volume-27'+String.fromCharCode(64)+'example.test';
 const created=await source.json('/api/projects',{id:project,name:'Synthetic volume'} ,201),dsn=new URL(created.dsn);
 const capture=await source.call(`/api${dsn.pathname}/store/?sentry_key=${dsn.username}&sentry_version=7`,{event_id:'a'.repeat(32),message:'synthetic-spool-volume',user:{id:'synthetic-spool-volume-person',email:value}},{});
 assert.equal(capture.status,200);await capture.arrayBuffer();
 const snapshot=await archive(source),seed=snapshot.data.events[0],identity=snapshot.data.event_identities[0],base=JSON.parse(seed.payload);
 const grow=async count=>{
  const data=structuredClone(snapshot.data),start=Date.now()-count*1000;
  data.events=Array.from({length:count},(_,n)=>{const id=n.toString(16).padStart(32,'0'),payload=JSON.stringify({...base,eventId:id});return {...seed,id,payload,digest:createHash('sha256').update(payload).digest('hex'),received:start+n*1000,occurrence:crypto.randomUUID()}});
  data.event_identities=data.events.map(event=>({...identity,event:event.id,occurrence:event.occurrence}));
  data.issues[0].count=count;data.issues[0].first_seen=start;data.issues[0].last_seen=data.events.at(-1).received;
  return archiveText(snapshot,data);
 };
 destination=await runtime();
 const refused=await restore(destination,await grow(retainedVolume+1));
 assert.equal(refused.status,400,'the public restore refuses volume above the retained cap');
 assert.deepEqual(await destination.json('/api/projects'),[],'refused over-cap restore leaves no project');
 const restored=await restore(destination,await grow(retainedVolume));assert.equal(restored.status,200,JSON.stringify(restored));
 const root='/api/projects/'+project+'/end-user-erasure',selection={field:'email',value,action:'remove_identity'};
 const preview=await destination.json(root+'/preview',selection);assert.equal(preview.events.count,retainedVolume);assert.equal(preview.events.retained,retainedVolume);
 const start=performance.now(),receipt=await destination.json(root+'/confirm',{...selection,planHash:preview.planHash,confirm:'ERASE USER DATA'}),completionMs=performance.now()-start;
 assert.equal(receipt.phase,'complete');assert.equal(receipt.deleted.event_identities,retainedVolume);assert.ok(completionMs<300000&&receipt.seconds<300,'admitted-volume erasure completes within five minutes');
 const after=await destination.json(root+'/preview',selection);assert.equal(after.events.count,0);assert.equal(after.events.retained,retainedVolume);
 const issues=await destination.json('/api/projects/'+project+'/issues');assert.equal(issues.reduce((n,row)=>n+row.count,0),retainedVolume);
 const visible=await destination.json('/api/projects/'+project+'/issues/'+seed.issue+'/affected-users');assert.equal(visible.affectedUsers,null);assert.equal(visible.unattributed,retainedVolume);
 const result={requestedVolume,requestedVolumeProof:'unavailable: public restore refuses corpus above retained cap',overCap:{attempted:retainedVolume+1,status:refused.status,error:refused.body.error},admittedVolume:retainedVolume,before:{retained:preview.events.retained,matched:preview.events.count},after:{retained:after.events.retained,matched:after.events.count},completionMs,receipt};
 assert.ok(!JSON.stringify(result).includes(value));
 await mkdir('.artifacts/erasure-preview',{recursive:true});await writeFile('.artifacts/erasure-preview/volume.json',JSON.stringify(result,null,2)+'\n');
 console.log('PROBE SDK-027 volume: '+JSON.stringify({requestedVolume,admittedVolume:retainedVolume,overCapStatus:refused.status,completionMs,receiptSeconds:receipt.seconds,claim:'PARTIAL; acceptance point 5 unproven'}));
} finally {await destination?.close();await source?.close()}
