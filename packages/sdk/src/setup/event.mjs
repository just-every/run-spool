/** Sends one test event to the DSN's project through Spool's public Sentry intake and reports Spool's answer. */
export async function sendTestEvent(dsn) {
  const url = new URL(dsn), alias = url.pathname.replace(/^\//, ''), id = crypto.randomUUID().replaceAll('-', '');
  const event = { event_id: id, platform: 'node', level: 'error', environment: 'setup', timestamp: Date.now() / 1000, exception: { values: [{ type: 'SpoolSetupTest', value: 'Spool setup test event', stacktrace: { frames: [{ filename: 'spool-setup', function: 'sendTestEvent', lineno: 1, colno: 1 }] } }] } };
  const body = [{ event_id: id, dsn, sent_at: new Date().toISOString() }, { type: 'event' }, event].map(part => JSON.stringify(part)).join('\n');
  const response = await fetch(`${url.origin}/api/${alias}/envelope/`, { method: 'POST', headers: { 'content-type': 'application/x-sentry-envelope' }, body });
  return { status: response.status, eventId: id, body: await response.text() };
}
