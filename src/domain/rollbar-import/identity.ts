import { sha256 } from '../../modules/import-kit/src/provenance/identity.ts';
export const mappingVersion = 'spool-rollbar-v1';
export function sourceId(value: unknown): string {
 if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
 if (typeof value === 'string' && /^[1-9][0-9]{0,19}$/.test(value)) return value;
 throw new Error('Rollbar system ID required');
}
export const projectId = (id: string) => `rollbar-${sha256(id).slice(0,32)}`;
export const issueId = (project: string, id: string) => sha256(JSON.stringify(['rollbar',project,id]));
export const eventId = (project: string, id: string) => sha256(JSON.stringify(['rollbar-occurrence',project,id])).slice(0,32);
export const fingerprint = (project: string, id: string) => sha256(JSON.stringify(['rollbar-import',project,id]));
export function timestamp(value: unknown): number {
 const seconds = typeof value === 'string' && /^\d+(\.\d+)?$/.test(value) ? Number(value) : value;
 if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(Math.round(seconds*1000))) throw new Error('Rollbar Unix timestamp required');
 return Math.round(seconds*1000);
}
