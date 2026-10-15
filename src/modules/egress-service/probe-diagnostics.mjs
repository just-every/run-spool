import { readOwnerState } from '../deploy-kit/owner.mjs';
import { activeWorker } from '../deploy-kit/worker.mjs';
import { createProbeNetwork } from './probe-network.mjs';

const network = createProbeNetwork();

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const status = value => Number.isInteger(value) && value >= 100 && value <= 599;
const binding = value => record(value) && text(value.type) && text(value.name)
  && (value.type !== 'service' || (text(value.service)
    && (value.entrypoint === undefined || text(value.entrypoint))
    && (value.environment === undefined || text(value.environment))
    && (value.props === undefined || record(value.props))));
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value) ? value : null;
const version = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value) ? value : null;
const field = (value, pattern) => typeof value === 'string' && pattern.test(value) ? value : null;

/** Only fixed metadata fields: never include an invocation body, token or binding value. */
export function responseDiagnostic(response) {
  return {
    status: response.status,
    cfRay: field(response.headers.get('cf-ray'), /^[a-f0-9]{16}(?:-[A-Z]{3})?$/i),
    contentType: field(response.headers.get('content-type'), /^[a-z][a-z0-9.+-]*\/[a-z][a-z0-9.+-]*(?:;\s*charset=[a-z0-9-]+)?$/i),
  };
}

function publicHealth(body) {
  if (!record(body)) return null;
  return {
    ok: typeof body.ok === 'boolean' ? body.ok : null,
    probeTokenReady: typeof body.probeTokenReady === 'boolean' ? body.probeTokenReady : null,
    deployment: {
      sourceSha: hex(body.deployment?.sourceSha, 40),
      fingerprint: hex(body.deployment?.fingerprint, 64),
      versionId: version(body.deployment?.versionId),
    },
  };
}

/** One read of each diagnostic source, with no retry and no authenticated health request. */
export async function probeDiagnostic({ api, target, statePath, sourceSha, request = globalThis.fetch }) {
  const checks = await Promise.allSettled([
    readOwnerState(statePath, target),
    activeWorker(api, target.worker),
    network.request(`${target.origin}/health`, {
      redirect: 'manual',
      headers: { 'Cache-Control': 'no-cache', Accept: 'application/json' },
    }, async (response, readText) => {
      const http = responseDiagnostic(response);
      let actual = null;
      try { actual = publicHealth(JSON.parse(await readText())); } catch { /* Do not retain raw bodies. */ }
      return { http, actual };
    }, 5000, request),
  ]);
  const [state, live, health] = checks.map(result => result.status === 'fulfilled' ? result.value : null);
  const bindings = live?.settings?.bindings;
  const names = Array.isArray(bindings) ? bindings.map(binding => ({
    name: field(binding?.name, /^[A-Za-z_][A-Za-z0-9_]{0,127}$/),
    type: field(binding?.type, /^[a-z_]{1,64}$/),
  })) : null;
  const attempts = state?.receipt?.health?.attempts;
  const fingerprint = hex(state?.receipt?.fingerprint ?? state?.pendingUpload?.fingerprint, 64);
  const expected = {
    sourceSha: hex(sourceSha, 40), fingerprint,
    versionId: version(state?.receipt?.provider?.versionId ?? state?.pendingUpload?.provider?.versionId),
  };
  const validAttempts = attempts == null || (Array.isArray(attempts) && attempts.every(attempt => record(attempt)
    && Number.isFinite(attempt.offsetMs) && (attempt.status === null || status(attempt.status))
    && ['cfRay', 'contentType', 'errorClass'].every(key => attempt[key] === null || typeof attempt[key] === 'string')));
  const valid = [
    record(state) && fingerprint !== null && validAttempts,
    record(live) && version(live.versionId) !== null && names !== null
      && names.every(item => item.name && item.type) && bindings.every(binding),
    health?.http.status === 200 && record(health.actual)
      && health.actual.ok === true && health.actual.probeTokenReady === true
      && Object.entries(expected).every(([key, value]) => value !== null && health.actual.deployment[key] === value),
  ];
  return {
    expected,
    actual: health?.actual ?? null, http: health?.http ?? null,
    providerVersionId: version(live?.versionId), bindingReadback: names,
    attempts: Array.isArray(attempts) ? attempts.map(attempt => ({
      offsetMs: Number.isFinite(attempt?.offsetMs) ? attempt.offsetMs : null,
      status: Number.isInteger(attempt?.status) ? attempt.status : null,
      cfRay: field(attempt?.cfRay, /^[a-f0-9]{16}(?:-[A-Z]{3})?$/i),
      contentType: field(attempt?.contentType, /^[a-z][a-z0-9.+-]*\/[a-z][a-z0-9.+-]*(?:;\s*charset=[a-z0-9-]+)?$/i),
      errorClass: field(attempt?.errorClass, /^[a-z]+(?:-[a-z]+)*$/),
    })) : null,
    failedDiagnostics: ['state', 'provider', 'health'].filter((_, index) => checks[index].status === 'rejected' || !valid[index]),
  };
}
