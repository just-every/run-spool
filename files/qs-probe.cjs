const {createRequire} = require('node:module');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const phase = process.argv[2];
assert(['before', 'after'].includes(phase));
const agent = createRequire(process.cwd() + '/packages/agent/package.json');
const sdk = createRequire(agent.resolve('@modelcontextprotocol/sdk/server/streamableHttp.js'));
const express = createRequire(sdk.resolve('express'));
const qs = express('qs');
const version = express('qs/package.json').version;
assert.equal(version, phase === 'before' ? '6.16.0' : '6.17.1');
const results = ['not callable', null, 42].map(ownToString => {
  let actual;
  try { actual = qs.stringify({a: [{toString: ownToString}]}, {arrayFormat: 'comma'}); }
  catch (e) { actual = e.name; }
  assert.equal(actual, phase === 'before' ? 'TypeError' : 'a=%5Bobject%20Object%5D');
  return {ownToString, actual};
});
assert.equal(qs.stringify({a: ['x', 'y']}, {arrayFormat: 'comma'}), 'a=x%2Cy');
assert.deepEqual(qs.parse('a[b]=c&a[d][]=1&a[d][]=2'), {a: {b: 'c', d: ['1', '2']}});
const row = {phase, version, dependencyPath: 'packages/agent -> @modelcontextprotocol/sdk 1.32.1 -> express 5.3.0 -> qs', results, ordinaryCommaStrings: 'pass', nestedQueryParsing: 'pass'};
fs.writeFileSync(path.join(__dirname, 'qs-' + phase + '.json'), JSON.stringify(row, null, 2) + '\n');
console.log(JSON.stringify(row));
