#!/usr/bin/env node
/* Live probe for the rows DESIGN.md marks live-only. Shared Cloudflare accounts are allowed:
 * it creates egress-service-probe and egress-probe-probe, runs the edge rows, then deletes only
 * these run-created Workers after verifying their recorded provider identities. It refuses if
 * either name already exists, and requires the owner to name the account twice. Uncertain
 * uploads or replaced Workers are left for inspection, with their local ownership state retained.
 *
 *   CLOUDFLARE_ACCOUNT_ID=<id> CLOUDFLARE_API_TOKEN=<token> \
 *     node modules/egress-service/owner-probe.mjs --account <id> --confirm-throwaway <id> [--receiver https://...]
 *
 * Public test services contacted from the edge: example.com, httpbin.org, badssl.com,
 * localtest.me, nip.io, ipv6.google.com and the fixed DoH resolver cloudflare-dns.com. */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { readAccountOwnership } from './account-ownership.mjs';
import { deleteWorker } from '../deploy-kit/teardown.mjs';
import { buildEgressWorker } from './build.mjs';
import { probeDiagnostic, responseDiagnostic } from './probe-diagnostics.mjs';
import { createProbeNetwork } from './probe-network.mjs';

const ENVIRONMENT = 'probe';
const EGRESS = 'egress-service-probe', PROBE = 'egress-probe-probe';
const network = createProbeNetwork();
// Twelve sequential service sends allow 15 s DNS + 15 s exchange each; direct
// diagnostics add at most 30 s. Leave 30 s for invocation and response transfer.
const invocationDeadline = { '/ready': 5000, '/run': 420000, '/narrow': 65000 };
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.length > 0;
const isStatus = value => Number.isInteger(value) && value >= 100 && value <= 599;
const isSend = value => isRecord(value) && ((isText(value.error) && value.status === undefined)
  || (isStatus(value.status) && value.error === undefined))
  && (value.location == null || typeof value.location === 'string');

// Validate row structure separately from its outcome: missing evidence is never a pass,
// including predicates that would otherwise short-circuit or accept an empty collection.
const complete = {
  P1: r => ['receiver', 'exampleCom', 'goodCertificate'].every(key => isSend(r.P1[key])),
  P2: r => isRecord(r.P1) && isSend(r.P1.receiver) && isSend(r.P1.goodCertificate)
    && ['wrongHost', 'selfSigned', 'untrustedRoot', 'expired'].every(key => isSend(r.P2[key])),
  P3: r => isText(r.P3.name) && isSend(r.P3.nxdomain) && isSend(r.P3.publicName)
    && Array.isArray(r.P3.diagnosticSecondQueries) && r.P3.diagnosticSecondQueries.length === 4
    && r.P3.diagnosticSecondQueries.every(q => isRecord(q) && isText(q.name) && isText(q.type) && isStatus(q.httpStatus) && isText(q.classification)),
  P4: r => r.P4.status === null || isStatus(r.P4.status),
  P5: r => r.P5.grantVerified === false || (r.P5.grantVerified === true && isSend(r.P5.allowed) && isSend(r.P5.narrowed)),
  P6: r => ['fetchPrivate', 'fetchPrivateName', 'connectPrivate'].every(key => isRecord(r.P6[key])
    && ((isText(r.P6[key].error) && r.P6[key].outcome === undefined)
      || (r.P6[key].error === undefined && (isStatus(r.P6[key].outcome) || r.P6[key].outcome === 'opened')))),
  P7: r => isSend(r.P7.redirect),
  P8: r => isSend(r.P8.localtest) && isSend(r.P8.nip),
  P9: r => isSend(r.P9.ipv6Only),
};

export function guard(argv, env) {
  let values;
  try { ({ values } = parseArgs({ args: argv, strict: true, options: { account: { type: 'string' }, 'confirm-throwaway': { type: 'string' }, receiver: { type: 'string' } } })); }
  catch { throw new Error('usage: --account <id> --confirm-throwaway <same id> [--receiver https://...]'); }
  const account = values.account ?? '';
  if (!/^[a-f0-9]{32}$/.test(account)) throw new Error('refused: name the throwaway account id with --account');
  if (values['confirm-throwaway'] !== account) throw new Error('refused: --confirm-throwaway must repeat the same throwaway account id');
  if (env.CLOUDFLARE_ACCOUNT_ID !== account) throw new Error('refused: CLOUDFLARE_ACCOUNT_ID must be the named throwaway account');
  if (!env.CLOUDFLARE_API_TOKEN?.trim()) throw new Error('refused: CLOUDFLARE_API_TOKEN is required');
  if (values.receiver !== undefined && !/^https:\/\/[^/@\s]+\/\S*$/.test(values.receiver)) throw new Error('refused: --receiver must be an https URL you own');
  return { account, token: env.CLOUDFLARE_API_TOKEN, receiver: values.receiver ?? 'https://httpbin.org/post' };
}

