import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { runtime,successor,confirmLatest,snapshot,archive,eraseInput,restore } from './owner-erasure/helpers.mjs';
import { testOwner,testSetupToken } from './auth.mjs';
import { sentryExport } from './project-erasure/fixture.mjs';
import { authorityRaces, heldScopes } from './owner-erasure-authority.mjs';
import { interruptedErasure } from './owner-erasure-resume.mjs';
import { interruptedFinalization } from './owner-erasure-finalization.mjs';
import { delayedRepairWrites } from './owner-erasure-inflight.mjs';
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
 assert.deepEqual(await snapshot(app),before,'sole owner refusal changes no data');
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
 await app.json('/api/projects/personal-capture/repairs',{issue:captured.issue,link:'https://code.test/pull/1',note:`Test owner and ${other}`},201);
 await app.DB.prepare('INSERT INTO rer_mail_development_outbox(id,created_at,message) VALUES(?,?,?)').bind(randomUUID(),Date.now(),JSON.stringify({deliveryId:'mixed-private-note',from:'auth@localhost.test',to:[testOwner,'quinn@spool.test'],text:`Test owner and ${other}`})).run();
 await app.DB.prepare('INSERT INTO oa_external_identities(issuer,subject,operator_id) VALUES(?,?,?)').bind('https://identity.test','personal-owner-subject',owner.id).run();
 await app.DB.prepare('INSERT INTO oc_idp_grants(issuer,client_id,jti,subject,sector_id) VALUES(?,?,?,?,?)').bind('https://identity.test','client','personal-owner-grant','personal-owner-subject','installation-sector').run();
 evidence.holds=await heldScopes(app,otherId);
 const pre=await archive(app),needles=[owner.id,'Test owner',testOwner,'personal-owner-subject'];
 const preview=await app.json('/api/owner/erasure');assert.equal(preview.hold,null,JSON.stringify(preview));
 assert.ok(preview.deleted.oa_operators===1 && preview.redacted.events>0 && preview.redacted.artifacts>0);
 for(const needle of needles)assert.ok(!JSON.stringify(preview).includes(needle),'preview contains no identifier');
 before=await snapshot(app);
 for(const [headers,value,status] of [[{Cookie:''},eraseInput(preview),401],[{Authorization:'Bearer '+project.ingestKey},eraseInput(preview),403],[{Origin:'https://foreign.test'},eraseInput(preview),403],[{}, {...eraseInput(preview),subject:otherId},400],[{},{confirm:'no',planHash:preview.planHash},400]]) {
  assert.equal((await app.request('/api/owner/erasure',value,headers)).status,status);
  assert.deepEqual(await snapshot(app),before,'denied destructive transport is nonmutating');
 }
 await app.DB.prepare('UPDATE repairs SET note=note||? WHERE project=?').bind(' more Test owner','personal-capture').run();
 before=await snapshot(app);
 assert.equal((await app.request('/api/owner/erasure',eraseInput(preview))).status,409);
 assert.deepEqual(await snapshot(app),before,'changed personal content makes old plan stale without mutation');
 const latest=await app.json('/api/owner/erasure');
 const receipt=await app.json('/api/owner/erasure',eraseInput(latest));assert.equal(receipt.phase,'complete');
 for(const needle of needles)assert.ok(!JSON.stringify(receipt).includes(needle),'receipt contains no identifier');
 const after=await snapshot(app);
 for(const needle of needles)assert.ok(!JSON.stringify(after).includes(needle),`all stored cells erased for ${needle}`);
 assert.deepEqual(after.oa_operators.find(row=>row.id===otherId),before.oa_operators.find(row=>row.id===otherId),'unrelated operator identical');
 for(const row of independent.results)assert.deepEqual(after.oa_sessions.find(item=>item.id===row.id),row,'independent other-person session preserved');
 for(const row of independentTokens.results)assert.deepEqual(after.oa_tokens.find(item=>item.id===row.id),row,'independent other-person token preserved');
 assert.equal((await app.call('/auth/session',undefined,{Cookie:otherCookies['quinn@spool.test']})).status,200,'unrelated member remains signed in');
 assert.equal((await app.call('/auth/session',undefined,{Cookie:otherCookies[next.email]})).status,401,'independent successor session is fenced by promotion');
 assert.equal(after.oa_tokens.filter(row=>row.issuer_id===owner.id).length,0,'predecessor-issued invitation is retired');
 for(const table of ['projects','issues','events','artifacts','repairs','rer_mail_development_outbox']) {
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
 const post=await archive(app);
 for(const needle of needles)assert.ok(!post.text.includes(needle),'fresh archive contains no self identifiers');
 assert.equal((await restore(app,pre.text)).body.error,'erasure_epoch');
 fresh=await runtime();
 assert.equal((await restore(fresh,post.text)).status,200,'redacted rows remain restorable');
 assert.equal((await restore(fresh,pre.text)).body.error,'erasure_epoch','fresh destination receiving later journal refuses old captures');
 evidence.native={planned:latest.deleted,redacted:latest.redacted,deleted:receipt.deleted,phase:receipt.phase,independentSessionsPreserved:independent.results.length,independentTokensPreserved:independentTokens.results.length,otherCanaries:Object.fromEntries(['projects','issues','events','artifacts','repairs','rer_mail_development_outbox'].map(table=>[table,{before:JSON.stringify(before[table]).split(other).length-1,after:JSON.stringify(after[table]).split(other).length-1}]))};
 console.log('Owner erasure native: '+JSON.stringify(evidence.native));
 await fresh.close();fresh=null;
 evidence.archives=await archiveFences(app,pre,post);
 evidence.checks.push('native self/other mixed canaries; real successor sign-in and sole-owner handoff; count-only plan and receipt; transport denials and stale plan nonmutation; full stored-cell scan; claim and predecessor credential fences; successor management; same/fresh archive fences');
 await app.close();app=null;
 app=await runtime();await successor(app);
 const source=Buffer.from(JSON.stringify(sentryExport())).toString('base64'),operationKey='owner-custody-bound';
 const planned=await app.json('/api/imports/sentry/plan',{source,operationKey});
 await app.json('/api/imports/sentry/apply',{source,reviewedFingerprint:planned.fingerprint,operationKey},201);
 const held=await app.json('/api/owner/erasure');assert.equal(held.hold,'shared_import_custody');
 before=await snapshot(app);assert.equal((await app.request('/api/owner/erasure',eraseInput(held))).status,409);assert.deepEqual(await snapshot(app),before,'shared originals and their other-person bytes remain identical on refusal');
 evidence.checks.push('shared import originals and principal custody explicitly held without mutation');
 await app.close();app=null;
 evidence.authorityRaces=await authorityRaces();
 evidence.resumption=await interruptedErasure();
 evidence.finalization=await interruptedFinalization();
 evidence.delayedRepairs=await delayedRepairWrites();
 evidence.checks.push('structural, ambiguous attribution and unrelated invitation holds leave all rows identical; independent other-person sessions and tokens survive; commit-time predecessor and successor authority races prevent destructive mutation; multi-batch interruption and restart complete through native scheduler; late predecessor mint rejected after completion; child-only archive and explicit later journal fences');
 await mkdir('.artifacts/owner-erasure',{recursive:true});await writeFile('.artifacts/owner-erasure/results.json',JSON.stringify(evidence,null,2)+'\n');
 console.log('Owner erasure public flow passed: '+evidence.checks.length+' groups.');
}finally{await fresh?.close();await app?.close();}
