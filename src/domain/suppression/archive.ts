import {scrubText} from '../scrub';
import {suppressionModes,hour} from './model';
export const suppressionTables={issue_suppressions:['id','project','issue','mode','reason','deadline','occurrence_target','user_target','window_ms','forecast','started','state','ended','historical','observed_count']};
export const suppressionDefaults=(data:any)=>({issue_suppressions:[],...data});
export const suppressionExportRow=(table:string,row:any)=>table==='issue_suppressions'?{...row,reason:scrubText(row.reason,500),historical:1}:row;
const integer=(value:any)=>Number.isSafeInteger(value)&&value>=0;
export function validateSuppressionArchive(data:any){
 const issues=new Map<string,string>(data.issues.map((row:any)=>[row.id,row.project])),ids=new Set<string>();
 for(const row of data.issue_suppressions){
  if(Object.keys(row).sort().join()!==[...suppressionTables.issue_suppressions].sort().join()||issues.get(row.issue)!==row.project||typeof row.id!=='string'||!row.id||row.id.length>100||ids.has(row.id)||
   !suppressionModes.includes(row.mode)||typeof row.reason!=='string'||!row.reason.trim()||row.reason.length>500||scrubText(row.reason,500)!==row.reason||
   !integer(row.observed_count)||!integer(row.started)||!['active','expired','ended'].includes(row.state)||row.historical!==1||
   (row.state==='active'?row.ended!==null:!integer(row.ended)||row.ended<row.started))throw new Error('Archive issue suppression');
  const deadline=['until','snooze'].includes(row.mode),count=row.mode==='count',users=row.mode==='users',forecast=row.mode==='escalating';
  if((deadline?!integer(row.deadline)||row.deadline<=row.started:row.deadline!==null)||
   (count?!integer(row.occurrence_target)||row.occurrence_target<1:row.occurrence_target!==null)||
   (users?!integer(row.user_target)||row.user_target<1:row.user_target!==null)||
   (forecast?row.window_ms!==hour||!integer(row.forecast):row.window_ms!==null||row.forecast!==null))throw new Error('Archive suppression condition');
  ids.add(row.id);
 }
}
