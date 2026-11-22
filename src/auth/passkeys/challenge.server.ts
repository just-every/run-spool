import { constantEqual, hashToken, validToken } from '../../modules/operator-auth/crypto.mjs';
import { localCookieName, sessionCookie } from '../../modules/operator-auth/http.mjs';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import type { Bindings } from '../bindings';

const lifetime = 120;
type Flow = 'register' | 'sign-in';
type Challenge = { challenge: string; issued: number };

function config(env: Bindings, flow: Flow) {
 return { cookieName: localCookieName(`spool_passkey_${flow}`, env.AUTH_ORIGIN), secure: false };
}

function signature(env: Bindings, flow: Flow, sessionId: string, value: string) {
 return hashToken(env.SESSION_SECRET, 'spool-local-passkey-challenge',
  JSON.stringify([env.AUTH_ORIGIN, flow, sessionId, value]));
}

export async function challengeCookie(env: Bindings, flow: Flow, sessionId: string, { challenge, issued }: Challenge) {
 const value = `${issued}.${challenge}`;
 return sessionCookie(`${value}.${await signature(env, flow, sessionId, value)}`, config(env, flow), lifetime);
}

export function clearChallenge(env: Bindings, flow: Flow) {
 return sessionCookie('', config(env, flow), 0);
}

export async function readChallenge(request: Request, env: Bindings, flow: Flow, sessionId: string): Promise<Challenge> {
 const prefix = config(env, flow).cookieName + '=';
 const cookies = (request.headers.get('cookie') ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(prefix));
 const [issuedText, challenge, mac, extra] = cookies.length === 1 ? cookies[0].slice(prefix.length).split('.') : [];
 const issued = Number(issuedText), now = Date.now();
 if (!Number.isSafeInteger(issued) || issued > now || now - issued >= lifetime * 1000 || !validToken(challenge) ||
     !mac || extra !== undefined || !constantEqual(mac, await signature(env, flow, sessionId, `${issuedText}.${challenge}`))) {
  throw new AuthError('invalid_passkey_challenge', 400);
 }
 return { challenge, issued };
}
