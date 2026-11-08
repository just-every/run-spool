// Synthetic records in the documented Bugsnag Data Access API v2 response shape.
export function bugsnagFixture(){
 const time='2026-06-01T12:00:00Z',org='synthetic-spool-1';
 const project=(id,name,type)=>({id,organization_id:org,name,type,created_at:time,release_stages:['production'],collaborators_url:'https://api.bugsnag.com/projects/'+id+'/collaborators'});
 const release=(id,project,version,extra={})=>({id,project_id:project,app_version:version,release_stage:'production',app_version_code:project==='android'?'42':undefined,release_time:time,...extra});
 const error=(id,project,status)=>({id,project_id:project,error_class:'CheckoutError',message:'Checkout failed',status,first_seen:time,last_seen:time,events:124,unthrottled_occurrence_count:150,assigned_collaborator_id:'synthetic-spool-2',linked_issues:[]});
 const event=(id,project,errorId)=>({id,error_id:errorId,project_id:project,received_at:time,severity:'error',unhandled:true,
  app:{version:'1.0.0',releaseStage:'production',type:project==='android'?'android':'browser',...project==='android'?{versionCode:'42'}:{}},
  exceptions:[{errorClass:'CheckoutError',message:'Checkout failed',stacktrace:[project==='android'?{file:'CheckoutActivity.kt',method:'com.synthetic.CheckoutActivity.submit',lineNumber:43,inProject:true,frameAddress:'0x10020'}:{file:'https://shop.example/checkout.js',method:'submit',lineNumber:1,columnNumber:0,inProject:true}]}],
  breadcrumbs:[{name:'Checkout opened',type:'navigation'}],metaData:{private:'not projected'},device:{id:'not projected'}});
 const collection=(kind,project,response)=>({kind,project,pages:[{cursor:null,nextCursor:null,response}]});
 const web=event('synthetic-spool-web-event','web','web-error');
 return {format:'spool-bugsnag-org-export',version:1,organization:{id:org,name:'Cedar Commerce',created_at:time},window:{start:'2026-06-01T00:00:00Z',end:'2026-06-02T00:00:00Z'},omissions:['Symbol binaries are separate build artifacts.'],collections:[
  collection('projects',null,[project('web','Cedar web shop','browser'),project('android','Cedar Android shop','android')]),
  collection('releases','web',[release('web-release','web','1.0.0',{total_sessions_count:1000,unhandled_sessions_count:7}),release('web-old','web','0.9.0',{total_sessions_count:0,unhandled_sessions_count:0})]),
  collection('releases','android',[release('android-release','android','1.0.0')]),
  collection('errors','web',[error('web-error','web','fixed')]),collection('errors','android',[error('android-error','android','open')]),
  collection('events','web',[web,structuredClone(web)]),collection('events','android',[event('synthetic-spool-android-event','android','android-error')]),
  collection('collaborators','web',Array.from({length:24},(_,index)=>({id:`synthetic-spool-collaborator-${index}`,name:`Migration collaborator ${index}`}))),collection('integrations','android',[{id:'synthetic-spool-3',type:'webhook',url:'https://integrations.example/notify'}])
 ]};
}
