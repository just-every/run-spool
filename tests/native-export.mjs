import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateCandidateSpec} from '../scripts/delivery/base/spec.mjs';

// Exercise the producer's public candidate-spec door in a bounded child: a
// backtracking regression must fail this check rather than stall verification.
if (process.argv.includes('--worker')) {
  const candidate = path => ({
    schema: 1, resources: [], migrations: [],
    compatibilityDate: '2026-01-01', compatibilityFlags: [],
    durableObjects: [{binding: 'SYNTHETIC', className: 'Synthetic'}],
    durableObjectMigrations: [], publicVariables: {}, secretNames: [],
    schedules: [], queueConsumers: [], healthPath: '/health',
    recovery: 'Restore the synthetic installation archive',
    nativeExport: {path, covers: ['SYNTHETIC']},
  });
  for (const path of ['/', '/export', '/export/', '/v1/private-export_2.json', '/a.b/~cache/', '/' + 'a'.repeat(255)]) {
    const spec = candidate(path);
    assert.equal(validateCandidateSpec(spec), spec, `accept native export path ${path}`);
  }
  for (const path of [
    '', 'export', '//export', '/a//b', '/a//', '/.', '/..', '/a/../b', '/a/./b',
    '/export?download=1', '/export#archive', '/a b', '/a\\b', '/%2e%2e',
    '/' + 'a'.repeat(256), '/' + 'a'.repeat(254) + '!',
    '/' + 'a/'.repeat(126) + 'a!', null, 42,
  ]) {
    assert.throws(() => validateCandidateSpec(candidate(path)), /Native export path must be a same-origin application path/);
  }
} else {
  const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--worker'], {
    encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  console.log('Native export candidate paths: valid paths accepted; invalid paths refused within the bounded worker');
}
