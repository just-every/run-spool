import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { runtime, archive, restore } from './owner-erasure/helpers.mjs';
import { archiveText } from './agent-handoff/caps.mjs';

// Run the committed journey outside push Verify under a hard 2400-second alarm.
// A restore admission refusal is not an erasure-fence proof. Keep the requested
// corpus and fallback explicit; never plant product rows or bypass capacity.
const requestedVolume=150000,profileOnly=process.argv.includes('--profile-10000');
const candidate=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.RER_CANDIDATE_SHA)assert.equal(candidate,process.env.RER_CANDIDATE_SHA,'scale receipt must name the checked-out candidate');
const runId=process.env.RER_SCALE_RUN_ID??'sd-spool-sdk027-3-'+new Date().toISOString().replace(/[-:]/g,'');
const startedAt=new Date().toISOString();
let retainedVolume=10000;
let source,destination;
try {
 source=await runtime();
 const project='synthetic-spool-volume-27',value='synthetic-spool-volume-27'+String.fromCharCode(64)+'example.test';
 const created=await source.json('/api/projects',{id:project,name:'Synthetic volume'} ,201),dsn=new URL(created.dsn);
 const capture=await source.call(`/api${dsn.pathname}/store/?sentry_key=${dsn.username}&sentry_version=7`,{event_id:'a'.repeat(32),message:'synthetic-spool-volume saw synthetic-spool-volume-person',fingerprint:['synthetic-spool-volume-27'],breadcrumbs:[{message:'captured synthetic-spool-volume-person'}],user:{id:'synthetic-spool-volume-person',email:value},tags:{identity_copy:'synthetic-spool-volume-person',ordinary:'synthetic-spool-safe'}},{});
 assert.equal(capture.status,200);await capture.arrayBuffer();
 const snapshot=await archive(source);
 for(const table of snapshot.manifest.tables)snapshot.data[table.name]??=[];
 const seed=snapshot.data.events[0],identity=snapshot.data.event_identities[0],base=JSON.parse(seed.payload);
 const grow=async count=>{
  const data=structuredClone(snapshot.data),start=Date.now()-count*1000;
  data.events=Array.from({length:count},(_,n)=>{const id=n.toString(16).padStart(32,'0'),payload=JSON.stringify({...base,eventId:id});return {...seed,id,payload,digest:createHash('sha256').update(payload).digest('hex'),received:start+n*1000,occurrence:crypto.randomUUID()}});
  data.event_identities=data.events.map(event=>({...identity,event:event.id,occurrence:event.occurrence}));
  data.issues[0].count=count;data.issues[0].first_seen=start;data.issues[0].last_seen=data.events.at(-1).received;
  return archiveText(snapshot,data);
 };
 destination=await runtime();
 const restoreStart=performance.now();
 const requested=profileOnly?null:await restore(destination,await grow(requestedVolume));
 const requestedRestoreMs=performance.now()-restoreStart;
 if(requested?.status===200)retainedVolume=requestedVolume;
 else {
  if(requested){assert.equal(requested.status,400,JSON.stringify(requested));assert.deepEqual(await destination.json('/api/projects'),[],'refused large restore leaves no project')}
  const restored=await restore(destination,await grow(retainedVolume));assert.equal(restored.status,200,JSON.stringify(restored));
 }
 console.log('SCALE_ADMISSION '+JSON.stringify({candidate,runId,requestedVolume,attempted:!profileOnly,status:requested?.status??null,error:requested?.body.error??null,requestedRestoreMs,retainedVolume}));
 const root='/api/projects/'+project+'/end-user-erasure',selection={field:'email',value,action:'remove_identity'};
 const preview=await destination.json(root+'/preview',selection);assert.equal(preview.events.count,retainedVolume);assert.equal(preview.events.retained,retainedVolume);assert.equal(preview.search.count,retainedVolume);assert.equal(preview.capturedText.count,retainedVolume);
 const start=performance.now(),receipt=await destination.json(root+'/confirm',{...selection,planHash:preview.planHash,confirm:'ERASE USER DATA'}),completionMs=performance.now()-start;
 assert.equal(receipt.phase,'complete');assert.equal(receipt.deleted.event_identities,retainedVolume);assert.equal(receipt.deleted.search_tags,retainedVolume);assert.equal(receipt.deleted.captured_text_events,retainedVolume);assert.ok(completionMs<300000&&receipt.seconds<300,'admitted-volume erasure completes within five minutes');
 const after=await destination.json(root+'/preview',selection);assert.equal(after.events.count,0);assert.equal(after.events.retained,retainedVolume);
 const issues=await destination.json('/api/projects/'+project+'/issues');assert.equal(issues.reduce((n,row)=>n+row.count,0),retainedVolume);
 const visible=await destination.json('/api/projects/'+project+'/issues/'+seed.issue+'/affected-users');assert.equal(visible.affectedUsers,null);assert.equal(visible.unattributed,retainedVolume);
 const identitySearch=await destination.json('/api/projects/'+project+'/identity-search?field=user.email&value='+encodeURIComponent(value));assert.equal(identitySearch.matchingEvents,0);assert.deepEqual(identitySearch.facets,[]);
 const result={candidate,runId,startedAt,completedAt:new Date().toISOString(),requestedVolume,requestedVolumeProof:retainedVolume===requestedVolume?'admitted and timed':profileOnly?'not attempted in focused profiling run':'unavailable: public restore refuses corpus above retained cap',overCap:{attempted:!profileOnly,volume:requestedVolume,status:requested?.status??null,error:requested?.body.error??null,requestedRestoreMs},admittedVolume:retainedVolume,before:{retained:preview.events.retained,matched:preview.events.count},after:{retained:after.events.retained,matched:after.events.count},completionMs,receipt};
 assert.ok(!JSON.stringify(result).includes(value));
 await mkdir('.artifacts/erasure-preview',{recursive:true});await writeFile('.artifacts/erasure-preview/volume.json',JSON.stringify(result,null,2)+'\n');
 console.log('PROBE SDK-027 volume: '+JSON.stringify({requestedVolume,admittedVolume:retainedVolume,overCapStatus:requested?.status??null,completionMs,receiptSeconds:receipt.seconds,claim:retainedVolume===requestedVolume?'acceptance point 5 timed; other gaps remain':'PARTIAL; acceptance point 5 unproven'}));
} finally {await destination?.close();await source?.close()}
