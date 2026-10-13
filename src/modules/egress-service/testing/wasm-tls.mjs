import { readFile } from 'node:fs/promises';
import { rustls } from '../rustls.ts';

/** Test-only trust injection into the separate test build. Production has no such export. */
export async function testTls(ca) {
  const module = new WebAssembly.Module(await readFile(new URL('../tls/test.wasm', import.meta.url)));
  const root = Buffer.from(ca.toString().replace(/-----[^-]+-----/g, '').replace(/\s/g, ''), 'base64');
  return rustls(module, exports => {
    const ptr = exports.buffer();
    new Uint8Array(exports.memory.buffer, ptr, root.length).set(root);
    if (exports.test_root(root.length) !== 0) throw new Error('test trust root refused');
  });
}
