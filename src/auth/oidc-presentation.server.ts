import { safeReturnTo } from '../modules/operator-auth/index.mjs';
import { readInput } from '../modules/operator-auth/input.mjs';

const notices = {
 'oidc-denied': 'Auth did not complete sign-in. Try again, or request an email sign-in link below.',
 'oidc-expired': 'This Auth sign-in attempt expired or could not be verified. Start again below.',
 'oidc-unavailable': 'Auth sign-in is unavailable right now. Try again, or request an email sign-in link below.',
};
export function oidcNotice(request: Request): string | undefined {
 const notice = new URL(request.url).searchParams.get('notice');
 return notice && Object.hasOwn(notices, notice) ? notices[notice as keyof typeof notices] : undefined;
}
function noticeFor(code: unknown): keyof typeof notices | undefined {
 if (code === 'oidc_provider_denied') return 'oidc-denied';
 if (code === 'oidc_invalid_correlation') return 'oidc-expired';
 if (typeof code === 'string' && (/^oidc_[a-z_]+$/.test(code) || code === 'provider_unlinked')) return 'oidc-unavailable';
}

// The copied dependency adapter does not forward branding.signInPath to OIDC.
// Use its structured transport to distinguish failures from successful return
// redirects, then render the product's browser presentation. Protocol validation,
// successful redirects, sessions, cookies and API responses stay native.
export async function linkedOidcPresentation(request: Request, handle: (request: Request) => Promise<Response | null>): Promise<Response | null> {
 const path = new URL(request.url).pathname;
 if (!/^\/auth\/oidc\/auth\/(start|callback)$/.test(path) || !/\btext\/html\b/.test(request.headers.get('accept') ?? '')) return handle(request);
 // Start failures can retain the bounded form's destination. Callback failures
 // expose no verified transaction destination; never trust callback query input.
 const destination = path.endsWith('/start') && request.method === 'POST'
  ? readInput(request.clone()).then(input => safeReturnTo(input.returnTo, '/setup'), () => '/setup')
  : Promise.resolve('/setup');
 const nativeHeaders = new Headers(request.headers);
 nativeHeaders.set('Accept', 'application/json');
 const [response, returnTo] = await Promise.all([handle(new Request(request, { headers: nativeHeaders })), destination]);
 if (!response) return response;
 let notice: keyof typeof notices | undefined;
 if (response.status >= 400 && response.headers.get('content-type')?.startsWith('application/json')) {
  const body = await response.clone().json() as { error?: unknown };
  notice = noticeFor(body.error);
 }
 if (!notice) return response;
 const headers = new Headers(response.headers);
 headers.set('Location', '/sign-in?' + new URLSearchParams({ notice, returnTo }));
 headers.set('Cache-Control', 'no-store');
 headers.delete('content-type');
 headers.delete('content-length');
 return new Response(null, { status: 303, headers });
}
