import { assertAuditAppendOnly } from './owner-erasure/helpers.mjs';
import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runtime,successor,confirmLatest,snapshot,archive,eraseInput,restore } from './owner-erasure/helpers.mjs';
import { testOwner,testSetupToken } from './auth.mjs';
import { sentryExport } from './project-erasure/fixture.mjs';
import { sentryDoorClient } from '../scripts/sentry-import.mjs';
import { authorityRaces, heldScopes } from './owner-erasure-authority.mjs';
import { interruptedErasure } from './owner-erasure-resume.mjs';
import { interruptedFinalization } from './owner-erasure-finalization.mjs';
import { delayedRepairWrites, delayedOwnerWrites, delayedRestore } from './owner-erasure-inflight.mjs';
import { archiveFences } from './owner-erasure-archives.mjs';

const evidence={checks:[]};let app,fresh;
try {
 app=await runtime();
 const owner=await app.DB.prepare("SELECT * FROM oa_operators WHERE role='owner'").first();
 const other='Quinn Otherperson',otherId=randomUUID();
 await app.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES(?,?,?,'member','active',?)").bind(otherId,'quinn@spool.test',other,Date.now()).run();
 const sole=await app.json('/api/owner/erasure');assert.equal(sole.hold,'verified_successor_required');
 let before=await snapshot(app);
 assert.equal((await app.request('/api/owner/erasure',eraseInput(sole))).status,409);
 assertAuditAppendOnly(await snapshot(app),before,'sole owner refusal changes no data');
 // A mistyped first invitation is retired when the owner invites the real successor, so it cannot hold erasure.
 await app.json('/api/owner/erasure/successor',{email:'sucessor@spool.test',displayName:'Successor Person'},202);
 const next=await successor(app);
 assert.equal(await app.DB.prepare("SELECT 1 FROM oa_operators WHERE email='sucessor@spool.test'").first(),null,'replaced invitee is retired');
 // An accepted successor the owner replaced can be named again; the second naming retires the replacement.
 await app.json('/api/owner/erasure/successor',{email:'second@spool.test',displayName:'Second Person'},202);
 await app.json('/api/owner/erasure/successor',{email:next.email,displayName:'Successor Person'},202);
 next.cookie=await confirmLatest(app,next.email);
 assert.equal(await app.DB.prepare("SELECT 1 FROM oa_operators WHERE email='second@spool.test'").first(),null,'second replaced invitee is retired');
 // Other people's independent native sessions and tokens survive unchanged.
 // The successor's invitation session is intentionally retired; their later
 // independent magic session remains stored but is fenced by the role change.
 const otherCookies={};
 for(const email of ['quinn@spool.test',next.email]) {
  assert.equal((await app.call('/auth/magic-link',{email})).status,202);
  const cookie=await confirmLatest(app,email);assert.ok(cookie);otherCookies[email]=cookie;
 }
 const independent=await app.DB.prepare("SELECT s.* FROM oa_sessions s JOIN oa_tokens t ON t.id=s.source_token_id WHERE t.kind='magic' AND s.operator_id<>?").bind(owner.id).all();
 assert.equal(independent.results.length,2);
 const independentTokens=await app.DB.prepare("SELECT * FROM oa_tokens WHERE kind='magic' AND operator_id<>?").bind(owner.id).all();
 const project=await app.json('/api/projects',{id:'personal-capture',name:`Test owner and ${other}`},201);
 await app.json('/api/projects/personal-capture/releases',{name:'r1',build:'b1'},201);
 await app.json('/api/projects/personal-capture/artifacts',{release:'r1',build:'b1',debugId:'map',map:{version:3,sources:['src/app.js'],sourcesContent:[`Test owner / ${testOwner} / ${owner.id} / ${other}`],names:[],mappings:'AAAA'}},201);
 const event={version:1,eventId:'personal-event',release:'r1',build:'b1',environment:'test',type:'Error',message:`Test owner / ${owner.id} / ${other}`,frames:[{file:'https://app.test/a.js',line:1,column:0,function:'run',debugId:'map'}],breadcrumbs:[`Test owner and ${other}`]};
 const captured=await app.json('/api/ingest/personal-capture',event,201,{Authorization:'Bearer '+project.ingestKey});
 // [SDK-005] Session hashes and their private project key leave with installation-owner erasure.
 const sessionDsn=new URL(project.dsn),sessionValue={sid:randomUUID().replaceAll('-',''),started:new Date().toISOString(),status:'exited',did:'synthetic-spool-session-owner',attrs:{release:'r1',environment:'test'}};
 const sessionResponse=await fetch(app.origin+`/api/${sessionDsn.pathname.slice(1)}/envelope/?sentry_key=${sessionDsn.username}&sentry_version=7`,{method:'POST',headers:{Origin:app.origin,'Content-Type':'text/plain'},body:'{}\n{"type":"session"}\n'+JSON.stringify(sessionValue)});assert.equal(sessionResponse.status,200);assert.equal((await sessionResponse.json()).sessions.session_stored,1);
 // [SDK-008] Owner-selected identity, preview and key share the same erasure custody.
 const identityPolicy={id:'keep',email:'keep',username:'keep',ip_address:'keep'},identityPreview=await app.json('/api/projects/personal-capture/identity-policy/preview',{policy:identityPolicy});
 const identityWrite=await app.request('/api/projects/personal-capture/identity-policy',{policy:identityPolicy,revision:identityPreview.revision,token:identityPreview.token},{},'PUT');assert.equal(identityWrite.status,200);await identityWrite.body.cancel();
 const identityValue={event_id:randomUUID().replaceAll('-',''),release:'r1',dist:'b1',environment:'test',user:{email:testOwner},exception:{values:[{type:'IdentityError',value:'Owner identity custody',stacktrace:{frames:[{filename:'identity.js',lineno:1,colno:1,function:'capture'}]}}]}};
 const identityResponse=await fetch(app.origin+`/api/${sessionDsn.pathname.slice(1)}/envelope/?sentry_key=${sessionDsn.username}&sentry_version=7`,{method:'POST',headers:{Origin:app.origin,'Content-Type':'text/plain'},body:'{}\n{"type":"event"}\n'+JSON.stringify(identityValue)});assert.equal(identityResponse.status,200);await identityResponse.body.cancel();
 // [ALERT-002] Installation erasure removes reconnect-only Slack secrets.
 await app.json('/api/projects/personal-capture/alerting/destinations',{kind:'slack',label:'Synthetic owner Slack',channelId:'synthetic-spool-channel',token:'synthetic-spool-'+randomUUID()},201);
 // [REL-002] An owner-authored suspect judgment is erased with its author.
 const judgment=await app.request('/api/projects/personal-capture/suspects/issues/'+captured.issue,{release:'r1',sha:null,judgment:'rejected',note:'Test owner reviewed this correlation.',revision:0},{},'PUT');assert.equal(judgment.status,200);await judgment.body?.cancel();
 const proposalKey=await app.json('/api/projects/personal-capture/keys',{kind:'agent'},201),proposalPacket=await app.json('/api/projects/personal-capture/issues/'+captured.issue+'/packet');
 await app.json('/api/projects/personal-capture/grouping-proposals',{kind:'split',source:captured.issue,revision:proposalPacket.issue.revision,events:['personal-event'],variants:[{stack:JSON.stringify(event.frames),release:'r1',route:''}],rationale:`Test owner / ${owner.id} / ${other}`,window:{start:Date.now()-60000,end:Date.now()+1}},201,{Cookie:'',Authorization:'Bearer '+proposalKey.key});
 const feedbackDsn=new URL(project.dsn),feedbackBody={event_id:'e'.repeat(32),type:'feedback',contexts:{feedback:{message:`Test owner / ${owner.id} / ${other}`}}};
 const feedbackResponse=await fetch(app.origin+`/api/${feedbackDsn.pathname.slice(1)}/envelope/?sentry_key=${feedbackDsn.username}&sentry_version=7`,{method:'POST',headers:{Origin:app.origin,'Content-Type':'text/plain'},body:'{}\n{"type":"feedback"}\n'+JSON.stringify(feedbackBody)});assert.equal(feedbackResponse.status,200);await feedbackResponse.body?.cancel();
 await app.json('/api/projects/personal-capture/repairs',{issue:captured.issue,link:'https://code.test/pull/1',note:`Test owner and ${other}`},201);
 // TEAM-004: the owner as a cited commit's author, beside another person's name in its message.
 await app.json('/api/projects/personal-capture/releases',{name:'r2',build:'b2',commits:[{sha:'d'.repeat(40),message:`Paired with ${other}; reviewed by Test owner`,author:{name:'Test owner',email:testOwner}}]},201);
 await app.DB.prepare('INSERT INTO rer_mail_development_outbox(id,created_at,message) VALUES(?,?,?)').bind(randomUUID(),Date.now(),JSON.stringify({deliveryId:'mixed-private-note',from:'auth@localhost.test',to:[testOwner,'quinn@spool.test'],text:`Test owner and ${other}`})).run();
 await app.DB.prepare('INSERT INTO oa_external_identities(issuer,subject,operator_id) VALUES(?,?,?)').bind('https://identity.test','personal-owner-subject',owner.id).run();
 await app.DB.prepare('INSERT INTO oc_idp_grants(issuer,client_id,jti,subject,sector_id) VALUES(?,?,?,?,?)').bind('https://identity.test','client','personal-owner-grant','personal-owner-subject','installation-sector').run();
 evidence.holds=await heldScopes(app,otherId);
 // TEAM-001: real membership and service doors declare their erasure custody.
 await app.json('/api/organization',{id:'synthetic-spool-1',name:'synthetic-spool-1'},201);
 await app.json('/api/organization/invites',{email:'quinn@spool.test',name:other,role:'admin',grants:[]},202);
 await app.json('/api/organization/invites',{email:'synthetic-spool-8@example.test',name:'synthetic-spool-8',role:'member',grants:[{project:'personal-capture',role:'member'}]},202);
 const team=(await app.json('/api/organization')),ownerMember=team.members.find(m=>m.operator_id===owner.id),teamInvite=(await app.DB.prepare("SELECT id FROM oa_tokens WHERE issuer_id=? AND operator_id IN (SELECT operator_id FROM spool_members WHERE email='synthetic-spool-8@example.test')").bind(owner.id).first()).id;
 const service=await app.json('/api/organization/services',{name:'synthetic-spool-1',scopes:[{project:'personal-capture',kind:'ingest'}]},201);
 const {hash:serviceHash}=await app.json('/api/organization/services/'+service.id+'/keys',{project:'personal-capture',kind:'ingest'},201);
 const otherService=await app.json('/api/organization/services',{name:'synthetic-spool-2',scopes:[{project:'personal-capture',kind:'agent'}]},201,{Cookie:otherCookies['quinn@spool.test']});
 const {hash:otherServiceHash}=await app.json('/api/organization/services/'+otherService.id+'/keys',{project:'personal-capture',kind:'agent'},201,{Cookie:otherCookies['quinn@spool.test']});
 const teamAlerts='/api/projects/personal-capture/alerting';
 const digest=await app.request(teamAlerts+'/team-digests',{member:ownerMember.id,timezone:'America/New_York',daily:true,weekly:true,hour:9},{},'PUT');assert.equal(digest.status,200);await digest.body?.cancel();
 await app.json(teamAlerts+'/team-snoozes',{scope:'team',target:'Default team',until:Date.now()+60000},201);
 const alternate=await app.request('/api/projects/personal-capture/follow-up/alternate-member',{member:ownerMember.id},{},'PUT');assert.equal(alternate.status,200);await alternate.body?.cancel();
 const pre=await archive(app),needles=[owner.id,'Test owner',testOwner,'personal-owner-subject'];
 const preview=await app.json('/api/owner/erasure');assert.equal(preview.hold,null,JSON.stringify(preview));
 assert.ok(preview.deleted.identity_policies===1 && preview.deleted.event_identities===1 && preview.deleted.health_sessions===1 && preview.deleted.project_identity_keys===1 && preview.deleted.slack_destinations===1 && preview.deleted.suspect_decisions===1 && preview.deleted.oa_operators===1 && preview.deleted.grouping_proposals===1 && preview.redacted.events>0 && preview.redacted.artifacts>0 && preview.redacted.feedback>0 && preview.redacted.commits===1);
 for(const needle of needles)assert.ok(!JSON.stringify(preview).includes(needle),'preview contains no identifier');
 before=await snapshot(app);
 for(const [headers,value,status] of [[{Cookie:''},eraseInput(preview),401],[{Authorization:'Bearer '+project.ingestKey},eraseInput(preview),403],[{Origin:'https://foreign.test'},eraseInput(preview),403],[{}, {...eraseInput(preview),subject:otherId},400],[{},{confirm:'no',planHash:preview.planHash},400]]) {
  assert.equal((await app.request('/api/owner/erasure',value,headers)).status,status);
  assertAuditAppendOnly(await snapshot(app),before,'denied destructive transport is nonmutating');
 }
 await app.DB.prepare('UPDATE repairs SET note=note||? WHERE project=?').bind(' more Test owner','personal-capture').run();
 before=await snapshot(app);
 assert.equal((await app.request('/api/owner/erasure',eraseInput(preview))).status,409);
 assertAuditAppendOnly(await snapshot(app),before,'changed personal content makes old plan stale without mutation');
 const latest=await app.json('/api/owner/erasure');
 const receipt=await app.json('/api/owner/erasure',eraseInput(latest));assert.equal(receipt.phase,'complete');assert.equal((await app.DB.prepare('SELECT COUNT(*) count FROM suspect_decisions').first()).count,0,'REL-002 owner erasure removes authored judgments');assert.equal((await app.DB.prepare('SELECT COUNT(*) count FROM slack_destinations').first()).count,0,'ALERT-002 owner erasure removes Slack tokens');for(const table of ['alert_rule_configs','alert_rule_previews','alert_decisions','alert_reactivation_markers','identity_policies','event_identities','health_sessions','health_aggregates','project_identity_keys'])assert.equal((await app.DB.prepare('SELECT COUNT(*) count FROM '+table).first()).count,0,'SDK-005 owner erasure removes session custody');
 for(const needle of needles)assert.ok(!JSON.stringify(receipt).includes(needle),'receipt contains no identifier');
 const after=await snapshot(app);
 for(const table of ['spool_team_digest_settings','spool_team_snoozes','spool_team_mail','spool_follow_up_alternates'])assert.equal(after[table].length,0,'former owner notification custody erased: '+table);
 assert.equal(after.spool_members.some(row=>row.operator_id===owner.id),false,'former owner membership erased');
 for(const table of ['spool_members','spool_project_grants','spool_member_invites','spool_project_teams'])assert.deepEqual(after[table].filter(row=>row.id!==ownerMember.id&&row.member!==ownerMember.id),before[table].filter(row=>row.id!==ownerMember.id&&row.member!==ownerMember.id),'other team configuration preserved: '+table);
 for(const table of ['spool_service_accounts','spool_service_scopes','spool_service_credentials'])assert.deepEqual(after[table],before[table].filter(row=>row.id!==service.id&&row.service!==service.id),'other service authority preserved: '+table);
 assert.equal(after.credentials.some(row=>row.hash===serviceHash),false,'sponsored service ingest authority erased');
 assert.deepEqual(after.credentials.find(row=>row.hash===otherServiceHash),before.credentials.find(row=>row.hash===otherServiceHash),'other sponsored credential preserved');
 assert.equal(after.oa_tokens.some(row=>row.id===teamInvite),false,'former issuer provenance retired without removing team member');
 assert.deepEqual(after.spool_audit_events.filter(row=>row.sequence<=before.spool_audit_events.at(-1)?.sequence),before.spool_audit_events,'AUDIT-001 actor erasure never rewrites prior safe chronology');
 assert.ok(after.audit_actor_links.every(row=>row.owner_id!==owner.id),'AUDIT-001 actor bindings are erased');
 for(const needle of needles)assert.ok(!JSON.stringify(after).includes(needle),`all stored cells erased for ${needle}`);
 assert.deepEqual(after.oa_operators.find(row=>row.id===otherId),before.oa_operators.find(row=>row.id===otherId),'unrelated operator identical');
 for(const row of independent.results)assert.deepEqual(after.oa_sessions.find(item=>item.id===row.id),row,'independent other-person session preserved');
 for(const row of independentTokens.results)assert.deepEqual(after.oa_tokens.find(item=>item.id===row.id),row,'independent other-person token preserved');
 assert.equal((await app.call('/auth/session',undefined,{Cookie:otherCookies['quinn@spool.test']})).status,200,'unrelated member remains signed in');
 assert.equal((await app.call('/auth/session',undefined,{Cookie:otherCookies[next.email]})).status,401,'independent successor session is fenced by promotion');
 assert.equal(after.oa_tokens.filter(row=>row.issuer_id===owner.id).length,0,'predecessor-issued invitation is retired');
 assert.deepEqual([after.commits[0].author_name,after.commits[0].author_email],['[erased]','[erased]'],'TEAM-004 commit author erased as whole tokens');
 for(const table of ['projects','issues','events','artifacts','repairs','feedback','rer_mail_development_outbox','commits']) {
  const occurrences=value=>JSON.stringify(value).split(other).length-1;
  assert.equal(occurrences(after[table]),occurrences(before[table]),`${table} preserves co-located other person values`);
 }
 assert.equal(after.oa_operators.filter(row=>row.role==='owner'&&row.status==='active').length,1);
 assert.equal(after.oa_bootstrap.length,1);assert.equal(after.oc_owner_claims.length,1);assert.equal(after.oc_owner_claims[0].email,'');
 assert.equal((await app.call('/auth/bootstrap',{token:testSetupToken,displayName:'Replacement'})).status,409,'claim never reopens');
 assert.equal((await app.request('/api/projects')).status,401,'predecessor session fenced');
 assert.equal((await app.call('/api/projects',undefined,{Cookie:next.cookie})).status,401,'pre-handoff successor session fenced');
 assert.equal((await app.call('/auth/magic-link',{email:next.email})).status,202);
 app.cookie=await confirmLatest(app,next.email);
 assert.ok(app.cookie);await app.json('/api/projects');
 const minted=await app.json('/api/projects/personal-capture/keys',{kind:'agent'},201);assert.ok(minted.key,'successor retains management and minting');
 // SDK-008: the successor chooses a new policy above the erased policy's safe revision floor.
 const nextIdentityPolicy={id:'hash',email:'hash',username:'hash',ip_address:'hash'},nextIdentityPreview=await app.json('/api/projects/personal-capture/identity-policy/preview',{policy:nextIdentityPolicy});
 const nextIdentityWrite=await app.request('/api/projects/personal-capture/identity-policy',{policy:nextIdentityPolicy,revision:nextIdentityPreview.revision,token:nextIdentityPreview.token},{},'PUT');assert.equal(nextIdentityWrite.status,200);const nextIdentity=await nextIdentityWrite.json();assert.ok(nextIdentity.revision>identityPreview.revision+1,'successor does not reuse an erased policy revision');
 const post=await archive(app);
 for(const needle of needles)assert.ok(!post.text.includes(needle),'fresh archive contains no self identifiers');
 assert.equal((await restore(app,pre.text)).body.error,'erasure_epoch');
 fresh=await runtime();
 const restoredPost=await restore(fresh,post.text);assert.equal(restoredPost.status,200,'redacted rows remain restorable: '+JSON.stringify(restoredPost.body));
 assert.equal((await restore(fresh,pre.text)).body.error,'erasure_epoch','fresh destination receiving later journal refuses old captures');
 evidence.native={planned:latest.deleted,redacted:latest.redacted,deleted:receipt.deleted,phase:receipt.phase,independentSessionsPreserved:independent.results.length,independentTokensPreserved:independentTokens.results.length,otherCanaries:Object.fromEntries(['projects','issues','events','artifacts','repairs','feedback','rer_mail_development_outbox'].map(table=>[table,{before:JSON.stringify(before[table]).split(other).length-1,after:JSON.stringify(after[table]).split(other).length-1}]))};
 console.log('Owner erasure native: '+JSON.stringify(evidence.native));
 await fresh.close();fresh=null;
 evidence.archives=await archiveFences(app,pre,post);
 evidence.checks.push('native self/other mixed canaries; real successor sign-in and sole-owner handoff; count-only plan and receipt; transport denials and stale plan nonmutation; full stored-cell scan; claim and predecessor credential fences; successor management; same/fresh archive fences');
 await app.close();app=null;
 app=await runtime();await successor(app);
 const door=sentryDoorClient({transport:(action,body,namespace)=>app.request(`/api/operator/import/${action}`,body,{'X-Import-Source':namespace})});
 const planned=await door.plan(Buffer.from(JSON.stringify(sentryExport())));
 assert.equal((await door.apply(planned.planId,planned.fingerprint)).job.state,'completed');
 const held=await app.json('/api/owner/erasure');assert.equal(held.hold,'shared_import_custody');
 before=await snapshot(app);assert.equal((await app.request('/api/owner/erasure',eraseInput(held))).status,409);assertAuditAppendOnly(await snapshot(app),before,'shared originals and their other-person bytes remain identical on refusal');
 evidence.checks.push('shared import originals and principal custody explicitly held without mutation');
 await app.close();app=null;
 evidence.authorityRaces=await authorityRaces();
 evidence.resumption=await interruptedErasure();
 evidence.finalization=await interruptedFinalization();
 evidence.delayedRepairs=await delayedRepairWrites();
 evidence.delayedOwnerWrites=await delayedOwnerWrites();
 evidence.delayedRestore=await delayedRestore();
 evidence.checks.push('structural, ambiguous attribution and unrelated invitation holds leave all rows identical; independent other-person sessions and tokens survive; commit-time predecessor and successor authority races prevent destructive mutation; multi-batch interruption and restart complete through native scheduler; late predecessor mint rejected after completion; child-only archive and explicit later journal fences');
 await mkdir('.artifacts/owner-erasure',{recursive:true});await writeFile('.artifacts/owner-erasure/results.json',JSON.stringify(evidence,null,2)+'\n');
 console.log('Owner erasure public flow passed: '+evidence.checks.length+' groups.');
}finally{await fresh?.close();await app?.close();}
