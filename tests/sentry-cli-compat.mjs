import assert from 'node:assert/strict';
import {mkdtemp, realpath, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {startTestWorker} from './worker.mjs';
import {signIn} from './auth.mjs';
import {writeEmitter} from './sentry-cli/sdk.mjs';
import {denialFlow, hostileBundleFlow} from './sentry-cli/denials.mjs';
import {releaseFlow} from './sentry-cli/release-flow.mjs';
import {mapFlow} from './sentry-cli/map-flow.mjs';
import {pluginFlow} from './sentry-cli/plugin-flow.mjs';
import {chunkFlow} from './sentry-cli/chunk-flow.mjs';
import {debugFlow} from './sentry-cli/debug-flow.mjs';
import {durableFlow} from './sentry-cli/durable.mjs';
import {fieldRefusalFlow} from './sentry-cli/field-refusals.mjs';

// SRC-003: the released sentry-cli and the unmodified Node SDK against the real emitted Worker. Only the Sentry URL,
// organization and project slugs and the auth token are set, as a team's existing CI would set them.
// The plugins run the newer `sentry` CLI in this process; its state and telemetry stay out of the checkout and the network.
process.env.SENTRY_CLI_NO_TELEMETRY = '1'; process.env.SENTRY_CLI_NO_UPDATE_CHECK = '1'; process.env.NO_PROXY = '127.0.0.1'; process.env.no_proxy = '127.0.0.1';
const app = await startTestWorker(15611), origin = app.origin, temporary = await realpath(await mkdtemp(resolve(tmpdir(), 'spool-sentry-cli-')));
process.env.SENTRY_CONFIG_DIR = resolve(temporary, 'sentry-config');
try {
 const cookie = await signIn(origin);
 const req = (path, method = 'GET', body, headers = {}) => fetch(origin + path, {method, headers: {Origin: origin, Cookie: cookie, ...body ? {'Content-Type': 'application/json'} : {}, ...headers}, ...body ? {body: JSON.stringify(body)} : {}});
 const api = async (...args) => { const response = await req(...args); assert.ok(response.ok, `${args[0]} ${response.status}: ${await response.clone().text()}`); return response.json(); };
 const web = await api('/api/projects', 'POST', {id: 'web', name: 'Web storefront'}), other = await api('/api/projects', 'POST', {id: 'other', name: 'Other project'});
 await api('/api/projects', 'POST', {id: 'chunks', name: 'Chunked uploads'});
 const key = async (project, kind) => (await api(`/api/projects/${project}/keys`, 'POST', {kind}));
 const revoked = await key('web', 'deploy'); await api(`/api/projects/web/keys/${revoked.hash}`, 'DELETE');
 const keys = {deploy: (await key('web', 'deploy')).key, ingest: (await key('web', 'ingest')).key, agent: (await key('web', 'agent')).key, revoked: revoked.key, other: (await key('other', 'deploy')).key, chunks: (await key('chunks', 'deploy')).key};
 const emitter = await writeEmitter(temporary), context = {origin, api, req, keys, dsn: web.dsn, otherDsn: other.dsn, emitter, temporary, db: app.db};
 await denialFlow(context);
 await hostileBundleFlow(context);
 await releaseFlow(context);
 await mapFlow(context);
 await pluginFlow(context);
 await chunkFlow(context);
 await fieldRefusalFlow(context);
 await debugFlow(context);
 await durableFlow(context);
 console.log('[SRC-004] SRC-003 sentry-cli journey passed: denials, release/commit/deploy enrichment, debug-ID and release/dist maps, the Vite, esbuild, Rollup and webpack plugins, chunk interruption and resume, refusals by name, archive, restore and erasure.');
} finally {
 await app.stop();
 await rm(temporary, {recursive: true, force: true});
}
