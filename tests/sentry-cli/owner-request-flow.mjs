import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {ownerRequest} from './owner-request.mjs';

// Real dropped HTTP sockets prove that recovery cannot hide a refused response,
// replay a mutation or spin indefinitely against a failed Worker.
export async function ownerRequestRecoveryFlow() {
 const counts = {read: 0, reset: 0, health: 0, mutation: 0, denied: 0, persistent: 0, unavailable: 0};
 let ready = true;
 const server = createServer((request, response) => {
  if (request.url === '/health') { counts.health++; response.writeHead(ready ? 200 : 503).end(); return; }
  if (request.url === '/read') {
   if (++counts.read === 1) { request.socket.destroy(); return; }
   response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({retained: 'synthetic-spool-read'})); return;
  }
  if (request.url === '/reset') {
   if (++counts.reset === 1) { request.socket.resetAndDestroy(); return; }
   response.end('reset recovered'); return;
  }
  if (request.url === '/mutation') { counts.mutation++; request.socket.destroy(); return; }
  if (request.url === '/denied') { counts.denied++; response.writeHead(403).end('refused'); return; }
  if (request.url === '/persistent') { counts.persistent++; request.socket.destroy(); return; }
  counts.unavailable++; request.socket.destroy();
 });
 server.listen(0, '127.0.0.1'); await once(server, 'listening');
 const origin = `http://127.0.0.1:${server.address().port}`;
 try {
  assert.deepEqual(await (await ownerRequest(origin + '/read')).json(), {retained: 'synthetic-spool-read'});
  assert.equal(counts.read, 2); assert.equal(counts.health, 1);
  assert.equal(await (await ownerRequest(origin + '/reset')).text(), 'reset recovered');
  assert.equal(counts.reset, 2); assert.equal(counts.health, 2);
  await assert.rejects(ownerRequest(origin + '/mutation', {method: 'POST', body: '{}'}));
  assert.equal(counts.mutation, 1); assert.equal(counts.health, 2, 'a mutation is never retried or health-polled');
  assert.equal((await ownerRequest(origin + '/denied')).status, 403);
  assert.equal(counts.denied, 1); assert.equal(counts.health, 2, 'an HTTP refusal is returned without retry');
  await assert.rejects(ownerRequest(origin + '/persistent'), failure => failure.cause?.code === 'UND_ERR_SOCKET');
  assert.equal(counts.persistent, 3); assert.equal(counts.health, 4, 'persistent socket failure stops after two retries');
  ready = false;
  await assert.rejects(ownerRequest(origin + '/unavailable'), /did not become health-ready/);
  assert.equal(counts.unavailable, 1); assert.equal(counts.health, 9, 'unready Worker stops after five readiness probes');
  console.log('Sentry owner read recovery: closed/reset GETs recovered; POST not replayed; 403 not retried; persistent socket and unhealthy Worker bounded.');
 } finally {
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
 }
}
