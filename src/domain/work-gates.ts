// A sweep over open work runs when one of its inputs changed since its last run, and at least hourly.
// Triggers from migration 0121 count the changes in spool_work_gates; a missing gate always runs.
export type WorkGate = 'follow_up_close' | 'follow_up_notices';
const backstop = 3600000;
export async function whenChanged(db: D1Database, gate: WorkGate, time: number, work: () => Promise<unknown>) {
 const row = await db.prepare('SELECT pending,done,run_at FROM spool_work_gates WHERE name=?').bind(gate).first<{ pending: number; done: number; run_at: number }>();
 if (row && row.pending === row.done && time >= row.run_at && time - row.run_at < backstop) return;
 await work();
 if (row) await db.prepare('UPDATE spool_work_gates SET done=?,run_at=? WHERE name=?').bind(row.pending, time, gate).run();
}
