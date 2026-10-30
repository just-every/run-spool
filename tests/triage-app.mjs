import {createServer} from 'node:http';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
// The synthetic Cedar Dispatch application runs as a minified module on a real
// second origin. Its actual thrown stack and generated map are the test inputs.
export async function startDispatchApp(config) {
 const source=`import { installBrowserCapture } from './errors-capture.js';
installBrowserCapture({ ...window.captureConfig, onOutcome(result) { window.captureOutcome = result; } });
function deliveryAddress(order) {
  return order.delivery.address;
}
document.querySelector('#dispatch').addEventListener('click', () => {
  document.querySelector('#address').textContent = deliveryAddress({ delivery: undefined });
});
function trackingUrl(shipment) { return shipment.tracking.url; }
document.querySelector('#track').addEventListener('click', () => { document.querySelector('#address').textContent = trackingUrl({ tracking: undefined }); });
`;
 const built=await build({stdin:{contents:source,sourcefile:'cedar-dispatch.js',resolveDir:process.cwd()},outfile:'dispatch.js',write:false,bundle:true,external:['./errors-capture.js'],sourcemap:'external',minify:true,format:'esm',platform:'browser'});
 const bundle=built.outputFiles.find(file=>file.path.endsWith('/dispatch.js')).text;
 const map=JSON.parse(built.outputFiles.find(file=>file.path.endsWith('.map')).text);
 const helper=await readFile('public/errors-capture.js');
 let current={...config};
 const server=createServer((request,response)=>{
  response.setHeader('Cache-Control','no-store');
  if(request.url==='/dispatch.js'){response.setHeader('Content-Type','text/javascript');response.end(bundle);return;}
  if(request.url==='/errors-capture.js'){response.setHeader('Content-Type','text/javascript');response.end(helper);return;}
  response.setHeader('Content-Type','text/html');
  response.end(`<!doctype html><html lang="en"><title>Cedar Dispatch</title><h1>Cedar Dispatch</h1><p>Order for North Market</p><button id="dispatch">Prepare delivery</button><button id="track">Track delivery</button><p id="address"></p><script>window.addEventListener('error',event=>{window.captureFailure={file:event.filename,line:event.lineno,column:event.colno-1};});window.captureConfig=${JSON.stringify(current).replaceAll('<','\\u003c')}</script><script type="module" src="/dispatch.js"></script></html>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {origin:`http://127.0.0.1:${server.address().port}`,map,originalLine:4,originalColumn:source.split('\n')[3].indexOf('address'),setRelease(release,build){current={...current,release,build};},async stop(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
