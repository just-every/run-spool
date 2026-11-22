import {
 generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
 type AuthenticationResponseJSON, type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { AuthError, safeReturnTo } from '../../modules/operator-auth/index.mjs';
import { devGate, devNotFound } from '../../modules/operator-auth/dev-gate.mjs';
import { requireOrigin, requirePost, securityHeaders } from '../../modules/operator-auth/http.mjs';
import { readInput } from '../../modules/operator-auth/input.mjs';
import { authConfig, ownerSession } from '../session.server';
import type { Bindings } from '../bindings';
import { challengeCookie, clearChallenge, readChallenge } from './challenge.server';
import { enrolledPasskey, passkeySession, savePasskey } from './store.server';

export const passkeyPath = '/auth/local/passkey';

// The localhost rule follows Uptime's WebAuthn origin rule. This door lives
// only in the local Worker entry.
export function localPasskeysEnabled(env: Bindings) {
 return env.RER_DEMO !== '1' && env.RER_DEV_IDENTITY !== 'off' &&
  /^http:\/\/localhost:\d+$/.test(env.AUTH_ORIGIN) &&
  !!devGate({ key: env.RER_DEV_KEY, origin: env.AUTH_ORIGIN, local: env.AUTH_LOCAL === 'true' });
}

export async function localPasskeyResponse(request: Request, env: Bindings) {
 if (!localPasskeysEnabled(env) || request.headers.has('authorization')) return devNotFound();
 const config = authConfig(env), headers = new Headers(securityHeaders());
 const reply = (value: unknown, status = 200) => Response.json(value, { status, headers });
 try {
  requireOrigin(request, config);
  const action = new URL(request.url).pathname.slice(passkeyPath.length);
  const rpID = new URL(env.AUTH_ORIGIN).hostname;
  if (action === '/sign-in' || action === '/verify') {
   requirePost(request, config);
   const key = await enrolledPasskey(env);
   if (!key) return devNotFound();
   if (action === '/sign-in') {
    const issued = Date.now();
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: [{ id: key.credential_id }] });
    headers.append('set-cookie', await challengeCookie(env, 'sign-in', '', { challenge: options.challenge, issued }));
    return reply(options);
   }
   headers.append('set-cookie', clearChallenge(env, 'sign-in'));
   const { challenge, issued } = await readChallenge(request, env, 'sign-in', '');
   const input = await readInput(request);
   const response = input.credential as AuthenticationResponseJSON;
   let verification;
   try {
    verification = await verifyAuthenticationResponse({ response, expectedChallenge: challenge, expectedOrigin: env.AUTH_ORIGIN,
     expectedRPID: rpID, requireUserVerification: true,
     credential: { id: key.credential_id, publicKey: Uint8Array.from(atob(key.public_key), value => value.charCodeAt(0)), counter: key.counter } });
   } catch { throw new AuthError('invalid_passkey', 400); }
   if (!verification.verified) throw new AuthError('invalid_passkey', 400);
   for (const cookie of await passkeySession(env, key, issued, verification.authenticationInfo.newCounter)) headers.append('set-cookie', cookie);
   return reply({ location: safeReturnTo(input.returnTo, '/setup') });
  }

  const session = await ownerSession(request, env);
  if (session?.operator.role !== 'owner') return devNotFound();
  if (action === '' && request.method === 'GET') return reply({ enrolled: !!await enrolledPasskey(env, session.operator.id) });
  requirePost(request, config);
  if (action === '/remove') {
   await savePasskey(request, env, session, 0, null);
   return reply({ enrolled: false });
  }
  if (action === '/register') {
   if (await enrolledPasskey(env, session.operator.id)) throw new AuthError('passkey_already_enrolled', 409);
   const issued = Date.now();
   const options = await generateRegistrationOptions({ rpName: 'Spool', rpID, userID: new TextEncoder().encode(session.operator.id),
    userName: session.operator.email, attestationType: 'none', authenticatorSelection: { userVerification: 'required' },
    supportedAlgorithmIDs: [-7, -257] });
   headers.append('set-cookie', await challengeCookie(env, 'register', session.id, { challenge: options.challenge, issued }));
   return reply(options);
  }
  if (action !== '/confirm') return devNotFound();
  headers.append('set-cookie', clearChallenge(env, 'register'));
  const { challenge, issued } = await readChallenge(request, env, 'register', session.id);
  const input = await readInput(request);
  let verification;
  try {
   verification = await verifyRegistrationResponse({ response: input.credential as RegistrationResponseJSON,
    expectedChallenge: challenge, expectedOrigin: env.AUTH_ORIGIN, expectedRPID: rpID, requireUserVerification: true });
  } catch { throw new AuthError('invalid_passkey', 400); }
  if (!verification.verified) throw new AuthError('invalid_passkey', 400);
  await savePasskey(request, env, session, issued, verification.registrationInfo.credential);
  return reply({ enrolled: true });
 } catch (error) {
  if (error instanceof AuthError) return reply({ error: error.code }, error.status);
  throw error;
 }
}
