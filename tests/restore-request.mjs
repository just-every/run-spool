import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {Client} = require(require.resolve('undici', {paths: [require.resolve('wrangler/package.json')]}));

// Archive construction can outlast the local server's pooled-socket idle limit.
// A restore is a write: open a fresh public HTTP connection, never replay it.
export async function restoreRequest(url, options) {
 const client = new Client(new URL(url).origin, {pipelining: 0});
 try {
  const response = await fetch(url, {...options, dispatcher: client});
  const body = response.body ? await response.arrayBuffer() : null;
  return new Response(body, {status: response.status, statusText: response.statusText, headers: response.headers});
 } finally { await client.destroy(); }
}
