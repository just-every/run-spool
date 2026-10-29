export interface ReportInput { from:number; to:number; timeZone:string; team?:string }
export interface ReportBucket { from:number; to:number; label:string; events:number; newIssues:number; regressions:number; resolutions:number }
export interface ReportEvent { project:string; issue:string; received:number; release:string; user_key:string|null; dropped:number|null }
export interface ReportIssue { project:string; id:string; state:string; first_seen:number; last_seen:number; algorithm:string; label:string|null }
export interface HistoryRow { project:string; kind:string; detail:string; created:number }
export interface AttentionRow { project:string; issue:string; id:string; kind:string; created:number }
export interface ReviewRow { project:string; issue:string; alert:string; reviewed:number }
export interface ExcludedIssue { project:string; issue:string; reason:string }
export interface StateCounts { open:number; acknowledged:number; resolved:number; suppressed:number; total:number; excluded:number }
export interface ReportRead {
 events:ReportEvent[]; issues:ReportIssue[]; history:HistoryRow[]; alerts:AttentionRow[]; reviews:ReviewRow[];
 corrections:{project:string; state:string; plan:string}[];
 outcomes:{project:string; reason:string; count:number}[];
}
