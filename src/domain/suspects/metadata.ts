import { scrub } from '../privacy';
/** Exact relative repository paths only; never fetch source or infer a suffix match. */
export function changedFiles(value: unknown): string[] | undefined {
 if (value === undefined) return undefined;
 if (!Array.isArray(value) || value.length > 200) throw new Error('Supply at most 200 changed paths per commit');
 const files = value.map(path => {
  if (typeof path !== 'string' || !path || path.length > 512 || path.trim() !== path || path.startsWith('/') || /[\\\x00-\x1f\x7f?#:]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..') || scrub(path) !== path) throw new Error('Changed paths must be scrubbed relative repository paths');
  return path;
 });
 return [...new Set(files)].sort();
}
/** Only protocol user-agent families are retained, never the raw header or device identity. */
export function sessionCohort(userAgent: unknown) {
 const ua = typeof userAgent === 'string' ? userAgent.slice(0, 2000).toLowerCase() : '';
 const os = /android/.test(ua) ? 'Android' : /iphone|ipad|ipod/.test(ua) ? 'iOS' : /windows/.test(ua) ? 'Windows' : /macintosh|mac os x/.test(ua) ? 'macOS' : /linux/.test(ua) ? 'Linux' : 'unknown';
 const device = /ipad|tablet/.test(ua) ? 'tablet' : /iphone|ipod|android.*mobile/.test(ua) ? 'mobile' : os !== 'unknown' && !/android/.test(ua) ? 'desktop' : 'unknown';
 return { device, os };
}
export const cohortDevices = ['desktop','mobile','tablet','unknown'];
export const cohortSystems = ['Android','iOS','Windows','macOS','Linux','unknown'];
