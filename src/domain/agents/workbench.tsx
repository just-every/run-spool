import { renderToStaticMarkup } from 'react-dom/server';
import { Wordmark } from '../../ui/Wordmark';
import { navigationDestinations } from '../../ui/workbench/navigationLinks';
import { hrefFor } from '../../ui/workbench/location';
import shellCss from '../../ui/workbench/shell.css?inline';
import { fontHead } from '../../base/font-head';
import { ownerSession } from '../../auth/session.server';
import { memberProjects, resolveMembership } from '../members/resolver';
import type { Bindings } from '../../auth/bindings';

/** Seed shell around the native agent door, retaining its auth, forms, CSP and scripts. */
export async function agentsWorkbench(request: Request, env: Bindings, response: Response, spend: string | null) {
  const session = await ownerSession(request, env, resolveMembership);
  if (!session || response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) return response;
  const projects = await memberProjects(env.DB, session), project = String(projects[0]?.id ?? '');
  const billing = session.membership?.role === 'billing';
  const manage = session.operator.role === 'owner' || session.membership?.role === 'admin' || projects[0]?.role === 'maintainer';
  const sidebar = renderToStaticMarkup(<aside className="sidebar" aria-label="Project navigation">
    <div className="sidebar-brand"><div className="brand"><Wordmark /><p className="brand-tagline">JavaScript errors, in context</p></div></div>
    <details className="agents-navigation" open><summary>Menu</summary><nav className="navigation" aria-label="Workbench">{navigationDestinations(billing, manage).map(([view,label]) => <a key={view} href={hrefFor(project,view)} className={view === 'settings' ? 'mark-bar' : undefined} aria-current={view === 'settings' ? 'page' : undefined}>{label}</a>)}</nav></details>
    <div className="team"><p>{session.operator.displayName}</p></div>
  </aside>);
  const summary = renderToStaticMarkup(<dl className="fields" data-paid-ai-summary><div><dt>Can agents use paid AI?</dt><dd>{spend === 'none' ? 'No' : spend === 'not_enforced' ? 'Yes — spend caps are not enforced by this app' : 'Not answered'}</dd></div></dl>);
  return new HTMLRewriter()
    .on('head', { element(element) { element.append(fontHead+'<link rel="stylesheet" href="/theme/spool.css">', {html:true}); } })
    .on('style', { element(element) { element.append(shellCss + '\n.agents-workbench .main{width:auto;max-width:none;margin:0;background:#fff;padding-top:0}.agents-workbench .sidebar a{display:flex}.agents-navigation summary{display:none}.agents-navigation:not([open])>.navigation{display:grid}.agents-workbench .sidebar .team{margin-top:auto}@media(max-width:760px){.agents-navigation summary{display:list-item;cursor:pointer;min-height:44px}.agents-navigation:not([open])>.navigation{display:none}.agents-workbench .sidebar .team{display:none}}', {html:true}); } })
    .on('script', { element(element) { element.append("{const menu=document.querySelector('.agents-navigation'),media=matchMedia('(max-width:760px)');if(menu){const update=()=>{menu.open=!media.matches};update();media.addEventListener('change',update)}}", {html:true}); } })
    .on('body', { element(element) { element.prepend('<div class="app workbench-shell agents-workbench">'+sidebar, {html:true}); element.append('</div>', {html:true}); } })
    .on('body > header', { element(element) { element.remove(); } })
    .on('main', { element(element) { element.setAttribute('class','main'); element.prepend('<div class="crumb">Your installation / Settings / Agents</div>', {html:true}); } })
    .on('#policy-title', { element(element) { element.after(summary,{html:true}); } })
    .transform(response);
}
