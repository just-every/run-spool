import {readRetentionPolicy,retentionCutoffs} from '../retention-policy';
import type {Window} from './input';

export async function widgetCoverage(db:D1Database,project:string,window:Window){
 const [policy,counters,gaps]=await Promise.all([
  readRetentionPolicy(db,project),
  db.prepare('SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? AND window<? GROUP BY reason ORDER BY reason').bind(project,Math.floor(window.from/60000)*60000,window.to).all<{reason:string;count:number}>(),
  db.prepare("SELECT detail,created FROM audit WHERE project=? AND kind='retention_gap' ORDER BY created").bind(project).all<{detail:string;created:number}>(),
 ]);
 const removed=gaps.results.map(row=>({at:row.created,...JSON.parse(row.detail)}));
 const count=(accept:(reason:string)=>boolean)=>counters.results.filter(row=>accept(row.reason)).reduce((n,row)=>n+row.count,0);
 return {
  sampling:'All currently retained matching observations are counted; no server query sampling. SDK sampling and pre-receipt losses are unknown. These observed totals do not estimate all failures or devices.',
  retention:{windows:policy.windows,held:policy.held,policyCutoffs:retentionCutoffs(policy.windows,Date.now()),appliedCutoff:removed.length?Math.max(...removed.map(row=>Number(row.cutoff))):null,removedEvents:removed.reduce((n,row)=>n+Number(row.removed??0),0),definition:'Current policy cutoffs and recorded retention removals; missing historical observations cannot be reconstructed. Legal hold pauses expiry only.'},
  dropped:{serverRefused:count(reason=>['rate_limited','key_rate_limited','budget','rejected','invalid','oversized','unregistered_release_or_build','missing_release_register_required'].includes(reason)),filtered:count(reason=>reason==='filtered'),clientDiscardedErrors:count(reason=>reason.startsWith('client_discarded:error:')),sessionDiscarded:count(reason=>reason.startsWith('client_discarded:session:')),sessionMissingRelease:count(reason=>reason==='session_missing_release')},
  outcomes:counters.results,outcomeWindow:{from:Math.floor(window.from/60000)*60000,to:window.to,precision:'receipt minute',scope:'Project-wide counters have no event-query, release or environment attribution; reasons can overlap and must not be summed into a loss denominator. Partial minutes may include receipts outside the exact widget window.'},
 };
}
