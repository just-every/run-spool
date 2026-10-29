// Cursors are positions in current retained data, never credentials or snapshots.
export function recordParameters(url: URL, allowed: string[]) {
 for (const key of url.searchParams.keys()) {
  if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw new Error('Unsupported or repeated record parameter');
 }
 const order = url.searchParams.get('order') ?? 'newest';
 if (order !== 'oldest' && order !== 'newest') throw new Error('Record order must be oldest or newest');
 return { order, direction: order === 'oldest' ? 'ASC' : 'DESC', comparison: order === 'oldest' ? '>' : '<' };
}

export function recordFilter(value: string | null, limit: number) {
 if (value !== null && (value.length > limit || /[\x00-\x1f\x7f]/.test(value))) throw new Error('Invalid record filter');
 return value;
}

export function recordCursor(raw: string | undefined, signature: string): { time: number; id: string } | null {
 if (raw === undefined) return null;
 try {
  if (!raw || raw.length > 4096 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) throw new Error();
  const binary = atob(raw);
  if (btoa(binary) !== raw) throw new Error();
  const cursor = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
  if (cursor.signature !== signature || !Number.isSafeInteger(cursor.time) || cursor.time < 0 || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 2048) throw new Error();
  return cursor;
 } catch { throw new Error('Invalid record cursor or cursor belongs to another query'); }
}

export function nextRecordCursor(signature: string, time: number, id: string) {
 const bytes = new TextEncoder().encode(JSON.stringify({ signature, time, id }));
 return btoa(String.fromCharCode(...bytes));
}
