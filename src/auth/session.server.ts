import { AuthError, createOperatorAuth, createAuthHandler, securityHeaders } from '../modules/operator-auth/index.mjs';
import { readInput } from '../modules/operator-auth/input.mjs';
import { createDependencies } from '../modules/dependencies/index.mjs';
import { createIdpOwnerClaimHandler } from '../modules/owner-claim/idp.mjs';
import { operatorMail } from './mail.server.mjs';
import type { Bindings } from './bindings';
import { successorConfirmation } from '../domain/erasure/owner-transfer.ts';
export function authConfig(env: Bindings) {
 return { origin: env.AUTH_ORIGIN, OWNER_EMAIL: env.OWNER_EMAIL, SESSION_SECRET: env.SESSION_SECRET,
  SETUP_TOKEN: env.SETUP_TOKEN, MAIL_FROM: env.MAIL_FROM, local: env.AUTH_LOCAL === 'true', dependencies: true,
  branding: { productName: 'Spool', accentColor: '#1C1C1B', signInPath: '/sign-in' } };
}
export function operatorAuth(env: Bindings) {
 return createOperatorAuth({ db: env.DB, config: authConfig(env),
  rolePolicy: ({ actor, action }) => actor.role === 'owner' && ['operators:list', 'sessions:list', 'sessions:revoke'].includes(action),
  mailSender: operatorMail(env), clientIp: request => request.headers.get('CF-Connecting-IP') ?? '',
 });
}
export async function ownerSession(request: Request, env: Bindings) {
 const session = await operatorAuth(env).getSession(request);
 return session?.operator.role === 'owner' ? session : null;
}
export async function authResponse(request: Request, env: Bindings) {
 const successor = await successorConfirmation(request, env); if (successor) return successor;
 // Spool renders its own form feedback from the structured auth result. Parse
 // native forms with Base's bounded input reader, then use its JSON transport.
 if (new URL(request.url).pathname === '/auth/magic-link' && request.method === 'POST'
  && request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === 'application/x-www-form-urlencoded') {
  try {
   const input = await readInput(request);
   const headers = new Headers(request.headers);
   headers.set('content-type', 'application/json');
   headers.delete('content-length');
   request = new Request(request.url, { method: request.method, headers, body: JSON.stringify(input) });
  } catch (error) {
   if (error instanceof AuthError) return Response.json({ error: error.code }, { status: error.status, headers: securityHeaders() });
   throw error;
  }
 }
 const auth = operatorAuth(env);
 // The optional oidc-provider@1 link: well-known document, link keys and callback,
 // app-local approvals, and an IdP owner claim used only inside link redemption
 // (the public /auth/owner-claim route stays the signed managed claim).
 const config = authConfig(env), clientIp = () => request.headers.get('CF-Connecting-IP') ?? '';
 const claimOwner = (token: string) => createIdpOwnerClaimHandler({ db: env.DB, authConfig: config, clientIp, expectedPin: undefined })(new Request(config.origin + '/auth/owner-claim', { method: 'POST', headers: { Host: new URL(config.origin).host, Origin: config.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }));
 const linked = await createDependencies({ db: env.DB, origin: config.origin, name: 'Spool', provider: env.IDENTITY_PROVIDER || undefined, local: config.local, auth, claimOwner }).handle(request);
 return linked ?? createAuthHandler(auth)(request);
}
export function ownerWrite(request: Request, env: Bindings) {
 const url = new URL(request.url);
 return url.origin === env.AUTH_ORIGIN && (!request.headers.has('host') || request.headers.get('host') === url.host) &&
  request.headers.get('origin') === env.AUTH_ORIGIN && request.headers.get('sec-fetch-site') !== 'cross-site';
}
