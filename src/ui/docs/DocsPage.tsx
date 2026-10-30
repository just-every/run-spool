import type { DocsPage as Page, DocsSection } from '../../../vite/docs/site';
import { SiteHeader } from '../landing/SiteHeader';
import { Footer } from '../landing/Footer';
import { PublicHead } from '../landing/PublicHead';

function DocsNav({ sections, current, label, contract }: { sections: DocsSection[]; current: string; label: string; contract?: boolean }) {
  return <nav className="docs-nav" aria-label={label}>{sections.map(section => <div key={section.title}>
    <p className="docs-nav-title">{section.title}</p>
    <ul>{section.pages.map(page => <li key={page.slug}><a href={page.href} className={page.slug === current ? 'mark-bar' : undefined} aria-current={page.slug === current ? 'page' : undefined}>{page.label}</a></li>)}</ul>
  </div>)}{contract && <div><ul><li><a href="/contract">Contract</a></li></ul></div>}</nav>;
}

/** One docs page: the landing's header and footer around a page rendered at build time from the repository's Markdown. */
export function DocsPage({ repository, sections, page, pages, variant, styles }: { repository: string; sections: DocsSection[]; page: Page; pages: Page[]; variant?: 'site'; styles?: string[] }) {
  const listed = pages.filter(candidate => !candidate.unlisted);
  const index = listed.indexOf(page), previous = listed[index - 1], next = index >= 0 ? listed[index + 1] : undefined;
  return <html lang="en">
    <PublicHead title={page.slug ? `${page.title} · Spool docs` : 'Spool docs'} description={page.description} stylesheet="/theme/docs.css" styles={styles} />
    <body className="landing docs">
      <div className="landing-page"><SiteHeader repository={repository} current="docs" thread variant={variant} /></div>
      <div className="docs-layout">
        <details className="docs-menu"><summary>Docs pages</summary><DocsNav sections={sections} current={page.slug} label="Docs pages" contract={variant === 'site'} /></details>
        <aside className="docs-sidebar"><DocsNav sections={sections} current={page.slug} label="Docs" contract={variant === 'site'} /></aside>
        <main className="docs-main">
          <article className="docs-article" data-doc={page.slug} aria-labelledby="docs-title">
            <p className="docs-eyebrow">{page.section}</p>
            <h1 id="docs-title">{page.title}</h1>
            <div className="prose" dangerouslySetInnerHTML={{ __html: page.html }} />
          </article>
          <div className="docs-foot">
            <nav className="docs-pager" aria-label="Previous and next">
              {previous ? <a href={previous.href} className="previous" rel="prev"><span aria-hidden="true">←</span> Previous<span className="visually-hidden">: {previous.label}</span></a> : <span />}
              {next && <a href={next.href} className="next" rel="next">Next<span className="visually-hidden">: {next.label}</span> <span aria-hidden="true">→</span></a>}
            </nav>
            <p className="docs-source"><a href={`${repository}/blob/main/${page.source}`}>View this page’s Markdown on GitHub</a></p>
          </div>
        </main>
      </div>
      <Footer repository={repository} variant={variant} />
    </body>
  </html>;
}
