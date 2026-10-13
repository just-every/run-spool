import { safeReturnTo } from '../modules/operator-auth/index.mjs';
import { localDevelopmentEnabled } from './local.server.mjs';
import type { Bindings } from './bindings';
import { operatorAuth } from './session.server.ts';
import { fontHead } from '../base/font-head.ts';
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
type SignInProvider = { label: string; startPath: string; authorizationOrigins?: string[] };
// A linked Auth install, once the owner turned its sign-in on, is offered above the email form.
export async function signInPage(request: Request, env: Bindings, result?: number): Promise<Response> {
 const providers = (await operatorAuth(env).providers?.list() ?? []).filter(p => p.visible);
 return signInDocument(request, env, result, providers);
}
export function signInDocument(request: Request, env: Bindings, result?: number, providers: SignInProvider[] = []): Response {
 const returnTo = safeReturnTo(new URL(request.url).searchParams.get('returnTo'), '/setup');
 const local = localDevelopmentEnabled(env) && env.MAIL_PROVIDER === 'development';
 const sent = result === 202;
 const continueWith = providers.map(p => `<form method="post" action="${escape(p.startPath)}"><input type="hidden" name="returnTo" value="${escape(returnTo)}"><button class="secondary-button" type="submit">Continue with ${escape(p.label)}</button></form>`).join('');
 // The start route redirects to the provider, so the form's target origins join form-action.
 const formTargets = [...new Set(providers.flatMap(p => p.authorizationOrigins ?? []))].map(origin => ' ' + origin).join('');
 const feedback = sent ? `<p role="status">If this is the owner email, a sign-in message has been requested. ${local ? 'Open the development outbox below.' : 'Check your inbox and spam folder.'}</p>` : result ? `<p role="alert">${result === 429 ? 'Too many sign-in requests. Wait before trying again.' : 'The sign-in request could not be completed. Check the email and try again.'}</p>` : '';
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Spool</title><link rel="icon" href="/theme/spool-mark.svg" type="image/svg+xml">${fontHead}<link rel="stylesheet" href="/theme/spool.css"><link rel="stylesheet" href="/theme/sign-in.css">
<main class="signin"><header class="signin-header"><a class="wordmark" href="/"><img src="/theme/spool-mark.svg" alt="" width="45" height="45">Spool</a></header><section class="signin-panel card"><h1><span class="mark-underline">Sign in to your installation</span></h1><p class="signin-intro">Open your issues and continue investigating. Enter your owner email, then open the sign-in message and confirm.</p>${feedback}${continueWith ? `<div class="signin-providers">${continueWith}<p class="signin-or">or</p></div>` : ''}<form method="post" action="/auth/magic-link?returnTo=${escape(encodeURIComponent(returnTo))}"><label class="form-field">Owner email<input type="email" name="email" autocomplete="email" required></label><input type="hidden" name="returnTo" value="${escape(returnTo)}"><button class="primary-button" type="submit">${sent ? 'Send another sign-in link' : 'Send sign-in link'}</button></form><div class="help">${local ? '<p><a href="/__dev/outbox">Open development outbox</a> to find sign-in messages saved on this computer.</p>' : '<p>Check your ordinary mailbox and spam folder. If a link has expired, enter your email above to request another.</p>'}<p>If you still cannot sign in, ask the person managing this installation to check its owner email and mail delivery settings.</p></div></section></main></html>`, {
  status: result && result !== 202 ? result : 200,
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'strict-origin',
   'x-content-type-options': 'nosniff', 'content-security-policy': `default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:; form-action 'self'${formTargets}; frame-ancestors 'none'; base-uri 'none'` },
 });
}
