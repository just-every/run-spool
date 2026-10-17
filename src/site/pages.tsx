import { renderToStaticMarkup } from 'react-dom/server';
import docs from 'virtual:spool-docs';
import { contractPageHtml } from '../base/contract-page';
import { runPageHtml, siteNotFoundHtml, type SiteBuild, type SiteContext } from '../base/run-site';
import { identity } from '../identity';
import { LandingPage } from '../ui/landing/Landing';
import { DocsPage } from '../ui/docs/DocsPage';
import { run } from './run';
import './site.css';

export function sitePages({ styles, contract }: SiteContext): SiteBuild {
 const styled = (html: string) => html.replace('</head>', styles.map(href => renderToStaticMarkup(<link rel="stylesheet" href={href} />)).join('') + '</head>');
 return {
  pages: [
   { path: '/', html: '<!doctype html>' + renderToStaticMarkup(<LandingPage repository={run.repository} variant="site" styles={styles} />) },
   { path: '/run', html: styled(runPageHtml(identity, run, contract)) },
   ...(contract ? [{ path: '/contract', html: styled(contractPageHtml(identity, run, contract)) }] : []),
   ...docs.pages.map(page => ({ path: page.href, html: '<!doctype html>' + renderToStaticMarkup(<DocsPage repository={run.repository} sections={docs.sections} page={page} pages={docs.pages} variant="site" styles={styles} />) })),
   { path: '/404', html: styled(siteNotFoundHtml(identity, run, contract)) },
  ],
  assets: ['rer-theme.css', 'brand', 'fonts', 'theme'],
 };
}
