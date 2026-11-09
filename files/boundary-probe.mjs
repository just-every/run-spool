// Deterministic small-script fallback permitted by the brief. This runs the
// actual before/after fixture helpers, candidate SQL, and decision() over SQLite;
// it does not claim a second full native Worker journey.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
const root=resolve(process.argv[2]??process.cwd()),require=createRequire(root+'/package.json');
const {build}=require('esbuild');
const bundle=resolve(root,'../boundary-product.mjs');
await build({stdin:{contents:"export {decision} from './src/domain/alerts/measure.ts'; export {eligibleEvent,eventFilter} from './src/domain/alerts/filters.ts';",resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:bundle});
const {decision,eligibleEvent,eventFilter}=await import(pathToFileURL(bundle));
const before=execFileSync('git',['show','aa853b97de89f949da4fa5876ae525e3b1f343aa:tests/alerts/conditions-journey.mjs'],{cwd:root,encoding:'utf8'});
const after=readFileSync(root+'/tests/alerts/conditions-journey.mjs','utf8');
const spikes=readFileSync(root+'/src/domain/alerts/spikes.ts','utf8');
const candidateTemplate=spikes.match(/`(SELECT DISTINCT i\.id FROM events[^`]+)`/)[1];
const began=Date.parse('2026-11-09T17:00:59.800Z'),sent=began+6000,width=60000;
const start=Math.floor(began/width)*width,end=start+width;
const config={metric:'session_percent',filters:{environment:'sessions'},tagKeys:['tenant']};
async function probe(source){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE events(project TEXT,id TEXT,issue TEXT,received INTEGER,environment TEXT,release TEXT,payload TEXT,occurrence TEXT,historical INTEGER);
 CREATE TABLE issues(project TEXT,id TEXT,state TEXT);
 CREATE TABLE event_suppressions(project TEXT,event TEXT,occurrence TEXT);
 CREATE TABLE event_grouping(project TEXT,event TEXT,occurrence TEXT);
 CREATE TABLE event_identities(project TEXT,event TEXT,occurrence TEXT,user_key TEXT);
 CREATE TABLE health_sessions(project TEXT,started INTEGER,environment TEXT,release TEXT,errors INTEGER,status TEXT);
 CREATE TABLE health_aggregates(project TEXT,started INTEGER,environment TEXT,release TEXT,status TEXT,quantity INTEGER);
 INSERT INTO issues VALUES('web','issue','open');`);
 const db={prepare(query){const stmt=sql.prepare(query);return {bind(...args){return {async first(){return stmt.get(...args)??null},async all(){return {results:stmt.all(...args)}},async run(){return stmt.run(...args)}}}}}};
 let sessionStamp;
 const send=async(type,value)=>{
  if(type==='session'){
   sessionStamp=value.timestamp;
   sql.prepare('INSERT INTO health_sessions VALUES(?,?,?,?,?,?)').run('web',Date.parse(value.started),value.attrs.environment,value.attrs.release,value.errors,value.status);
  }else{
   sql.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?)').run('web',value.event_id,'issue',sent,value.environment,value.release,JSON.stringify({sentry:{level:value.level,tags:value.tags}}),'occurrence',0);
  }
 };
 class BoundaryDate extends Date{constructor(...args){super(...(args.length?args:[sent]))}static now(){return sent}}
 const helper=source.slice(source.indexOf(' const error=async'),source.indexOf(' const untouched='));
 const sessions=source.split('\n').find(line=>line.includes("for(let i=0;i<10;i++)await send('session'"));
 const context=vm.createContext({app:{db},send,start,Date:BoundaryDate,crypto:globalThis.crypto});
 await vm.runInContext(`(async()=>{${helper}\n${sessions}\nawait error(100,{environment:'sessions'});})()`,context);
 const f=eventFilter(config),query=vm.runInNewContext('`'+candidateTemplate+'`',{eligibleEvent,f});
 const candidates=sql.prepare(query).all('web',start,end,...f.args);
 const decisions=[];
 for(const issue of candidates.slice(0,1))decisions.push({rule_id:'sessions',reason:JSON.stringify(await decision(db,'web',config,issue.id,start,end,30))});
 const received=sql.prepare('SELECT received FROM events').get().received;
 let result,error;
 try{result=JSON.parse(decisions.find(d=>d.rule_id==='sessions').reason)}catch(caught){error=caught}
 sql.close();
 return {sessionStamp,received,candidates:candidates.length,result,error};
}
console.log('Clock: start within last 200ms of minute = '+new Date(began).toISOString()+'; send = '+new Date(sent).toISOString());
console.log('Window: ['+new Date(start).toISOString()+', '+new Date(end).toISOString()+')');
const old=await probe(before);
assert.equal(old.candidates,0);assert.ok(old.error instanceof TypeError);assert.match(old.error.message,/reason/);
assert.ok(Date.parse(old.sessionStamp)>=end);assert.ok(old.received>=end);
console.log('REPRO alerts: events stamped new Date() across :00 -> no decision (TypeError)');
console.log('Before: session timestamp='+old.sessionStamp+'; error received='+new Date(old.received).toISOString()+'; '+old.error.message);
const sessionOnly=await probe(before.replace('timestamp:new Date().toISOString()','timestamp:new Date(start+200).toISOString()'));
assert.equal(sessionOnly.candidates,0);assert.ok(sessionOnly.error instanceof TypeError);
console.log('Session-timestamp-only control: no decision; candidate SQL uses error received, sessionMeasure uses started.');
const fixed=await probe(after);
assert.equal(fixed.candidates,1);assert.ok(fixed.received>=start&&fixed.received<end);
assert.equal(fixed.sessionStamp,new Date(start+200).toISOString());
assert.deepEqual([fixed.result.affected,fixed.result.denominator,fixed.result.value,fixed.result.fired],[3,10,30,true]);
console.log('PROBE alerts: events stamped inside the window across :00 -> decision present');
console.log('After: session timestamp='+fixed.sessionStamp+'; error received='+new Date(fixed.received).toISOString()+'; decision='+JSON.stringify(fixed.result));
