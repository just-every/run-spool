import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gitHistory, fixtureAuthor} from './fixtures.mjs';
import {runCli} from './cli.mjs';
import {runNode} from './sdk.mjs';

const find = (rows, name) => rows.find(row => row.name === name);

/** SDK-009/REL-001/TEAM-004 through unmodified sentry-cli: an SDK-created release is enriched, never split;
 * commits from the checkout resolve only the permitted issues, in order. */
export async function releaseFlow({origin, api, keys, dsn, otherDsn, emitter, temporary}) {
 const cli = (args, options = {}) => runCli(args, {origin, token: keys.deploy, ...options});
 const emit = (release, target = dsn) => runNode(emitter, {DSN: target, ...release ? {REL: release} : {}});
 const issues = async (project = 'web') => api(`/api/projects/${project}/issues`);

 // An older release registered first, so the project's first-seen order puts it before the SDK's.
 const older = await cli(['releases', 'new', 'checkout@0.9.0']);
 assert.equal(older.code, 0, older.output); assert.match(older.output, /Created release checkout@0\.9\.0/);

 await emit('checkout@1.0.0');
 let release = find(await api('/api/projects/web/releases'), 'checkout@1.0.0');
 assert.equal(release.auto_created, 1, 'the SDK event auto-created the release');
 const original = {seq: release.seq, first_seen: release.first_seen, first_environment: release.first_environment};

 const created = await cli(['releases', 'new', 'checkout@1.0.0']);
 assert.equal(created.code, 0, created.output);
 const repeat = await cli(['releases', 'new', 'checkout@1.0.0']);
 assert.equal(repeat.code, 0, repeat.output);
 const rows = await api('/api/projects/web/releases');
 assert.equal(rows.filter(row => row.name === 'checkout@1.0.0').length, 1, 'one release identity');
 release = find(rows, 'checkout@1.0.0');
 assert.deepEqual({seq: release.seq, first_seen: release.first_seen, first_environment: release.first_environment}, original, 'sequence, first-seen time and first environment are the SDK release\'s');
 assert.equal(release.auto_created, 0, 'registration removes the auto-created label');

 const finalized = await cli(['releases', 'finalize', 'checkout@1.0.0']);
 assert.equal(finalized.code, 0, finalized.output); assert.match(finalized.output, /Finalized release checkout@1.0.0/);
 const firstFinalized = find(await api('/api/projects/web/releases'), 'checkout@1.0.0').finalized;
 assert.ok(Number.isSafeInteger(firstFinalized));
 assert.equal((await cli(['releases', 'finalize', 'checkout@1.0.0'])).code, 0);
 assert.equal(find(await api('/api/projects/web/releases'), 'checkout@1.0.0').finalized, firstFinalized, 'the first finalization stands');

 const deploy = await cli(['releases', 'deploys', 'checkout@1.0.0', 'new', '-e', 'production', '-n', 'build-7']);
 assert.equal(deploy.code, 0, deploy.output); assert.match(deploy.output, /Created new deploy build-7 for 'production'/);
 const listed = await cli(['releases', 'deploys', 'checkout@1.0.0', 'list']);
 assert.match(listed.output, /production\s+\|\s+build-7/);
 const deploys = JSON.parse(find(await api('/api/projects/web/releases'), 'checkout@1.0.0').cli_deploys);
 assert.equal(deploys.length, 1); assert.equal(deploys[0].environment, 'production');
 const topLevel = await cli(['deploys', 'new', '-r', 'checkout@1.0.0', '-e', 'staging', '-n', 'canary']);
 assert.equal(topLevel.code, 0, topLevel.output); assert.match(topLevel.output, /Created new deploy canary for 'staging'/);
 assert.deepEqual(JSON.parse(find(await api('/api/projects/web/releases'), 'checkout@1.0.0').cli_deploys).map(row => row.environment).sort(), ['production', 'staging']);
 const missing = await cli(['releases', 'deploys', 'nonexistent@9.9.9', 'new', '-e', 'production']);
 assert.notEqual(missing.code, 0); assert.match(missing.output, /Release not found/);

 // Commits come from a real git history. The first commit cites the project's own issue, an unknown ID and
 // an ID of another project's issue; the cli falls back to local git when the project lists no repository.
 await emit('checkout@0.9.0', otherDsn);
 const own = (await issues()).find(row => /city/.test(row.title)), foreign = (await issues('other'))[0];
 assert.ok(own?.short_id && foreign?.short_id, 'both projects hold an issue to cite');
 assert.equal(own.state, 'open');
 const repository = resolve(temporary, 'checkout-repo'); await mkdir(repository, {recursive: true});
 const shas = gitHistory(repository, ['Initial commit', `Guard the missing address. Fixes ${own.short_id}, Resolves NOPE-404 and closes ${foreign.short_id}`]);
 for (const flags of [['--auto'], ['--commit', `acme/checkout@${shas.at(-1)}`], ['--local']]) {
  const result = await cli(['releases', 'set-commits', 'checkout@1.0.0', ...flags], {cwd: repository});
  assert.equal(result.code, 0, `${flags.join(' ')}: ${result.output}`); assert.match(result.output, /Success! Set commits for release checkout@1.0.0/);
 }
 assert.equal(find(await api('/api/projects/web/releases'), 'checkout@1.0.0').commit_count, 2, 'each commit is held once however often it is sent');
 assert.equal((await api('/api/projects/web/releases')).length, 2, 'set-commits created no further release');
 const timeline = await api(`/api/projects/web/commits/issues/${own.id}`);
 assert.equal(timeline.state, 'resolved');
 assert.equal(timeline.links.length, 1);
 assert.deepEqual({sha: timeline.links[0].sha, release: timeline.links[0].release, author: timeline.links[0].author}, {sha: shas.at(-1), release: 'checkout@1.0.0', author: fixtureAuthor});
 const log = await api('/api/projects/web/commits/link-log');
 assert.deepEqual(log.rows.map(row => [row.citation.toLowerCase(), row.reason]).sort(), [[`closes ${foreign.short_id}`.toLowerCase(), 'other_project'], ['resolves nope-404', 'unknown']].sort());
 assert.equal((await issues('other')).find(row => row.id === foreign.id).state, 'open', 'another project\'s issue is untouched');

 // Order protection: an occurrence in the older release cannot reopen it; one in a newer release does.
 await emit('checkout@0.9.0');
 assert.equal((await issues()).find(row => row.id === own.id).state, 'resolved', 'an older-release event does not regress');
 await emit('checkout@1.0.1');
 assert.equal((await issues()).find(row => row.id === own.id).state, 'open', 'a newer-release event regresses it');
 return {own};
}
