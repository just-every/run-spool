import { configureClaim } from '../modules/owner-claim/verify.mjs';
import type { ManagedBindings } from './bindings';

/** Shared deployment-owned trust for first-owner admission and Business grants. */
export function ownerClaimConfig(env: ManagedBindings) {
 return configureClaim({
  issuer: env.RER_OWNER_CLAIM_ISSUER!,
  installationId: env.RER_OWNER_CLAIM_INSTALLATION_ID!,
  appOrigin: env.RER_DEMO === '1' ? env.AUTH_ORIGIN : env.RER_OWNER_CLAIM_APP_ORIGIN!,
  expectedEmail: env.OWNER_EMAIL,
  publicKeys: JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS ?? 'null'),
 });
}
