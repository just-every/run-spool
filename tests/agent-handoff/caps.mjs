import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalize} from '../../src/domain/privacy.ts';
import {makePart} from '../../src/modules/portability/index.mjs';
import {ContentVerifier,ArchiveVerifier} from '../../src/modules/portability/format.mjs';
import {bounded,gap} from './packet.mjs';
// Grow a real public archive, then restore it into an empty installation. This
// bypasses no admission logic and does not consume 84 live minute windows.
export async function archiveText(snapshot,data){
 const items=[];const manifest={...snapshot.manifest,payloads:[],sourceIdentity:crypto.randomUUID(),epoch:0,journal:[],exportedAt:new Date().toISOString(),tables:snapshot.manifest.tables.map(table=>({...table,count:data[table.name].length}))};
 for(const table of manifest.tables)for(const [index,row] of data[table.name].entries())items.push({kind:'row',table:table.name,index,row,...table.rowidAlias?{rowid:index+1}:{}});
 const parts=[];for(let n=0;n<items.length;n+=100)parts.push(await makePart(parts.length,items.slice(n,n+100)));
 manifest.partCount=parts.length;const verifier=new ContentVerifier(manifest),binding=new ArchiveVerifier(manifest);for(const part of parts){binding.add(part);for(const item of part.items)verifier.add(item);}
 return [manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:verifier.digest(),archiveHash:binding.digest()}].map(row=>JSON.stringify(row)).join('\n')+'\n';
}
export async function capArchive(app,issue){
 const snapshot=await app.archive(),data=structuredClone(snapshot.data);
 // Keep one captured native issue/project with its registered releases and
 // maps. Clear unrelated history rather than inventing a second application.
 const seed=data.events.find(row=>row.project==='a'&&row.issue===issue),group=data.issues.find(row=>row.id===issue);assert.ok(seed&&group);
 for(const [table,rows] of Object.entries(data))data[table]=rows.filter(row=>table==='projects'?row.id==='a':row.project==='a');
 // This cap fixture replaces all occurrences and drops unrelated issues; their
 // proposal investigation history cannot name the replacement corpus. The
 // unmodified proposal round trip is covered by operator-flow/product-runtime.
 data.grouping_proposals=[];
 // The replacement corpus keeps no collaborative decisions from dropped issues.
 for(const table of ['issue_activity','issue_comments','issue_subscriptions','issue_suppressions','issue_recurrence_boundaries'])data[table]=data[table].filter(row=>row.issue===issue);
 data.issues=[group];data.issue_resolutions=data.issue_resolutions.filter(row=>row.issue===issue);
 // Dropped issues take their short IDs with them; the kept issue keeps its own (TEAM-004).
 data.issue_short_ids=data.issue_short_ids.filter(row=>row.issue===issue&&row.assigned===issue);data.issue_short_id_moves=[];data.alerts=data.alerts.filter(row=>row.issue===issue);data.alert_rules=[];data.alert_history=[];
 // Capture facts follow the retained issue; excluded issues cannot leave
 // dangling history in this intentionally sliced archive.
 data.audit=data.audit.filter(row=>!row.kind.startsWith('alert_')&&(!['capture_history_started','capture_unsuppressed'].includes(row.kind)||JSON.parse(row.detail).issue===issue));
 // Historical delivery rows are a supported archive surface. They carry
 // private routing labels and a stored delivery body URL; no provider is called.
 const alert=data.alerts[0];assert.ok(alert);for(const row of data.alerts){const payload=JSON.parse(row.payload);payload.issueUrl=`https://handoff-delivery-body.example/?project=a&issue=${row.issue}`;row.payload=JSON.stringify(payload);}
 for(const [channel,destination] of [['mail','HANDOFF_ALERT_RECIPIENT'],['webhook','HANDOFF_WEBHOOK_TARGET']]){
  const id='handoff-history-'+channel;data.alert_rules.push({id,project:'a',revision:1,name:'Imported historical destination',enabled:0,channel,destination,kinds:JSON.stringify(['new_issue']),window_ms:60000,threshold:2,created:alert.created,updated:alert.created});
  data.alert_history.push({id:alert.id+'.'+id+'.1',project:'a',alert_id:alert.id,rule_id:id,rule_revision:1,channel,destination,state:'accepted',code:null,attempts:1,created:alert.created,updated:alert.created,historical:1});
 }
 const base=JSON.parse(seed.payload),start=Date.now()-20000;let largeIssue;
 data.events=Array.from({length:10000},(_,n)=>{const id='cap-'+String(n).padStart(5,'0'),value={...base,eventId:id};return {...seed,id,payload:JSON.stringify(value),diagnostic:seed.diagnostic,digest:createHash('sha256').update(JSON.stringify(value)).digest('hex'),received:start+n,occurrence:crypto.randomUUID()};});
 group.count=data.events.length;group.first_seen=start;group.last_seen=start+9999;
 // Eight moderate multibyte events force removal before the count limit; one
 // very large valid event forces the legal zero-included case on its own issue.
 for(let n=9990;n<10000;n++){
  const row=data.events[n],payload=normalize({...base,eventId:row.id,message:'😀'.repeat(500),frames:Array.from({length:30},(_,i)=>i===0?(n===9999?{...base.frames[0],function:'oversizedPacket'}:base.frames[0]):{file:'https://app.example/'+('界'.repeat(300))+i+'.js',line:1,column:0,function:'界'.repeat(n===9999?1000:250)}),breadcrumbs:Array.from({length:20},()=> '界'.repeat(1000))});
  if(n===9999){const fingerprint=createHash('sha256').update(JSON.stringify([payload.type,payload.frames[0].file,payload.frames[0].function,payload.frames[0].line])).digest('hex');largeIssue=createHash('sha256').update('a:'+fingerprint).digest('hex');data.issues.push({...group,id:largeIssue,fingerprint,state:'resolved',count:1,first_seen:row.received,last_seen:row.received,title:'TypeError: multibyte evidence'});row.issue=largeIssue;group.count=9999;group.last_seen=start+9998;}row.payload=JSON.stringify(payload);row.diagnostic=JSON.stringify(payload.frames.map(generated=>({generated,status:generated.debugId?'missing_artifact':'missing_debug_id'})));row.digest=createHash('sha256').update(row.payload).digest('hex');
 }
 for(let n=0;n<101;n++){
  const fingerprint=createHash('sha256').update(JSON.stringify(['TypeError','https://app.example/closed-'+n+'.js','closed',1])).digest('hex'),id=createHash('sha256').update('a:'+fingerprint).digest('hex'),at=start+20000+n;
  data.issues.push({...group,id,fingerprint,title:'Closed comparison '+n,state:'resolved',count:0,first_seen:at,last_seen:at});
  const source=data.alerts.find(row=>row.kind==='regression')??data.alerts[0],alertId='closed-alert-'+n,payload=JSON.parse(source.payload);
  data.alerts.push({...source,id:alertId,issue:id,kind:'regression',created:at,payload:JSON.stringify({...payload,alertId,issueId:id,kind:'regression',occurredAt:new Date(at).toISOString(),title:'Closed comparison '+n,issueUrl:'https://handoff-delivery-body.example/?project=a&issue='+id})});
 }
 // Retention can leave an open issue without its old feed attention. Give
 // the historical delivery witness to an acknowledged issue so it remains a
 // real private owner row without promoting the older open query witness.
 const deliveryIssue=data.issues[2];deliveryIssue.state='acknowledged';
 for(const row of data.alerts.filter(row=>row.issue===issue)){row.issue=deliveryIssue.id;const payload=JSON.parse(row.payload);payload.issueId=deliveryIssue.id;payload.issueUrl='https://handoff-delivery-body.example/?project=a&issue='+deliveryIssue.id;row.payload=JSON.stringify(payload);}
 data.issue_priorities=data.issues.map(row=>({project:row.project,issue:row.id,automatic:3,manual:null}));
  const text=await archiveText(snapshot,data),poisoned=structuredClone(data);const privateBody=JSON.parse(poisoned.alerts[0].payload);privateBody.deliveryBody='HANDOFF_UNKNOWN_FIELD_CANARY';poisoned.alerts[0].payload=JSON.stringify(privateBody);return {text,invalidText:await archiveText(snapshot,poisoned),issue,largeIssue,deliveryIssue:deliveryIssue.id,sample:{...base,eventId:'over-cap'}};
}
export async function capProof(app,{issue,largeIssue,deliveryIssue,sample}){
 const ownerIssues=await app.json('/api/projects/a/issues');assert.ok(!ownerIssues.some(row=>row.id===issue),'older open issue lies outside the bounded unfiltered list');const openIssues=await app.json('/api/projects/a/issues?state=open&limit=1');assert.equal(openIssues.length,1);assert.equal(openIssues[0].id,issue,'filter applied before list bound');
 const grant=await app.json('/api/projects/a/keys','POST',{kind:'agent'}),path='/api/projects/a/issues/'+issue+'/packet';
 const {cli,clientEnvironment,mcpClient}=await import('./clients.mjs');const {noSecrets}=await import('./packet.mjs');const openCommand=await cli(['issues','--state','open','--limit','1'],clientEnvironment(app,grant.key));assert.equal(openCommand.code,0);assert.ok(openCommand.stdout.includes(issue),'CLI finds older open issue beyond unfiltered bound');noSecrets(openCommand.stdout+openCommand.stderr);const privatePacket=await cli(['packet',deliveryIssue,'--format','json'],clientEnvironment(app,grant.key));assert.equal(privatePacket.code,0);noSecrets(privatePacket.stdout+privatePacket.stderr);const mcp=await mcpClient(app,grant.key);try{const result=await mcp.call('get_packet',{issue:deliveryIssue});assert.ok(!result.isError);noSecrets(result);}finally{await mcp.close();}
 const ownerDeliveries=await app.json('/api/projects/a/alerting/deliveries');for(const canary of ['HANDOFF_ALERT_RECIPIENT','HANDOFF_WEBHOOK_TARGET'])assert.ok(JSON.stringify(ownerDeliveries).includes(canary),'canary exists in owner delivery rows');const ownerAlerts=await app.json('/api/projects/a/alerts');assert.ok(JSON.stringify(ownerAlerts).includes('handoff-delivery-body'),'canary exists in stored owner alert body');for(const route of ['/api/projects/a/alerts','/api/projects/a/issues',path,'/api/projects/a/issues/'+deliveryIssue+'/packet']){const value=await app.json(route,'GET',undefined,{agent:grant.key});const {noSecrets}=await import('./packet.mjs');noSecrets(value);}for(const route of ['/api/projects/a/alerting/deliveries','/api/projects/a/alerting/rules'])assert.equal((await app.request(route,'GET',undefined,{agent:grant.key})).status,403);
 const packet=await app.json(path,'GET',undefined,{agent:grant.key});const measured=bounded(packet);gap(packet,/events_omitted/);assert.equal(packet.bounds.availableEvents,9999);assert.equal(packet.bounds.includedEvents,packet.events.length);assert.equal(packet.bounds.omittedEvents,9999-packet.events.length);assert.ok(packet.events.length>0,'newest bounded event fits and survives');assert.ok(packet.events.length<packet.bounds.eventLimit,'byte cap removes events beyond count cap');
 if(packet.events.length){assert.equal(packet.events[0].id,'cap-09998');for(let n=1;n<packet.events.length;n++)assert.ok(packet.events[n-1].received>=packet.events[n].received);}else assert.equal(packet.bounds.omittedEvents,9999,'all-events-removed gap includes complete count');
 const large=await app.json('/api/projects/a/issues/'+largeIssue+'/packet','GET',undefined,{agent:grant.key});bounded(large);assert.equal(large.events.length,0);assert.equal(gap(large,/events_omitted/).available,1);
 const ingest=await app.json('/api/projects/a/keys','POST',{kind:'ingest'});const payload=sample;
 const rejected=await app.request('/api/ingest/a','POST',payload,{agent:ingest.key});assert.equal(rejected.status,429);assert.equal((await rejected.json()).reason,'retained_event_budget');
 const after=await app.json(path,'GET',undefined,{agent:grant.key});assert.ok(gap(after,/windowed_loss/).rows.some(row=>row.reason==='budget'&&row.count>0));
 return {...measured,included:packet.events.length,available:packet.bounds.availableEvents};
}
