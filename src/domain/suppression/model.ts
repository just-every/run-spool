import {canonical,hash} from '../privacy';
import {scrubText} from '../scrub';
import {activity} from '../discussion/model';
import {s,guard} from '../operators/common';

export const suppressionModes=['forever','until','count','users','escalating','snooze'] as const;
export type SuppressionMode=typeof suppressionModes[number];
export type SuppressionInput={mode:SuppressionMode;reason:string;until?:number;count?:number;users?:number;durationMs?:number};
export type SuppressionMetrics={occurrences:number;users:number;unattributed:number;rollingOccurrences:number;historicalHourlyMaximum:number};
export type SuppressionPlan={project:string;issue:string;revision:number;input:SuppressionInput;deadline:number|null;occurrenceTarget:number|null;userTarget:number|null;windowMs:number|null;forecast:number|null;metrics:SuppressionMetrics};
export const hour=3600000;
// Same identity and native-client definition as SDK008 identities/read.ts.
export const affectedIdentitySql=`COALESCE(x.user_key,CASE WHEN json_extract(e.payload,'$.sentry') IS NULL AND json_extract(e.payload,'$.client') IS NOT NULL THEN 'native:'||json_extract(e.payload,'$.client') END)`;
export const userCountSql=(project:string,issue:string)=>`(SELECT COUNT(DISTINCT ${affectedIdentitySql}) FROM events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence WHERE e.project=${project} AND e.issue=${issue})`;

export function suppressionInput(value:any,time:number):SuppressionInput {
 if(!value||typeof value!=='object'||Array.isArray(value)||!suppressionModes.includes(value.mode)||typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.reason))throw new Error('Choose an archive condition and a reason of 1 to 500 characters');
 const field=({until:'until',count:'count',users:'users',snooze:'durationMs'} as Record<string,string>)[value.mode];
 if(Object.keys(value).some(key=>!['mode','reason',...(field?[field]:[])].includes(key)))throw new Error('Unexpected archive condition field');
 if(field&&(!Number.isSafeInteger(value[field])||value[field]<=0))throw new Error('Archive threshold must be a positive integer');
 if(value.mode==='until'&&value.until<=time)throw new Error('Choose a future archive deadline');
 if(value.mode==='snooze'&&(!Number.isSafeInteger(time+value.durationMs)))throw new Error('Invalid snooze duration');
 const reason=scrubText(value.reason.trim(),500);if(!reason.trim())throw new Error('Archive reason is required');
 return {mode:value.mode,reason,...field?{[field]:value[field]}:{}};
}

export async function suppressionMetrics(db:D1Database,project:string,issue:string,time:number):Promise<SuppressionMetrics>{
 const row=await s(db,`SELECT COUNT(*) occurrences,COUNT(DISTINCT ${affectedIdentitySql}) users,
  COALESCE(SUM(CASE WHEN ${affectedIdentitySql} IS NULL THEN 1 ELSE 0 END),0) unattributed,
  COALESCE(SUM(CASE WHEN e.received>? AND e.received<=? THEN 1 ELSE 0 END),0) rollingOccurrences
  FROM events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence WHERE e.project=? AND e.issue=?`,time-hour,time,project,issue).first<any>();
 const history=await s(db,`SELECT COALESCE(MAX(n),0) maximum FROM (SELECT COUNT(*) n FROM events WHERE project=? AND issue=? AND received<? GROUP BY CAST(received/? AS INTEGER))`,project,issue,Math.floor(time/hour)*hour,hour).first<any>();
 return {...row,historicalHourlyMaximum:history.maximum};
}

export async function planSuppression(db:D1Database,project:string,issue:{id:string;revision:number;count:number},value:any,time:number):Promise<SuppressionPlan>{
 const input=suppressionInput(value,time),metrics=await suppressionMetrics(db,project,issue.id,time);
 const occurrenceTarget=input.mode==='count'?issue.count+input.count!:null;
 if(occurrenceTarget!==null&&!Number.isSafeInteger(occurrenceTarget))throw new Error('Occurrence threshold is too large');
 return {project,issue:issue.id,revision:issue.revision,input,metrics,deadline:input.mode==='until'?input.until!:input.mode==='snooze'?time+input.durationMs!:null,
  occurrenceTarget,userTarget:input.mode==='users'?input.users!:null,windowMs:input.mode==='escalating'?hour:null,
  forecast:input.mode==='escalating'?Math.max(metrics.rollingOccurrences,metrics.historicalHourlyMaximum):null};
}
export const suppressionSignature=(plan:SuppressionPlan)=>hash(canonical({...plan,deadline:plan.input.mode==='snooze'?null:plan.deadline}));
export const suppressionFences=(db:D1Database,plan:SuppressionPlan)=>[
 guard(db,`EXISTS(SELECT 1 FROM issues WHERE project=? AND id=? AND revision=?) AND ${userCountSql('?','?')}=?`,plan.project,plan.issue,plan.revision,plan.project,plan.issue,plan.metrics.users),
];
export function suppressionStatements(db:D1Database,plan:SuppressionPlan,id:string,time:number){
 return [
  s(db,"UPDATE issue_suppressions SET state='ended',ended=? WHERE project=? AND issue=? AND historical=0 AND state='active'",time,plan.project,plan.issue),
  s(db,`INSERT INTO issue_suppressions(id,project,issue,mode,reason,deadline,occurrence_target,user_target,window_ms,forecast,started,state,ended,historical) VALUES(?,?,?,?,?,?,?,?,?,?,?,'active',NULL,0)`,id,plan.project,plan.issue,plan.input.mode,plan.input.reason,plan.deadline,plan.occurrenceTarget,plan.userTarget,plan.windowMs,plan.forecast,time),
  s(db,"UPDATE issues SET state='suppressed',resolved_seq=NULL,revision=revision+1 WHERE project=? AND id=? AND revision=?",plan.project,plan.issue,plan.revision),
  activity(db,plan.project,plan.issue,'suppression_started',{suppression:id,mode:plan.input.mode,reason:plan.input.reason,deadline:plan.deadline,occurrenceTarget:plan.occurrenceTarget,userTarget:plan.userTarget,windowMs:plan.windowMs,forecast:plan.forecast},time),
 ];
}
