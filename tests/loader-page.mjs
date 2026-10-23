// A synthetic site's real script-tag replacement fixture, on the existing second origin.
export function loaderPage(url, res, fixture) {
 if (url.pathname === '/loader-app.js') {
  res.setHeader('Content-Type', 'text/javascript');
  res.end(`function checkoutFailure(){return new Error('synthetic-spool-checkout')}
   document.getElementById('capture').onclick=()=>Sentry.captureException(checkoutFailure());
   document.getElementById('throw').onclick=()=>{throw new Error('synthetic-spool-auto')};`);
  return true;
 }
 if (url.pathname !== '/loader' || !fixture) return false;
 const mode = url.searchParams.get('mode'), config = { release: 'synthetic-spool-loader@1', dist: 'synthetic-spool-1' };
 const tag = mode === 'direct'
  ? `<script src="${fixture.origin}/spool-sentry-sdk.js" crossorigin="anonymous"></script>
     <script>window.Sentry=window.__SpoolSentrySDK;Sentry.init({dsn:${JSON.stringify(fixture.project.dsn)},...${JSON.stringify(config)}})</script>`
  : `<script src="${fixture.origin}/sdk/${fixture.key}.min.js" crossorigin="anonymous" ${mode === 'eager' ? 'data-lazy="no"' : ''}></script>
     <script>Sentry.onLoad(()=>{window.loaderReady=(window.loaderReady||0)+1;window.callbackDsn=Sentry.getClient().getOptions().dsn})</script>`;
 res.setHeader('Content-Type', 'text/html');
 res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Checkout</title>
  <h1>Checkout</h1><button id="capture">Capture checkout error</button><button id="throw">Throw checkout error</button>
  <script>window.sentryOnLoad=()=>{window.hookReady=(window.hookReady||0)+1;window.hookDsn=Sentry.getClient().getOptions().dsn;${mode === 'no-release' ? '' : `Sentry.init(${JSON.stringify(config)})`}}</script>
  ${tag}<script src="/loader-app.js"></script></html>`);
 return true;
}
