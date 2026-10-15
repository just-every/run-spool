import assert from 'node:assert/strict';
import {legacyMailRows} from '../legacy-mail.mjs';
import {canonical} from '../../src/domain/privacy.ts';
// Every archived row count, the exact repair rows, delivery rows and the local
// development outbox: the observable effects a repair write could have.
export async function snapshot(app){
 const {data}=await app.archive();
 const outbox=(await legacyMailRows(app.origin)).length;
 return {rows:Object.fromEntries(Object.entries(data).map(([table,rows])=>[table,rows.length])),repairs:canonical(data.repairs),checks:canonical(data.repair_checks),deliveries:data.alert_history.length,alerts:data.alerts.length,outbox,data};
}
export async function unchanged(app,before,label){
 const after=await snapshot(app);
 assert.deepEqual(after.rows,before.rows,label+': row counts unchanged');assert.equal(after.repairs,before.repairs,label+': repairs unchanged');assert.equal(after.checks,before.checks,label+': checks unchanged');
 return after;
}
// A repair write sends no mail or webhook and creates no alert or delivery row.
export async function quiet(app,before,label){
 const after=await snapshot(app);
 assert.equal(after.outbox,before.outbox,label+': no outbox message');assert.equal(after.deliveries,0,label+': no delivery rows');assert.equal(after.alerts,before.alerts,label+': no alert rows');
 return after;
}
export async function status(app,path,body,expected,options={},label=path){
 const response=await app.request(path,'POST',body,options);assert.equal(response.status,expected,label);return response.json().catch(()=>null);
}
export const reasons=repair=>repair.observation.reasons.map(row=>row.code);
