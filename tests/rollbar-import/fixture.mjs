// API envelopes follow the official Rollbar clients linked in the migration guide.
export function rollbarFixture() {
 const epoch=1772409600;
 const response=result=>({err:0,result});
 const collection=(kind,result,extra={})=>({kind,complete:true,...extra,pages:[{page:1,response:response(result)}]});
 const items=Array.from({length:24},(_,index)=>({id:1001+index,counter:index+1,project_id:71,title:`Checkout failure ${index+1}`,
  status:index===0?'resolved':'active',environment:index%2?'staging':'production',hash:`synthetic-spool-${index+1}`,
  first_occurrence_timestamp:epoch,last_occurrence_timestamp:epoch+120,total_occurrences:index===0?0:37,
  last_resolved_timestamp:index<2?epoch+30:null,last_activated_timestamp:index===1?epoch+90:epoch,
  assigned_user_id:99,assigned_team_id:null,integrations_data:{tracker:{id:`synthetic-spool-${index+1}`}},group_status:1}));
 const occurrences=items.map((item,index)=>({id:2001+index,item_id:item.id,timestamp:epoch+120,version:1,
  data:{environment:item.environment,code_version:'checkout@1.0.0',language:'javascript',fingerprint:item.hash,
   body:{trace:{exception:{class:'TypeError',message:item.title},frames:[
    {filename:'src/orders.js',lineno:10,colno:4,method:'handleOrder'},
    {filename:'src/checkout.js',lineno:27,colno:12,method:'chargeCard',code:'private source remains in custody'},
   ]}},telemetry:[{type:'log',body:{message:'checkout: started'}}],custom:{sourceOnly:'synthetic-spool-91'}}}));
 // A second deployment of one revision must not create a duplicate release.
 const deploys=[{id:301,project_id:71,environment:'production',revision:'checkout@1.0.0',status:'succeeded',start_time:epoch-60,finish_time:epoch-30},
  {id:302,project_id:71,environment:'staging',revision:'checkout@1.0.0',status:'succeeded',start_time:epoch-30,finish_time:epoch}];
 return {format:'spool-rollbar-export',version:1,exportedAt:'2026-03-02T00:05:00Z',
  project:response({id:71,name:'Checkout migration',account_id:8,date_created:epoch-86400,status:'enabled'}),
  collections:[collection('items',{page:1,total_count:24,items}),
   {kind:'occurrences',complete:true,pages:occurrences.map((occurrence,index)=>({page:index+1,response:response(occurrence)}))},
   collection('deploys',{page:1,deploys}),
   collection('item_events',{page:1,total_count:2,events:[{id:401,type:'item_status_history',item_id:1002,timestamp:epoch+30,comment:'Investigated and resolved'},
    {id:402,type:'item_comment',item_id:1002,timestamp:epoch+90,text:'Reactivated by the next occurrence'}]},{item:1002}),
   ...['email','slack','pagerduty','webhook'].map((channel,index)=>collection('notification_rules',[
    {id:501+index,status:'enabled',action:`send_${channel}`,trigger:'reactivated_item',filters:[{type:'environment',operation:'eq',value:'production'}],config:{}}],{channel})),
  ],unavailable:[...items.filter(item=>item.id!==1002).map(item=>({kind:'item_events',item:item.id,reason:'History not included in this authorized capture.'})),
   {kind:'occurrences',reason:'The since-resolution counters include older occurrences outside the available retained export.'},
   {kind:'artifacts',reason:'Original build artifacts must be recovered from the authorized build pipeline; no download bytes supplied.'},
   {kind:'grouping_rules',reason:'Custom fingerprint rule export unavailable; per-item hash and per-occurrence fingerprint retained.'},
   {kind:'tracker_links',reason:'Integration data retained as opaque source; provider links cannot be activated.'}]};
}
