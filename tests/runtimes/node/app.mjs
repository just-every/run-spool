import * as Sentry from '@sentry/node';
const mode = process.argv[2];
Sentry.init({
  dsn: process.env.SPOOL_FIXTURE_DSN,
  dist: process.env.SENTRY_DIST,
  environment: 'compatibility',
  tracesSampleRate: 1,
  sendClientReports: true,
  beforeSend: event => event.message === 'synthetic-spool-discard' ? null : event,
});
function checkout() { throw new TypeError('synthetic-spool-node-handled'); }
function rootCause() { throw new TypeError('synthetic-spool-node-root'); }
function wrapCause() {
  try { rootCause(); } catch (cause) { throw new RangeError('synthetic-spool-node-middle', { cause }); }
}
function parseCause() {
  try { wrapCause(); } catch (cause) { throw new SyntaxError('synthetic-spool-node-parse', { cause }); }
}
function resolveCause() {
  try { parseCause(); } catch (cause) { throw new ReferenceError('synthetic-spool-node-resolve', { cause }); }
}
function routeCause() {
  try { resolveCause(); } catch (cause) { throw new URIError('synthetic-spool-node-route', { cause }); }
}
function linkedFailure() {
  try { routeCause(); } catch (cause) { throw new Error('synthetic-spool-node-wrapper', { cause }); }
}
if (mode === 'identity') {
  try { checkout(); } catch (error) { Sentry.captureException(error); }
} else if (mode === 'causes') {
  try { linkedFailure(); } catch (error) { Sentry.captureException(error); }
} else {
  Sentry.logger.info('synthetic-spool-node-log', { step: 'checkout' });
  Sentry.startSpan({ name: 'synthetic-spool-node-span', op: 'test' }, () => {});
  Sentry.captureMessage('synthetic-spool-discard');
  if (mode === 'handled') {
    let eventId;
    try { checkout(); } catch (error) {
      eventId = Sentry.captureException(error, { attachments: [{ filename: 'synthetic-spool.txt', data: 'synthetic-spool-1' }] });
    }
    await Sentry.flush(10000);
    Sentry.captureFeedback({ message: 'synthetic-spool-node-feedback', associatedEventId: eventId });
  }
}
await Sentry.flush(10000);
await Sentry.flush(10000);
if (mode === 'crash') {
  // The SDK's default uncaught-exception integration owns capture and shutdown.
  setTimeout(() => { throw new RangeError('synthetic-spool-node-unhandled'); }, 0);
} else {
  Sentry.endSession();
  await Sentry.flush(10000);
  await Sentry.close(10000);
}
