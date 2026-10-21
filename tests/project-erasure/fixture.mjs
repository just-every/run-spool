import {createHash} from 'node:crypto';
// Unique canaries for one journey. Each is plain text that the scrubber keeps,
// so its absence afterwards is erasure, not redaction.
const run=createHash('sha256').update(crypto.randomUUID()).digest('hex').slice(0,10).toUpperCase();
export const canary=Object.fromEntries(['NAME','EVENT','MAP','RECIPIENT','LABEL','TITLE','REPAIR','IMPORTTITLE','ORIGINAL','CAP','MOBILE','FEEDBACK','COMMIT','AUTHOR'].map(kind=>[kind,`ERASECANARY${kind}${run}`]));
export const organization='erase-org',slug='canary-web';
export const capProject=`cap-${run.toLowerCase()}`,mobileProject=`mobile-${run.toLowerCase()}`;
// The same derivation the importer uses for a Sentry project's native identifier.
export const importedProject=`sentry-${createHash('sha256').update(JSON.stringify([organization,slug])).digest('hex').slice(0,32)}`;
export const destinations=[
 {id:'erase-mail',project:importedProject,label:'Owner mail',channel:'mail',recipient:`${canary.RECIPIENT.toLowerCase()}@private.example`},
 {id:'erase-webhook',project:importedProject,label:`Webhook ${canary.LABEL}`,channel:'webhook',url:'https://webhook.example/erase',key:Buffer.from('ERASE_SIGNING_SECRET_MATERIAL_PRIVATE_32B').toString('base64')},
];
// A Sentry organization export holding the canary project and one other project.
// The original bytes carry a canary that never reaches native rows (user email).
export function sentryExport(){
 const event=(id,group,project,message,email)=>({eventID:id,groupID:group,dateCreated:'2026-02-02T00:00:00Z',release:{version:'web@1.0.0'},dist:'build-1',environment:'production',
  user:{email},entries:[{type:'exception',data:{values:[{type:'TypeError',value:message,rawStacktrace:{frames:[{filename:'https://app.example/bundle.js',lineNo:1,colNo:12,function:project}]}}]}}]});
 return {format:'spool-sentry-org-export',version:1,organization:{id:'7',slug:organization,region:'us'},window:{start:'2026-02-01T00:00:00Z',end:'2026-02-03T00:00:00Z'},
  collections:[
   {kind:'projects',project:null,pages:[{cursor:null,nextCursor:null,response:[{id:'201',slug,name:`Imported ${canary.NAME}`,dateCreated:'2026-01-01T00:00:00Z'},{id:'202',slug:'other-web',name:'Other imported web',dateCreated:'2026-01-01T00:00:00Z'}]}]},
   {kind:'releases',project:null,pages:[{cursor:null,nextCursor:null,response:[{version:'web@1.0.0',dateCreated:'2026-02-01T00:00:00Z',projects:[{slug},{slug:'other-web'}]}]}]},
   {kind:'issues',project:slug,pages:[{cursor:null,nextCursor:null,response:[{id:'601',title:`TypeError: ${canary.IMPORTTITLE}`,status:'unresolved',firstSeen:'2026-02-02T00:00:00Z',lastSeen:'2026-02-02T00:00:00Z'}]}]},
   {kind:'issues',project:'other-web',pages:[{cursor:null,nextCursor:null,response:[{id:'602',title:'TypeError: other imported',status:'unresolved',firstSeen:'2026-02-02T00:00:00Z',lastSeen:'2026-02-02T00:00:00Z'}]}]},
   {kind:'events',project:slug,pages:[{cursor:null,nextCursor:null,response:[event('b'.repeat(32),'601','canaryweb',canary.IMPORTTITLE,`${canary.ORIGINAL.toLowerCase()}@private.example`)]}]},
   {kind:'events',project:'other-web',pages:[{cursor:null,nextCursor:null,response:[event('c'.repeat(32),'602','otherweb','other imported','other.person@private.example')]}]},
  ],omissions:['Synthetic erasure journey export.']};
}
// A flat Source Map V3 whose private source content carries a canary.
export const sourceMap=()=>({version:3,file:'bundle.js',sources:['src/checkout.ts'],sourcesContent:[`// ${canary.MAP}\nexport function checkout(){throw new TypeError('x')}\n`],names:[],mappings:'AAAA'});
export const event=(id,message,extra={})=>({version:1,eventId:id,release:'r1',build:'b1',environment:'production',type:'TypeError',message,frames:[{file:'https://app.example/bundle.js',line:1,column:0,function:'checkout',debugId:'erase-map'}],breadcrumbs:[],...extra});
