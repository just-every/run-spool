import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

// Seed-owned policy module for Base's Managed-data intake, which imports it in
// the rer process. It bundles the same product policy and safe audit payload
// the portability worker restores with; createPolicy binds the payload to the
// database the intake supplies (its private ZIP sandbox, never the destination).
const { outputFiles } = await build({ stdin: {
 contents: `import { portabilityPolicy } from './portability.ts';
import { auditPayload, SAFE_AUDIT_PAYLOAD } from './audit/archive.ts';
export default portabilityPolicy;
export function createPolicy({ db }) {
 return { ...portabilityPolicy, extraPayloads: { [SAFE_AUDIT_PAYLOAD]: auditPayload(db) } };
}`,
 resolveDir: fileURLToPath(new URL('../../src/domain/', import.meta.url)),
}, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const policy = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].contents).toString('base64'));
export default policy.default;
export const createPolicy = policy.createPolicy;
