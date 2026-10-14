import { bounded, scrub } from './scrub.ts';

export function file(value: string, language?: 'python' | 'go'): string {
  if (/^https?:\/\//.test(value)) { try { const u = new URL(value); return scrub(`${u.origin}${u.pathname}`) } catch { return '[invalid-url]' } }
  return bounded(scrub(value.split(/[?#]/)[0]).replace(/\\/g, '/').replace(language ? /(\/(?:Users|home)\/)[^/]+\//gi : /(\/(?:Users|home)\/)[^/]+\//g,'$1[user]/'));
}

export function framePath(value: string, language?: 'python' | 'go'): string {
  const path = file(value, language);
  if (language && (!path.trim() || path === '[invalid-url]' || /[\x00-\x1f\x7f]/.test(path))) throw new Error('Invalid frame path');
  return path;
}
