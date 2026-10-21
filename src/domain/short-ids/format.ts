// TEAM-004 short IDs: `<PREFIX>-<suffix>`, the suffix a per-project counter in
// Crockford base32 (no I, L, O or U), so `CHECKOUT-1A3` reads aloud unambiguously.
export const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function base32(value: number) {
 let n = value, text = '';
 do { text = BASE32[n % 32] + text; n = Math.floor(n / 32); } while (n > 0);
 return text;
}
/** The same digits in SQL for a positive integer expression, without leading zeros. */
export function base32Sql(n: string) {
 const powers = [1073741824, 33554432, 1048576, 32768, 1024, 32];
 return powers.map(p => `CASE WHEN (${n})>=${p} THEN substr('${BASE32}',((${n})/${p})%32+1,1) ELSE '' END`).join('||') + `||substr('${BASE32}',(${n})%32+1,1)`;
}
/** A prefix base: the project identifier in capitals, '.', ':' and '_' as '-',
 * runs of '-' collapsed and trimmed. A base never holds '_', so a taken base
 * continues as `<base>_<n>`, which no other project's base can equal. */
export function prefixBase(project: string) {
 return project.toUpperCase().replace(/[.:_]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'P';
}
export function prefixBaseSql(column: string) {
 let sql = `upper(${column})`;
 for (const c of ['.', ':', '_']) sql = `replace(${sql},'${c}','-')`;
 // Project identifiers hold at most 100 characters: seven halvings collapse any run.
 for (let i = 0; i < 7; i++) sql = `replace(${sql},'--','-')`;
 return `COALESCE(NULLIF(trim(${sql},'-'),''),'P')`;
}
const token = String.raw`[A-Za-z0-9](?:[A-Za-z0-9_]|-(?=[A-Za-z0-9_]))*-[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{1,13}(?![A-Za-z0-9_-])`;
/** A short ID or alias as written anywhere: any case, exact characters only. */
export const shortIdPattern = new RegExp(`^${token}$`);
export const normalizeShortId = (value: string) => value.toUpperCase();
export const isShortId = (value: unknown): value is string => typeof value === 'string' && value.length <= 160 && shortIdPattern.test(value);
/** `Fixes`, `Resolves` or `Closes` (any case) directly before a short ID, any number per message. */
export function citations(message: string) {
 const found = new Map<string, { citation: string; id: string }>();
 for (const match of message.matchAll(new RegExp(String.raw`\b(?:fixes|resolves|closes)\b:?[ \t]+(${token})`, 'gi'))) {
  if (match[0].length <= 200 && !found.has(match[0])) found.set(match[0], { citation: match[0], id: normalizeShortId(match[1]) });
 }
 return [...found.values()].slice(0, 100);
}
