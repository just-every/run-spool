export type Bindings = {
 ASSETS?: Fetcher;
 DB: D1Database; AUTH_ORIGIN: string; OWNER_EMAIL: string; SESSION_SECRET: string;
 SETUP_TOKEN?: string; AUTH_LOCAL?: string;
 // The optional Auth install this app links to (rer-setup.json IDENTITY_PROVIDER); empty keeps email links only.
 IDENTITY_PROVIDER?: string; MAIL_PROVIDER?: string; MAIL_FROM?: string;
 MAIL_API_KEY?: string; MAIL_ACCOUNT_ID?: string; RER_DEV_ORIGIN?: string;
 // Local runtimes only: the checkout's key gate and dev identity switch. Deploy refuses both.
 RER_DEV_KEY?: string; RER_DEV_IDENTITY?: string; RER_INSTALLATION_ID?: string; RER_MANAGEMENT_ORIGIN?: string;
 // The owner's GitHub App connection for fix branches (src/domain/fixes/connection.ts); absent means awaiting connection.
 GITHUB_CONNECTION?: string;
 RER_DEPLOY_SOURCE?: string; RER_DEPLOY_FINGERPRINT?: string; RER_VERSION?: { id: string };
};
export function runtimeBindings(env: Bindings): Bindings {
 return env.AUTH_LOCAL === 'true' && env.RER_DEV_ORIGIN ? { ...env, AUTH_ORIGIN: env.RER_DEV_ORIGIN } : env;
}
