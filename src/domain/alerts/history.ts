import { statement as s,type AlertEnvironment } from './types';

export async function synchronizeHistory(env:AlertEnvironment,time:number) {
 if(!await s(env.DB,'SELECT 1 FROM alert_history_dirty LIMIT 1').first())return;
 // Clearing markers and publishing the projection share a transaction. A
 // competing claim either contributes here or leaves a marker for the next run.
 await env.DB.batch([
  s(env.DB,`WITH changed AS MATERIALIZED (
   SELECT p.id,p.state,p.attempts,p.code
   FROM alert_history_dirty q CROSS JOIN alert_history_projection p ON p.id=q.id AND p.project=q.project
  )
  UPDATE alert_history AS h SET (state,attempts,code,updated)=(
   SELECT p.state,p.attempts,p.code,? FROM changed p WHERE p.id=h.id
  ) WHERE id IN (SELECT id FROM changed) AND (state,attempts,code) IS NOT (
   SELECT p.state,p.attempts,p.code FROM changed p WHERE p.id=h.id
  )`,time),
  s(env.DB,'DELETE FROM alert_history_dirty'),
 ]);
}
