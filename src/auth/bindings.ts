import { demoEnvironment } from '../demo/environment';
export type Bindings = {
 RER_BUSINESS_TRUST?: string;
 RER_OWNER_CLAIM_ISSUER?: string; RER_OWNER_CLAIM_INSTALLATION_ID?: string;
 RER_OWNER_CLAIM_APP_ORIGIN?: string; RER_OWNER_CLAIM_PUBLIC_KEYS?: string;
 ASSETS?: Fetcher;
 DB: D1Database; AUTH_ORIGIN: string; OWNER_EMAIL: string; SESSION_SECRET: string;
 SETUP_TOKEN?: string; AUTH_LOCAL?: string; RER_DEMO?: string;
 // The optional Auth install this app links to (rer-setup.json IDENTITY_PROVIDER); empty keeps email links only.
 IDENTITY_PROVIDER?: string; MAIL_PROVIDER?: string; MAIL_FROM?: string;
 MAIL_API_KEY?: string; MAIL_ACCOUNT_ID?: string; MAIL_RELAY_URL?: string; RER_DEV_ORIGIN?: string;
 // Local runtimes only: the checkout's key gate and dev identity switch. Deploy refuses both.
 RER_DEV_KEY?: string; RER_DEV_IDENTITY?: string; RER_INSTALLATION_ID?: string; RER_MANAGEMENT_ORIGIN?: string;
 // The owner's GitHub App connection for fix branches (src/domain/fixes/connection.ts); absent means awaiting connection.
 GITHUB_CONNECTION?: string;
 RER_DEPLOY_SOURCE?: string; RER_DEPLOY_FINGERPRINT?: string; RER_VERSION?: { id: string };
};
export function runtimeBindings(env: Bindings): Bindings {
 return demoEnvironment(env.AUTH_LOCAL === 'true' && env.RER_DEV_ORIGIN ? { ...env, AUTH_ORIGIN: env.RER_DEV_ORIGIN } : env);
}
