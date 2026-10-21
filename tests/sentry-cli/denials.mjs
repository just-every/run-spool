import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runCli} from './cli.mjs';

/** An ingest, agent (read-only), revoked, foreign-project or unknown token reaches no Sentry door's storage. */
export async function denialFlow({origin, api, keys, temporary}) {
 const dist = resolve(temporary, 'denied-dist'); await mkdir(dist, {recursive: true});
 await writeFile(resolve(dist, 'a.js'), 'console.log(1)\n//# sourceMappingURL=a.js.map\n');
 await writeFile(resolve(dist, 'a.js.map'), JSON.stringify({version: 3, file: 'a.js', sources: ['a.ts'], sourcesContent: ['x'], names: [], mappings: 'AAAA'}));
 const cases = {ingest: [keys.ingest, 'web'], agent: [keys.agent, 'web'], revoked: [keys.revoked, 'web'], 'foreign project': [keys.other, 'web'], unknown: ['0'.repeat(64), 'web']};
 for (const [label, [token, project]] of Object.entries(cases)) {
  for (const args of [['releases', 'new', 'denied@1.0.0'], ['releases', 'finalize', 'denied@1.0.0'], ['releases', 'deploys', 'denied@1.0.0', 'new', '-e', 'production'], ['sourcemaps', 'upload', '--release', 'denied@1.0.0', dist]]) {
   const result = await runCli(args, {origin, token, project});
   assert.notEqual(result.code, 0, `${label}: ${args.slice(0, 2).join(' ')} is refused`);
   assert.match(result.output, /\b(401|403)\b|Invalid|scope|required|Release not found/i, `${label}: the client output names the refusal`);
  }
 }
 for (const project of ['web', 'other']) {
  assert.deepEqual(await api(`/api/projects/${project}/releases`), [], `${project}: no release was stored`);
  const stored = await api(`/api/projects/${project}/sentry-uploads`);
  assert.deepEqual(stored, {artifacts: [], assemblies: []}, `${project}: no map or assembly was stored`);
 }
}
