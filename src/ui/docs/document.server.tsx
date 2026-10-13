import { renderToStaticMarkup } from 'react-dom/server';
import site from 'virtual:spool-docs';
import { DocsPage } from './DocsPage';

const docsPath = /^\/docs(?:\/([a-z0-9-]+))?\/?$/;
export const isDocsRequest = (request: Request) => /^\/docs(\/|$)/.test(new URL(request.url).pathname);

const headers = {
  'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'strict-origin', 'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
};
const rendered = new Map<string, string>();
// Public for everyone, signed in or not: the pages hold only what the repository already publishes.
export function docsResponse(request: Request): Response {
  const match = new URL(request.url).pathname.match(docsPath);
  const page = match ? site.pages.find(candidate => candidate.slug === (match[1] ?? '')) : undefined;
  if (!page || !['GET', 'HEAD'].includes(request.method)) return new Response(page ? 'Method not allowed' : 'Not found', { status: page ? 405 : 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  let html = rendered.get(page.slug);
  if (html === undefined) rendered.set(page.slug, html = '<!doctype html>' + renderToStaticMarkup(<DocsPage repository={site.repository} sections={site.sections} page={page} pages={site.pages} />));
  return new Response(request.method === 'HEAD' ? null : html, { headers });
}
