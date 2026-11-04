import { escapeHtml } from '../modules/operator-auth/http.mjs';

export type LocalSignInPerson = { email: string; displayName?: string; role: string };

/** The gate stays private; the public page explains how to obtain admission. */
export function localSignInContent(people: LocalSignInPerson[], returnTo: string): string {
 const choices = people.map(person => {
  const owner = person.role === 'owner';
  const destination = !owner && returnTo === '/setup' ? '/app' : returnTo;
  const href = `/auth/dev/enter?as=${encodeURIComponent(owner ? 'owner' : person.email)}&returnTo=${encodeURIComponent(destination)}`;
  return `<div><p>${escapeHtml(person.displayName || person.email)}${person.displayName ? ` · ${escapeHtml(person.email)}` : ''} · ${owner ? 'Owner' : 'Member'}</p><a class="primary-button" href="${escapeHtml(href)}">${owner ? 'Continue as owner' : `Continue as ${escapeHtml(person.email)}`}</a></div>`;
 }).join('');
 return `${choices ? `<div class="signin-providers">${choices}</div>` : '<p>Open the private <code>RER_OPEN</code> link printed by <code>rer dev</code> on this computer to choose an account.</p>'}<div class="help"><p>From this Spool project folder, run <code>rer dev --as owner</code> for the owner, or <code>rer dev --as &apos;your-invited-email@example.com&apos;</code> for an invited member. Open the new private <code>RER_OPEN</code> link it prints.</p><p>No sign-in email is sent in local development. Keep the printed link private.</p></div>`;
}
