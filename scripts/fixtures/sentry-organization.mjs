#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { schema, endpoints, exportCapture } from '../sentry-export.mjs';

// Fixed synthetic values, based on the linked public API response schemas. No provider calls.
export const documentation = {
 projects:'https://docs.sentry.io/api/organizations/list-an-organizations-projects/',
 keys:'https://docs.sentry.io/api/projects/list-a-projects-client-keys/',
 issues:'https://docs.sentry.io/api/events/list-a-projects-issues/',
 events:'https://docs.sentry.io/api/events/retrieve-an-event-for-a-project/',
 releases:'https://docs.sentry.io/api/releases/list-an-organizations-releases/',
 workflows:'https://docs.sentry.io/api/monitors/fetch-alerts/',
 detectors:'https://docs.sentry.io/api/monitors/fetch-an-organizations-monitors/',
 ownership:'https://docs.sentry.io/api/projects/retrieve-ownership-configuration-for-a-project/',
 members:'https://docs.sentry.io/api/organizations/list-an-organizations-members/',
 teams:'https://docs.sentry.io/api/teams/list-an-organizations-teams/',
 pagination:'https://docs.sentry.io/api/pagination/',
};
const date='2026-02-02T00:00:00Z',org='synthetic-spool-1',project='checkout';
const url=path=>'https://sentry.invalid'+path;
export function sentryOrganization(profile='baseline') {
 if(!['baseline','scaled'].includes(profile))throw new Error('Expected baseline or scaled');
 const size=profile==='scaled'?260:8;
 const capture={schema,synthetic:true,organization:{id:'synthetic-spool-1',slug:org,region:'us'},
  window:{start:'2026-02-01T00:00:00Z',end:'2026-02-03T00:00:00Z'},
  omissions:['Synthetic documented API captures only; all other MIG-001 families and real buyer cutover remain unqualified.'],collections:[]};
 const paths=endpoints(org,project);
 const list=(kind,rows,scope=null)=>{
  const base=new URL(url(paths[kind]));base.searchParams.set('per_page','100');if(kind==='issues')base.searchParams.set('query','');
  const pageSize=100,parts=[];
  for(let offset=0;offset<rows.length;offset+=pageSize)parts.push(rows.slice(offset,offset+pageSize));
  if(!parts.length)parts.push([]);parts.push([]); // Empty terminal page is actually acquired.
  const responses=parts.map((part,index)=>{
   const current=new URL(base),next=new URL(base);if(index)current.searchParams.set('cursor',`opaque-%E7%8C%AB-%25-${index}`);
   const cursor=`opaque-%E7%8C%AB-%25-${index+1}`;next.searchParams.set('cursor',cursor);
   return {url:current.href,status:200,link:`<${next.href}>; rel="next"; results="${index<parts.length-1}"; cursor="${cursor}"`,body:JSON.stringify(part)};
  });capture.collections.push({kind,project:scope,responses});
 };
 list('projects',[{id:'synthetic-project-1',slug:project,name:'Checkout 猫 café',dateCreated:date,platform:'javascript',teams:[{id:'synthetic-team-1',slug:'checkout',name:'Checkout'}],environments:['production','staging'],features:['releases']}]);
 list('releases',[{version:'checkout@1.0.0',dateCreated:date,projects:[{slug:project,name:'Checkout',platform:'javascript'}],dateReleased:date,commitCount:2,lastCommit:{id:'a'.repeat(40),message:'Synthetic change',repository:{name:'synthetic-spool-1',provider:{id:'github',name:'GitHub'}}}}]);
 list('keys',[{id:'synthetic-key-1',name:'Browser loader',public:'synthetic-spool-key-1',secret:'[removed]',isActive:false,
  rateLimit:{count:37,window:60},dsn:{public:'https://synthetic-spool-key-1@ingest.invalid/42',secret:'[removed]',cdn:'https://js.sentry-cdn.com/synthetic-spool-key-1.min.js'},
  browserSdkVersion:'latest',dynamicSdkLoaderOptions:{hasReplay:true,hasPerformance:false,hasDebug:true,hasFeedback:true,hasLogsAndMetrics:false}}],project);
 list('teams',[{id:'synthetic-team-1',slug:'checkout',name:'Checkout فريق',dateCreated:date,memberCount:2,hasAccess:true}]);
 list('members',[{id:'synthetic-member-1',email:'synthetic-spool-1@example.test',name:'Synthetic member',orgRole:'admin',pending:true,expired:false,flags:{'sso:linked':false},user:null}]);
 list('workflows',[{id:'synthetic-workflow-1',name:'Checkout error alert',enabled:false,detectorIds:['synthetic-detector-1'],triggers:{id:'synthetic-trigger-1',logicType:'any',conditions:[{id:'synthetic-trigger-condition-1',type:'detector_changed',comparison:'high',conditionResult:true}],actions:[]},actionFilters:[{id:'synthetic-filter-1',logicType:'any',conditions:[],actions:[{id:'synthetic-action-1',type:'email',status:'disabled',integrationId:null,config:{targetType:'Team',targetIdentifier:'synthetic-team-1',targetDisplay:'Checkout'},data:{fallthroughType:'ActiveMembers'}}]}],config:{frequency:30},unknownExtension:{nested:[{code:'source-only'}]}}]);
 list('detectors',[{id:'synthetic-detector-1',name:'Checkout errors',type:'error',projectId:'synthetic-project-1',enabled:false,config:{},conditionGroup:{id:'synthetic-condition-group-1',logicType:'any',conditions:[{id:'synthetic-condition-1',type:'event_frequency_count',comparison:100,conditionResult:true}],actions:[]},dataSources:[{id:'synthetic-data-source-1',type:'snuba_query_subscription',sourceId:'synthetic-query-1',queryObj:{id:'synthetic-query-1',snubaQuery:{dataset:'events',eventTypes:['error'],aggregate:'count()',query:'event.type:error',timeWindow:60,environment:'production'}}}]}]);
 capture.collections.push({kind:'ownership',project,responses:[{url:url(paths.ownership),status:200,body:JSON.stringify({raw:'path:src/checkout/* #checkout',schema:{$version:1,rules:[{matcher:{type:'path',pattern:'src/checkout/*'},owners:[{type:'team',id:'synthetic-team-1',name:'checkout'}]}]},fallthrough:true,autoAssignment:false,codeownersAutoSync:false})}]});
 const issues=Array.from({length:size},(_,i)=>({id:`synthetic-issue-${i}`,shortId:`CHECKOUT-${i+1}`,title:`Checkout failure ${i}`,status:i%3===0?'resolved':i%3===1?'ignored':'unresolved',firstSeen:date,lastSeen:date,count:'99',userCount:3,assignedTo:{type:'team',id:'synthetic-team-1',name:'Checkout'},statusDetails:{},priority:'high'}));
 list('issues',[...issues,structuredClone(issues[0])],project);
 capture.collections.push({kind:'events',project,responses:issues.map((issue,i)=>{
  const eventID=i.toString(16).padStart(32,'0');
  return {url:url(paths.events+eventID+'/'),status:200,body:JSON.stringify({eventID,groupID:issue.id,title:issue.title,release:{version:'checkout@1.0.0',shortVersion:'1.0.0'},dist:'build-1',environment:'production',dateCreated:date,dateReceived:'2026-02-02T00:00:01Z',tags:[{key:'environment',value:'production'},{key:'region',value:'synthetic'}],contexts:{browser:{name:'Synthetic browser'}},
   entries:[{type:'exception',data:{values:[{type:'Error',value:'Earlier exception',stacktrace:{frames:[{filename:'earlier.js',lineNo:1,colNo:1}] }},{type:'TypeError',value:issue.title,mechanism:{handled:true,type:'generic'},rawStacktrace:{frames:[{filename:'src/checkout.ts',absPath:'https://checkout.example.test/app.js',lineNo:12,colNo:4,function:'checkout',vars:{ordinary:'safe'}}]},stacktrace:{frames:[{filename:'src/original.ts',lineNo:3,colNo:2,function:'original'}]}}]}},
    {type:'breadcrumbs',data:{values:[{type:'default',category:'navigation',message:'Checkout opened',data:{method:'GET',status_code:200},event_id:'source-only'}]}},
    {type:'request',data:{method:'GET',url:'https://checkout.example.test/',headers:[['Accept','application/json']]}}]})};
 })});
 return capture;
}
export async function writeFixture(directory,profile='baseline') {
 const capture=sentryOrganization(profile),{bundle,receipt}=exportCapture(capture);
 await mkdir(directory,{recursive:true});
 for(const [name,value] of Object.entries({capture,bundle,receipt,documentation}))await writeFile(resolve(directory,name+'.json'),JSON.stringify(value,null,2)+'\n',{mode:0o600});
 return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const [directory,profile]=process.argv.slice(2);if(!directory)throw new Error('Expected output directory [baseline|scaled]');
 console.log(JSON.stringify(await writeFixture(directory,profile)));
}
