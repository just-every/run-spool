// Run Edit Run fleet, 2026-11-17. One-off maintenance proof; no product pin test.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';

const agentRequire = createRequire(resolve('packages/agent/package.json'));
const expressEntry = agentRequire.resolve('@modelcontextprotocol/sdk/server/express.js');
const sdkRequire = createRequire(expressEntry);
const rateLimitEntry = sdkRequire.resolve('express-rate-limit');
const rateLimitRequire = createRequire(rateLimitEntry);
const ipAddressEntry = rateLimitRequire.resolve('ip-address');
const { Address6 } = rateLimitRequire('ip-address');
const { rateLimit, ipKeyGenerator } = sdkRequire('express-rate-limit');
const { createMcpExpressApp } = await import(pathToFileURL(expressEntry));
assert.equal(new Address6('fe80::1%eth0').zone, '%eth0');
assert.equal(new Address6('2001:db8::1').canonicalForm(), '2001:0db8:0000:0000:0000:0000:0000:0001');
assert.equal(ipKeyGenerator('192.0.2.1'), '192.0.2.1');
assert.equal(ipKeyGenerator('2001:db8:abcd:12ff::2'), ipKeyGenerator('2001:db8:abcd:1200::1'));
assert.notEqual(ipKeyGenerator('2001:db8:abcd:1300::1'), ipKeyGenerator('2001:db8:abcd:1200::1'));

const started = performance.now();
const regression = spawnSync(process.execPath, ['--input-type=commonjs', '-e', `
const assert = require('node:assert/strict');
const { Address6 } = require(process.argv[1]);
const input = 'fe80::1' + '%'.repeat(2_000_000) + '\\n';
assert.throws(() => new Address6(input));
process.stdout.write('oversized malformed zone refused\\n');
`, ipAddressEntry], { timeout: 5000, encoding: 'utf8' });
assert.ifError(regression.error);
assert.equal(regression.status, 0, regression.stderr);
const zoneMilliseconds = Math.round(performance.now() - started);

const app = createMcpExpressApp();
app.set('trust proxy', 'loopback');
const limiter = rateLimit({ windowMs: 30_000, limit: 2, standardHeaders: 'draft-8', legacyHeaders: false });
app.get('/maintenance-proof', limiter, (_request, response) => response.json({ admitted: true }));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}/maintenance-proof`;
const statuses = [];
try {
  for (const ip of ['2001:db8:abcd:1200::1', '2001:db8:abcd:12ff::2', '2001:db8:abcd:1201::3', '2001:db8:abcd:1300::1', '192.0.2.1']) {
    const response = await fetch(url, { headers: { 'x-forwarded-for': ip } });
    statuses.push(response.status);
    if (response.status === 429) assert.ok(Number(response.headers.get('retry-after')) > 0);
    await response.arrayBuffer();
  }
  assert.deepEqual(statuses, [200, 200, 429, 200, 200]);
} finally {
  server.closeAllConnections();
  await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept()));
  await limiter.resetKey(ipKeyGenerator('2001:db8:abcd:1200::1'));
}
console.log(JSON.stringify({ status: 'passed', ordinaryIPv6AndZone: true, oversizedMalformedZoneRefused: true, zoneMilliseconds, zoneDeadlineMilliseconds: 5000, sharedSubnetAndIndependentAddressStatuses: statuses, retryAfterPresent: true, serverClosed: true }));
