// trust-bundle.json pins each built artifact to the webpki-roots snapshot
// compiled into it: the locked crate release and the SHA-256 of every anchor's
// subject Name and SubjectPublicKeyInfo DER. The publication scan relies on it
// to recognise CA certificate metadata inside exactly these artifacts.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const literal = '((?:[^"\\\\]|\\\\.)*)';
const ANCHOR = new RegExp(`TrustAnchor \\{\\s*subject: Der::from_slice\\(b"${literal}"\\),\\s*subject_public_key_info: Der::from_slice\\(b"${literal}"\\),`, 'g');
const ESCAPES = { n: 10, r: 13, t: 9, '\\': 92, 0: 0, "'": 39, '"': 34 };

// Rust byte-string literal body to bytes; anything unexpected stops the build.
function bytes(body) {
  const out = [];
  for (let i = 0; i < body.length; i++) {
    const code = body.charCodeAt(i);
    if (code > 0x7e || code < 0x20) throw new Error('unexpected byte-string character');
    if (body[i] !== '\\') { out.push(code); continue; }
    const escape = body[++i];
    if (escape === 'x' && /^[0-9a-fA-F]{2}$/.test(body.slice(i + 1, i + 3))) { out.push(parseInt(body.slice(i + 1, i + 3), 16)); i += 2; }
    else if (Object.hasOwn(ESCAPES, escape)) out.push(ESCAPES[escape]);
    else throw new Error('unexpected byte-string escape');
  }
  return Buffer.from(out);
}

export function roots(here, cargo) {
  const metadata = JSON.parse(execFileSync(cargo[0], [...cargo.slice(1), 'metadata', '--locked', '--format-version', '1'], { cwd: here, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const crate = metadata.packages.filter(p => p.name === 'webpki-roots');
  if (crate.length !== 1) throw new Error('expected one webpki-roots package');
  const lock = readFileSync(join(here, 'Cargo.lock'), 'utf8').split('\n[[package]]\n').find(block => block.startsWith('name = "webpki-roots"\n'));
  const checksum = lock?.match(/^checksum = "([0-9a-f]{64})"$/m)?.[1];
  if (!lock?.includes(`\nversion = "${crate[0].version}"\n`) || !checksum) throw new Error('webpki-roots is not locked');
  const source = readFileSync(join(dirname(crate[0].manifest_path), 'src/lib.rs'), 'utf8');
  const anchors = [...source.matchAll(ANCHOR)].map(([, subject, spki]) => ({ subject: bytes(subject), spki: bytes(spki) }));
  if (!anchors.length || anchors.length !== source.split('TrustAnchor {').length - 1) throw new Error('could not read every webpki-roots trust anchor');
  return { crate: { crate: 'webpki-roots', version: crate[0].version, checksum }, anchors };
}

export function manifest(previous, file, artifact, { crate, anchors }) {
  for (const anchor of anchors) {
    if (!artifact.includes(anchor.subject) || !artifact.includes(anchor.spki)) throw new Error('trust anchor not compiled into artifact');
  }
  return JSON.stringify({
    schemaVersion: 1, roots: crate,
    artifacts: Object.fromEntries(Object.entries({ ...previous?.artifacts, [file]: sha256(artifact) }).sort()),
    anchors: anchors.map(anchor => ({ subject: sha256(anchor.subject), spki: sha256(anchor.spki) })),
  }, null, 2) + '\n';
}
