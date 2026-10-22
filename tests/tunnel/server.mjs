// Test server for the Node tunnel: static files from a directory, the installed package's nodeTunnel at POST /monitoring,
// and this process's peak resident memory (KiB) at /peak-rss, so the journey can bound what one request costs the host.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [tunnelModule, root, ...dsns] = process.argv.slice(2);
const { nodeTunnel } = await import(pathToFileURL(tunnelModule).href);
const tunnel = nodeTunnel({ dsn: dsns });
const server = createServer(async (req, res) => {
  if (req.url === '/monitoring') return tunnel(req, res);
  if (req.url === '/peak-rss') return res.end(String(process.resourceUsage().maxRSS));
  try { res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html'); res.end(await readFile(resolve(root, basename(req.url)))); } catch { res.statusCode = 404; res.end(); }
});
server.listen(0, '127.0.0.1', () => console.log(server.address().port));
