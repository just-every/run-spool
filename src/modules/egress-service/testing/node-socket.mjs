import net from 'node:net';
import { Duplex } from 'node:stream';

/** Test-only raw loopback routing. TLS is always the real WASM engine. */
export function nodeLoopbackSockets() {
  return port => {
    const raw = net.connect({ host: '127.0.0.1', port });
    const opened = new Promise((resolve, reject) => { raw.once('connect', resolve); raw.once('error', reject); });
    opened.catch(() => {}); raw.on('error', () => {});
    const streams = Duplex.toWeb(raw);
    return { ...streams, opened, async close() { raw.destroy(); } };
  };
}
