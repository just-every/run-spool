// One catalogue for production registration, discovery, docs and conformance.
const str={type:'string',minLength:1,maxLength:200};
const text={type:'string',maxLength:4000};
// Native cursors encode the query signature, ordering keys and record ID.
const cursor={type:'string',minLength:1,maxLength:1024};
const num={type:'integer',minimum:0};
const bool={type:'boolean'};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const fields=(properties,required)=>object({project:str,...properties},required??['project',...Object.keys(properties)]);
const proposal={kind:{enum:['split','merge','rule']},source:str,revision:num,events:{type:'array',items:str,minItems:1,maxItems:200},target:str,targetRevision:num,policyRevision:num,rationale:text,variants:{type:'array',items:object({stack:text,release:str,route:text}),minItems:1,maxItems:20},window:object({start:num,end:num}),policy:{type:'object'}};
const grants={type:'array',items:object({project:str,role:{enum:['maintainer','member','read-only']}}),maxItems:100};
const rule={name:str,enabled:bool,channel:{enum:['mail','webhook']},destination:str,kinds:{type:'array',items:{enum:['new_issue','regression','spike']}},windowMs:num,threshold:num,revision:num};
const definitions=[
 ['projects.list','GET','projects',object({}),true,['standard'],['TEAM-001']],
 ['projects.create','POST','projects',object({name:str}),false,['standard'],['TEAM-001']],
 ['issues.list','GET','issues',fields({state:{enum:['open','all']},limit:{type:'integer',minimum:1,maximum:100}},['project']),true,['standard'],['ERR-007']],
 ['issues.read','GET','issue',fields({issue:str}),true,['standard'],['ERR-007']],
 ['packets.read','GET','packet',fields({issue:str}),true,['standard'],['ERR-007','AI-001']],
 ['outcomes.read','GET','outcomes',fields({}),true,['standard'],['ERR-008']],
 ['issues.search','GET','issue-search',fields({q:text,sort:str,cursor},['project']),true,['standard'],['ERR-007']],
 ['issues.export','GET','issue-export',fields({q:text,sort:str},['project']),true,['standard'],['ERR-007']],
 ['occurrences.list','GET','occurrences',fields({issue:str,q:text,cursor,order:{enum:['oldest','newest']}},['project']),true,['standard'],['ERR-007']],
 ['feedback.read','GET','feedback-reports',fields({issue:str,cursor,order:{enum:['oldest','newest']}},['project']),true,['standard'],['ERR-007']],
 ['health.read','GET','release-health',fields({from:num,to:num,environment:str},['project']),true,['standard'],['REL-001']],
 ['affected.read','GET','affected-users',fields({issue:str}),true,['standard'],['SDK-008']],
 ['notifications.read','GET','notifications',fields({}),true,['standard'],['ALERT-001']],
 ['proposals.list','GET','proposals',fields({}),true,['standard'],['AI-005']],
 ['proposals.read','GET','proposal',fields({id:str}),true,['standard'],['AI-005']],
 ['proposals.create','POST','proposals',fields(proposal,['project','kind','source','revision','rationale','variants','window']),false,['standard'],['AI-005']],
 ['issues.update','PATCH','issue',fields({issue:str,state:{enum:['open','acknowledged','resolved','suppressed']},revision:num,resolution:{type:'object'}},['project','issue','state','revision']),false,['standard','live'],['ERR-006','TEAM-003']],
 ['grouping.preview','POST','grouping-preview',fields(proposal,['project','kind','source','revision']),false,['standard'],['ERR-006','AI-005']],
 ['grouping.apply','POST','grouping-apply',fields({id:str}),false,['standard'],['ERR-006','AI-005']],
 ['grouping.undo','POST','grouping-undo',fields({id:str}),false,['standard'],['ERR-006']],
 ['reproducers.read','GET','reproducers',fields({issue:str}),true,['standard'],['AI-002']],
 ['reproducers.create','POST','reproducers',fields({event:str,export:str,input:{type:'array',maxItems:100}},['project','event','input']),false,['standard'],['AI-002']],
 ['reproducers.run','POST','reproducer-run',fields({id:str,release:str},['project','id']),false,['standard'],['AI-002']],
 ['reproducers.claim','POST','reproducer-claim',fields({id:str}),false,['standard'],['AI-002']],
 ['repairs.read','GET','repairs',fields({issue:str}),true,['standard'],['ERR-008','AI-004']],
 ['repairs.record','POST','repairs',fields({issue:str,link:text,note:text},['project','issue','link']),false,['standard'],['ERR-008']],
 ['repairs.check','POST','repair-check',fields({id:str,revision:num,name:str,outcome:{enum:['passed','failed','not_run']},note:text},['project','id','revision','name','outcome']),false,['standard'],['ERR-008','AI-004']],
 ['repairs.record_fact','POST','repair-fact',fields({id:str,revision:num,fact:{enum:['approved','merged','deployed','exercised']},release:str,note:text},['project','id','revision','fact']),false,['standard'],['ERR-008']],
 ['fixes.read','GET','fixes',fields({issue:str}),true,['standard'],['AI-003']],
 ['fixes.create','POST','fixes',fields({reproducer:str,run:str,repository:str,base:str,flow:str,durationMinutes:{type:'integer',minimum:1,maximum:10080}},['project','reproducer','run','repository','flow']),false,['standard'],['AI-003']],
 ['fixes.advance','POST','fix-advance',fields({id:str}),false,['external'],['AI-003']],
 ['releases.read','GET','releases',fields({}),true,['standard'],['REL-001']],
 ['releases.record','POST','releases',fields({name:str,build:str,manifest:{type:'object'}},['project','name','build']),false,['standard'],['REL-001']],
 ['deployments.read','GET','deployments',fields({}),true,['standard'],['REL-001']],
 ['deployments.record','POST','deployments',fields({release:str,build:str,manifest:object({commitSha:str,repository:str,environment:str,deployedAt:str})}),false,['standard'],['REL-001']],
 ['alerts.read','GET','alerts',fields({}),true,['standard'],['ALERT-001']],
 ['alerts.destinations','GET','destinations',fields({}),true,['standard'],['ALERT-001']],
 ['alerts.update','PUT','alert',fields({id:str,...rule},['project','id',...Object.keys(rule)]),false,['standard','live'],['ALERT-001']],
 ['alerts.test','POST','alert-test',fields({id:str}),false,['external'],['ALERT-001']],
 ['followups.read','GET','followup',fields({}),true,['standard'],['ALERT-004']],
 ['followups.update','PUT','followup',fields({destination:{type:['string','null']},channel:{enum:['mail','webhook']},revision:num},['project','destination']),false,['standard','live'],['ALERT-004']],
 ['access.read','GET','access',object({}),true,['standard'],['TEAM-001']],
 ['access.update','PUT','access-member',object({id:str,version:num,role:{enum:['admin','billing','member','read-only']},grants}),false,['access'],['TEAM-001']],
 ['credentials.list','GET','credentials',fields({}),true,['standard'],['ERR-004']],
 ['credentials.read','GET','credential',object({id:str}),true,['standard'],['ERR-004']],
 ['credentials.update','DELETE','credential',object({id:str}),false,['access','security'],['ERR-004']],
 ['retention.read','GET','retention',fields({}),true,['standard'],['GOV-002']],
 ['retention.preview','POST','retention-preview',fields({windows:{type:'object'}}),true,['standard'],['GOV-002']],
 ['retention.update','PUT','retention',fields({revision:num,windows:{type:'object'},at:num,token:str},['project','revision','windows','at','token']),false,['live','destructive'],['GOV-002']],
 ['privacy.preview','GET','privacy',fields({}),true,['standard'],['BASE-DATA-003']],
 ['privacy.erase','POST','privacy',fields({planHash:str}),false,['destructive'],['BASE-DATA-003']],
 ['privacy.continue','POST','erasure-resume',object({id:str}),false,['destructive'],['BASE-DATA-003']],
 ['witness.read','GET','witness',fields({}),true,['standard'],['ERR-010','AUDIT-001']],
];
export const catalogue=definitions.map(([verb,method,route,inputSchema,readOnly,classes,clauses])=>({...verb==='fixes.advance'?{proof:'native',proofKind:'repository_grant'}:{},name:`spool.${verb}`,scope:readOnly?'spool:evidence':verb==='proposals.create'?'spool:propose':`spool:${verb.split('.')[0]}`,method,route,inputSchema,readOnly,classes,clauses}));
export const localScopes=['spool:evidence','spool:propose'];
export const notTools=[
 {clauses:['ERR-001','SDK-001'],reason:'connector'},
 {clauses:['MIG-001','ERR-009'],reason:'import-door'},
 {clauses:['OPS-001'],reason:'installation'},
 {clauses:['AI-002'],reason:'connector'},
 {clauses:['AI-003'],reason:'screen'},
];

const resourceRoot='spool://projects/{project}';
export const resourceTemplates=['spool://projects/{project}',`${resourceRoot}/issues/{id}`,`${resourceRoot}/issues/{id}/packet`,`${resourceRoot}/outcomes`,...['grouping-proposals','reproducers','repairs','fixes','releases','deployments','alerts'].map(area=>`${resourceRoot}/${area}/{id}`),`${resourceRoot}/retention-policy`,`${resourceRoot}/follow-up`,'spool://people/{id}','spool://credentials/{id}'];
