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
if (mode === 'cause') {
  try { throw new Error('synthetic-spool-node-wrapper', { cause: new RangeError('synthetic-spool-node-root') }); }
  catch (error) { Sentry.captureException(error); }
} else if (mode === 'identity') {
  try { checkout(); } catch (error) { Sentry.captureException(error); }
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
