import { client, identity } from '../privacy.ts';

// The SDK's exposure report: this client ran this release and reached these
// flows. `capture` says whether error capture was installed, so a session that
// could not have reported the failure is counted as a capture gap, not a success.
export const FLOW_LIMIT = 20;
// Outcome counters for refused exposure reports: each is a capture gap.
export const EXPOSURE_LOSS = ['exposure_invalid', 'exposure_unregistered', 'exposure_budget'];
export interface Exposure { version: 1; release: string; build: string; environment: string; client: string; flows: string[]; capture: boolean }
export function exposureInput(value: any): Exposure {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== 'build,capture,client,environment,flows,release,version' || value.version !== 1) throw new Error('Invalid exposure report');
 if (!Array.isArray(value.flows) || value.flows.length > FLOW_LIMIT || typeof value.capture !== 'boolean') throw new Error('Invalid exposure report');
 const flows = [...new Set(value.flows.map((flow: unknown) => identity(flow, 'flow')))] as string[];
 return { version: 1, release: identity(value.release, 'release'), build: identity(value.build, 'build'), environment: identity(value.environment, 'environment'), client: client(value.client), flows, capture: value.capture };
}
export interface ExposureTarget { endpoint: string; project: string; ingestKey: string; transport?: typeof fetch }
/** Sends one report. It never throws: the result says whether Spool recorded it. */
export async function sendExposure(target: ExposureTarget, report: Exposure): Promise<{ outcome: string; reason?: string }> {
 try {
  const response = await Reflect.apply(target.transport ?? fetch, globalThis, [`${target.endpoint}/api/ingest/${encodeURIComponent(target.project)}/exposure`, { method: 'POST', credentials: 'omit', mode: 'cors', redirect: 'manual', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${target.ingestKey}` }, body: JSON.stringify(exposureInput(report)), keepalive: true }]) as Response;
  const body: any = await response.json().catch(() => null);
  return body && typeof body.outcome === 'string' ? body : { outcome: 'unknown', reason: 'unexpected_response' };
 } catch (error) { return { outcome: (error as Error).message === 'Invalid exposure report' || /Invalid (flow|client|release|build|environment)/.test(String((error as Error).message)) ? 'rejected' : 'unknown', reason: String((error as Error).message) }; }
}
