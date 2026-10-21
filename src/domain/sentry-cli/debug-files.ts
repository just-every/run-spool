import type { Context } from 'hono';
import type { CliAuthority } from './auth';
import { cliError } from './errors';

const hex40 = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
/** Native debug files (dSYM, ELF/DWARF, Breakpad, ProGuard/R8, Dart/Flutter symbols) are symbolicated by SDK-002,
 * which is not implemented. Each file is refused by name before any bytes are uploaded, so a build that depends
 * on them fails visibly instead of looking uploaded. Nothing is staged or stored. */
export async function assembleDebugFiles(c: Context, _who: CliAuthority, body: any): Promise<Response> {
 if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).length > 1000) return cliError(c, 400, 'Expected one entry per debug file, keyed by SHA-1 checksum.');
 const out: Record<string, unknown> = {};
 for (const [checksum, info] of Object.entries<any>(body)) {
  if (!hex40(checksum) || !info || typeof info !== 'object') return cliError(c, 400, 'Each debug file is keyed by its SHA-1 checksum.');
  const name = typeof info.name === 'string' ? info.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) : checksum;
  out[checksum] = {
   state: 'error', missingChunks: [],
   detail: `${name}: native debug files are not accepted yet. Symbolication and ProGuard/R8 deobfuscation (SDK-002) are not implemented, so Spool stores no dSYM, ELF/DWARF, Breakpad, ProGuard/R8 or Dart symbol file and uploaded nothing.`,
  };
 }
 return c.json(out);
}
