// The real local Worker entry (the deployed Worker plus local sign-in) with its D1 binding metered:
// every statement adds D1's own meta.rows_read. GET /__d1_meter answers the reads since the last reset.
import app, { SpoolAlertWork as AlertWork } from '../../src/server.dev.ts';

let rows = 0, unmetered = 0;
const count = meta => { if (Number.isSafeInteger(meta?.rows_read)) rows += meta.rows_read; else unmetered++; };
const native = new WeakMap();
function statement(inner) {
 const outer = new Proxy(inner, { get(target, key) {
  if (key === 'bind') return (...values) => statement(target.bind(...values));
  if (key === 'all' || key === 'run') return async () => { const result = await target[key](); count(result.meta); return result; };
  if (key === 'first') return async column => { const result = await target.all(); count(result.meta); const row = result.results[0] ?? null; return column === undefined ? row : row?.[column] ?? null; };
  if (key === 'raw') return async options => { const result = await target.all(); count(result.meta); return target.raw(options); };
  const value = Reflect.get(target, key, target);
  return typeof value === 'function' ? value.bind(target) : value;
 } });
 native.set(outer, inner);
 return outer;
}
const metered = db => new Proxy(db, { get(target, key) {
 if (key === 'prepare') return sql => statement(target.prepare(sql));
 if (key === 'batch') return async list => { const results = await target.batch(list.map(item => native.get(item) ?? item)); results.forEach(result => count(result.meta)); return results; };
 const value = Reflect.get(target, key, target);
 return typeof value === 'function' ? value.bind(target) : value;
} });

export class SpoolAlertWork extends AlertWork {
 constructor(ctx, env) { super(ctx, { ...env, DB: metered(env.DB) }); }
}

export default {
 async scheduled(event, env, context) { return app.scheduled(event, { ...env, DB: metered(env.DB) }, context); },
 async fetch(request, env, context) {
  const url = new URL(request.url);
  if (url.pathname === '/__d1_meter') {
   const report = { rows, unmetered };
   if (url.searchParams.has('reset')) rows = unmetered = 0;
   return Response.json(report);
  }
  return app.fetch(request, { ...env, DB: metered(env.DB) }, context);
 },
};
