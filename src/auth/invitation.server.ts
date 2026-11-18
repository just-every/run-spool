import { hashToken } from '../modules/operator-auth/crypto.mjs';
import { escapeHtml } from '../modules/operator-auth/http.mjs';
import type { Bindings } from './bindings';

export async function invitationPage(request: Request, env: Bindings, auth: { previewLink: (request: Request, token: string) => Promise<any> }, response: Response | null) {
 const url = new URL(request.url), token = url.searchParams.get('token');
 if (!response || url.pathname !== '/auth/confirm' || !['GET','HEAD'].includes(request.method) || response.status !== 200 || !token) return response;
 if ((await auth.previewLink(request, token))?.kind !== 'invite') return response;
 const digest = await hashToken(env.SESSION_SECRET, 'link', token);
 const context = await env.DB.prepare(`SELECT o.display_name inviter, g.name organization, m.role, m.id member
  FROM oa_tokens t JOIN oa_operators o ON o.id=t.issuer_id
  JOIN spool_members m ON m.operator_id=t.operator_id JOIN spool_organizations g ON g.id=m.organization
  WHERE t.token_hash=? AND t.kind='invite' AND m.state='active'`).bind(digest).first<{inviter:string;organization:string;role:string;member:string}>();
 if (!context) return response;
 const grants = (await env.DB.prepare('SELECT p.name,g.role FROM spool_project_grants g JOIN projects p ON p.id=g.project WHERE g.member=? ORDER BY p.name').bind(context.member).all<{name:string;role:string}>()).results;
 const role = (value:string) => ({'read-only':'Read only',maintainer:'Maintainer',member:'Member',admin:'Admin',billing:'Billing'}[value] ?? value);
 const description = `${context.inviter} at ${context.organization} invited you to join ${context.organization} as ${role(context.role)}.`;
 return new HTMLRewriter().on('main h1',{element(element){element.setInnerContent("You're invited");element.after(`<p>${escapeHtml(description)}</p>${grants.length?'<ul>'+grants.map(grant=>`<li>${escapeHtml(grant.name)} · ${escapeHtml(role(grant.role))}</li>`).join('')+'</ul>':''}`,{html:true});}})
  .on('button[type="submit"]',{element(element){element.setInnerContent('Join');}}).transform(response);
}
