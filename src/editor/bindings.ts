import type { Bindings } from '../auth/bindings';

export type ManagedBindings = Bindings & {
 RER_MANAGEMENT_ORIGIN?: string;
 RER_INSTALLATION_ID?: string;
 RER_OWNER_CLAIM_ISSUER?: string;
 RER_OWNER_CLAIM_INSTALLATION_ID?: string;
 RER_OWNER_CLAIM_APP_ORIGIN?: string;
 RER_OWNER_CLAIM_PUBLIC_KEYS?: string;
 // `on` only on installs RER provisions for an approved Business plan.
 RER_IMPORT_DOOR?: string;
};
