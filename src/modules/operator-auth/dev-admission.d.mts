/** A verified native witness; absent on one-click and owner shortcuts. */
export type DevCredential = { type: 'session'; id: string; operatorId: string } | { type: 'invite'; digest: string };
/** Registers local admission. Only the local-only dev layer calls it. */
export function registerDevAdmission(check: ((request: Request, credential?: DevCredential) => boolean | Promise<boolean>) | null | undefined): void;
/** False without a registered local check or when it throws. */
export function devAdmitted(request: Request, credential?: DevCredential): Promise<boolean>;