/** /run collects independent rows; /narrow runs only after strict props readback succeeds. */
export const probeWorker = `
import { connect } from 'cloudflare:sockets';
const network = (${createProbeNetwork.toString()})();
const wire = url => ({ url, headers: { 'content-type': 'application/json' }, body: '{"probe":"rer-egress"}' });
async function send(binding, url) { try { const r = await binding.send(wire(url)); return { status: r.status, location: r.headers.location ?? null }; } catch (e) { return { error: String(e.message) }; } }
async function raw(fn) { try { return { outcome: await fn() }; } catch (e) { return { error: network.errorCode(e) }; } }
async function rawExample() {
  try {
    const dns = await network.request('https://cloudflare-dns.com/dns-query?name=example.com&type=A', { headers:{accept:'application/dns-json'}, redirect:'manual' }, async (response, readText) => {
      if (response.status !== 200) throw new Error('probe_response_invalid');
      return JSON.parse(await readText());
    });
    return await Promise.all((dns.Answer ?? []).filter(a => a.type === 1).map(async a => {
      try { await network.socket(connect, {hostname:a.data,port:443},{secureTransport:'off',allowHalfOpen:false}); return {address:a.data,opened:true}; }
      catch(error) { return {address:a.data,error:network.errorCode(error)}; }
    }));
  } catch (error) { return { error: network.errorCode(error) }; }
}
async function dnsEvidence(names) { return Promise.all(names.flatMap(name => ['A', 'AAAA'].map(async type => {
  try { return await network.request('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(name) + '&type=' + type, { headers: {accept: 'application/dns-json'}, redirect: 'manual' }, async (r, readText) => {
    const body = await readText(); let classification = 'invalid';
    try { const json = JSON.parse(body); classification = json.Status === 3 ? 'NXDOMAIN' : json.Status !== 0 ? 'resolver-error' : (json.Answer ?? []).some(a => a.type === 1 || a.type === 28) ? 'address-answers' : 'NOERROR-no-address-answers'; } catch {}
    return { name, type, httpStatus: r.status, body, classification };
  }); } catch (error) { return { name, type, httpStatus: null, classification: 'incomplete', error: network.errorCode(error) }; }
}))); }
export default { async fetch(request, env) {
  const url = new URL(request.url);
  const probeTokenReady = typeof env.PROBE_TOKEN === 'string' && env.PROBE_TOKEN.trim().length > 0;
  const health = { ok: probeTokenReady, probeTokenReady, deployment: { sourceSha: env.RER_DEPLOY_SOURCE, fingerprint: env.RER_DEPLOY_FINGERPRINT, versionId: env.RER_VERSION?.id } };
  if (url.pathname === '/health') return Response.json(health);
  if (!probeTokenReady || !['/ready', '/run', '/narrow'].includes(url.pathname) || request.headers.get('x-probe-token') !== env.PROBE_TOKEN) return new Response(null, { status: 404 });
  if (url.pathname === '/ready') return Response.json(health);
  const { receiver, missing } = await request.json(), E = env.EGRESS;
  if (url.pathname === '/narrow') return Response.json({ allowed: await send(env.EGRESS_NARROW, 'https://badssl.com/'), narrowed: await send(env.EGRESS_NARROW, receiver) });
  return Response.json({
    P1: { receiver: await send(E, receiver), exampleCom: await send(E, 'https://example.com/'), goodCertificate: await send(E, 'https://badssl.com/') },
    P2: { wrongHost: await send(E, 'https://wrong.host.badssl.com/'), selfSigned: await send(E, 'https://self-signed.badssl.com/'),
          untrustedRoot: await send(E, 'https://untrusted-root.badssl.com/'), expired: await send(E, 'https://expired.badssl.com/') },
    P3: { name: missing + '.example.com', nxdomain: await send(E, 'https://' + missing + '.example.com/'), diagnosticRawExampleSockets: await rawExample(), diagnosticSecondQueries: await dnsEvidence([missing + '.example.com', 'example.com']) },
    P6: { fetchPrivate: await raw(() => network.request('https://10.0.0.1/', { redirect: 'manual' }, r => r.status)),
          fetchPrivateName: await raw(() => network.request('https://localtest.me/', { redirect: 'manual' }, r => r.status)),
          connectPrivate: await raw(() => network.socket(connect, { hostname: '10.0.0.1', port: 443 })) },
    P7: { redirect: await send(E, 'https://httpbin.org/redirect-to?url=https%3A%2F%2F169.254.169.254%2F&status_code=302') },
    P8: { localtest: await send(E, 'https://localtest.me/'), nip: await send(E, 'https://10.0.0.1.nip.io/') },
    P9: { ipv6Only: await send(E, 'https://ipv6.google.com/') },
  });
} };`;

