import type { Bindings } from '../../auth/bindings';
import { hash } from '../privacy';
import { mintAdmission } from '../dev-credentials';
import { readLoader } from '../loader/options';
import { installReportDialog } from './client';
import { reportDialogStyle } from './style';
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' };
const defaults = {
 title: 'Tell us what happened', subtitle: 'Help the application’s team understand this error.', labelComments: 'Description', labelSubmit: 'Send report', labelClose: 'Close report',
 errorFormEntry: 'Please enter a description.', errorGeneric: 'The report could not be sent. Please try again.', successMessage: 'Thank you. Your report was sent.',
};
export async function reportDialogResponse(request: Request, env: Bindings): Promise<Response | null> {
 const url = new URL(request.url);
 if (url.pathname !== '/api/embed/error-page/') return null;
 const missing = () => new Response(null, { status: 404, headers });
 if (!['GET', 'HEAD'].includes(request.method) || url.searchParams.getAll('dsn').length !== 1 || url.searchParams.getAll('eventId').length !== 1) return missing();
 const eventId = url.searchParams.get('eventId')!;
 if (!/^[a-fA-F0-9]{32}$/.test(eventId)) return missing();
 let dsn: URL;
 try { dsn = new URL(url.searchParams.get('dsn')!); } catch { return missing(); }
 if (dsn.origin !== url.origin || !['http:', 'https:'].includes(dsn.protocol) || dsn.password || dsn.search || dsn.hash || !/^\/[1-9][0-9]{0,15}$/.test(dsn.pathname) || !/^[a-f0-9]{64}$/.test(dsn.username)) return missing();
 const keyHash = await hash(dsn.username);
 const row = await env.DB.prepare(`SELECT credentials.project FROM credentials JOIN sentry_project_aliases a ON a.project=credentials.project WHERE credentials.hash=? AND credentials.kind='ingest' AND credentials.revoked IS NULL AND a.id=? AND ${await mintAdmission(request)}`).bind(keyHash, dsn.pathname.slice(1)).first<{ project: string }>();
 if (!row || !(await readLoader(env.DB, row.project, keyHash)).settings.enabled) return missing();
 const wording = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => { const value = url.searchParams.get(key); return [key, value?.trim() && value.length <= 240 ? value : fallback]; }));
 const endpoint = new URL(`/api${dsn.pathname}/envelope/`, url.origin);
 endpoint.search = new URLSearchParams({ sentry_key: dsn.username, sentry_version: '7' }).toString();
 // Name/email and all other options never enter the script or feedback payload.
 const config = { eventId: eventId.toLowerCase(), endpoint: endpoint.href, wording, style: reportDialogStyle };
 return new Response(request.method === 'HEAD' ? null : `;(${installReportDialog.toString()})(${JSON.stringify(config)});`, { headers: { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' } });
}
