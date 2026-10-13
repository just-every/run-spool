import type { Plugin } from 'vite';
import { existsSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { applicationDocument, servicePath } from '../src/auth/document-path';

/** Hide private checkout paths before Vite's fs rejection; the Worker owns documents. */
export function documentBoundary(): Plugin {
 return {
  name: 'spool-document-boundary', enforce: 'pre',
  configureServer(server) {
   const root = resolve(server.config.root);
   const publicRoot = resolve(root, 'public');
   server.middlewares.use((request, response, next) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (applicationDocument(path) || servicePath(path)) return next();
    // The public docs are served by the Worker from the built Markdown, though /docs is also a checkout folder.
    if (/^\/docs(?:\/|$)/.test(path)) return next();
    // Vite owns these module/asset namespaces and applies its existing fs policy.
    if (/^\/(?:src\/|node_modules\/|@|__vite|assets\/)/.test(path)) return next();
    let decoded: string;
    try { decoded = decodeURIComponent(path); } catch { decoded = ''; }
    const checkout = resolve(root, '.' + decoded);
    const asset = resolve(publicRoot, '.' + decoded);
    if (decoded && !/[\\\0]/.test(decoded) && checkout.startsWith(root + sep)) {
     if (asset.startsWith(publicRoot + sep) && existsSync(asset) && statSync(asset).isFile()) return next();
     // A missing path must reach the Worker's real owner-session check and router.
     if (!existsSync(checkout)) return next();
    }
    response.statusCode = 404;
    response.setHeader('Cache-Control', 'no-store');
    response.end('Not found');
   });
  },
 };
}
