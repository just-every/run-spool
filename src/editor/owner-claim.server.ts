import { createOwnerClaimHandler, OwnerClaimError } from '../modules/owner-claim/index.mjs';
import type { ManagedBindings } from './bindings';
import { ownerClaimConfig } from './owner-claim-config.server';

/** Only deployment configuration supplies claim authority; POST supplies the signed claim. */
export async function ownerClaimResponse(request: Request, env: ManagedBindings): Promise<Response> {
 try {
  const response = await createOwnerClaimHandler({
   db: env.DB,
   authConfig: { origin: env.AUTH_ORIGIN, local: env.AUTH_LOCAL === 'true',
    OWNER_EMAIL: env.OWNER_EMAIL, SESSION_SECRET: env.SESSION_SECRET, SETUP_TOKEN: env.SETUP_TOKEN,
    branding: { productName: 'Spool', accentColor: '#cb541f', signInPath: '/sign-in' } },
   clientIp: request => request.headers.get('CF-Connecting-IP') ?? '',
   ...ownerClaimConfig(env),
  })(request);
  return response ?? new Response('Not found', {status: 404});
 } catch (error) {
  return Response.json({error: error instanceof OwnerClaimError ? error.code : 'claim_unavailable'}, {
   status: error instanceof OwnerClaimError ? error.status : 503,
   headers: {'cache-control': 'no-store', 'referrer-policy': 'no-referrer'},
  });
 }
}
