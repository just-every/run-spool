/** Serialized as a standalone classic script. Keep this function self-contained. */
export function installLoader(config: any) {
 const page = window as any, tag = document.currentScript as HTMLScriptElement | null;
 if (page.Sentry?.getClient?.() || page.Sentry?.__spoolLoader) return;
 const queue: any[] = [], callbacks: (() => void)[] = [];
 let loading = false, ready = false;
 const stub: any = page.Sentry = { __spoolLoader: true };
 const captureError = (event: ErrorEvent) => { queue.push({ error: event.error ?? new Error(event.message), unhandled: true }); load(); };
 const captureRejection = (event: PromiseRejectionEvent) => { queue.push({ error: event.reason, unhandled: true }); load(); };
 const invoke = (callback: () => void) => { try { callback(); } catch (error) { console.error('Spool loader callback failed', error); } };
 function load() {
  if (loading) return;
  loading = true;
  const script = document.createElement('script');
  script.src = config.bundle; script.crossOrigin = 'anonymous';
  script.onload = () => {
   const sdk = { ...page.__SpoolSentrySDK };
   const originalInit = sdk.init;
   sdk.init = (input: any = {}) => {
    const options = { ...input, dsn: config.dsn, tracesSampleRate: config.options.tracesSampleRate, replaysSessionSampleRate: config.options.replaysSessionSampleRate, replaysOnErrorSampleRate: config.options.replaysOnErrorSampleRate };
    const integrations = (defaults: any[]) => {
     const chosen = typeof input.integrations === 'function' ? input.integrations(defaults) : [...defaults, ...(input.integrations ?? [])];
     const add = (integration: any) => { if (!chosen.some((item: any) => item.name === integration.name)) chosen.push(integration); };
     if (config.options.tracesSampleRate > 0) add(sdk.browserTracingIntegration());
     if (config.options.replaysSessionSampleRate > 0 || config.options.replaysOnErrorSampleRate > 0) add(sdk.replayIntegration());
     if (config.options.feedback) add(sdk.feedbackIntegration({ enableScreenshot: false }));
     return chosen;
    };
    originalInit({ ...options, integrations });
   };
   window.removeEventListener('error', captureError);
   window.removeEventListener('unhandledrejection', captureRejection);
   page.Sentry = sdk;
   // Initialize before notifying callbacks, which can then supply release/dist.
   const initializations = queue.filter(item => item.method === 'init');
   sdk.init(initializations.at(-1)?.args[0]);
   ready = true;
   sdk.onLoad = (callback: () => void) => invoke(callback);
   sdk.forceLoad = () => {};
   if (typeof page.sentryOnLoad === 'function') { const callback = page.sentryOnLoad; page.sentryOnLoad = undefined; invoke(callback); }
   for (const callback of callbacks.splice(0)) invoke(callback);
   for (const item of queue.splice(0)) {
    if (item.unhandled) sdk.captureException(item.error, { mechanism: { handled: false, type: 'onerror' } });
    else if (item.method !== 'init') sdk[item.method](...item.args);
   }
  };
  script.onerror = () => console.error('Spool browser SDK could not load');
  (document.head ?? document.documentElement).appendChild(script);
 }
 stub.onLoad = (callback: () => void) => { if (ready) invoke(callback); else callbacks.push(callback); };
 stub.forceLoad = () => setTimeout(load);
 for (const method of ['init', 'addBreadcrumb', 'captureMessage', 'captureException', 'captureEvent', 'withScope', 'showReportDialog']) stub[method] = (...args: any[]) => {
  queue.push({ method, args });
  if (method.startsWith('capture') || method === 'showReportDialog') load();
 };
 window.addEventListener('error', captureError);
 window.addEventListener('unhandledrejection', captureRejection);
 if (tag?.dataset.lazy === 'no' || config.options.tracesSampleRate > 0 || config.options.replaysSessionSampleRate > 0 || config.options.replaysOnErrorSampleRate > 0 || config.options.feedback) setTimeout(load);
}
