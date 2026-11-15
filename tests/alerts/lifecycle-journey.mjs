import assert from 'node:assert/strict';
import {metric,sentry} from '../alerts-metric.mjs';
import {rule} from './runtime.mjs';
import {followErasure} from '../project-erasure/follow.mjs';
export const alertCustodyTables=['sentry_transactions','alert_target_destinations','alert_intent_recipients','alert_metric_states','alert_metric_events'];
export async function alertLifecycleJourney(app,metrics,targets){
 const successful=await app.json(`/api/projects/${metrics.project.id}/follow-up`);
 assert.ok(!successful.rows.some(row=>['capture_loss_transaction_stored','capture_loss_transaction_duplicate'].includes(row.reason)),'accepted and duplicate transactions never become capture loss');
 const loss=successful.rows.find(row=>row.reason==='capture_loss_transaction_invalid');assert.ok(loss&&loss.capture_loss===1,'a refused invalid transaction remains truthful loss');
 const config=metric('errors',{}, {triggers:[{label:'critical',alertThreshold:0.5}],resolveThreshold:0});
 const draft=rule('mail',{name:'Checkout recipient unavailable',destination:targets.retiredDestination,kinds:['metric'],windowMs:600000,config});
 const created=await app.json(targets.base+'/rules','POST',draft),end=Math.ceil(Date.now()/60000)*60000;
 const tick=async time=>{const result=await app.tick(time);assert.equal(result.status,200)};
 await tick(end);
 const delivery=(await app.json(targets.base+'/deliveries')).find(row=>row.rule_id===created.id);assert.equal(delivery.state,'blocked');assert.equal(delivery.issue,null);
 let attention=(await app.json(`/api/projects/${targets.project.id}/follow-up`)).rows.find(row=>row.source_id===delivery.id);assert.equal(attention.state,'blocked','a metric has accountable failure without a synthetic issue');
 const kept=attention.id;await tick(end);attention=(await app.json(`/api/projects/${targets.project.id}/follow-up`)).rows.filter(row=>row.source_id===delivery.id);assert.equal(attention.length,1);assert.equal(attention[0].id,kept,'replay retains one failure');
 await app.json(targets.base+'/rules/'+created.id,'PUT',{...draft,enabled:false,revision:created.revision});await tick(end+60000);
 assert.equal((await app.json(`/api/projects/${targets.project.id}/follow-up`)).rows.find(row=>row.id===kept).state,'completed','revoking a blocked metric rule closes its source without a send');
 const response=await sentry(app,targets.project,[['transaction',{type:'transaction',event_id:'e'.repeat(32),transaction:'/v1/checkout',environment:'production',release:'r1',start_timestamp:(Date.now()-1000)/1000,timestamp:Date.now()/1000}]]);assert.equal(response.status,200);assert.equal((await response.json()).transactions.transaction_stored,1);
 const preview=await app.json(`/api/projects/${targets.project.id}/erasure`);
 for(const table of alertCustodyTables)assert.ok(preview.deleted[table]>0,'count-only preview includes '+table);
 const survivor=(await app.db.prepare('SELECT * FROM sentry_transactions WHERE project=? ORDER BY id').bind(metrics.project.id).all()).results;
 const receipt=await followErasure(app.json,await app.json(`/api/projects/${targets.project.id}/erasure`,'POST',{confirm:targets.project.id,planHash:preview.planHash}));assert.equal(receipt.phase,'complete');
 for(const table of alertCustodyTables)assert.equal((await app.db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE project=?`).bind(targets.project.id).first()).n,0,'project erasure removes '+table);
 assert.deepEqual((await app.db.prepare('SELECT * FROM sentry_transactions WHERE project=? ORDER BY id').bind(metrics.project.id).all()).results,survivor,'another project retains its actual observations');
 assert.equal((await app.db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
 console.log('Native metric failure/revocation, truthful capture-loss accounting and populated project alert custody erasure passed');
}
