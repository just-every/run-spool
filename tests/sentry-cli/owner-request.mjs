import {setTimeout as delay} from 'node:timers/promises';

async function healthReady(origin, failure) {
 for (let poll = 0; poll < 5; poll++) {
  try {
   const health = await fetch(origin + '/health', {headers: {Connection: 'close'}, signal: AbortSignal.timeout(2000)});
   const ready = health.ok;
   await health.body?.cancel();
   if (ready) return;
  } catch {}
  if (poll < 4) await delay(200);
 }
 throw new Error('Sentry test Worker did not become health-ready after a read socket closed', {cause: failure});
}

// The local HTTP/1 listener intermittently closes or resets a pooled socket
// after archive/refusal sequences. Retry only that failed owner GET through the same public door.
// Never replay writes, HTTP refusals, assertion failures or other transports.
export async function ownerRequest(url, options = {}) {
 const method = (options.method ?? 'GET').toUpperCase();
 for (let attempt = 0; ; attempt++) {
  try {
   return await fetch(url, {...options, ...(attempt ? {headers: {...options.headers, Connection: 'close'}} : {})});
  } catch (failure) {
   if (method !== 'GET' || !['UND_ERR_SOCKET', 'ECONNRESET'].includes(failure.cause?.code) || attempt >= 2) throw failure;
   console.warn(`Sentry owner read socket closed [${failure.cause.code}]: ${new URL(url).pathname}; health check before retry ${attempt + 1}/2`);
   await healthReady(new URL(url).origin, failure);
  }
 }
}
