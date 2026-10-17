import assert from 'node:assert/strict';

/** Exact source links through authenticated packet and selected-occurrence doors. */
export async function repositorySourceFlow({ req, json }) {
 const project = await json('/api/projects', 'POST', { id: 'repository-source', name: 'Repository source evidence' });
 const root = `/api/projects/${project.id}`, sha = '0123456789abcdef0123456789abcdef01234567';
 const auth = { Cookie: '', Authorization: `Bearer ${project.ingestKey}` };
 const manifest = repository => ({ repository, commitSha: sha, environment: 'production', deployedAt: '2026-10-17T00:00:00.000Z', pathMappings: [{ from: '/app', to: 'services' }, { from: '/app/checkout', to: 'packages/checkout' }, { from: 'src', to: 'packages/web/src' }] });
 const input = (id, release, extra = {}) => ({ version: 1, eventId: id, release, build: 'build', environment: 'production', language: 'python', type: 'Error', message: 'Checkout failed', frames: [{ file: '/app/checkout/cart.py', line: 7, column: null, function: 'checkout' }], breadcrumbs: [], ...extra });
 const admit = event => json(`/api/ingest/${project.id}`, 'POST', event, auth);
 const packet = issue => json(`${root}/issues/${issue}/packet`);
 const source = (value, id) => value.events.find(event => event.id === id).repositorySources[0];
 // Recording a deployment later enriches a fresh lookup, preserving admission evidence.
 await json(`${root}/releases`, 'POST', { name: 'github', build: 'build' });
 const event = input('github-event', 'github'), accepted = await admit(event);
 const before = await packet(accepted.issue), original = before.events[0].atAdmission;
 assert.equal(source(before, event.eventId).reason, 'deployment_unavailable');
 await json(`${root}/releases`, 'POST', { name: 'github', build: 'build', manifest: manifest('https://github.com/just-every/run-spool') });
 const linked = await packet(accepted.issue), link = source(linked, event.eventId);
 assert.equal(link.url, `https://github.com/just-every/run-spool/blob/${sha}/packages/checkout/cart.py#L7`, 'longest explicit prefix wins at a full recorded revision');
 assert.equal(link.verified, false); assert.equal(link.source, 'owner_or_deploy_key_recorded');
 assert.deepEqual(linked.events.find(row => row.id === event.eventId).atAdmission, original);
 const occurrence = linked.events.find(row => row.id === event.eventId).occurrence;
 const selectedPath = `${root}/issues/${accepted.issue}/events/${event.eventId}?occurrence=${occurrence}`;
 assert.deepEqual((await json(selectedPath)).repositorySources[0], link, 'selected event and packet share source evidence');
 assert.equal((await req(selectedPath, 'GET', undefined, { Cookie: '' })).status, 401);
 assert.equal((await req(`${root}/issues/${accepted.issue}/packet`, 'GET', undefined, { Cookie: '' })).status, 401);
 const agent = await json(`${root}/keys`, 'POST', { kind: 'agent' });
 const agentHeaders = { Cookie: '', Authorization: `Bearer ${agent.key}` };
 assert.deepEqual(source(await json(`${root}/issues/${accepted.issue}/packet`, 'GET', undefined, agentHeaders), event.eventId), link);
 const other = await json('/api/projects', 'POST', { id: 'repository-other', name: 'Other source project' });
 assert.ok([401, 403].includes((await req(`/api/projects/${other.id}/issues/${accepted.issue}/packet`, 'GET', undefined, agentHeaders)).status));
 for (const [name, repository, expected, language] of [
  ['gitlab', 'https://gitlab.com/example/group/shop', `https://gitlab.com/example/group/shop/-/blob/${sha}/packages/checkout/cart.py#L7`, 'python'],
  ['bitbucket', 'https://bitbucket.org/example/shop', `https://bitbucket.org/example/shop/src/${sha}/packages/checkout/cart.py#lines-7`, 'go'],
 ]) {
  await json(`${root}/releases`, 'POST', { name, build: 'build', manifest: manifest(repository) });
  const value = input(name + '-event', name, { language });
  const result = await admit(value);
  assert.equal(source(await packet(result.issue), value.eventId).url, expected);
 }
 // Unsupported hosts, other environments, nonmatching and unsafe paths remain explicit.
 await json(`${root}/releases`, 'POST', { name: 'unsupported', build: 'build', manifest: manifest('https://github.com.evil.example/example/shop') });
 const refusedHost = input('unsupported-host', 'unsupported'), refused = await admit(refusedHost);
 assert.equal(source(await packet(refused.issue), refusedHost.eventId).reason, 'repository_unsupported');
 for (const [id, extra, reason] of [
  ['wrong-environment', { environment: 'staging' }, 'deployment_unavailable'],
  ['unmatched', { frames: [{ file: '/application/cart.py', line: 7, function: 'checkout' }] }, 'path_unmatched'],
  ['unsafe', { frames: [{ file: '/app/checkout/%2e%2e/cart.py', line: 7, function: 'checkout' }] }, 'unsafe_source_path'],
 ]) {
  const value = input(id, 'github', extra), result = await admit(value);
  const row = source(await packet(result.issue), value.eventId);
  assert.equal(row.status, 'unmapped'); assert.equal(row.reason, reason); assert.ok(!row.url);
 }
 // JavaScript requires original map coordinates AND an explicit repository mapping.
 const javascript = input('javascript', 'github', { language: 'javascript', frames: [{ file: 'https://cdn.example/shop.js', line: 1, column: 0, function: 'checkout', debugId: 'repository-debug' }] });
 const javascriptResult = await admit(javascript);
 assert.equal(source(await packet(javascriptResult.issue), javascript.eventId).reason, 'original_source_unavailable');
 await json(`${root}/artifacts`, 'POST', { release: 'github', build: 'build', debugId: 'repository-debug', map: { version: 3, sources: ['src/cart.ts'], names: [], mappings: 'AAAA' } });
 const mapped = await packet(javascriptResult.issue);
 assert.equal(source(mapped, javascript.eventId).url, `https://github.com/just-every/run-spool/blob/${sha}/packages/web/src/cart.ts#L1`);
 const raw = mapped.events.find(row => row.id === javascript.eventId);
 assert.equal(raw.atAdmission[0].status, 'missing_artifact');
 assert.equal(raw.event.frames[0].file, javascript.frames[0].file, 'source linking never replaces the reported frame');
}
