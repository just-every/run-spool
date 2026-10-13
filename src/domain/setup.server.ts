import type { Bindings } from '../auth/bindings';
import { claimedWhen } from '../base/setup-state';

export const setupClaimed = claimedWhen('SELECT 1 FROM projects LIMIT 1');

// Called only for documents, after the native owner-session check. The database
// is authoritative after creation, restore, restart, and an empty reset.
export async function setupDocumentResponse(request: Request, env: Pick<Bindings, 'DB'>): Promise<Response | null> {
 const complete = await setupClaimed(env.DB);
 const atSetup = new URL(request.url).pathname === '/setup';
 if (complete !== atSetup) return null;
 return new Response(null, { status: 303, headers: {
  Location: complete ? '/' : '/setup', 'Cache-Control': 'no-store',
 } });
}
