// Setup serves the production Worker directly. Reject platform and checkout
// paths before owner/first-run redirects, just as rer's public proxy does.
export function privateRuntimePath(url: string): boolean {
 let path = new URL(url).pathname;
 for (let round = 0; round < 4; round++) {
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { return true; }
  if (decoded === path) break;
  path = decoded;
 }
 return path.split(/[\\/]/).some(segment => /^(?:cdn-cgi|\.rer|\.seed|\.wrangler|\.git|\.dev\.vars.*|\.env.*)$/i.test(segment.trim()));
}
