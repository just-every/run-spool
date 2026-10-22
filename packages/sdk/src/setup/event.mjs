/**
 * Sends one test event to the DSN's project through Spool's public Sentry intake. It counts as accepted only when the
 * DSN's own origin answers 200 with Spool's intake receipt for this event; a redirect is never followed.
 */
export async function sendTestEvent(dsn) {
  const url = new URL(dsn), alias = url.pathname.replace(/^\//, ''), id = crypto.randomUUID().replaceAll('-', '');
  const event = { event_id: id, platform: 'node', level: 'error', environment: 'setup', timestamp: Date.now() / 1000, exception: { values: [{ type: 'SpoolSetupTest', value: 'Spool setup test event', stacktrace: { frames: [{ filename: 'spool-setup', function: 'sendTestEvent', lineno: 1, colno: 1 }] } }] } };
  const body = [{ event_id: id, dsn, sent_at: new Date().toISOString() }, { type: 'event' }, event].map(part => JSON.stringify(part)).join('\n');
  const response = await fetch(`${url.origin}/api/${alias}/envelope/`, { method: 'POST', headers: { 'content-type': 'application/x-sentry-envelope' }, body, redirect: 'manual' });
  const text = (await response.text()).slice(0, 4096);
  const receipt = (() => { try { return JSON.parse(text); } catch { return undefined; } })();
  const accepted = response.status === 200 && receipt?.id === id && typeof receipt.dropped === 'object' && receipt.dropped !== null;
  return { status: response.status, eventId: id, accepted, body: text };
}
