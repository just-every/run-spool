import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {restoreRequest} from './restore-request.mjs';

export async function restoreRequestFlow() {
 const sockets = new Set(); let writes = 0, dropped = 0;
 const server = createServer(async (request, response) => {
  writes++; sockets.add(request.socket);
  let body = ''; for await (const chunk of request) body += chunk;
  if (request.url === '/drop') { dropped++; request.socket.destroy(); return; }
  response.writeHead(request.url === '/refused' ? 409 : 200, {'Content-Type': 'application/json'});
  response.end(JSON.stringify({body, confirmation: request.headers['x-confirm-restore']}));
 });
 server.listen(0, '127.0.0.1'); await once(server, 'listening');
 const origin = `http://127.0.0.1:${server.address().port}`;
 const options = {method: 'POST', headers: {'Content-Type': 'application/x-ndjson', 'X-Confirm-Restore': 'yes'}, body: '{"synthetic":"archive"}\n'};
 try {
  assert.deepEqual(await (await restoreRequest(origin + '/restore', options)).json(), {body: options.body, confirmation: 'yes'});
  const refused = await restoreRequest(origin + '/refused', options);
  assert.equal(refused.status, 409); assert.equal((await refused.json()).body, options.body);
  assert.equal(sockets.size, 2, 'each restore uses a fresh connection');
  await assert.rejects(restoreRequest(origin + '/drop', options));
  assert.equal(dropped, 1, 'a closed restore POST is never replayed'); assert.equal(writes, 3);
  console.log('Restore transport: fresh public connections, unchanged body/confirmation/refusal, dropped POST sent once.');
 } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
