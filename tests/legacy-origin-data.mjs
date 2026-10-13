import { randomBytes, randomUUID } from 'node:crypto';
import { normalize, hash, canonical, scrub } from '../src/domain/privacy.ts';
import {importSource} from './source-import.mjs';
const {validateMap}=await importSource(new URL('../src/domain/artifacts.ts',import.meta.url));
// Synthetic rows for the actual 0001/0002 database and retained native producer.
// Current application handlers only run after all remaining migrations apply.
export async function legacyOriginData() {
 const project={id:'cors',name:'Origin acceptance',ingestKey:randomBytes(32).toString('hex')},time=Date.now();
 const event={version:1,eventId:'old-native',release:'r1',build:'b1',environment:'test',type:'TypeError',message:'origin fixture token=test-spool-origin-private-canary alice@private.example',frames:[{file:'/fixture.js',line:1,column:0,function:'originFixture',debugId:'d1'}],breadcrumbs:[]};
 const normalized=normalize(event),top=normalized.frames[0];
 const fingerprint=await hash(JSON.stringify([normalized.type,top.file,top.function,top.line])),issue=await hash(project.id+':'+fingerprint);
 const payload=validateMap({version:3,sources:['original.ts'],names:[],mappings:'AAAA'});
 const rows={
  projects:[{id:project.id,name:project.name,created:time}],
  credentials:[{hash:await hash(project.ingestKey),project:project.id,kind:'ingest',created:time,revoked:null}],
  releases:[{project:project.id,name:'r1',seq:1,build:'b1',created:time}],
  issues:[{id:issue,project:project.id,fingerprint,algorithm:'js-frame-v1',title:scrub(normalized.type+': '+normalized.message),state:'open',revision:1,count:1,first_seen:time,last_seen:time,resolved_seq:null}],
  events:[{id:event.eventId,project:project.id,issue,release:'r1',release_seq:1,build:'b1',environment:'test',payload:JSON.stringify(normalized),digest:await hash(canonical(event)),diagnostic:JSON.stringify([{generated:top,status:'missing_artifact'}]),received:time}],
  artifacts:[{project:project.id,release:'r1',build:'b1',debug:'d1',payload,digest:await hash(payload),created:time}],
  outcomes:[{project:project.id,window:Math.floor(time/60000)*60000,reason:'accepted',count:1}],
  audit:[{id:randomUUID(),project:project.id,kind:'project_created',detail:JSON.stringify({id:project.id}),created:time}],
  alerts:[{id:randomUUID(),project:project.id,issue,kind:'new_issue',created:time}],
 };
 const cell=value=>value===null?'NULL':typeof value==='number'?String(value):"'"+value.replaceAll("'","''")+"'";
 const sql=Object.entries(rows).flatMap(([table,values])=>values.map(row=>`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(cell).join(',')});`)).join('\n');
 return {project,event,sql};
}
