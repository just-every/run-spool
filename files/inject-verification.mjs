// Run Edit Run fleet, 2026-11-17. Ad hoc verification; no product test registration.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';

const repo = resolve(process.argv[2]);
const require = createRequire(resolve(repo, 'package.json'));
const {parse} = require('@babel/parser');
const {TraceMap, originalPositionFor} = require('@jridgewell/trace-mapping');
const {injectDebugId} = await import(pathToFileURL(resolve(repo, 'packages/sdk/src/sourcemaps/inject.mjs')));
const beforeFix = execFileSync('git', ['show', 'a2e7bffed0a4c089f570ddd2876595396f6d7e54:packages/sdk/src/sourcemaps/inject.mjs'], {cwd: repo, encoding: 'utf8'});
const oldSource = beforeFix.replace("'./position.mjs'", JSON.stringify(pathToFileURL(resolve(repo, 'packages/sdk/src/sourcemaps/position.mjs')).href));
const {injectDebugId: originalInjector} = await import('data:text/javascript;base64,' + Buffer.from(oldSource).toString('base64'));
const baseMap = {version: 3, sources: ['synthetic-spool-1.js'], sourcesContent: ['globalThis.result = 42;'], names: [], mappings: 'AAAA'};
const rows = [];
for (const [name, code] of [
  ['ordinary script', 'globalThis.result = 42;'],
  ['strict script', '"use strict";globalThis.result = 42;'],
  ['directive-only eval', '"use strict";'],
  ['source directive lookalike', 'globalThis.result = "//# sourceMappingURL=synthetic.js.map";'],
  ['source map comment', 'globalThis.result = 42;\n//# sourceMappingURL=synthetic.js.map\n'],
]) {
  const output = injectDebugId(code, baseMap);
  assert.deepEqual(output, originalInjector(code, baseMap), name + ': original and current output are byte-identical for flat maps');
  assert.match(output.debugId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  parse(output.code, {sourceType: 'script'});
  const context = vm.createContext({});
  const result = vm.runInContext(output.code, context);
  const untouched = vm.createContext({});
  assert.equal(result, vm.runInContext(code, untouched), name + ': eval completion retained');
  assert.equal(context.result, untouched.result, name + ': application behavior retained');
  assert.equal(context._sentryDebugIdIdentifier, 'sentry-dbid-' + output.debugId);
  assert.deepEqual(Object.values(context._sentryDebugIds), [output.debugId]);
  assert.deepEqual(injectDebugId(output.code, output.map), output, name + ': reinjection is idempotent');
  rows.push({name, passed: true, debugId: output.debugId});
}
const mapped = injectDebugId('globalThis.result = 42;', baseMap);
const generatedLine = mapped.code.split('\n').findIndex(line => line.startsWith('globalThis.result')) + 1;
assert.deepEqual(originalPositionFor(new TraceMap(mapped.map), {line: generatedLine, column: 0}), {source: baseMap.sources[0], line: 1, column: 0, name: null});
rows.push({name: 'source coordinates preserved after registration', passed: true});
const indexed = injectDebugId('globalThis.result = 42;', {version:3, sections:[{offset:{line:0,column:0},map:baseMap}]});
assert.equal(indexed.map.sections, undefined);
assert.deepEqual(injectDebugId(indexed.code, indexed.map), indexed);
rows.push({name: 'indexed map normalization and reinjection', passed: true});
for (const field of ['debug_id', 'debugId']) {
  assert.throws(() => injectDebugId('globalThis.result = 42;', {...baseMap, [field]: '";globalThis.injected = true;//'}), /Invalid source map debug ID/);
}
rows.push({name: 'externally supplied JavaScript-shaped debug IDs rejected', passed: true});
const hostileMap = {...baseMap, sources:['";globalThis.injected = true;//'], sourcesContent:['";globalThis.injected = true;//'], names:['";globalThis.injected = true;//']};
const isolated = injectDebugId('globalThis.result = 42;', hostileMap);
const context = vm.createContext({});
vm.runInContext(isolated.code, context);
assert.equal(context.result, 42);
assert.equal(context.injected, undefined);
assert.deepEqual(Object.values(context._sentryDebugIds), [isolated.debugId]);
rows.push({name: 'source map strings cannot become executable registration code', passed: true});
console.log(JSON.stringify({passed:true, node:process.version, head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(), checks:rows.length, rows},null,2));
