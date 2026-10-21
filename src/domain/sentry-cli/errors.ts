import type { Context } from 'hono';

/** Sentry clients print `detail`; Spool's other doors answer `error`. Both carry the same sentence. */
export const cliError = (c: Context, status: number, detail: string) => c.json({ detail, error: detail }, status as any);

export class CliRefusal extends Error {
 constructor(readonly status: number, readonly detail: string) { super(detail); }
}
export const refuse = (status: number, detail: string): never => { throw new CliRefusal(status, detail); };
