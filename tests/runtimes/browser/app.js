import * as Sentry from '@sentry/browser';
window.__SPOOL_SENT__ = [];
window.__SPOOL_DISCARDS__ = 0;
window.__SPOOL_FEEDBACK__ = false;
window.__SPOOL_RESPONSES__ = [];
Sentry.init({
  dsn: globalThis.__DSN__,
  ...globalThis.__SDK_CONFIG__,
  tracesSampleRate: 1,
  traceLifecycle: 'static',
  replaysSessionSampleRate: 1,
  sendClientReports: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ minReplayDuration: 0, flushMinDelay: 60000, flushMaxDelay: 60000 }),
    Sentry.feedbackIntegration({ autoInject: false, enableScreenshot: false, showEmail: false, showName: false,
      onSubmitSuccess: () => { window.__SPOOL_FEEDBACK__ = true; },
      onSubmitError: error => { window.__SPOOL_FEEDBACK_ERROR__ = String(error); },
    }),
  ],
  beforeSend: event => {
    if (event.message?.startsWith('synthetic-spool-browser-discard ')) { window.__SPOOL_DISCARDS__++; return null; }
    return event;
  },
});
// Supply observed browser metadata through the SDK's public context door.
Sentry.setTag('tenant', 'acme');
const browserVersion = /Chrome\/([\d.]+)/.exec(navigator.userAgent)?.[1];
if (browserVersion) Sentry.setContext('browser', { name: 'Chrome', version: browserVersion });
Sentry.setContext('os', { name: navigator.userAgentData?.platform || navigator.platform });
Sentry.getClient().on('beforeEnvelope', envelope => {
  window.__SPOOL_SENT__.push(...envelope[1].map(item => item[0].type));
});
Sentry.getClient().on('afterSendEvent', (event, response) => window.__SPOOL_RESPONSES__.push({type:event.type??'event',status:response?.statusCode}));
window.openReportDialog = options => Sentry.showReportDialog(options);
window.sendFilterError = message => { Sentry.captureException(new Error(message)); return Sentry.flush(10000); };
window.sendFeedback = (message, associatedEventId) => {
  Sentry.captureFeedback({ message, associatedEventId, name: 'Private Feedback Name', email: 'feedback-private@example.com' });
  return Sentry.flush(10000);
};
window.qualifyHandled = async () => {
  Sentry.logger.info('synthetic-spool-browser-log', { step: 'checkout' });
  Sentry.startSpan({ name: 'synthetic-spool-browser-span', op: 'test' }, () => {});
  let eventId;
  try { throw new Error('synthetic-spool-browser-handled'); } catch (error) {
    eventId = Sentry.captureException(error, { attachments: [{ filename: 'synthetic-spool.txt', data: 'synthetic-spool-1' }] });
  }
  await Sentry.flush(10000);
  return eventId;
};
window.stopReplay = () => Sentry.getReplay().stop();
window.openFeedback = () => Sentry.getFeedback().createWidget();
window.queueDiscards = () => { for (let i = 0; i < 3; i++) Sentry.captureMessage('synthetic-spool-browser-discard ' + i); };
window.flushSDK = () => Sentry.flush(10000);
document.querySelector('button').onclick = () => setTimeout(function checkout() {
  const account = {};
  return account.address.city;
}, 0);
window.__SDK_READY__ = true;
