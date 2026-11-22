import { normalizeEmail, safeReturnTo } from '../modules/operator-auth/index.mjs';
import { localDevelopmentEnabled } from './local.server.mjs';
import { devGate } from '../modules/operator-auth/dev-gate.mjs';
import type { Bindings } from './bindings';
import { fontHead } from '../base/font-head.ts';
import { oidcNotice } from './oidc-presentation.server.ts';
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
type SignInProvider = { label: string; startPath: string; authorizationOrigins?: string[] };
// A linked Auth install, once the owner turned its sign-in on, is offered above the email form.
export async function signInPage(request: Request, env: Bindings, result?: number, passkey = false): Promise<Response> {
 const { operatorAuth } = await import('./session.server.ts');
 const providers = (await operatorAuth(env).providers?.list() ?? []).filter(p => p.visible);
 const gate = localDevelopmentEnabled(env) && env.RER_DEV_IDENTITY !== 'off'
  ? devGate({ key: env.RER_DEV_KEY, origin: env.AUTH_ORIGIN, local: true }) : null;
 return signInDocument(request, env, result, providers, !!await gate?.admits(request), passkey);
}
export function signInDocument(request: Request, env: Bindings, result?: number, providers: SignInProvider[] = [], ownerGate = false, passkey = false): Response {
 // Use Base's email policy, as its shared login_hint sign-in page does.
 let email = '';
 try { email = normalizeEmail(new URL(request.url).searchParams.get('login_hint')); } catch {}
 const returnTo = safeReturnTo(new URL(request.url).searchParams.get('returnTo'), '/setup');
 const local = localDevelopmentEnabled(env);
 const mailOff = !local && env.MAIL_PROVIDER === 'none';
 const sent = result === 202;
 const notice = oidcNotice(request);
 const passkeyForm = passkey ? `<div class="signin-providers"><form data-passkey-sign-in hidden><input type="hidden" name="returnTo" value="${escape(returnTo)}"><button class="secondary-button" type="submit">Sign in with a passkey</button><p role="alert" hidden></p></form></div>` : '';
 const continueWith = providers.map(p => `<form method="post" action="${escape(p.startPath)}"><input type="hidden" name="returnTo" value="${escape(returnTo)}"><button class="secondary-button" type="submit">Continue with ${escape(p.label)}</button></form>`).join('');
 // The start route redirects to the provider, so the form's target origins join form-action.
 const formTargets = [...new Set(providers.flatMap(p => p.authorizationOrigins ?? []))].map(origin => ' ' + origin).join('');
 const feedback = sent ? `<p role="status">If this is the owner email, a sign-in message has been requested. Check your inbox and spam folder.</p>` : result ? `<p role="alert">${result === 429 ? 'Too many sign-in requests. Wait before trying again.' : result === 503 ? 'We could not send the sign-in email. Ask the person managing this installation to check its mail settings, then try again.' : 'The sign-in request could not be completed. Check the email and try again.'}</p>` : notice ? `<p role="alert">${escape(notice)}</p>` : '';
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Spool</title><link rel="icon" href="/theme/spool-mark.svg" type="image/svg+xml">${fontHead}<link rel="stylesheet" href="/theme/spool.css"><link rel="stylesheet" href="/theme/sign-in.css">${passkey ? '<script defer src="/local-passkey-sign-in.js"></script>' : ''}</head><body>
<main class="signin"><header class="signin-header"><a class="wordmark" href="/"><img src="/theme/spool-mark.svg" alt="" width="45" height="45"><span data-rer-name>Spool</span></a></header><section class="signin-panel card"><h1><span class="mark-underline">Sign in to your installation</span></h1><p class="signin-intro">Open your issues and continue investigating. ${local ? ownerGate ? 'This browser holds the local owner gate. Continuing signs you in as the owner, with access to every project.' : 'This copy runs on your computer and sends no sign-in email.' : mailOff ? 'Email is off for this installation. The deploying owner can sign in from the original checkout with rer signin, using the deployment credentials and its saved ownership record.' : 'Enter your owner email, then open the sign-in message and confirm.'}</p>${passkeyForm}${local && ownerGate ? `<a class="primary-button" href="/auth/dev/enter?as=owner&returnTo=${escape(encodeURIComponent(returnTo))}">Continue as owner</a>` : local ? '' : feedback}${local && !ownerGate ? '<div class="help"><h2>Are you the owner?</h2><p>In your <code>run-spool</code> folder, run <code>~/.local/bin/rer dev --as owner</code> in a terminal. Open the private sign-in link it prints on this computer to continue as the owner. Keep that link private.</p><h2>Were you invited?</h2><p>Open your own invitation link to sign in with your membership and project access. Ask the owner for a fresh invitation if your access has changed.</p><a class="text-button" href="/">Back to Spool</a></div>' : ''}${!local && !mailOff && continueWith ? `<div class="signin-providers">${continueWith}<p class="signin-or">or</p></div>` : ''}${local || mailOff ? '' : `<form method="post" action="/auth/magic-link?returnTo=${escape(encodeURIComponent(returnTo))}"><label class="form-field">Owner email<input type="email" name="email" autocomplete="email" value="${escape(email)}" maxlength="254" required></label><input type="hidden" name="returnTo" value="${escape(returnTo)}"><button class="primary-button" type="submit">${sent ? 'Send another sign-in link' : 'Send sign-in link'}</button></form><div class="help"><p>Check your ordinary mailbox and spam folder. If a link has expired, enter your email above to request another.</p><p>If you still cannot sign in, ask the person managing this installation to check its owner email and mail delivery settings.</p></div>`}</section></main></body></html>`, {
  status: result && result !== 202 ? result : 200,
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'strict-origin',
   'x-content-type-options': 'nosniff', 'content-security-policy': `default-src 'none'; ${passkey ? "script-src 'self'; connect-src 'self'; " : ''}style-src 'self'; font-src 'self'; img-src 'self' data:; form-action 'self'${formTargets}; frame-ancestors 'none'; base-uri 'none'` },
 });
}
