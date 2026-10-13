import { scrub } from '../privacy';

export const REPAIR_FACTS = ['approved', 'merged', 'deployed', 'exercised'] as const;
export type RepairFact = typeof REPAIR_FACTS[number];
export const CHECK_OUTCOMES = ['passed', 'failed', 'not_run'] as const;

// A recorded link is text the owner can open; Spool never fetches it. Keep only
// an https origin and path so a pasted query or fragment cannot carry a secret.
export function repairLink(value: unknown): string {
 if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new Error('Link must be an https URL of at most 2048 characters');
 let url: URL;
 try { url = new URL(value.trim()); } catch { throw new Error('Link must be an https URL of at most 2048 characters'); }
 if (url.protocol !== 'https:' || !url.hostname) throw new Error('Link must be an https URL of at most 2048 characters');
 if (url.username || url.password) throw new Error('Link must not contain credentials');
 const link = url.origin + url.pathname;
 if (scrub(link) !== link) throw new Error('Link contains sensitive text');
 return link;
}

// Notes are bounded before scrubbing: an oversize note is refused, never cut.
export function boundedText(value: unknown, field: string, max: number, required = false): string {
 if (value === undefined && !required) return '';
 if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`${field} must be ${required ? '1' : '0'} to ${max} characters`);
 return scrub(value.trim());
}

export function checkInput(body: any) {
 if (!CHECK_OUTCOMES.includes(body?.outcome)) throw new Error('Check outcome must be passed, failed or not_run');
 return { name: boundedText(body.name, 'Check name', 80, true), outcome: body.outcome as string, note: boundedText(body.note, 'Check note', 300) };
}

export function revision(value: unknown): number {
 if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('Repair revision required');
 return value as number;
}
