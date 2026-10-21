/** Release/dist artifacts are named by the minified file's URL, `~/static/app.js`, where `~` stands for any
 * origin (Sentry's own convention, honoured by `--url-prefix`). Spool keeps them in the same release, dist and
 * identity table as debug-ID maps, under a fixed-width key that cannot collide with a debug ID's UUID shape. */
export function normalizeArtifactName(name: string): string | null {
 let path: string;
 if (/^[a-z][a-z0-9+.-]*:\/\//i.test(name)) { try { path = new URL(name).pathname; } catch { return null; } }
 else if (name.startsWith('~/')) path = name.slice(1).split(/[?#]/)[0];
 else return null;
 if (!path.startsWith('/') || path.length > 1024 || /[\u0000-\u001f\u007f]/.test(path)) return null;
 return '~' + path;
}
export async function artifactNameKey(normalized: string): Promise<string> {
 const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('artifact-name\n' + normalized));
 return 'url:' + Array.from(new Uint8Array(digest).subarray(0, 20), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** Names a frame's file could have been uploaded under: its URL path, or for a local path its path and basename. */
export function frameArtifactNames(file: string): string[] {
 const exact = normalizeArtifactName(file);
 if (exact) return [exact];
 if (!file.startsWith('/') || /[\u0000-\u001f\u007f]/.test(file)) return [];
 const clean = file.split(/[?#]/)[0], base = clean.slice(clean.lastIndexOf('/') + 1);
 return [...new Set(['~' + clean, base ? '~/' + base : ''].filter(Boolean))];
}
/** Resolves the `sourcemap` header of a minified file against that file's own artifact name. */
export function siblingName(minified: string, reference: string): string | null {
 const base = normalizeArtifactName(minified);
 if (!base) return null;
 try { return normalizeArtifactName('~' + new URL(reference, 'https://artifact.invalid' + base.slice(1)).pathname); } catch { return null; }
}
