import { spoolTunnel, type TunnelOptions } from './tunnel.ts';

/**
 * Drop-in Next.js route handler for the Sentry SDK's `tunnel` option, replacing the `tunnelRoute` rewrite
 * (which only targets Sentry's hosted ingest). In `app/monitoring/route.ts`:
 *
 *   export const { POST } = spoolTunnelRoute({ dsn: process.env.SPOOL_DSN! });
 */
export function spoolTunnelRoute(options: TunnelOptions): { POST: (request: Request) => Promise<Response> } {
  return { POST: spoolTunnel(options) };
}

export type { TunnelOptions };
