import type { ClassId, JsonSchema } from '../../modules/agent-door/index.ts';

const id = { type: 'string', minLength: 1, maxLength: 200 };
const revision = { type: 'integer', minimum: 0 };
const text = (maxLength: number) => ({ type: 'string', maxLength });
const object = (properties: Record<string, JsonSchema>, required = Object.keys(properties)) => ({ type: 'object' as const, properties, required, additionalProperties: false });
const array = (items: JsonSchema, maxItems: number) => ({ type: 'array', items, maxItems });
export interface NativeOperation {
 name: string; method: string; path: string; classes: ClassId[]; clauses: string[];
 properties: Record<string, JsonSchema>; required?: string[]; table?: string; key?: string; nativeRevision?: string;
 description: string; nativeRead?: boolean; readOnly?: boolean;
}
const op = (name: string, method: string, path: string, classes: ClassId[], clauses: string[], properties: Record<string, JsonSchema>, description: string, extra: Partial<NativeOperation> = {}): NativeOperation => ({ name: 'spool.' + name, method, path, classes, clauses, properties, description, ...extra });
const proposal = { kind: {enum:['split','merge','rule']}, source:id, revision, events:array(id,200), target:id, targetRevision:revision, policy:{type:'object'}, policyRevision:revision,
 variants:array(object({stack:text(4000),release:text(200),route:text(500)}),20), rationale:text(2000), window:object({start:{type:'integer',minimum:0},end:{type:'integer',minimum:1}}) };
