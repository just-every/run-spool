import { REDACTED, keyedSecrets } from './scrub-keyed.ts';
// D1 stores UTF-8: repair orphan UTF-16 units before crossing that boundary.
export const bounded=(value:string)=>value.slice(0,1000).replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,'�');

// The scrubber before 12 Oct 2026 wrote name=[redacted] over one word and kept
// the next, which in rows stored then may be the secret after a scheme word or
// =>. That next word is redacted when it is not a plain lowercase word.
const legacyResidue=/(?<![A-Za-z0-9_])((?:password|passwd|secret|token|api[_-]?key)=\[redacted\]) ([A-Za-z0-9_+\/.-]+={0,2})(?=[\s,;]|$)/gi;
// Basic credentials are base64 of user:password; decode to tell them from prose.
function basicCredential(value:string){
  try { const text=atob(value.replace(/-/g,'+').replace(/_/g,'/')); return text.length>1&&/^[\x20-\x7e]*:[\x20-\x7e]*$/.test(text); } catch { return false; }
}
// A bearer credential is anything but a short plain word ("Bearer of bad news").
const bearerWord=/^[A-Za-z][a-z]{0,14}[.:!?]?$/;
// Armored private keys (PEM, OpenSSH, PGP) and PuTTY key files.
const privateKey=/-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY(?: BLOCK)?-----|$)|PuTTY-User-Key-File-\d+:[\s\S]*?(?:Private-MAC:[ \t]*[0-9a-f]*|$)/g;
// Webhook URLs whose path is the credential keep only the service prefix.
const credentialPath=/\b(https?:\/\/(?:hooks\.slack\.com\/(?:services|workflows|triggers)|(?:[a-z0-9-]+\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks|[a-z0-9-]+\.webhook\.office\.com\/webhookb2|outlook\.office(?:365)?\.com\/webhook|hooks\.zapier\.com\/hooks\/catch)\/)(?!\[redacted\])[^\s)"'<>]+/gi;
// Shapes that are credentials wherever they appear.
const bareTokens=/\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*|(?<![A-Za-z0-9])(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|glpat-[A-Za-z0-9_-]{20,}|xox[abeoprs]-[A-Za-z0-9-]{10,}|xapp-[A-Za-z0-9-]{10,}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9+/=]{20,}|sk-[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|npm_[A-Za-z0-9]{30,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|hf_[A-Za-z0-9]{30,}|pypi-[A-Za-z0-9_-]{50,})(?![A-Za-z0-9])/g;
export function scrub(value: string): string {
  const text=bounded(value)
    .replace(privateKey,'[private key]')
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/?#@]+@/gi,`$1${REDACTED}@`)
    .replace(credentialPath,`$1${REDACTED}`)
    .replace(/https?:\/\/[^\s)]+/gi, value => { try { const u = new URL(value); return `${u.origin}${u.pathname}` } catch { return '[url]' } })
    .replace(bareTokens,REDACTED);
  return bounded(keyedSecrets(text).replace(legacyResidue,(match,marker:string,word:string)=>/^[a-z]+$/.test(word)?match:`${marker} ${REDACTED}`)
    .replace(/\b(bearer)\s+([^\s,;]+)/gi,(match,word:string,credential:string)=>credential===REDACTED||bearerWord.test(credential)?match:`${word} ${REDACTED}`)
    .replace(/\b(Basic)\s+([A-Za-z0-9+/_-]{4,}={0,2})(?![A-Za-z0-9+/=_-])/g,(match,word:string,credential:string)=>basicCredential(credential)?`${word} ${REDACTED}`:match)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[number]'));
}
