export function toBase64(bytes: Uint8Array): string {
 let out = '';
 for (let at = 0; at < bytes.length; at += 8192) out += String.fromCharCode(...bytes.subarray(at, at + 8192));
 return btoa(out);
}
export function fromBase64(text: string): Uint8Array {
 const raw = atob(text), out = new Uint8Array(raw.length);
 for (let at = 0; at < raw.length; at++) out[at] = raw.charCodeAt(at);
 return out;
}
export async function sha1Hex(bytes: Uint8Array): Promise<string> {
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', bytes as BufferSource)), byte => byte.toString(16).padStart(2, '0')).join('');
}