export const operations: NativeOperation[] = [
 op('deliveries.read','GET','/alerting/deliveries',['standard'],['ALERT-002'],{},'Read retained native delivery IDs, states and uncertainty.',{nativeRead:true}),
 op('alert_rules.read','GET','/alerting/rules',['standard'],['ALERT-001'],{},'Read current native rule revisions.',{nativeRead:true}),
 op('destinations.read','GET','/alerting/destinations',['standard'],['ALERT-002'],{},'Read configured destination readiness without signing material.',{nativeRead:true}),
 op('credentials.read','GET','/keys',['standard'],['AI-001'],{},'Read purpose, hash and revocation metadata; no bearer tokens.',{nativeRead:true}),
 op('retention.preview','POST','/retention-policy/preview',['standard'],['GOV-002'],{windows:{type:'object'}},'Read the exact native retention preview and token without applying it.',{nativeRead:true,readOnly:true}),
 op('privacy.preview','GET','/erasure',['standard'],['BASE-DATA-003'],{},'Read the native erasure plan and explicit holds without applying it.',{nativeRead:true}),

 op('issues.search','GET','/issue-search',['standard'],['FIND-001','AI-001'],{q:text(2000),order:id},'Search bounded current-project native evidence.',{required:[],nativeRead:true}),
 op('issues.export','GET','/issue-export',['standard'],['FIND-001','AI-001'],{q:text(2000),format:{enum:['csv','json']}},'Export the exact current-project sanitized issue projection.',{required:[],nativeRead:true}),
 op('occurrences.list','GET','/occurrences',['standard'],['ERR-007','AI-001'],{issue:id,q:text(2000),order:{enum:['oldest','newest']},cursor:text(4000)},'Read bounded permitted occurrence metadata without source, identity or credentials.',{required:[],nativeRead:true}),
 op('feedback.read','GET','/feedback-reports',['standard'],['ERR-007','AI-001'],{issue:id,cursor:text(4000)},'Read sanitized current-project feedback text as untrusted evidence.',{required:[],nativeRead:true}),
 op('releases.health','GET','/release-health',['standard'],['SDK-005'],{release:id,environment:id},'Read observed release-health denominators and unavailable-data reasons.',{required:[],nativeRead:true}),

 op('issues.list','GET','/issues',['standard'],['ERR-006','AI-001'],{state:{enum:['open','all']},limit:{type:'integer',minimum:1,maximum:100}},'List bounded sanitized issues.',{required:[],nativeRead:true}),
 op('issues.read','GET','/issues/{issue}/packet',['standard'],['ERR-007','AI-001'],{issue:id},'Read the native issue and evidence frontier.'),
 op('packets.read','GET','/issues/{issue}/packet',['standard'],['ERR-007','AI-001'],{issue:id},'Read bounded sanitized evidence; telemetry is untrusted.'),
 op('outcomes.read','GET','/outcomes',['standard'],['ERR-008'],{},'Read capture acceptance and loss. Silence remains Unknown.',{nativeRead:true}),
 op('proposals.list','GET','/grouping-proposals',['standard'],['AI-005'],{},'List inert grouping advice.'),
 op('proposals.read','GET','/grouping-proposals/{id}',['standard'],['AI-005'],{id},'Read a current native proposal and its counterexamples.'),
 op('proposals.create','POST','/grouping-proposals',['standard'],['AI-005'],proposal,'Save inert packet-derived advice. Submission changes no grouping or alert.',{required:['kind','source','revision','variants','rationale','window'],table:'issues',key:'source',nativeRevision:'revision'}),
 op('issues.update','PATCH','/issues/{issue}',['standard','live'],['ERR-006','TEAM-003'],{issue:id,state:{enum:['open','acknowledged','resolved','suppressed']},revision,resolution:{type:'object'}},'Apply native reversible triage; suppression changes active alert eligibility.',{required:['issue','state','revision'],table:'issues',key:'issue',nativeRevision:'revision'}),
 op('grouping.apply','POST','/corrections/{id}/apply',['live'],['AI-005','GROUP-001'],{id},'Apply a current native correction preview, retaining original events and native Undo.',{table:'grouping_corrections',key:'id',nativeRevision:'updated'}),
 op('grouping.preview','POST','/corrections/preview',['standard'],['AI-005'],proposal,'Prepare the native revision-bound correction without applying it.',{required:['kind','source','revision']}),
 op('reproducers.read','GET','/reproducers',['standard'],['AI-002'],{issue:id,observed:{enum:['reproduced']}},'Read stored recipes and observed sandbox outcomes; no source or run token.',{required:['issue']}),
 op('reproducers.create','POST','/reproducers',['standard'],['AI-002'],{event:id,export:id,input:{type:'array',maxItems:100}},'Record a supported deterministic recipe through native classification.',{required:['event','input']}),
 op('reproducers.run','POST','/reproducers/{id}/runs',['standard'],['AI-002'],{id,release:id},'Queue one bounded single-use native sandbox grant. The separate runner must supply an observation.',{required:['id']}),
 op('repairs.read','GET','/repairs',['standard'],['ERR-008','AI-004'],{issue:id},'Read asserted repair facts separately from native observed recurrence and capture gaps.'),
 op('repairs.record','POST','/repairs',['standard'],['ERR-008','AI-004'],{issue:id,link:text(1000),note:text(1000)},'Record an attributed inert repair claim. Links are never fetched.'),
 op('repairs.check','POST','/repairs/{id}/checks',['standard'],['ERR-008','AI-004'],{id,revision,name:text(200),outcome:{enum:['passed','failed','not_run']},note:text(1000)},'Record an asserted check; it does not become independent proof.',{table:'repairs',key:'id',nativeRevision:'revision'}),
 op('fixes.read','GET','/fixes',['standard'],['AI-003'],{issue:id},'Read the exact repository grant, data-only draft PR receipts and observed checks.'),
 op('fixes.create','POST','/fixes',['standard'],['AI-003'],{reproducer:id,run:id,repository:id,base:id,flow:id,durationMinutes:{type:'integer',minimum:1,maximum:10080}},'Prepare an inert exact-repository workflow from a server-confirmed reproduction; no provider call.',{required:['reproducer','run','repository','base','flow','durationMinutes']}),
 op('fixes.advance','POST','/fixes/{id}/advance',['external'],['AI-003'],{id,revision},'Advance one already-consented native GitHub draft data workflow. No generated code, merge or deploy.',{table:'fix_workflows',key:'id',nativeRevision:'revision'}),
 op('releases.read','GET','/releases',['standard'],['REL-001'],{},'Read registered releases and their provenance; recording is not deployment.'),
 op('releases.record','POST','/releases',['standard'],['REL-001'],{name:id,build:id},'Record observed release identity using native release admission.'),
 op('deployments.read','GET','/deployments',['standard'],['REL-002'],{},'Read recorded deployment facts, steps and uncertainty.'),
 op('deployments.record','POST','/deployments',['standard'],['REL-002'],{id,release:id,build:id,environment:id,repository:text(1000),commitSha:id,previousCommit:id,includedCommits:array({type:['object','string']},500),startedAt:{type:'string'},deadline:{type:'string'},destination:id},'Record an observed deployment through native exact-identity admission; never deploy.',{required:['id','release','build','environment','repository','commitSha','startedAt','deadline','destination']}),
 op('alerts.read','GET','/alerts',['standard'],['ALERT-001'],{},'Read native sanitized alert evidence.',{nativeRead:true}),
 op('alerts.update','PUT','/alerting/rules/{id}',['standard','live'],['ALERT-001'],{id,revision,name:text(200),enabled:{type:'boolean'},channel:{enum:['mail','webhook']},destination:id,kinds:array(id,10),windowMs:{type:'integer'},threshold:{type:'integer'}},'Update a revision-bound rule. Existing destination consent and reviewed-test constraints remain.',{table:'alert_rules',key:'id',nativeRevision:'revision'}),
 op('alerts.test','POST','/alerting/destinations/{id}/test',['external'],['ALERT-002'],{id},'Send one native TEST to a configured destination, retaining provider uncertainty.'),
 op('followups.update','PUT','/follow-up/alternate-member',['live'],['ALERT-004'],{member:{type:['string','null']}},'Choose an eligible current native alternate or remove it. No immediate send.'),
 op('access.read','GET','@/api/organization',['standard'],['TEAM-001'],{},'Read native membership, project grants and service purposes without credentials.'),
 op('access.update','PUT','@/api/organization/members/{id}',['access'],['TEAM-001'],{id,version:revision,role:{enum:['admin','billing','member','read-only']},grants:array(object({project:id,role:{enum:['maintainer','member','read-only']}}),100)},'Change another native member’s role and project grants; narrowing permanently retires affected keys.',{table:'spool_members',key:'id',nativeRevision:'version'}),
 op('credentials.update','DELETE','/keys/{id}',['security','live'],['AI-001'],{id},'Permanently revoke an existing project credential; never mint or reveal one.'),
 op('retention.update','PUT','/retention-policy',['live','destructive'],['GOV-002'],{revision,windows:{type:'object'},token:id,at:{type:'integer'},confirmation:text(100)},'Apply an exact native retention preview; shortening preserves its explicit confirmation and evidence fence.'),
 op('privacy.erase','POST','/erasure',['destructive'],['BASE-DATA-003'],{planHash:id},'Erase only the exact previewed project through native erasure custody. No other project is selected.'),
];
export const schemaObject = object;

