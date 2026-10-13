import { instantiate } from './tls/engine.js';
import type { EgressSocket } from './transport.ts';
import { EgressError } from './policy.ts';

type Engine = {
  memory: WebAssembly.Memory; buffer(): number; start(n: number): number;
  receive(n: number): number; send(n: number): number; drain_tls(): number;
  drain_plain(): number; handshaking(): number; peer_closed(): number;
};
export type TlsFactory = (socket: EgressSocket, hostname: string, signal: AbortSignal) => Promise<ReadableStream<Uint8Array> & { send(request: Uint8Array): Promise<void> }>;
const failure = () => new EgressError('egress_connection_failed');

/** A new instance per connection keeps all TLS state private and independently bounded. */
export function rustls(module: WebAssembly.Module, configure?: (exports: WebAssembly.Exports) => void): TlsFactory {
  return async (socket, hostname, signal) => {
    const exports = instantiate(module);
    const engine = exports as unknown as Engine;
    configure?.(exports);
    const alive = () => { if (signal.aborted) throw new EgressError('egress_request_timeout'); };
    const input = (bytes: Uint8Array) => { alive(); if (bytes.length > 65536) throw failure(); const ptr = engine.buffer(); new Uint8Array(engine.memory.buffer, ptr, bytes.length).set(bytes); };
    const checked = (n: number) => { if (n < 0 || n > 65536) throw failure(); return n; };
    const output = (n: number) => { const ptr = engine.buffer(); return new Uint8Array(engine.memory.buffer, ptr, n).slice(); };
    const reader = socket.readable.getReader(), writer = socket.writable.getWriter();
    const dispose = () => {
      signal.removeEventListener('abort', dispose);
      reader.cancel().catch(() => {}).finally(() => { try { reader.releaseLock(); } catch {} });
      writer.abort().catch(() => {}).finally(() => { try { writer.releaseLock(); } catch {} });
    };
    signal.addEventListener('abort', dispose, { once: true });
    // Bound handshake records as well as rustls's internal record/handshake and plaintext buffers.
    let handshakeBytes = 0;
    const flush = async () => {
      while (true) { alive(); const n = checked(engine.drain_tls()); if (!n) break; await writer.write(output(n)); }
    };
    const receive = async () => {
      alive(); const { value, done } = await reader.read(); alive();
      if (done) { if (!engine.peer_closed()) throw failure(); return false; }
      if (!value || value.length > 65536) throw failure();
      if (engine.handshaking()) { handshakeBytes += value.length; if (handshakeBytes > 262144) throw failure(); }
      for (let offset = 0; offset < value.length;) {
        const piece = value.subarray(offset, Math.min(offset + 16384, value.length)); input(piece);
        const n = checked(engine.receive(piece.length)); if (!n) throw failure(); offset += n;
      }
      await flush(); return true;
    };
    input(new TextEncoder().encode(hostname)); checked(engine.start(hostname.length));
    await flush();
    while (engine.handshaking()) { if (!await receive()) throw failure(); }
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          while (true) {
            alive(); const n = checked(engine.drain_plain());
            if (n) { controller.enqueue(output(n)); return; }
            if (engine.peer_closed()) { controller.close(); return; }
            if (!await receive()) { controller.close(); return; }
          }
        } catch (error) { controller.error(error); }
      },
      cancel() { return socket.close(); },
    }, { highWaterMark: 0 });
    return Object.assign(stream, { async send(request: Uint8Array) {
      for (let offset = 0; offset < request.length;) {
        const piece = request.subarray(offset, Math.min(offset + 16384, request.length)); input(piece);
        const n = checked(engine.send(piece.length)); if (!n) throw failure(); offset += n; await flush();
      }
    } });
  };
}
