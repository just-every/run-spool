import {createServer} from 'node:http';

/** This is only the external management service edge; no application/auth routes are mocked. */
export async function managementEdge() {
 const state = {allowed: '', denied: false};
 const server = createServer((request, response) => {
  if (new URL(request.url, 'http://127.0.0.1').pathname !== '/editor') {
   response.writeHead(404).end(); return;
  }
  response.setHeader('content-type', 'text/html');
  response.setHeader('content-security-policy', `frame-ancestors ${state.denied ? "'none'" : state.allowed}`);
  response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
html,body{margin:0;background:transparent;font:14px/1.45 system-ui;color:#182b48}
section{position:fixed;right:12px;bottom:84px;width:min(360px,calc(100vw - 24px));box-sizing:border-box;padding:16px;background:white;border:1px solid #aebbd0;border-radius:12px;box-shadow:0 3px 16px #10203030;max-height:calc(100dvh - 100px);overflow:auto}
h1{font-size:18px;margin:0 0 8px}p{margin:8px 0}label{display:grid;gap:4px;margin:10px 0}input,button{font:inherit;min-height:36px;box-sizing:border-box}input{width:100%}button{cursor:pointer}output{display:block;margin-top:10px;overflow-wrap:anywhere}
</style></head><body><section aria-label="Local management test edge">
<h1>Local management test edge</h1><p>Test-only provider. The host page and editor widget are the emitted Spool application.</p>
<button id="capture">Read page heading</button><label>Preview text<input id="text"></label>
<button id="apply" disabled>Preview text edit</button> <button id="undo" disabled>Undo preview</button>
<output role="status" data-status="waiting">Waiting for the host connection.</output>
</section><script>
const params = new URL(location.href).searchParams;
const origin = params.get('parentOrigin'), installationId = params.get('installation');
const panel = document.querySelector('section'), result = document.querySelector('output');
const input = document.querySelector('#text'), apply = document.querySelector('#apply'), undo = document.querySelector('#undo');
let sessionId, target, pagePath, revision = 0, open = false, reading = false;
const send = (type, values = {}) => parent.postMessage({...values,protocol:'rer-editor',version:1,installationId,type,...(sessionId?{sessionId}:{})}, origin);
const status = (value, message) => {result.dataset.status = value; result.textContent = message;};
function regions() {
 if (!sessionId) return;
 const {x,y,width,height} = panel.getBoundingClientRect();
 send('interactive-regions', {viewport:{width:innerWidth,height:innerHeight},regions:open?[{x,y,width,height}]:[]});
}
document.querySelector('#capture').onclick = () => {
 target = undefined; reading = true; apply.disabled = true; status('reading', 'Reading the visible host heading.');
 send('set-context-sharing', {enabled:true});
};
apply.onclick = () => {
 if (!target) return;
 revision++; status('applying', 'Applying the preview to the host page.');
 send('live-edits', {snapshot:{revision,edits:[{id:'acceptance-preview',revision,parentOrigin:origin,path:pagePath,target,change:{text:input.value}}]}});
};
undo.onclick = () => {status('undoing', 'Removing the preview.'); send('undo-live-edit', {id:'acceptance-preview',revision});};
addEventListener('message', event => {
 if(event.source !== parent || event.origin !== origin)return;
 const message = event.data;
 if (!message || message.protocol !== 'rer-editor' || message.version !== 1 || message.installationId !== installationId) return;
 if (message.type === 'protocol-offer') {sessionId = message.sessionId; target = undefined; apply.disabled = true; undo.disabled = true; send('protocol-accept'); return;}
 if (message.sessionId !== sessionId) return;
 if (message.type === 'protocol-connected') {
  status('connected', 'Connected to the native host.'); regions();
  // A host pathname change retires the old session; continue the user's pending read under the new grant.
  if (reading) send('set-context-sharing', {enabled:true});
 }
 if (message.type === 'editor-visibility') {open = message.open; regions();}
 if (message.type === 'context-sharing' && message.enabled && reading) {reading = false; send('capture-context');}
 if (message.type === 'page-context') {
  const heading = message.context.elements.find(element => element.tag === 'h1');
  if (!heading) {status('unavailable', 'No visible host heading is available.'); return;}
  const {text, ...identity} = heading; target = {...identity,beforeText:text}; pagePath = message.context.path;
  input.value = text; apply.disabled = false; status('captured', 'Heading read from ' + pagePath);
 }
 if (message.type === 'live-edit-result' && message.id === 'acceptance-preview' && message.revision === revision) {
  status(message.status, message.message); undo.disabled = message.status !== 'applied';
  if (message.status === 'undone') send('live-edits', {snapshot:{revision:++revision,edits:[],removedIds:['acceptance-preview']}});
 }
 if (message.type === 'context-unavailable' || message.type === 'live-edits-error') status('error', 'The native host refused the operation.');
});
addEventListener('resize', regions); new ResizeObserver(regions).observe(panel);
send('ready');
</script></body></html>`);
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 return {state, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve))};
}
