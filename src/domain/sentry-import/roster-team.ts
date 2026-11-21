import { scrub } from '../privacy';

export function importedTeamName(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.length > 100
    || /[\x00-\x1f\x7f]/.test(value) || scrub(value) !== value) return null;
  return value;
}
