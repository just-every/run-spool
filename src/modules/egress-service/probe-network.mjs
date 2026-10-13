/** Shared by the command and embedded Worker. Keep this factory self-contained so the
 * deployed source uses the same bounds and cleanup without another build or runtime. */
export function createProbeNetwork() {
  const discard = action => { try { Promise.resolve(action()).catch(() => {}); } catch {} };
  const timeout = () => new Error('probe_timeout');
  const errorCode = error => ['probe_timeout', 'probe_response_too_large', 'probe_response_invalid'].includes(error?.message)
    ? error.message : 'probe_network_failed';

  async function deadline(timeoutMs, operation) {
    const controller = new AbortController(), cleanup = [];
    let closed = false, timer;
    const scope = {
      signal: controller.signal,
      get closed() { return closed; },
      track(action) { if (closed) discard(action); else cleanup.push(action); },
    };
    try {
      return await Promise.race([
        new Promise((_, reject) => { timer = setTimeout(() => reject(timeout()), timeoutMs); }),
        Promise.resolve().then(() => operation(scope)),
      ]);
    } finally {
      closed = true;
      clearTimeout(timer);
      controller.abort();
      // A peer may never settle cancel()/close(). Cleanup must not hold the deadline open.
      for (const action of cleanup) discard(action);
    }
  }

  async function request(input, init, consume, timeoutMs = 5000, fetcher = globalThis.fetch) {
    return deadline(timeoutMs, async scope => {
      const response = await fetcher(input, { ...init, signal: scope.signal });
      scope.track(() => response.body?.cancel());
      if (scope.closed) throw timeout();
      const readText = async (limit = 65536) => {
        if (scope.closed) throw timeout();
        if (!response.body) return '';
        const reader = response.body.getReader(), parts = [];
        scope.track(() => reader.cancel());
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (scope.closed) throw timeout();
          if (done) break;
          size += value.byteLength;
          if (size > limit) throw new Error('probe_response_too_large');
          parts.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
        try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
        catch { throw new Error('probe_response_invalid'); }
      };
      return consume(response, readText);
    });
  }

  async function socket(connect, address, options, timeoutMs = 5000) {
    return deadline(timeoutMs, async scope => {
      const connection = connect(address, options);
      const close = () => connection.close();
      scope.track(close);
      // Some implementations refuse close before opened settles. Close a late open again.
      const opened = Promise.resolve(connection.opened).then(() => {
        if (scope.closed) { discard(close); throw timeout(); }
      });
      Promise.resolve(connection.closed).catch(() => {});
      await opened;
      return 'opened';
    });
  }

  return { deadline, request, socket, errorCode };
}
