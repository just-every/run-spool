import { renderToStaticMarkup } from 'react-dom/server';
import { repository } from 'virtual:spool-docs';
import { LandingPage } from './Landing';

export const isLandingRequest = (request: Request) => new URL(request.url).pathname === '/' && ['GET', 'HEAD'].includes(request.method);

let page: string | undefined;
// Visitors without an owner session; owners keep the workbench at the same path.
export function landingResponse(request: Request): Response {
  page ??= '<!doctype html>' + renderToStaticMarkup(<LandingPage repository={repository} />);
  return new Response(request.method === 'HEAD' ? null : page, { headers: {
    'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', vary: 'Cookie', 'referrer-policy': 'strict-origin', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
  } });
}