function dnsObserved(row) {
  const queries = row.diagnosticSecondQueries;
  if (!Array.isArray(queries) || queries.length !== 4 || queries.some(q => q.httpStatus !== 200)) return false;
  const negative = queries.filter(q => q.name === row.name), positive = queries.filter(q => q.name === 'example.com');
  const expectedError = negative.some(q => q.classification === 'NXDOMAIN') ? 'egress_dns_failed' : 'egress_dns_not_public';
  return negative.length === 2 && negative.every(q => ['NXDOMAIN','NOERROR-no-address-answers'].includes(q.classification))
    && row.nxdomain.error === expectedError && positive.length === 2 && positive.some(q => q.classification === 'address-answers')
    && (row.publicName.status !== undefined || row.publicName.error === 'egress_connection_failed');
}

const expected = [
  ['P1', 'hybrid HTTPS delivery works on the edge', r => r.P1.receiver.status !== undefined && r.P1.exampleCom.status !== undefined, 'receiver and example.com return HTTP; non-Cloudflare answers use pinned rustls, all-Cloudflare answers use original-URL Worker fetch'],
  ['P2', 'bad certificates refused on the edge', r => r.P1.receiver.status !== undefined && r.P1.goodCertificate.status !== undefined && Object.values(r.P2).every(x => x.error === 'egress_connection_failed'), 'all four egress_connection_failed'],
  // transport.ts reaches exchange only after the public name's DoH answers pass validation;
  // egress_connection_failed originates there, so it proves DNS independently of working TLS.
  ['P3', 'DoH answers from the edge', r => dnsObserved(r.P3), 'negative name refused; public name passes DNS validation; raw A and AAAA HTTP/JSON retained as separately labelled diagnostic second queries'],
  ['P4', 'no public route to the egress Worker', r => r.P4.status === null || r.P4.status >= 400, 'workers.dev request fails or answers 4xx/5xx'],
  ['P5', 'service-owned named grants narrow on the edge and read back', r => r.P5.grantVerified === true && r.P5.allowed?.status !== undefined && r.P5.narrowed?.error === 'egress_destination_not_allowed', 'strict service grant + target deployment + caller binding readback succeeds, badssl.com returns HTTP and the otherwise-working receiver is denied'],
  ['P6', 'platform private-address refusal required by the fetch route', r => r.P6.fetchPrivate.outcome === 403 && r.P6.fetchPrivateName.outcome === 403, 'direct Worker fetch returns 403 for both https://10.0.0.1/ and https://localtest.me/; errors or other statuses do not qualify private-address refusal; raw socket result is diagnostic only'],
  ['P7', 'a 3xx is returned, not followed', r => r.P7.redirect.status === 302 && r.P7.redirect.location?.includes('169.254.169.254'), '302 with its Location'],
  ['P8', 'public DNS names with private answers refused', r => r.P8.localtest.error === 'egress_dns_not_public' && r.P8.nip.error === 'egress_dns_not_public', 'both egress_dns_not_public'],
  ['P9', 'IPv6 egress for AAAA-only names (informational)', r => r.P9.ipv6Only.status !== undefined, 'an HTTP status; otherwise prefer A answers only'],
];

