export interface RecurrencePolicy { revision:number; reopenSameRelease:boolean; updated:number|null }
export interface RecurrencePreview { revision:number; reopenSameRelease:boolean; affectedResolvedCount:number }

export async function readRecurrencePolicy(db:D1Database,project:string):Promise<RecurrencePolicy> {
 const row=await db.prepare('SELECT revision,reopen_same_release,updated FROM recurrence_policies WHERE project=?').bind(project).first<{revision:number;reopen_same_release:number;updated:number}>();
 return row?{revision:row.revision,reopenSameRelease:row.reopen_same_release===1,updated:row.updated}:{revision:0,reopenSameRelease:false,updated:null};
}

/** Named resolution already regresses at its chosen release; next resolution
 * deliberately waits above its boundary. Only current-resolution equality
 * changes when this project policy changes. Stored issue states never change. */
export async function recurrencePreview(db:D1Database,project:string,current:RecurrencePolicy,reopenSameRelease:boolean):Promise<RecurrencePreview> {
 const row=await db.prepare(`SELECT COUNT(*) count FROM issues i
  JOIN issue_resolutions z ON z.project=i.project AND z.issue=i.id AND z.mode='current'
  JOIN releases r ON r.project=i.project AND r.seq=COALESCE(z.boundary_seq,i.resolved_seq)
  WHERE i.project=? AND i.state='resolved' AND i.latest_release_seq IS NOT NULL
   AND i.algorithm IN ('js-frame-v1','python-frame-v1','go-frame-v1','sentry-chain-v1')`).bind(project).first<{count:number}>();
 return {revision:current.revision,reopenSameRelease,affectedResolvedCount:reopenSameRelease===current.reopenSameRelease?0:row!.count};
}

export function recurrenceInput(value:any) {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['revision','reopenSameRelease','apply','preview'].includes(key))||
  typeof value.reopenSameRelease!=='boolean'||!Number.isSafeInteger(value.revision)||value.revision<0||value.revision>=Number.MAX_SAFE_INTEGER)
  throw new Error('Expected same-release policy and current revision');
 if(value.apply===true){
  const p=value.preview;
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join()!=='affectedResolvedCount,reopenSameRelease,revision'||
   p.revision!==value.revision||p.reopenSameRelease!==value.reopenSameRelease||!Number.isSafeInteger(p.affectedResolvedCount)||p.affectedResolvedCount<0)
   throw new Error('Preview this policy and revision before applying');
 }else if(value.preview!==true||value.apply!==undefined&&value.apply!==false)throw new Error('Choose preview or apply');
 return value as {revision:number;reopenSameRelease:boolean;apply?:boolean;preview:true|RecurrencePreview};
}