export function operationDeclaration(op: NativeOperation) {
 const readOnly=op.readOnly ?? op.method==='GET';
 return {name:op.name,title:op.name,description:op.description,scope:op.name==='spool.proposals.create'?'spool:propose':readOnly?'spool:read':'spool:write',readOnly,classes:op.classes,clauses:op.clauses,
 inputSchema:schemaObject({project:{type:'string',minLength:1,maxLength:100},...op.properties},['project',...(op.required??Object.keys(op.properties))]),outputSchema:{type:['object','array']}};
}
export const witnessDeclaration={name:'spool.evidence.witness',title:'Read native effect witness',description:'Read bounded native effect and authority metadata without provider calls or credentials.',scope:'spool:read',readOnly:true,classes:['standard'] as ClassId[],clauses:['AUDIT-001','AI-001'],inputSchema:schemaObject({project:{type:'string'}}),outputSchema:{type:'object'}};
export const notificationDeclaration={name:'spool.notifications.dispatch',title:'Dispatch one admitted notification',description:'Admit one durable native alert at its final network boundary using its original sponsor, agent, consent and exact destination. Native uncertain attempts are never blindly resent.',scope:'spool:write',readOnly:false,classes:['external'] as ClassId[],clauses:['ALERT-002','ALERT-004','AUDIT-001'],inputSchema:schemaObject({project:{type:'string'},id:{type:'string'}}),outputSchema:{type:'object'}};
export const resourceTemplates=[['issues','issues/{issue}'],['packets','issues/{issue}/packet'],['outcomes','outcomes'],['proposals','grouping-proposals/{id}'],['reproducers','reproducers/{id}'],['repairs','repairs/{id}'],['fixes','fixes/{id}'],['releases','releases/{id}'],['deployments','deployments/{id}']];

export const retentionExecutionDeclaration={name:'spool.retention.execute',title:'Admit scheduled retention',description:'Admit one bounded native scheduled-retention batch under its originating agent, sponsor, consent and current policy.',scope:'spool:write',readOnly:false,classes:['standard','destructive'] as ClassId[],clauses:['GOV-002','AUDIT-001'],inputSchema:schemaObject({project:{type:'string'}}),outputSchema:{type:'object'}};
export const followupDispatchDeclaration={name:'spool.followups.dispatch',title:'Admit an alternate notice',description:'Admit one durable native Needs attention notice at its final dispatch boundary. Uncertain attempts remain uncertain.',scope:'spool:write',readOnly:false,classes:['external'] as ClassId[],clauses:['ALERT-004','AUDIT-001'],inputSchema:schemaObject({project:{type:'string'},id:{type:'string'}}),outputSchema:{type:'object'}};