async function main() {
  const { account, token, receiver } = guard(process.argv.slice(2), process.env);
  const kit = new URL('../deploy-kit/', import.meta.url);
  const { cloudflare } = await import(new URL('provider.mjs', kit));
  const { ownerTarget, ownerPlan, ownerDeploy, readOwnerState } = await import(new URL('owner.mjs', kit));
  const { activeWorker } = await import(new URL('worker.mjs', kit));
  const { packageBuild } = await import(new URL('prepare.mjs', kit));
  const { hash } = await import(new URL('validation.mjs', kit));
  const api = cloudflare({ accountId: account, token });
  const scripts = (await api.list('/workers/scripts', { pagination: 'single' })).map(row => row.id);
  if (scripts.some(name => [EGRESS, PROBE].includes(name))) throw new Error('refused: a probe Worker name already exists; inspect it before running');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const source = { sha: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}') };
  const work = await realpath(await mkdtemp(join(tmpdir(), 'egress-probe-')));
  const deployments = [];
  try {
    const egressTarget = await ownerTarget(api, { project: 'runeditrun/egress-service', environment: ENVIRONMENT });
    const ownership = await readAccountOwnership({ account, token, target: egressTarget });
    await buildEgressWorker(join(work, 'egress'));
    const egressArtifact = await packageBuild({ root: work, source, runIdentity: { id: '0', attempt: '1' }, productDirectory: 'egress' });
    const egressState = join(work, 'egress-state.json');
    deployments.push({ target: egressTarget, statePath: egressState });
    const egressDeployment = await ownerDeploy({ api, target: egressTarget, artifact: egressArtifact, statePath: egressState,
      plan: ownerPlan(egressTarget, { version: 1, project: 'runeditrun/egress-service', compatibilityDate: '2026-09-08', workersDev: false, vars: { ...ownership, EGRESS_GRANTS: JSON.stringify([{entrypoint:'EgressService',allowedHosts:null},{entrypoint:'EgressRestricted',allowedHosts:['badssl.com']}]) } }, egressArtifact) });
    const probeArtifact = { version: 1, source, run: { id: '0', attempt: '1' }, main: 'index.js', assets: [], migrations: [],
      modules: [{ path: 'index.js', base64: Buffer.from(probeWorker).toString('base64'), sha256: hash(probeWorker) }] };
    const probeTarget = await ownerTarget(api, { project: 'runeditrun/egress-probe', environment: ENVIRONMENT });
    const probeToken = randomBytes(24).toString('hex');
    const probeState = join(work, 'probe-state.json');
    deployments.push({ target: probeTarget, statePath: probeState });
    const grant = allowedHosts => ({ allowedHosts, sourceSha: source.sha, fingerprint: egressDeployment.receipt.fingerprint, provider: egressDeployment.receipt.provider });
    const declaration = { version: 1, project: 'runeditrun/egress-probe', compatibilityDate: '2026-09-08',
      secrets: [{ binding: 'PROBE_TOKEN', environment: 'PROBE_TOKEN' }],
      services: [{ binding: 'EGRESS', project: 'runeditrun/egress-service', entrypoint: 'EgressService', grant: grant(null) }] };
    const diagnose = () => probeDiagnostic({ api, target: probeTarget, statePath: probeState, sourceSha: source.sha });
    const deployProbe = async plan => {
      try {
        const deployed = await ownerDeploy({ api, target: probeTarget, artifact: probeArtifact,
          statePath: probeState, env: { PROBE_TOKEN: probeToken }, plan });
        // No destination work begins until the runtime accepts this exact token and deployment.
        const ready = await invoke('/ready', {});
        if (ready?.ok !== true || ready.probeTokenReady !== true
          || ready.deployment?.sourceSha !== source.sha || ready.deployment?.fingerprint !== deployed.receipt.fingerprint
          || ready.deployment?.versionId !== deployed.receipt.provider.versionId) throw new Error('probe-readiness-identity-mismatch');
        return deployed;
      }
      catch (error) {
        if (!error.probeDiagnosed) console.error(JSON.stringify({ probeDiagnostic: { stage: 'deploy', ...(await diagnose()) } }));
        throw error;
      }
    };
    const invoke = async (path, body) => {
      const fail = async (message, response = null) => {
        console.error(JSON.stringify({ probeDiagnostic: { stage: 'invoke', path, response, ...(await diagnose()) } }));
        const error = new Error(message); error.probeDiagnosed = true; throw error;
      };
      let response;
      try {
        return await network.request(`${probeTarget.origin}${path}`, { method: 'POST', redirect: 'manual',
          headers: { 'x-probe-token': probeToken, 'content-type': 'application/json' }, body: JSON.stringify(body) }, async (received, readText) => {
          response = received;
          if (response.status !== 200) throw new Error('probe-http-status');
          // Four 64 KiB DNS bodies may expand when encoded as strings inside JSON.
          return JSON.parse(await readText(2 * 1024 * 1024));
        }, invocationDeadline[path]);
      } catch (error) {
        const message = error.message === 'probe_timeout' ? 'probe Worker request timed out'
          : !response ? 'probe Worker request failed' : response.status !== 200
            ? `probe Worker answered ${response.status}` : 'probe Worker returned invalid JSON';
        return fail(message, response ? responseDiagnostic(response) : null);
      }
    };
    await deployProbe(ownerPlan(probeTarget, declaration, probeArtifact));
    // Retain the independent observations from the fully verified plain deployment.
    const run = await invoke('/run', { receiver, missing: `rer-egress-probe-${randomBytes(6).toString('hex')}` });
    const results = isRecord(run) ? run : {};
    // Enrichment cannot manufacture an absent P3 row or discard the other observations.
    if (isRecord(results.P3)) results.P3.publicName = isRecord(results.P1) ? results.P1.exampleCom : undefined;
    results.P4 = await network.request(probeTarget.origin.replace(PROBE, EGRESS), { redirect: 'manual' }, r => ({ status: r.status }))
      .catch(error => error.message === 'probe_timeout' ? { error: 'probe_timeout' } : { status: null });
    const narrowPlan = ownerPlan(probeTarget, { ...declaration, services: [...declaration.services,
      { binding: 'EGRESS_NARROW', project: 'runeditrun/egress-service', entrypoint: 'EgressRestricted', grant: grant(['badssl.com']) }] }, probeArtifact);
    try {
      await deployProbe(narrowPlan);
      results.P5 = { grantVerified: true, mechanism: 'service-owned named entrypoint', entrypoint: 'EgressRestricted', allowedHosts: ['badssl.com'], provider: egressDeployment.receipt.provider, ...(await invoke('/narrow', { receiver })) };
    } catch (error) {
      // Preserve all independent rows. No unverified narrowing call is made.
      results.P5 = { grantVerified: false, deploymentError: error.message };
      results.P5.healthDiagnostic = await diagnose();
      const { failedDiagnostics } = results.P5.healthDiagnostic;
      if (failedDiagnostics.length) {
        results.P5.diagnosticError = 'probe_diagnostic_failed';
        results.P5.failedDiagnostics = failedDiagnostics;
      }
    }
    const rows = expected.map(([id, guarantee, check, wanted]) => {
      const row = { id, guarantee, wanted, pass: false, observed: results[id] ?? null };
      try {
        if (!isRecord(results[id]) || !complete[id](results)) throw new Error('incomplete observation');
        row.pass = Boolean(check(results));
      }
      catch { row.diagnosticError = 'probe_observation_incomplete'; }
      return row;
    });
    console.log(JSON.stringify({ account: `${account.slice(0, 6)}…`, source: source.sha, rows }, null, 2));
    process.exitCode = rows.filter(row => row.id !== 'P9').every(row => row.pass) ? 0 : 1;
  } finally {
    let retained = false;
    for (const { target, statePath } of deployments.reverse()) {
      try {
        const state = await readOwnerState(statePath, target);
        // Registering a deployment attempt is not ownership: a name collision can fail before
        // upload. Pending intent alone also cannot prove that an upload created this Worker.
        if (!state.owned.worker) continue;
        const identity = state.pendingUpload?.provider ?? state.receipt?.provider;
        if (state.owned.worker.status !== 'created' || !identity) throw new Error('creation not confirmed');
        const live = await activeWorker(api, target.worker);
        if (!live) continue;
        if (['versionId', 'deploymentId', 'etag'].some(key => !identity[key] || identity[key] !== live[key])) throw new Error('provider identity changed');
        await deleteWorker({ api, worker: target.worker });
      } catch (error) {
        retained = true;
        process.exitCode = 2;
        console.error(`cleanup ${target.worker} refused or failed: ${error.message}; inspect manually with state ${statePath}`);
      }
    }
    if (!retained) await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 2; });
}
