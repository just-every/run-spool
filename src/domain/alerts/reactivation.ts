import { statement as s } from './types';

// Joins the existing triage transaction, before its revision-fenced update.
export function reactivationMarker(db:D1Database,issue:string,revision:number,state:string) {
 return s(db,"INSERT INTO alert_reactivation_markers SELECT project,id,revision+1 FROM issues WHERE id=? AND revision=? AND state='suppressed' AND ?='open' ON CONFLICT(project,issue) DO UPDATE SET revision=excluded.revision",issue,revision,state);
}
